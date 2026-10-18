"""PostgreSQL scenarios for verified documents (certificates, project credentials)."""

import os
from dataclasses import replace
from datetime import UTC, datetime
from uuid import uuid4

import pytest
from sqlalchemy import delete, func, select

from impulse.application.development import (
    CompletedCompetency,
    CourseCertificate,
)
from impulse.application.project_credentials import (
    ProjectCompetencyCell,
    ProjectCredential,
)
from impulse.bootstrap.demo_seed import demo_id, seed_demo
from impulse.domain.reward import ReviewGrade
from impulse.infrastructure.credentials_store import (
    SqlCertificateStore,
    SqlProjectCredentialStore,
)
from impulse.infrastructure.database import Database, async_database_url
from impulse.infrastructure.models.credentials import (
    course_certificates,
    project_credentials,
)

pytestmark = pytest.mark.integration


def integration_url() -> str:
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.skip("TEST_DATABASE_URL is required for PostgreSQL integration tests")
    return async_database_url(url)


def demo_certificate(person_id) -> CourseCertificate:
    return CourseCertificate(
        certificate_id=uuid4(),
        verification_id=f"cert-{uuid4().hex[:12]}",
        person_id=person_id,
        holder_name="Алекс Речной",
        course_key="openspec-sdd",
        course_title="OpenSpec и SDD",
        specialization="Python / Data / Product / ML",
        program_version="1.0.0",
        period="09.2026",
        workload_hours=24,
        result="Демонстрационный образец подтверждает прохождение курса.",
        competencies=(
            CompletedCompetency("Спецификация и документация", "базовый", "OpenSpec-задание курса"),
            CompletedCompetency("Ведение проекта по SDD", "базовый", "Практическое задание курса"),
        ),
        issued_at=datetime.now(UTC),
    )


def demo_credential(person_id) -> ProjectCredential:
    return ProjectCredential(
        credential_id=uuid4(),
        verification_id=f"proj-{uuid4().hex[:12]}",
        contribution_id=uuid4(),
        contribution_version=1,
        person_id=person_id,
        holder_name="Алекс Речной",
        customer_id=demo_id("customer-roman"),
        customer_name="Роман Заказчик",
        task_key="semantic-search-rd",
        task_title="Семантический поиск для программ",
        project_key="demo-rd-lab",
        period="17.10.2026",
        personal_summary="Реализовал API поиска и добавил замер offline-метрики.",
        artifact_keys=("personal-api-proof",),
        grade=ReviewGrade.A,
        review_explanation="Результат выше критериев, подтверждён примерами.",
        competencies=(
            ProjectCompetencyCell(
                "result", "уверенный", ("artifact:result",), "Метрика подтверждена."
            ),
        ),
        payment_status="Оплачено",
        signed_at=datetime.now(UTC),
    )


@pytest.mark.asyncio
async def test_course_certificate_upsert_and_lookup() -> None:
    database = Database(integration_url())
    await seed_demo(database)
    store = SqlCertificateStore(database)
    person_id = demo_id("participant-alex")
    certificate = demo_certificate(person_id)

    await store.add_course_certificate(certificate)
    stored = await store.course_certificate(person_id, certificate.course_key)
    assert stored is not None
    assert stored.verification_id == certificate.verification_id
    assert stored.holder_name == certificate.holder_name
    assert stored.workload_hours == 24
    assert stored.competencies == certificate.competencies

    replacement = demo_certificate(person_id)
    await store.add_course_certificate(replacement)
    async with database.session() as session:
        count = (
            await session.scalar(
                select(func.count())
                .select_from(course_certificates)
                .where(course_certificates.c.person_id == person_id)
            )
            or 0
        )
    assert int(count) == 1
    refresh = await store.course_certificate(person_id, certificate.course_key)
    assert refresh is not None and refresh.verification_id == replacement.verification_id
    verification = await store.certificate_by_verification(replacement.verification_id)
    assert verification is not None and verification.holder_name == "Алекс Речной"
    assert len(await store.course_certificates(person_id)) == 1

    async with database.session() as session:
        await session.execute(
            delete(course_certificates).where(course_certificates.c.person_id == person_id)
        )
    await database.close()


@pytest.mark.asyncio
async def test_project_credential_supersede_round_trip() -> None:
    database = Database(integration_url())
    await seed_demo(database)
    store = SqlProjectCredentialStore(database)
    person_id = demo_id("participant-maria")
    first = demo_credential(person_id)
    await store.add_credential(first, None)

    stored = await store.credential_by_contribution(first.contribution_id, 1)
    assert stored == first
    verification = await store.credential_by_verification(first.verification_id)
    assert verification == first
    assert list(await store.credentials_for_person(person_id)) == [first]

    second = replace(
        first,
        credential_id=uuid4(),
        verification_id=f"proj-{uuid4().hex[:12]}",
        contribution_version=2,
        signed_at=datetime.now(UTC),
    )
    await store.add_credential(second, first.verification_id)

    previous = await store.credential_by_verification(first.verification_id)
    assert previous is not None
    assert previous.status == "superseded"
    assert previous.superseded_by == second.verification_id
    version_two = await store.credential_by_contribution(first.contribution_id, 2)
    assert version_two == second

    async with database.session() as session:
        await session.execute(
            delete(project_credentials).where(project_credentials.c.person_id == person_id)
        )
    await database.close()
