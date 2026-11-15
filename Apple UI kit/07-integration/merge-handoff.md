# Совмещение параллельных Apple UI kit PR для IMPULSE

**Срез:** 2026-11-15, ссылки и состояния PR проверены через GitHub в ходе этой работы. Статусы могут меняться после проверки.

## Что существует

| PR | Базовая ветка на момент аудита | Содержание | Путь риска |
|---|---|---|---|
| [#181](https://github.com/Podtverzhdeno/Sber-Platform/pull/181) | main | 13 каталожных категорий, ссылки, SVG, HIG, web reference gallery | **Apple UI kit/README.md** |
| [#184](https://github.com/Podtverzhdeno/Sber-Platform/pull/184) | docs/apple-ui-kit-refs-20261115 (#181) | 16 отдельный reference-cases/*.svg | зависимость от #181 |
| [#186](https://github.com/Podtverzhdeno/Sber-Platform/pull/186) | docs/apple-ui-kit-visual-cases-20261115 (#184) | 10 advanced-cases, по 2 SVG состояния | зависимость от #184 |
| [#182](https://github.com/Podtverzhdeno/Sber-Platform/pull/182) | main | 12 сценариев, базовая спецификация и casebook; **объединён 2026-11-15 14:56:55 UTC** | База библиотеки уже в main |
| [#188](https://github.com/Podtverzhdeno/Sber-Platform/pull/188) | main | **Объединён 2026-11-15**: 12 SVG, галереи, provenance и QA workflow | Уже присутствует в `main` |
| [#192](https://github.com/Podtverzhdeno/Sber-Platform/pull/192) | main | **Объединён 2026-11-15**: точные пути к файлам React, переносимый Node-валидатор | Уже присутствует в `main` |
| [#183](https://github.com/Podtverzhdeno/Sber-Platform/pull/183) | main | 9 component packs, Figma sources, browser comparator, measurements | **Apple UI kit/README.md** |
| [#198](https://github.com/Podtverzhdeno/Sber-Platform/pull/198) | main | **merged**: 16 original reference-cases SVG/README + fixed paths | Unique collection copied from #184 |
| [#199](https://github.com/Podtverzhdeno/Sber-Platform/pull/199) | main | **merged**: 20 dark/light SVG + gallery/manifest | Unique collection copied from #186 |
| [#200](https://github.com/Podtverzhdeno/Sber-Platform/pull/200) | main | **merged**: 38-case searchable 48-SVG gallery | New root `index.html` |
| [#201](https://github.com/Podtverzhdeno/Sber-Platform/pull/201) | main | **merged**: 9 component packs, 32 official source links, pixel comparator | Nested 08-component-packs, no root conflict |

**Важно:** ветки имеют собственные корневые README и многократно описывают одну задачу, но большинство каталогов и визуальных примеров у них *разные*. Простое «merge all PR» без контролируемой разрешающей правки README рискованно. Не делать force push и не создавать второй «истинный» `Apple UI kit`.

## Актуальный план без повторного импорта

1. **#182, #188, #192, #194, #198, #199, #200 и #201 уже объединены с main.** Проверять их текущее содержимое до любых новых изменений.
2. **#184 и #186 — исходные stacked PR.** Их уникальные SVG/галереи уже перенесены через #198/#199; не дублировать при дальнейшем merge.
3. **#183 — исходный компонентный PR.** Его 9 групп, реестр 32 ссылок, измерения и comparator интегрированы как отдельная папка `08-component-packs/` через #201; исходный PR открытый, требуется согласование закрытия с владельцем.
4. **#181 — оставшийся активный source-atlas.** Перепроверить свежий diff, перенести только действительно уникальные категории/материалы и не заменять канонический `Apple UI kit/README.md`.
5. Запускать структурный QA, проверку источников и визуальных галерей перед merge. Production React/CSS интегрировать только отдельно с сохранением маршрутов, API, роли, a11y и проверками UI.

### Текущие коллекции

- [Общий портал — 38 сценариев, 48 SVG](../index.html)
- [12 базовых SVG](../06-cases/VISUAL_GALLERY.md)
- [16 reference cases](../reference-cases/README.md)
- [10 advanced cases — 20 SVG light/dark](../advanced-cases/README.md)
- [9 компонентных пакетов и 32 источника](../08-component-packs/README.md)
- [Локальный инструмент сравнения](../08-component-packs/compare.html)
- [Таблица для замеров в Figma/Sketch](../08-component-packs/measurement-ledger.csv)

## Не путать разные коллекции

- `06-cases/` в #182: 12 сценариев и README; в #188 — 12 собственных SVG-схем 1600×900.
- `reference-cases/` в #184: 16 отдельных типов ситуаций.
- `advanced-cases/` в #186: 10 случаев в светлой и тёмной версиях.
- `01-liquid-glass-materials/` … `13-official-visual-references/` в #181: 13 других каталогов и SVG.
- `01-Liquid-Glass/` … `09-Applications-Patterns/` в #183: 9 блоков спецификации.

Похожесть тем ≠ совпадение файлов. Можно сгруппировать ссылками, не требуется дублировать артефакты при каждом переносе.

## Verification gate для release manager

- [ ] `git fetch` и сравнение актуального `main` / head каждой ветки.
- [ ] Проверка PR dependency chain; после merge родительского PR следить, чтобы не прилетели повторные файлы/исторические коммиты.
- [ ] Ни одного конфликта в корневом README, source manifest или лицензиях не разрешать автоматически «ours/theirs» без сравнения информации.
- [ ] `node "Apple UI kit/04-web-reference/verify-library.mjs"`, `python3 "Apple UI kit/04-web-reference/validate-svg-library.py"`, `python3 "Apple UI kit/advanced-cases/validate-advanced.py"`, `node "Apple UI kit/08-component-packs/verify.mjs"`; для отдельного source-atlas #181 применять его собственный валидатор.
- [ ] Открыть SVG и обе gallery в browser. Проверить, что каждый `<img>` грузится и читаем.
- [ ] Нет оригиналов Apple UI kit, SF Pro fonts, SF Symbols, встроенных сторонних скриншотов/логотипов.
- [ ] Пройден функциональный QA production app, если последующие изменения UI уже интегрированы.
- [ ] Публикация не утверждает pixel-perfect/native Liquid Glass без измеренных baseline screenshots.

**Ограничение:** приведены только подтверждённые данные о переносе уникального содержимого. Само слияние или закрытие исходных #181/#183/#184/#186 не утверждается. Не называйте SVG/CSS приблизительную реализацию pixel-perfect Apple или нативным Liquid Glass: для этого нужны исходные измерения разрешённых Figma/Sketch компонентов и отдельный визуальный QA.
