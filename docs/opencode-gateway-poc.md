# OpenCode gateway PoC

## Что проверено

18 октября 2026 года на локальной установке OpenCode `1.19.3` подтверждены оба пути:

- CLI: `opencode run --model opencode/glm-5.3-flash-free ...`;
- защищённый локальный Server API: `health → session → message → delete session`.

Тестовый ответ `SERVER_GATEWAY_OK` пришёл от модели
`opencode/glm-5.3-flash-free`. Это подтверждает работоспособность текущей локальной
конфигурации, но не является гарантией бессрочного бесплатного доступа.

## Граница решения

OpenCode Server здесь — локальный программируемый шлюз к моделям и учётным данным,
которые уже доступны OpenCode. Это не OpenAI-compatible API, не способ получить API-ключ
модели и не обход авторизации, квот или правил провайдера.

Бесплатные модели и лимиты могут меняться. Перед каждым экспериментом следует проверять
актуальный каталог:

```powershell
opencode models opencode
```

## Запуск сервера

Используйте непубличный адрес и отдельный случайный пароль. Значение пароля не сохраняйте
в репозитории:

```powershell
$env:OPENCODE_SERVER_PASSWORD = '<local-random-password>'
opencode serve --hostname 127.0.0.1 --port 4096
```

OpenCode по умолчанию использует имя Basic Auth `opencode`. Если имя изменено на стороне
сервера, задайте его клиенту:

```powershell
$env:OPENCODE_SERVER_USERNAME = '<configured-username>'
```

## Одиночный вызов

В другом терминале задайте тот же пароль только в переменной окружения и вызовите шлюз:

```powershell
$env:OPENCODE_SERVER_PASSWORD = '<same-local-random-password>'
uv run python -m scripts.opencode_gateway "Ответь ровно: OK"
```

Другую доступную модель можно выбрать без изменения кода:

```powershell
uv run python -m scripts.opencode_gateway --model opencode/beam-free "Ответь ровно: OK"
```

Скрипт проверяет здоровье сервера, создаёт временную сессию, отправляет сообщение и удаляет
сессию даже при ошибке модели. Пароль обязателен, не принимается аргументом CLI и не выводится
в лог.

## Мультиагентная проверка

Следующая команда параллельно создаёт четыре независимые сессии: `architect`, `developer`,
`reviewer` и `tester`. Результат возвращается как JSON:

```powershell
uv run python -m scripts.opencode_multiagent "Спроектируй импорт профиля участника из CSV"
```

Одну или несколько ролей можно направить в другие модели из текущего каталога OpenCode:

```powershell
uv run python -m scripts.opencode_multiagent `
  --role-model architect=opencode/glm-5.3-flash-free `
  --role-model reviewer=opencode/beam-free `
  "Спроектируй импорт профиля участника из CSV"
```

Это review-контур: всем сессиям принудительно отключены `bash`, `edit`, `write`, `patch` и
`task`.
Роль `developer` предлагает изменения, но не применяет их. Автоматическую запись в рабочее
дерево следует добавлять только отдельным этапом с изоляцией веток/worktree, проверкой diff
и обязательными quality gates.

## Практические ограничения

- Сервер должен слушать только `127.0.0.1`, если удалённый доступ специально не защищён.
- Один пароль защищает API управления сессиями; его нельзя коммитить или передавать в CLI.
- Доступ фактически зависит от авторизации, каталога, квот и доступности OpenCode/провайдера.
- Бесплатный endpoint подходит для экспериментов и вспомогательных ролей, но не для контура
  с гарантированным SLA.
- Оркестратор использует OpenCode Session API. Клиенты, ожидающие OpenAI API, без адаптера с
  ним несовместимы.

## Официальные источники

- [OpenCode Server](https://docs.opencode.ai/docs/server/)
- [OpenCode SDK](https://docs.opencode.ai/docs/sdk/)
- [OpenCode Models](https://docs.opencode.ai/docs/models/)
- [OpenCode Zen](https://docs.opencode.ai/docs/zen/)
