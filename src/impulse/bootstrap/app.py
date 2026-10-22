"""FastAPI application factory."""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from pathlib import Path
from uuid import UUID

from fastapi import FastAPI

from impulse.ai.gateway import ModelRegistry
from impulse.ai.suggestions import SuggestionService
from impulse.api.errors import install_error_handlers
from impulse.api.health import router as health_router
from impulse.api.request_context import RequestContextMiddleware
from impulse.api.security import SecurityMiddleware
from impulse.api.v1 import router as api_v1_router
from impulse.api.v1.deadline import router as deadline_router
from impulse.application.buddy import BuddyConversationService, MemoryBuddyStorage
from impulse.application.competencies import (
    CompetencyService,
    MemoryCompetencyEvidenceStore,
    MemoryFrameworkStore,
    install_demo_competencies,
)
from impulse.application.deadline import (
    DeadlineChangeService,
    MemoryDeadlineChangeStore,
)
from impulse.application.development import (
    DevelopmentService,
    MemoryCertificateStore,
    MemoryDevelopmentStore,
    demo_course_certificate,
)
from impulse.application.ecosystem import EcosystemService, MemoryEcosystemStore
from impulse.application.identity import DemoAuthService, MemoryIdentityStore, demo_personas
from impulse.application.messaging import (
    MemoryMessagingStore,
    MessagingService,
    WorkTaskChannelSource,
)
from impulse.application.notifications import (
    MemoryNotificationsStore,
    NotificationFeedService,
    memory_demo_notifications,
)
from impulse.application.operations import MemoryOperationsStore, OperationsService
from impulse.application.project_credentials import (
    MemoryProjectCredentialStore,
    ProjectCredentialService,
)
from impulse.application.recognition import MemoryRecognitionStore, RecognitionService
from impulse.application.reward import (
    MemoryRewardStore,
    RewardService,
    WorkReviewEvidenceProvider,
)
from impulse.application.search import SearchService
from impulse.application.talent import MemoryTalentStore, TalentService
from impulse.application.work import MemoryWorkStore, WorkService
from impulse.bootcamp import catalog_router as bootcamp_catalog_router
from impulse.bootstrap.demo_seed import demo_id
from impulse.bootstrap.logging import configure_logging
from impulse.bootstrap.settings import Settings
from impulse.bootstrap.static import install_spa_fallback
from impulse.domain.notifications import Notification
from impulse.events import ParticipantEventsService
from impulse.events import router as participant_events_router
from impulse.events.store import MemoryEventDetailStore, SqlEventDetailStore
from impulse.infrastructure.buddy_store import SqlBuddyStorage
from impulse.infrastructure.competencies_store import SqlCompetencyEvidenceStore, SqlFrameworkStore
from impulse.infrastructure.credentials_store import (
    SqlCertificateStore,
    SqlProjectCredentialStore,
)
from impulse.infrastructure.database import Database
from impulse.infrastructure.deadline_store import SqlDeadlineChangeStore
from impulse.infrastructure.development_store import SqlDevelopmentStore
from impulse.infrastructure.ecosystem_store import SqlEcosystemStore
from impulse.infrastructure.identity_store import SqlIdentityStore
from impulse.infrastructure.messaging_store import SqlMessagingStore
from impulse.infrastructure.notifications_store import SqlNotificationsStore
from impulse.infrastructure.operations_store import SqlOperationsStore
from impulse.infrastructure.recognition_store import SqlRecognitionStore
from impulse.infrastructure.reward_store import SqlRewardStore
from impulse.infrastructure.talent_store import SqlTalentStore
from impulse.infrastructure.work_store import SqlWorkStore
from impulse.integrations import platform_router
from impulse.integrations.runtime import (
    DefaultProjectPlatformConfig,
    FailClosedPlatformGateway,
    FailClosedPlatformSyncGateway,
    TrajectoryCheckpointLocator,
    WorkAssignmentMembership,
)
from impulse.integrations.service import (
    DeploymentSealedVault,
    MemoryConnectionStore,
    PlatformConnectionService,
)
from impulse.integrations.sync import MemorySyncStore, PlatformSyncService


