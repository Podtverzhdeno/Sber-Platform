"""Messaging workspace acceptance scenarios."""

from dataclasses import replace
from typing import cast
from uuid import UUID, uuid5

from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import SecretStr

from impulse.application.messaging import (
    ChannelStatus,
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


def test_closed_dialogs_are_hidden_from_all_participants() -> None:
    api, store = build()
    alex_csrf = login(api, "participant-alex")
    opened = api.post(
        "/api/v1/me/messaging/channels/personal",
        json={"peer_id": str(ELENA)},
        headers={"X-CSRF-Token": alex_csrf},
    )
    assert opened.status_code == 200
    dialog = opened.json()
    channel_id = UUID(dialog["id"])
    alex_channels = api.get("/api/v1/me/messaging/channels").json()
    assert any(item["id"] == dialog["id"] for item in alex_channels)

    # Test-only introspection: emulate channel closure behind the service layer.
    channels_map = store._channels  # pyright: ignore[reportPrivateUsage]
    for identifier, channel in list(channels_map.items()):
        if identifier == channel_id:
            channels_map[identifier] = replace(channel, status=ChannelStatus.CLOSED)

    assert all(
        item["id"] != dialog["id"] for item in api.get("/api/v1/me/messaging/channels").json()
    )

    elena_csrf = login(api, "mentor-elena")
    del elena_csrf
    elena_channels = api.get("/api/v1/me/messaging/channels").json()
    assert all(item["id"] != dialog["id"] for item in elena_channels)

    alex_csrf = login(api, "participant-alex")
    send = api.post(
        f"/api/v1/me/messaging/channels/{channel_id}/messages",
        json={"body": "Попытка записи в закрытый диалог"},
        headers={"X-CSRF-Token": alex_csrf},
    )
    assert send.status_code == 403
    assert send.json()["code"] == "MESSAGING_READ_ONLY"


def test_read_cursor_persists_across_sessions_and_devices() -> None:
    api, _store = build()
    alex_csrf = login(api, "participant-alex")
    opened = api.post(
        "/api/v1/me/messaging/channels/personal",
        json={"peer_id": str(ELENA)},
        headers={"X-CSRF-Token": alex_csrf},
    )
    assert opened.status_code == 200
    dialog = opened.json()

    posted = api.post(
        f"/api/v1/me/messaging/channels/{dialog['id']}/messages",
        json={"body": "Приоритеты зафиксировал в тикете."},
        headers={"X-CSRF-Token": alex_csrf},
    )
    assert posted.status_code == 200
    message = posted.json()

    first_elena_csrf = login(api, "mentor-elena")
    read = api.post(
        f"/api/v1/me/messaging/channels/{dialog['id']}/read",
        json={"message_id": message["id"]},
        headers={"X-CSRF-Token": first_elena_csrf},
    )
    assert read.status_code == 200
    assert read.json()["unread"] == 0

    second_elena_csrf = login(api, "mentor-elena")
    elena_channels = api.get("/api/v1/me/messaging/channels").json()
    matching = [item for item in elena_channels if item["id"] == dialog["id"]]
    assert len(matching) == 1
    assert matching[0]["unread"] == 0

    again = api.post(
        f"/api/v1/me/messaging/channels/{dialog['id']}/read",
        json={"message_id": message["id"]},
        headers={"X-CSRF-Token": second_elena_csrf},
    )
    assert again.status_code == 200
    assert again.json()["unread"] == 0


def test_restored_session_csrf_unblocks_message_send_without_disabling_protection() -> None:
    api, _store = build()
    original = login(api, "participant-alex")
    # Refresh/back-navigation in the SPA has no in-memory copy of the login token.
    fresh_actor = api.get("/api/v1/me")
    assert fresh_actor.status_code == 200
    recovered = fresh_actor.json()["csrf_token"]
    assert isinstance(recovered, str) and len(recovered) >= 32
    assert fresh_actor.headers.get("cache-control") == "no-store, private"
    assert recovered != original

    blocked = api.post(
        "/api/v1/me/messaging/channels/personal",
        json={"peer_id": str(ELENA)},
    )
    assert blocked.status_code == 403
    assert blocked.json()["code"] == "CSRF_INVALID"

    opened = api.post(
        "/api/v1/me/messaging/channels/personal",
        json={"peer_id": str(ELENA)},
        headers={"X-CSRF-Token": recovered},
    )
    assert opened.status_code == 200
    cid = opened.json()["id"]
    delivered = api.post(
        f"/api/v1/me/messaging/channels/{cid}/messages",
        json={"body": "Сообщение доставлено после перезагрузки."},
        headers={"X-CSRF-Token": recovered},
    )
    assert delivered.status_code == 200
    assert delivered.json()["body"] == "Сообщение доставлено после перезагрузки."
    assert (
        api.post(
            f"/api/v1/me/messaging/channels/{cid}/mute",
            json={"muted": True},
            headers={"X-CSRF-Token": recovered},
        ).status_code
        == 200
    )


def test_demo_contact_directory_and_group_creation_round_trip() -> None:
    api, _store = build()
    csrf = login(api, "participant-alex")
    contacts_response = api.get("/api/v1/me/messaging/contacts")
    assert contacts_response.status_code == 200
    contacts = contacts_response.json()
    assert len(contacts) >= 5
    assert str(ALEX) not in {person["id"] for person in contacts}
    assert {str(ELENA), str(ROMAN)}.issubset({person["id"] for person in contacts})

    endpoint = "/api/v1/me/messaging/channels/group"
    payload = {"title": "Команда AI-проекта", "peer_ids": [str(ELENA), str(ROMAN)]}
    assert api.post(endpoint, json=payload).status_code == 403
    created = api.post(endpoint, json=payload, headers={"X-CSRF-Token": csrf})
    assert created.status_code == 201
    chat = created.json()
    assert chat["kind"] == "community" and chat["title"] == "Команда AI-проекта"
    assert {str(ALEX), str(ELENA), str(ROMAN)} == {user["id"] for user in chat["participants"]}

    sent = api.post(
        f"/api/v1/me/messaging/channels/{chat['id']}/messages",
        json={"body": "Проверка коллективной переписки."},
        headers={"X-CSRF-Token": csrf},
    )
    assert sent.status_code == 200
    login(api, "mentor-elena")
    unread = api.get("/api/v1/me/messaging/channels").json()
    assert next(c for c in unread if c["id"] == chat["id"])["unread"] == 1
    elena_csrf = api.get("/api/v1/me").json()["csrf_token"]
    marked = api.post(
        f"/api/v1/me/messaging/channels/{chat['id']}/read",
        json={"message_id": sent.json()["id"]},
        headers={"X-CSRF-Token": elena_csrf},
    )
    assert marked.status_code == 200 and marked.json()["unread"] == 0


def test_group_creation_rejects_unknown_people_and_foreign_channels() -> None:
    api, _store = build()
    csrf = login(api, "participant-alex")

    def post(ids: list[str]):
        return api.post(
            "/api/v1/me/messaging/channels/group",
            json={"title": "Проверка доступа", "peer_ids": ids},
            headers={"X-CSRF-Token": csrf},
        )

    assert post([str(ALEX)]).status_code == 422
    assert post([str(UUID(int=999))]).status_code == 422
    assert post([]).status_code == 422


def test_contact_directory_and_group_creation_work_with_demo_flag_disabled() -> None:
    """Program members can message each other after demo mode is switched off.

    Keep demo-login isolated to the test setup; exercise the same session after
    flipping settings. The group is stored in the MessagingService, not only UI.
    """
    api, _store = build()
    csrf = login(api, "participant-alex")
    server = api.app
    assert isinstance(server, FastAPI)
    cast(Settings, server.state.settings).demo_mode = False

    contacts = api.get("/api/v1/me/messaging/contacts")
    assert contacts.status_code == 200
    ids = {entry["id"] for entry in contacts.json()}
    assert str(ELENA) in ids and str(ROMAN) in ids
    assert str(ALEX) not in ids

    created = api.post(
        "/api/v1/me/messaging/channels/group",
        json={"title": "AI-проект: участники", "peer_ids": [str(ELENA), str(ROMAN)]},
        headers={"X-CSRF-Token": csrf},
    )
    assert created.status_code == 201
    channel_id = created.json()["id"]
    assert created.json()["kind"] == "community"
    assert {part["id"] for part in created.json()["participants"]} == {
        str(ALEX),
        str(ELENA),
        str(ROMAN),
    }

    message = api.post(
        f"/api/v1/me/messaging/channels/{channel_id}/messages",
        json={"body": "Новый чат работает, сообщение сохранено."},
        headers={"X-CSRF-Token": csrf},
    )
    assert message.status_code == 200
    assert api.get(f"/api/v1/me/messaging/channels/{channel_id}/messages").json()[-1]["body"] == (
        "Новый чат работает, сообщение сохранено."
    )

    invalid = api.post(
        "/api/v1/me/messaging/channels/personal",
        json={"peer_id": str(UUID(int=999))},
        headers={"X-CSRF-Token": csrf},
    )
    assert invalid.status_code == 403
    assert invalid.json()["code"] == "MESSAGE_PEER_INVALID"


def test_community_invites_are_persisted_and_scoped_to_members_and_program() -> None:
    api, _store = build()
    alex_csrf = login(api, "participant-alex")
    created = api.post(
        "/api/v1/me/messaging/channels/group",
        json={"title": "Команда дизайна", "peer_ids": [str(ELENA)]},
        headers={"X-CSRF-Token": alex_csrf},
    )
    assert created.status_code == 201
    channel_id = created.json()["id"]
    path = f"/api/v1/me/messaging/channels/{channel_id}/members"
    unavailable_contact = api.post(
        path,
        json={"person_ids": [str(UUID(int=999))]},
        headers={"X-CSRF-Token": alex_csrf},
    )
    assert unavailable_contact.status_code == 403
    added = api.post(
        path,
        json={"person_ids": [str(ROMAN)]},
        headers={"X-CSRF-Token": alex_csrf},
    )
    assert added.status_code == 200
    assert str(ROMAN) in {person["id"] for person in added.json()["participants"]}
    again = api.post(
        path,
        json={"person_ids": [str(ROMAN)]},
        headers={"X-CSRF-Token": alex_csrf},
    )
    assert again.status_code == 200
    assert len([person for person in again.json()["participants"] if person["id"] == str(ROMAN)]) == 1
    no_csrf = api.post(path, json={"person_ids": [str(ROMAN)]})
    assert no_csrf.status_code in (401, 403)
    hr_csrf = login(api, "hr-nina")
    hidden = api.post(
        path,
        json={"person_ids": [str(ROMAN)]},
        headers={"X-CSRF-Token": hr_csrf},
    )
    assert hidden.status_code in (403, 404)
