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
4. В `Variables` сервиса приложения задать:

   ```dotenv
   APP_ENV=production
   DEMO_MODE=true
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   SESSION_SECRET=<случайная строка длиной не менее 32 символов>
   AI_BUDDY_ENABLED=true
   AI_MENTOR_DRAFT_ENABLED=true
   AI_OPERATOR_TRIAGE_ENABLED=true
   AI_CUSTOMER_BRIEF_ENABLED=true
   OPENROUTER_API_KEY=<секрет только в Railway>
   OPENROUTER_MODEL_BUDDY=openrouter/free
   OPENROUTER_MODEL_STRUCTURED=openrouter/free
   ```

5. Применить staged changes. Перед развёртыванием `railway.toml` выполняет миграции и
   идемпотентно обновляет демонстрационные данные. Команда запуска образа повторяет эту
   безопасную подготовку как fallback, если Railway pre-deploy не был применён.
6. В `Settings -> Networking` сервиса приложения нажать `Generate Domain`. Полученный
   HTTPS URL является ссылкой для демонстрации продукта.

PostgreSQL не нужно делать публичным: приложение обращается к нему по приватной сети
Railway. После каждого push в подключённую ветку Railway автоматически собирает и
публикует новую версию, а `/health/ready` не позволяет переключить трафик на экземпляр,
который не видит базу.

## Локальная проверка production-контейнера

```powershell
docker compose up --build
```

После запуска приложение доступно на `http://localhost:8000`. Остановка без удаления
данных: `docker compose down`. Команда `docker compose down -v` удаляет и локальную
демонстрационную базу, поэтому её следует применять осознанно.
