# Prototype intake and provenance

## Source archives

| Source | SHA-256 | Purpose |
|---|---|---|
| `Impulse_Full_UI_Grades5_6_and_Tasks.zip` | `161A8983E71C4AB51CFD1C3C3BE241FDE55FE9C9B83F3D84DBDD4E02290CE1CD` | Главная, панель всех грейдов, detail следующего грейда, desktop/mobile references |
| `Impulse_Trajectory_Interactive_Code_and_Tasks.zip` | `BA49623E43CC8E255BD2B06BD794207F7E4D259869DE554B29273EB0931BD825` | Интерактивная траектория, drawers/dialogs/menu, desktop/mobile references |

Архивы предоставлены владельцем проекта 2026-10-22. Они не копируются в production bundle. Контрольные суммы позволяют повторно проверить, что реализация сверяется с теми же материалами.

## Key extracted artifacts

| Artifact | SHA-256 |
|---|---|
| Full UI `tasks.md` | `318452FD73D9D2255C06CCFC208D6F951EC4171D1A63F8BB76846232124C6F0B` |
| Full UI `app.js` | `62C736454F34453EC26AF3C64B977094A9EC4D7F47043AB6A41C7E8AEE44E09F` |
| Full UI `styles.css` | `3FF5C5E84A9C15B6D22662BE7C239FDF160E8D56A8252187FC83AB5181B3E9D5` |
| Trajectory `tasks.md` | `460ED4B44FF9109FD45E25DF26BFD4E159162C0C4DEB889148CECE1935E31F23` |
| Trajectory `app.js` | `D62A341E4BC4C03F6CB4B45B859796F708FB64ACBF07218D47A0B5E29A41E66C` |
| Trajectory `styles.css` | `11DF2A6730E43563D7E4FBE7F42F2E0595BB14B6E6715319AFF1D2C50598C23D` |

## Accepted visual states

### Main and grades

- dense desktop home: hero/grade/week top row; next step directly above active tasks; compact Buddy and Skill Passport rail;
- grades drawer ordered from higher to lower grade with visually distinct completed/current/target/locked states;
- target-grade detail with readiness, responsibilities, competencies, task examples, gaps, development plan and requirements;
- mobile composition preserving task priority and accessible controls.

### Interactive trajectory

- role selector with primary, active, paused and unselected states;
- seven-stage example path with completed/current/locked states, without hardcoding seven in the domain;
- selected stage task list and independent stage progress;
- task/evidence drawer;
- role information dialog with six content sections/tabs;
- contextual menu: compare, pin, share, hide unselected, configure path;
- all-grades dialog and mobile composition.

## Adaptation rules

1. Reuse current React routing, design tokens, primitives, query layer and RBAC.
2. Treat labels, numbers, dates, people, percentages and grade catalog entries as demo content until backed by API/seed policy.
3. Never use prototype local state to confirm evidence, career grade or access.
4. Preserve interaction intent, information hierarchy, responsive behavior and key visual states.
5. Where prototype and current domain rules conflict, domain rules and this OpenSpec change win.
6. Do not add screenshot baselines until the active Sass migration is approved and the target route renders deterministic API-backed fixtures.

## Coverage mapping

| Prototype theme | SDD coverage |
|---|---|
| Main composition | `participant-experience` delta, tasks 3.1–3.3 |
| Grade drawer/detail | `career-grades`, tasks 1.1–2.3 and 4.1–4.2 |
| Role selector and path | `career-roadmap` delta, tasks 5.1–5.3 |
| Drawers/dialog/menu | `career-roadmap` delta, tasks 5.2–5.4 |
| Themes/responsive/a11y | `visual-system` delta, tasks 6.1–6.2 |
| API/RBAC/real data | design decisions 2 and 7, tasks 2.1–2.3 |
| Tests/acceptance | tasks 7.1–7.4 |