def create_app(
    settings: Settings | None = None,
    *,
    auth_service: DemoAuthService | None = None,
    development_service: DevelopmentService | None = None,
    ecosystem_service: EcosystemService | None = None,
    work_service: WorkService | None = None,
    reward_service: RewardService | None = None,
    recognition_service: RecognitionService | None = None,
    talent_service: TalentService | None = None,
    operations_service: OperationsService | None = None,
    messaging_service: MessagingService | None = None,
    notifications_service: NotificationFeedService | None = None,
    search_service: SearchService | None = None,
    project_credential_service: ProjectCredentialService | None = None,
    competency_service: CompetencyService | None = None,
    ai_registry: ModelRegistry | None = None,
    buddy_service: BuddyConversationService | None = None,
    ai_suggestion_service: SuggestionService | None = None,
    participant_events_service: ParticipantEventsService | None = None,
    deadline_service: DeadlineChangeService | None = None,
    platforms_service: PlatformConnectionService | None = None,
    platforms_sync_service: PlatformSyncService | None = None,
) -> FastAPI:
    """Build the HTTP application without import-time side effects."""
    runtime_settings = settings or Settings()
    configure_logging()
    owned_database: Database | None = None
    if auth_service is None:
        if runtime_settings.database_url is None:
            identity_store = MemoryIdentityStore(demo_personas())
        else:
            owned_database = Database(runtime_settings.database_url.get_secret_value())
            identity_store = SqlIdentityStore(owned_database)
        auth_service = DemoAuthService(
            identity_store,
            secret=runtime_settings.session_signing_secret(),
            ttl_seconds=runtime_settings.session_ttl_seconds,
        )
    if buddy_service is None:
        buddy_storage = (
            SqlBuddyStorage(owned_database) if owned_database is not None else MemoryBuddyStorage()
        )
        buddy_service = BuddyConversationService(buddy_storage)
    if development_service is None:
        development_store = (
            SqlDevelopmentStore(owned_database)
            if owned_database is not None
            else MemoryDevelopmentStore()
        )
        certificate_store = (
            SqlCertificateStore(owned_database)
            if owned_database is not None
            else MemoryCertificateStore()
        )
        development_service = DevelopmentService(development_store, certificate_store)
        if runtime_settings.demo_mode and owned_database is None:
            assert isinstance(certificate_store, MemoryCertificateStore)
            certificate_store.install_course_certificate(
                demo_course_certificate(
                    demo_id("participant-alex"),
                    demo_id("certificate:participant-alex:openspec-sdd"),
                )
            )
    if ecosystem_service is None:
        ecosystem_store = (
            SqlEcosystemStore(owned_database)
            if owned_database is not None
            else MemoryEcosystemStore(
                people={f"demo:{item.key}": item.person_id for item in demo_personas()}
            )
        )
        ecosystem_service = EcosystemService(ecosystem_store)
    if participant_events_service is None:
        participant_events_store = (
            SqlEventDetailStore(owned_database)
            if owned_database is not None
            else MemoryEventDetailStore()
        )
        participant_events_service = ParticipantEventsService(participant_events_store)
    if work_service is None:
        work_store = (
            SqlWorkStore(owned_database) if owned_database is not None else MemoryWorkStore()
        )
        work_service = WorkService(work_store)
    work_service.consent_store = auth_service.store
    if reward_service is None:
        reward_store = (
            SqlRewardStore(owned_database) if owned_database is not None else MemoryRewardStore()
        )
        reward_service = RewardService(
            reward_store,
            WorkReviewEvidenceProvider(work_service.store),
            work_service.store,
            identity=work_service.consent_store,
        )
    if project_credential_service is None:
        project_store = (
            SqlProjectCredentialStore(owned_database)
            if owned_database is not None
            else MemoryProjectCredentialStore()
        )
        project_credential_service = ProjectCredentialService(
            work_service.store,
            reward_service.store,
            project_store,
            persona_by_id=auth_service.store.get_persona_by_id,
        )
    if recognition_service is None:
        recognition_store = (
            SqlRecognitionStore(owned_database)
            if owned_database is not None
            else MemoryRecognitionStore()
        )
        recognition_service = RecognitionService(recognition_store)
    if talent_service is None:
        talent_store = (
            SqlTalentStore(owned_database) if owned_database is not None else MemoryTalentStore()
        )
        talent_service = TalentService(talent_store)
    if operations_service is None:
        operations_store = (
            SqlOperationsStore(owned_database)
            if owned_database is not None
            else MemoryOperationsStore()
        )
        operations_service = OperationsService(operations_store)
    if messaging_service is None:
        messaging_store = (
            SqlMessagingStore(owned_database)
            if owned_database is not None
            else MemoryMessagingStore()
        )
        messaging_service = MessagingService(messaging_store)
        messaging_service.task_channels = WorkTaskChannelSource(
            work_service.store, reward_service.store
        )
    if notifications_service is None:
        notification_rows = memory_demo_notifications()
        grouped: dict[UUID, list[Notification]] = {}
        for row in notification_rows:
            grouped.setdefault(row.person_id, []).append(row)
        notifications_store = (
            SqlNotificationsStore(owned_database)
            if owned_database is not None
            else MemoryNotificationsStore(
                {person_id: tuple(items) for person_id, items in grouped.items()}
            )
        )
        notifications_service = NotificationFeedService(notifications_store)
    if deadline_service is None:
        deadline_work_store = work_service.store
        deadline_store = (
            SqlDeadlineChangeStore(owned_database)
            if owned_database is not None
            else MemoryDeadlineChangeStore(deadline_work_store)
        )
        deadline_service = DeadlineChangeService(
            deadline_store, deadline_work_store, notifications_service
        )
    if search_service is None:
        search_service = SearchService(
            work_service.store,
            development_service.store,
            ecosystem_service.store,
            messaging_service=messaging_service,
            auth_service=auth_service,
            recognition_store=recognition_service.store,
        )
    platforms_store = MemoryConnectionStore()
    platforms_membership = WorkAssignmentMembership(work_service.store)
    platforms_config = DefaultProjectPlatformConfig()
    platforms_vault = DeploymentSealedVault.from_secret(runtime_settings.platform_sealing_secret())
    if platforms_service is None:
        platforms_service = PlatformConnectionService(
            platforms_store,
            platforms_vault,
            FailClosedPlatformGateway(),
            platforms_membership,
            platforms_config,
        )
    if platforms_sync_service is None:
        platforms_sync_service = PlatformSyncService(
            platforms_store,
            MemorySyncStore(),
            FailClosedPlatformSyncGateway(),
            TrajectoryCheckpointLocator(development_service),
            platforms_membership,
            platforms_config,
            platforms_vault,
        )
    if competency_service is None:
        competency_service = CompetencyService(
            SqlFrameworkStore(owned_database)
            if owned_database is not None
            else MemoryFrameworkStore(),
            SqlCompetencyEvidenceStore(owned_database)
            if owned_database is not None
            else MemoryCompetencyEvidenceStore(),
        )
    development_service.competency_service = competency_service
    project_credential_service.competency_service = competency_service

    @asynccontextmanager
    async def lifespan(_app: FastAPI) -> AsyncGenerator[None]:
        if runtime_settings.demo_mode and owned_database is None:
            await install_demo_competencies(competency_service, demo_id("participant-alex"))
        try:
            yield
        finally:
            if owned_database is not None:
                await owned_database.close()

    app = FastAPI(
        title="Impulse API",
        version="0.1.0",
        lifespan=lifespan,
    )
    app.state.settings = runtime_settings
    app.state.database = owned_database
    app.state.auth_service = auth_service
    app.state.development_service = development_service
    app.state.ecosystem_service = ecosystem_service
    app.state.work_service = work_service
    app.state.reward_service = reward_service
    app.state.project_credential_service = project_credential_service
    app.state.recognition_service = recognition_service
    app.state.talent_service = talent_service
    app.state.operations_service = operations_service
    app.state.messaging_service = messaging_service
    app.state.notifications_service = notifications_service
    app.state.deadline_service = deadline_service
    app.state.search_service = search_service
    app.state.competency_service = competency_service
    app.state.ai_registry = ai_registry
    app.state.buddy_service = buddy_service
    app.state.ai_suggestion_service = ai_suggestion_service
    app.state.participant_events_service = participant_events_service
    app.state.platforms_service = platforms_service
    app.state.platforms_sync_service = platforms_sync_service
    app.add_middleware(RequestContextMiddleware)
    allowed_origins = (
        frozenset({str(runtime_settings.allowed_origin).rstrip("/")})
        if runtime_settings.allowed_origin is not None
        else frozenset[str]()
    )
    app.add_middleware(
        SecurityMiddleware,
        allowed_origins=allowed_origins,
        max_request_bytes=runtime_settings.max_request_bytes,
    )
    install_error_handlers(app)
    app.include_router(health_router)
    app.include_router(api_v1_router)
    app.include_router(deadline_router, prefix="/api/v1")
    app.include_router(participant_events_router, prefix="/api/v1")
    app.include_router(platform_router, prefix="/api/v1")
    # impulse.bootcamp.api imports current_session from impulse.api.v1.identity,
    # so including catalog_router from the api/v1 package would deadlock the
    # package __init__; assemble it here like deadline and participant events.
    app.include_router(bootcamp_catalog_router, prefix="/api/v1")
    frontend_directory = Path("frontend/dist")
    if frontend_directory.is_dir():
        install_spa_fallback(app, frontend_directory)
    return app
