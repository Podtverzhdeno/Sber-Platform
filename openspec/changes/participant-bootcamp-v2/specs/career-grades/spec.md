# career-grades Delta Specification

## ADDED Requirements

### Requirement: Bootcamp copy reflects automatic verified grade transition
Bootcamp SHALL объяснять, что отдельный курс закрывает только соответствующую часть policy и не повышает grade сам по себе. Когда все требования опубликованной policy verified и readiness достигает 100%, сервер SHALL автоматически, атомарно и идемпотентно выполнить разрешённый grade transition согласно career-grade contract.

#### Scenario: Остался один обязательный курс
- **WHEN** участник открывает requirements drawer при readiness меньше 100%
- **THEN** UI называет курс и остальные requirements, не требует ручного подтверждения повышения и не обещает переход до verification всех условий

#### Scenario: Последнее evidence проверено
- **WHEN** verification доводит readiness до 100%
- **THEN** после server transition Bootcamp показывает новый grade из обновлённой projection и не вычисляет его на клиенте
