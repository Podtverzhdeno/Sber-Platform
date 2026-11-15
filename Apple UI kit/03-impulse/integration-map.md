# Реальная карта внедрения в IMPULSE

Сверено по `frontend/package.json`, `frontend/src/App.tsx`, `frontend/src/app/theme.ts` на базовом main commit `0ab91bd29d21fb6ff7f4203824bfe113a251d012` 2026-11-15. **Физические пути к файлам уточнены 2026-11-15 в актуальном `main`:** полный путь и расширение соответствуют действительным файлам. Импорты React могут опускать расширение.

## Стек

React 19 + TypeScript 5 + Vite 7 + react-router-dom 7 + lucide-react + SCSS (sass). Есть dark/light/system `data-theme` на documentElement, ключ localStorage `impulse-theme`. Это **существующий контракт**, не заменять. Есть Vitest, Playwright, ESLint, Typecheck.

## Приоритетные entry points

| Приоритет | Код IMPULSE | Apple pattern | Что делать |
|---|---|---|---|
| P0 | `frontend/src/App.tsx` | shared shell / toolbar | audit навигации и базовых layout зон, без переписывания маршрутов |
| P0 | `frontend/src/features/calm-navigation/Sidebar.tsx` | macOS sidebar | лейаут, отступы, selection, responsive collapse, glass functional layer |
| P0 | `frontend/src/features/collaboration.tsx` → `MessagingWorkspace` | Messages | conversation split, thread, bubble, composer, search, alerts |
| P0 | `frontend/src/app/theme.ts` | appearance | сохранить API `applyTheme`, `storedThemeChoice`, `subscribeSystemTheme` |
| P0 | `frontend/src/components/ui.tsx` (физический файл; import разрешает без расширения) | buttons / fields / dialogs | проверить actual exports перед изменением, вводить tokens постепенно |
| P1 | `frontend/src/features/participant-home-v2/page.tsx` | dashboard | grouped sections, functional glass topbar, solid data |
| P1 | `frontend/src/features/trajectory-v2/page.tsx` | navigation / timeline | content hierarchy, progress visualization |
| P1 | `frontend/src/features/bootcamp/route-v2.tsx` | course lists | cards, tabs, segmented controls, filters |
| P1 | `frontend/src/features/task-catalog-v2/page.tsx` | list and search | list rows, search, chips, sorting |
| P1 | `frontend/src/features/my-projects/page.tsx` | project lists | grouping, empty and loading |
| P1 | `frontend/src/features/analytics-v3/page.tsx` | dashboard metrics | opaque readable KPI tables + overlay controls |
| P1 | `frontend/src/features/portfolio-v2.tsx` | profile | typography, badges, CTA |
| P2 | `frontend/src/features/participant.tsx` | settings | toggle, picker, grouped lists, validation |
| P2 | `frontend/src/features/customer.tsx`, `frontend/src/features/mentor.tsx`, `frontend/src/features/hr.tsx`, `frontend/src/features/manager.tsx`, `frontend/src/features/operator.tsx` | specialized workspaces | preserve access rights and role-specific functions |

## Порядок внедрения в отдельных PR

1. **Tokens-only:** добавить семантические design tokens, подключить к одной демонстрационной странице. Никакого массового CSS find/replace.
2. **Shell:** sidebar/topbar, active selection, responsive collapsed layout, light/dark. Screenshots before/after.
3. **Common controls:** button, input, segmented, menu, toast, dialog. Сохранить старые props или добавить адаптер.
4. **Messages:** отдельный PR для chat, особенно composer, empty/loading/error и message delivery states.
5. **Secondary surfaces:** каталоги, домашняя, task list, settings.
6. **Metrics:** убрать стекло с плотного информационного содержимого; сохранить контраст и графики.
7. **QA & rollout:** фича-флаг, keyboard/axe, e2e smoke, visual regression; PR review; no direct force-push to main.

## Защита функционала

- Не менять endpoint contracts, API client, route names, role gating, data fetching или translations.
- Не пересоздавать существующие компоненты без проверки их API и unit tests.
- Не подменять существующие брендовые активы Apple логотипами/иконками.
- Не ставить нового UI package без предварительного обоснования.
- Любые design tokens соотносить с фактическим набором старых SCSS-variables.
- Выполнять `npm run typecheck && npm run lint && npm test && npm run build` в frontend.
