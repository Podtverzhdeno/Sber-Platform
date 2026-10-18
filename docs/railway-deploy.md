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

5. Применить staged changes. Перед развёртыванием `railway.toml` выполняет миграции и
   идемпотентно обновляет демонстрационные данные. Команда запуска образа повторяет эту
   безопасную подготовку как fallback, если Railway pre-deploy не был применён.
6. В `Settings -> Networking` сервиса приложения нажать `Generate Domain`. Полученный
   HTTPS URL является ссылкой для демонстрации продукта.

PostgreSQL не нужно делать публичным: приложение обращается к нему по приватной сети
Railway. После каждого push в подключённую ветку Railway автоматически собирает и
публикует новую версию, а `/health/ready` не позволяет переключить трафик на экземпляр,
который не видит базу.

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
