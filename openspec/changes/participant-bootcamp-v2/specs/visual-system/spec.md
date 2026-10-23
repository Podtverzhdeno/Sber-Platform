# visual-system Delta Specification

## ADDED Requirements

### Requirement: Bootcamp has five traceable visual references
Visual acceptance SHALL использовать именованные `BC-R01` cards, `BC-R02` list, `BC-R03` course detail, `BC-R04` recommendation explanation и `BC-R05` requirements с SHA-256 manifest из `docs/prototype-intake.md`. Production UI SHALL воспроизводить композицию редактируемыми компонентами, а не встраивать PNG или автономный HTML.

#### Scenario: Выполняется visual regression
- **WHEN** deterministic fixtures рендерятся на 1448×1086 и 390×844
- **THEN** каждый baseline связан с одним `BC-R*`, locked width отличается не более чем на 1 px, отсутствует document overflow и результаты доступны для human review

### Requirement: Bootcamp semantics survive theme and viewport changes
Dark/light themes SHALL сохранять порядок, state semantics, contrast и focus; layout SHALL адаптироваться 4/3/2/1 columns без hover-only информации и обязательной motion.

#### Scenario: Светлая мобильная тема
- **WHEN** Bootcamp открыт на 390×844 в light theme с reduced motion
- **THEN** каталог и полноэкранный drawer остаются читаемыми, keyboard/touch actions доступны, а состояние не передаётся только цветом
