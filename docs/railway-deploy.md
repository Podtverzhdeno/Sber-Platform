# Публичный деплой Impulse в Railway

Пользователь открывает один публичный URL Railway. React и FastAPI находятся в одном
контейнере и работают на одном домене; PostgreSQL разворачивается отдельным приватным
сервисом Railway. База данных не входит в Docker image и не публикуется наружу.

## Первый деплой

1. Отправить актуальную ветку `main` в GitHub-репозиторий.
2. В Railway создать проект и добавить `Database -> PostgreSQL`. Оставить имя сервиса
   `Postgres` либо скорректировать ссылку на переменную ниже.
3. В том же проекте выбрать `New -> GitHub Repo`, подключить `Podtverzhdeno/Sber-Platform`
   и ветку `main`. Railway автоматически обнаружит корневой `Dockerfile`.
4. Заполнить и подписать [Railway Variables checklist](railway-variables-checklist.md).
   Checklist намеренно не содержит значений. Секреты задаются только в Railway UI, а
   production credentials помечаются sealed.

5. Применить staged changes. Перед развёртыванием Railway выполняет одну команду
   `python -m impulse.bootstrap.predeploy`: Alembic `upgrade head`, затем — **только при**
   `DEMO_MODE=true` — идемпотентный demo seed и проверку наличия не менее 12 синтетических
   задач. Если миграции, seed или проверка не удались, pre-deploy завершается ошибкой и
   новый deployment не должен заменять работающее приложение. При `DEMO_MODE=false`
   приложение не наполняется синтетическими данными. Миграции не дублируются при restart.
6. В `Settings -> Networking` сервиса приложения нажать `Generate Domain`. Полученный
   HTTPS URL является ссылкой для демонстрации продукта.

PostgreSQL не нужно делать публичным: приложение обращается к нему по приватной сети
Railway. После каждого push в подключённую ветку Railway автоматически собирает и
публикует новую версию, а `/health/ready` не позволяет переключить трафик на экземпляр,
который не видит базу.

Если Alembic сообщает о подключении к `localhost:5432`, в application service отсутствует
корректная reference variable. Добавьте PostgreSQL service в этот же Railway project и задайте
`DATABASE_URL=${{Postgres.DATABASE_URL}}` в Variables приложения. Для каждого отдельного Railway
project/environment ссылка создаётся отдельно; literal localhost использовать нельзя.

## Миграции и откат

Production schema changes SHALL следовать схеме expand → backfill → contract. Перед contract
обязателен dry-run возврата предыдущего image на expanded schema. Порядок выпуска и аварийного
отката описан в [migration-rollbacks.md](migration-rollbacks.md). Во время incident rollback
сначала возвращается последний исправный Railway deployment; `alembic downgrade` автоматически
не запускается.

## Локальная проверка production-контейнера

```powershell
docker compose up --build
```

После запуска приложение доступно на `http://localhost:8000`. Остановка без удаления
данных: `docker compose down`. Команда `docker compose down -v` удаляет и локальную
демонстрационную базу, поэтому её следует применять осознанно.

## Когда у участника пустой каталог задач

Пустой каталог не равнозначен пустой базе: проверить нужно отдельно схему, seed,
подключение к правильному Postgres service и фильтры доступа/deadline. На Railway
в pre-deploy логах ожидаются строки `Alembic migrations completed` и (в demo mode)
`Demo data verified: 12 task rows`. Команды **не содержат** секретов.

В PostgreSQL Data → Query (только чтение) проверить:

```sql
SELECT version_num FROM alembic_version;
SELECT status, data_origin, COUNT(*)
FROM tasks
GROUP BY status, data_origin
ORDER BY status, data_origin;
SELECT COUNT(*) AS published_demo_tasks
FROM tasks
WHERE status = 'published' AND data_origin = 'demo_seed';
SELECT COUNT(*) AS published_demo_terms
FROM task_terms_versions
WHERE status = 'published' AND data_origin = 'demo_seed';
```

Ожидаемая ревизия при этой версии кода: `20261023_0027`; при включённом DEMO_MODE
ожидаются 12 опубликованных demo-задач и 12 опубликованных demo-условий. Затем
проверить `/api/v1/me/task-recommendations` под синтетическим участником, без
обхода авторизации. Важное ограничение: `/health/ready` проверяет соединение **только когда**
`DATABASE_URL` задан; в `APP_ENV=development` без настроенной базы он также может
ответить `200` из-за использования in-memory stores. Поэтому `200` не
подтверждает ни наличие PostgreSQL, ни наличие задач.

Если demo mode выключен, запуск `impulse-demo-seed` запрещён. Не выполнять
`impulse-demo-reset`, `alembic downgrade`, `DROP` или `TRUNCATE` ради ремонта
пустого каталога. Перед новым deploy — backup/restore point и сверка среды.
