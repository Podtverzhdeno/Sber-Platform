# Full CI architecture verification snapshot — 2026-10-26

Этот документ существует для отдельной, неизменяемой PR-проверки всех обязательных gate основного `CI` во время одновременной активной разработки на `main` (`cancel-in-progress` отменяет незавершённые push workflow).

**Цель:** исполнить PostgreSQL migrations + pytest, OpenSpec strict, Ruff/Pyright, frontend ESLint/TS/Vitest, React build + Playwright, Docker и security scans на единой проверяемой версии кода.

**Не цель:** изменение поведения, деплой, принятие старого архитектурного долга или merge этого черновика без независимого ревью.

## Evidence

- Architecture audit tool: `scripts/architecture/audit.py`
- Layer debt baseline: `scripts/architecture/legacy-imports.json`
- Full static report: artifact `architecture-audit` от GH Actions
- Первичные findings: `docs/architecture/2026-10-26-audit.md`
- 31 существующий forbidden import; новых импортов и runtime cycles архитектурный gate не допускает
- 33 Alembic revisions, one head, no missing parent (static check)

**Приёмка:** каждый mandatory job в `.github/workflows/ci.yml` завершён со статусом `success` на одном head/merge SHA и отчёты доступны reviewer. Ошибки необходимо описать отдельно, а не скрывать новой baseline записью.
