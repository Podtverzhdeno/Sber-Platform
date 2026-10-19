"""Messaging workspace acceptance scenarios."""

from uuid import UUID, uuid5

from fastapi.testclient import TestClient
from pydantic import SecretStr

from impulse.application.messaging import (
    ChannelWorkContext,
    MemoryMessagingStore,
    MessagingService,
    TaskChannelContext,
    TaskChannelSource,
)
from impulse.bootstrap.app import create_app
from impulse.bootstrap.settings import AppEnvironment, Settings

PERSONA_NAMESPACE = UUID("6c3775de-88fa-4d98-a584-cf7820422d54")
ALEX = uuid5(PERSONA_NAMESPACE, "v1:participant-alex")
ELENA = uuid5(PERSONA_NAMESPACE, "v1:mentor-elena")
ROMAN = uuid5(PERSONA_NAMESPACE, "v1:customer-roman")
TASK_ID = UUID("30000000-0000-0000-0000-000000000003")


class FakeTaskChannels:
    """Deterministic stand-in for WorkTaskChannelSource."""

    def __init__(
        self,
        by_person: dict[UUID, tuple[TaskChannelContext, ...]],
        senders: dict[UUID, set[UUID]],
    ) -> None:
        self.by_person = by_person
        self.senders = senders

    async def channels_for(self, person_id: UUID) -> tuple[TaskChannelContext, ...]:
        return self.by_person.get(person_id, ())

    async def can_send(self, person_id: UUID, task_id: UUID) -> bool:
        return person_id in self.senders.get(task_id, set())

    async def work_context(self, task_id: UUID) -> ChannelWorkContext | None:
        # Task work context is outside the scenarios covered by this test module.
        del task_id
        return None


def build(
    *, task_channels: TaskChannelSource | None = None
) -> tuple[TestClient, MemoryMessagingStore]:
    store = MemoryMessagingStore()
    service = MessagingService(store, task_channels=task_channels)
    api = TestClient(
        create_app(
            Settings(
                app_env=AppEnvironment.TEST,
                demo_mode=True,
                session_secret=SecretStr("messaging-test-secret-long-enough"),
            ),
            messaging_service=service,
        )
    )
    return api, store


def login(client: TestClient, persona: str) -> str:
    response = client.post("/api/v1/auth/demo-login", json={"persona_key": persona})
    assert response.status_code == 200
    return response.json()["csrf_token"]


def test_personal_dialog_send_read_and_mute_flow() -> None:
    api, _store = build()
    alex_csrf = login(api, "participant-alex")
    opened = api.post(
        "/api/v1/me/messaging/channels/personal",
        json={"peer_id": str(ELENA)},
        headers={"X-CSRF-Token": alex_csrf},
    )
    assert opened.status_code == 200
    dialog = opened.json()
    assert dialog["kind"] == "personal"
    assert dialog["role"] == "member"
    assert dialog["sender_enabled"] is True

    posted = api.post(
        f"/api/v1/me/messaging/channels/{dialog['id']}/messages",
        json={"body": "Елена, готов обсуждать приоритеты."},
        headers={"X-CSRF-Token": alex_csrf},
    )
    assert posted.status_code == 200
    message = posted.json()
    assert message["author_id"] == str(ALEX)
    assert message["kind"] == "text"
    assert message["sequence"] == 1

    elena_csrf = login(api, "mentor-elena")
    elena_channels = api.get("/api/v1/me/messaging/channels").json()
    matching = [item for item in elena_channels if item["id"] == dialog["id"]]
    assert len(matching) == 1
    assert matching[0]["unread"] == 1

    history = api.get(f"/api/v1/me/messaging/channels/{dialog['id']}/messages").json()
    assert [item["body"] for item in history] == ["Елена, готов обсуждать приоритеты."]

    read = api.post(
        f"/api/v1/me/messaging/channels/{dialog['id']}/read",
        json={"message_id": message["id"]},
        headers={"X-CSRF-Token": elena_csrf},
    )
    assert read.status_code == 200
    assert read.json()["unread"] == 0

    muted = api.post(
        f"/api/v1/me/messaging/channels/{dialog['id']}/mute",
        json={"muted": True},
        headers={"X-CSRF-Token": elena_csrf},
    )
    assert muted.status_code == 200
    assert muted.json()["muted"] is True


def test_self_dialog_is_rejected() -> None:
    api, _store = build()
    csrf = login(api, "participant-alex")
    response = api.post(
        "/api/v1/me/messaging/channels/personal",
        json={"peer_id": str(ALEX)},
        headers={"X-CSRF-Token": csrf},
    )
    assert response.status_code == 422
    assert response.json()["code"] == "MESSAGE_PEER_INVALID"


