"""PostgreSQL persistence for verified documents (certificates, project credentials)."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert as postgres_insert

from impulse.application.development import (
    CertificateStore,
    CompletedCompetency,
    CourseCertificate,
)
from impulse.application.project_credentials import (
    ProjectCompetencyCell,
    ProjectCredential,
    ProjectCredentialStore,
)
from impulse.domain.reward import ReviewGrade
from impulse.infrastructure.database import Database
from impulse.infrastructure.models.credentials import course_certificates, project_credentials


def _cert_row(certificate: CourseCertificate) -> dict[str, object]:
    return {
        "id": certificate.certificate_id,
        "person_id": certificate.person_id,
        "course_key": certificate.course_key,
        "course_title": certificate.course_title,
        "verification_id": certificate.verification_id,
        "data_origin": "demo_runtime",
        "created_by": certificate.person_id,
        "payload": {
            "holder_name": certificate.holder_name,
            "specialization": certificate.specialization,
            "program_version": certificate.program_version,
            "period": certificate.period,
            "workload_hours": certificate.workload_hours,
            "result": certificate.result,
            "issued_at": certificate.issued_at.isoformat(),
            "competencies": [
                {
                    "competency": entry.competency,
                    "level": entry.level,
                    "evidence": entry.evidence,
                }
                for entry in certificate.competencies
            ],
        },
    }


def _row_certificate(row: Any) -> CourseCertificate:
    payload = row.payload
    return CourseCertificate(
        certificate_id=row.id,
        verification_id=row.verification_id,
        person_id=row.person_id,
        holder_name=str(payload.get("holder_name", "Участник")),
        course_key=row.course_key,
        course_title=row.course_title,
        specialization=str(payload.get("specialization", "")),
        program_version=str(payload.get("program_version", "1.0.0")),
        period=str(payload.get("period", "")),
        workload_hours=int(payload.get("workload_hours", 0)),
        result=str(payload.get("result", "")),
        competencies=tuple(
            CompletedCompetency(entry["competency"], entry["level"], entry["evidence"])
            for entry in payload.get("competencies", [])
        ),
        issued_at=_from_iso(payload, "issued_at"),
    )


def _cred_row(credential: ProjectCredential) -> dict[str, object]:
    return {
        "id": credential.credential_id,
        "person_id": credential.person_id,
        "contribution_id": credential.contribution_id,
        "contribution_version": credential.contribution_version,
        "verification_id": credential.verification_id,
        "data_origin": "demo_runtime",
        "created_by": credential.customer_id,
        "payload": {
            "holder_name": credential.holder_name,
            "customer_id": str(credential.customer_id),
            "customer_name": credential.customer_name,
            "task_key": credential.task_key,
            "task_title": credential.task_title,
            "project_key": credential.project_key,
            "period": credential.period,
            "personal_summary": credential.personal_summary,
            "artifact_keys": list(credential.artifact_keys),
            "grade": credential.grade.value,
            "review_explanation": credential.review_explanation,
            "competencies": [
                {
                    "competency": cell.competency,
                    "level": cell.level,
                    "evidence_refs": list(cell.evidence_refs),
                    "finding": cell.finding,
                }
                for cell in credential.competencies
            ],
            "payment_status": credential.payment_status,
            "signed_at": credential.signed_at.isoformat(),
            "status": credential.status,
            "superseded_by": credential.superseded_by,
        },
    }


def _row_credential(row: Any) -> ProjectCredential:
    payload = row.payload
    return ProjectCredential(
        credential_id=row.id,
        verification_id=row.verification_id,
        contribution_id=row.contribution_id,
        contribution_version=row.contribution_version,
        person_id=row.person_id,
        holder_name=str(payload.get("holder_name", "Участник")),
        customer_id=UUID(str(payload.get("customer_id"))),
        customer_name=str(payload.get("customer_name", "")),
        task_key=str(payload.get("task_key", "")),
        task_title=str(payload.get("task_title", "")),
        project_key=str(payload.get("project_key", "")),
        period=str(payload.get("period", "")),
        personal_summary=str(payload.get("personal_summary", "")),
        artifact_keys=tuple(payload.get("artifact_keys", [])),
        grade=ReviewGrade(str(payload.get("grade", "A"))),
        review_explanation=str(payload.get("review_explanation", "")),
        competencies=tuple(
            ProjectCompetencyCell(
                entry["competency"], entry["level"], tuple(entry["evidence_refs"]), entry["finding"]
            )
            for entry in payload.get("competencies", [])
        ),
        payment_status=str(payload.get("payment_status", "")),
        signed_at=_from_iso(payload, "signed_at"),
        status=str(payload.get("status", "valid")),
        superseded_by=payload.get("superseded_by"),
    )


def _from_iso(payload: dict[str, Any], key: str) -> datetime:
    stored = payload.get(key)
    if not stored:
        return datetime.now(UTC)
    return datetime.fromisoformat(str(stored))


class SqlCertificateStore(CertificateStore):
    """PostgreSQL adapter implementing CertificateStore."""

    def __init__(self, database: Database) -> None:
        self.database = database

    async def course_certificate(
        self, person_id: UUID, course_key: str
    ) -> CourseCertificate | None:
        async with self.database.sessions() as session:
            row = (
                await session.execute(
                    select(course_certificates).where(
                        course_certificates.c.person_id == person_id,
                        course_certificates.c.course_key == course_key,
                    )
                )
            ).one_or_none()
            return _row_certificate(row) if row is not None else None

    async def certificate_by_verification(self, verification_id: str) -> CourseCertificate | None:
        async with self.database.sessions() as session:
            row = (
                await session.execute(
                    select(course_certificates).where(
                        course_certificates.c.verification_id == verification_id
                    )
                )
            ).one_or_none()
            return _row_certificate(row) if row is not None else None

    async def course_certificates(self, person_id: UUID) -> tuple[CourseCertificate, ...]:
        async with self.database.sessions() as session:
            rows = (
                await session.execute(
                    select(course_certificates)
                    .where(course_certificates.c.person_id == person_id)
                    .order_by(course_certificates.c.created_at)
                )
            ).all()
            return tuple(_row_certificate(row) for row in rows)

    async def add_course_certificate(self, certificate: CourseCertificate) -> CourseCertificate:
        async with self.database.session() as session:
            await session.execute(
                postgres_insert(course_certificates)
                .values(**_cert_row(certificate))
                .on_conflict_do_update(
                    constraint="uq_course_certificates_person_id_course_key",
                    set_={
                        "course_title": certificate.course_title,
                        "verification_id": certificate.verification_id,
                        "payload": _cert_row(certificate)["payload"],
                        "version": course_certificates.c.version + 1,
                    },
                )
            )
            return certificate


class SqlProjectCredentialStore(ProjectCredentialStore):
    """PostgreSQL adapter implementing ProjectCredentialStore."""

    def __init__(self, database: Database) -> None:
        self.database = database

    async def credential_by_contribution(
        self, contribution_id: UUID, contribution_version: int
    ) -> ProjectCredential | None:
        async with self.database.sessions() as session:
            row = (
                await session.execute(
                    select(project_credentials).where(
                        project_credentials.c.contribution_id == contribution_id,
                        project_credentials.c.contribution_version == contribution_version,
                    )
                )
            ).one_or_none()
            return _row_credential(row) if row is not None else None

    async def credential_by_verification(self, verification_id: str) -> ProjectCredential | None:
        async with self.database.sessions() as session:
            row = (
                await session.execute(
                    select(project_credentials).where(
                        project_credentials.c.verification_id == verification_id
                    )
                )
            ).one_or_none()
            return _row_credential(row) if row is not None else None

    async def credentials_for_person(self, person_id: UUID) -> tuple[ProjectCredential, ...]:
        async with self.database.sessions() as session:
            rows = (
                await session.execute(
                    select(project_credentials)
                    .where(project_credentials.c.person_id == person_id)
                    .order_by(project_credentials.c.created_at)
                )
            ).all()
            return tuple(_row_credential(row) for row in rows)

    async def add_credential(
        self, credential: ProjectCredential, superseded_id: str | None
    ) -> ProjectCredential:
        async with self.database.session() as session:
            superseded_payload: dict[str, object] | None = None
            if superseded_id is not None:
                previous = (
                    await session.execute(
                        select(project_credentials.c.payload).where(
                            project_credentials.c.verification_id == superseded_id
                        )
                    )
                ).one_or_none()
                if previous is not None:
                    superseded_payload = {
                        **previous.payload,
                        "status": "superseded",
                        "superseded_by": credential.verification_id,
                    }
            await session.execute(
                postgres_insert(project_credentials).values(**_cred_row(credential))
            )
            if superseded_payload is not None:
                await session.execute(
                    update(project_credentials)
                    .where(project_credentials.c.verification_id == superseded_id)
                    .values(
                        status="superseded",
                        payload=superseded_payload,
                        version=project_credentials.c.version + 1,
                    )
                )
            return credential