def test_task_channel_visibility_and_revocation() -> None:
    context = TaskChannelContext(
        TASK_ID,
        "Прототип рекомендательной системы",
        ROMAN,
        (ELENA,),
        (ALEX,),
    )
    task_channels = FakeTaskChannels(
        {ALEX: (context,), ROMAN: (context,), ELENA: (context,)},
        {TASK_ID: {ALEX, ROMAN, ELENA}},
    )
    api, _store = build(task_channels=task_channels)
    alex_csrf = login(api, "participant-alex")

    channels = api.get("/api/v1/me/messaging/channels").json()
    assert [item["kind"] for item in channels] == ["task_team"]
    channel = channels[0]
    assert channel["role"] == "member"
    assert channel["title"] == "Прототип рекомендательной системы"
    assert channel["last_message"]["kind"] == "system"
    assert channel["last_message"]["author_name"] is None
    participant_names = {item["display_name"]: item["role"] for item in channel["participants"]}
    assert participant_names["Елена Наставник"] == "mentor"
    assert participant_names["Алекс Речной"] == "member"
    assert participant_names["Роман Заказчик"] == "customer"

    posted = api.post(
        f"/api/v1/me/messaging/channels/{channel['id']}/messages",
        json={"body": "Выложил промежуточный результат.", "artifact_refs": ["repository"]},
        headers={"X-CSRF-Token": alex_csrf},
    )
    assert posted.status_code == 200
    assert posted.json()["artifact_refs"] == ["repository"]
    assert posted.json()["author_name"] == "Алекс Речной"

    elena_csrf = login(api, "mentor-elena")
    del elena_csrf
    elena_channels = api.get("/api/v1/me/messaging/channels").json()
    assert elena_channels[0]["role"] == "mentor"
    assert elena_channels[0]["unread"] == 1

    # Participant without assignment has no channels; another's channel stays hidden (404).
    stranger_csrf = login(api, "hr-nina")
    del stranger_csrf
    stranger_channels = api.get("/api/v1/me/messaging/channels").json()
    assert stranger_channels == []
    hidden = api.get(f"/api/v1/me/messaging/channels/{channel['id']}/messages")
    assert hidden.status_code == 404
    assert hidden.json()["code"] == "RESOURCE_NOT_FOUND"

    # Losing send access blocks sending but keeps history readable (fresh alex session).
    task_channels.by_person[ALEX] = (
        TaskChannelContext(TASK_ID, "Прототип рекомендательной системы", ROMAN, (ELENA,), ()),
    )
    task_channels.senders[TASK_ID].discard(ALEX)
    alex_csrf = login(api, "participant-alex")
    read_only = api.post(
        f"/api/v1/me/messaging/channels/{channel['id']}/messages",
        json={"body": "Попытка после вывода из команды"},
        headers={"X-CSRF-Token": alex_csrf},
    )
    assert read_only.status_code == 403
    assert read_only.json()["code"] == "MESSAGING_READ_ONLY"
    refreshed = api.get("/api/v1/me/messaging/channels").json()
    assert refreshed[0]["sender_enabled"] is False
    still_visible = api.get(f"/api/v1/me/messaging/channels/{channel['id']}/messages")
    assert still_visible.status_code == 200
    posted_bodies = [item["body"] for item in still_visible.json()]
    assert "Выложил промежуточный результат." in posted_bodies


def test_message_validation_codes() -> None:
    api, _store = build()
    csrf = login(api, "participant-alex")
    dialog = api.post(
        "/api/v1/me/messaging/channels/personal",
        json={"peer_id": str(ELENA)},
        headers={"X-CSRF-Token": csrf},
    ).json()
    channel_id = dialog["id"]
    base = f"/api/v1/me/messaging/channels/{channel_id}/messages"

    empty = api.post(base, json={"body": "   "}, headers={"X-CSRF-Token": csrf})
    assert empty.status_code == 422
    assert empty.json()["code"] == "MESSAGE_BODY_REQUIRED"

    too_long = api.post(
        base,
        json={"body": "x" * 4001},
        headers={"X-CSRF-Token": csrf},
    )
    assert too_long.status_code == 422
    assert too_long.json()["code"] == "MESSAGE_BODY_TOO_LONG"

    too_many_refs = api.post(
        base,
        json={"body": "ok", "artifact_refs": [str(index) for index in range(7)]},
        headers={"X-CSRF-Token": csrf},
    )
    assert too_many_refs.status_code == 422
    assert too_many_refs.json()["code"] == "MESSAGE_ARTIFACTS_INVALID"


def test_history_pagination_is_ascending() -> None:
    api, _store = build()
    csrf = login(api, "participant-alex")
    dialog = api.post(
        "/api/v1/me/messaging/channels/personal",
        json={"peer_id": str(ELENA)},
        headers={"X-CSRF-Token": csrf},
    ).json()
    base = f"/api/v1/me/messaging/channels/{dialog['id']}/messages"
    for index in range(1, 4):
        posted = api.post(
            base,
            json={"body": f"сообщение {index}"},
            headers={"X-CSRF-Token": csrf},
        )
        assert posted.status_code == 200
        assert posted.json()["sequence"] == index

    first_page = api.get(base, params={"limit": 2, "before": 3}).json()
    assert [item["sequence"] for item in first_page] == [1, 2]
    latest = api.get(base).json()
    assert [item["sequence"] for item in latest] == [1, 2, 3]
