# Совмещение параллельных Apple UI kit PR для IMPULSE

**Срез:** 2026-11-15, ссылки и состояния PR проверены через GitHub в ходе этой работы. Статусы могут меняться после проверки.

## Что существует

| PR | Базовая ветка на момент аудита | Содержание | Путь риска |
|---|---|---|---|
| [#181](https://github.com/Podtverzhdeno/Sber-Platform/pull/181) | main | 13 каталожных категорий, ссылки, SVG, HIG, web reference gallery | **Apple UI kit/README.md** |
| [#184](https://github.com/Podtverzhdeno/Sber-Platform/pull/184) | docs/apple-ui-kit-refs-20261115 (#181) | 16 отдельный reference-cases/*.svg | зависимость от #181 |
| [#186](https://github.com/Podtverzhdeno/Sber-Platform/pull/186) | docs/apple-ui-kit-visual-cases-20261115 (#184) | 10 advanced-cases, по 2 SVG состояния | зависимость от #184 |
| [#182](https://github.com/Podtverzhdeno/Sber-Platform/pull/182) | main | 12 сценариев, базовая спецификация и casebook; **объединён 2026-11-15 14:56:55 UTC** | База библиотеки уже в main |
| [#188](https://github.com/Podtverzhdeno/Sber-Platform/pull/188) | main | Пост-merge дополнение: 12 оригинальных SVG, обе галереи, верификация, QA workflow | Новые материалы, без изменения frontend |
| [#183](https://github.com/Podtverzhdeno/Sber-Platform/pull/183) | main | 9 component packs, Figma sources, browser comparator, measurements | **Apple UI kit/README.md** |

**Важно:** ветки имеют собственные корневые README и многократно описывают одну задачу, но большинство каталогов и визуальных примеров у них *разные*. Простое «merge all PR» без контролируемой разрешающей правки README рискованно. Не делать force push и не создавать второй «истинный» `Apple UI kit`.

## Рекомендуемый безопасный порядок

1. Зафиксировать новейший `main`, проверить неизменность существующих production UI PR / claims, CI и авторов веток.
2. Ревью #181 как канонической индексной библиотеки; если одобрено, объединить #181 в main.
3. Перенастроить #184 на актуальный main после слияния #181, проверить diff исключительно `reference-cases/`, сравнить SHA файлов, CI и визуальные SVG. Объединить после ревью.
4. Аналогично #186 после #184, сохранив `advanced-cases/`.
5. Базовый #182 уже в `main`. PR #188 вносит только **новые** SVG, галереи, source verification, validator и ссылки в документации. Подкаталоги `01-sources/`, `02-specifications/`, `03-impulse/`, `04-web-reference/`, `05-legal-and-sources/` и `06-cases/` уже созданы. При слиянии других веток **объединять**, а не перезаписывать корневой README.
6. Перенести уникальное содержимое #183 (папки `01-Liquid-Glass` … `09-Applications-Patterns`, online comparator и measurement ledger) и включить их в канонический README.
7. Выполнить поиск всех `Apple UI kit/README.md`, проверку ссылок, provenance, лицензию, валидаторы каждой коллекции и пробный визуальный QA. После объединения оставить *один* входной README и единый индекс ссылок.

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
- [ ] `node "Apple UI kit/04-web-reference/verify-library.mjs"` и `python3 "Apple UI kit/04-web-reference/validate-svg-library.py"` для #188; `node "Apple UI kit/verify.mjs"` для #183, Python validator #181; запускать только если соответствующие пути присутствуют.
- [ ] Открыть SVG и обе gallery в browser. Проверить, что каждый `<img>` грузится и читаем.
- [ ] Нет оригиналов Apple UI kit, SF Pro fonts, SF Symbols, встроенных сторонних скриншотов/логотипов.
- [ ] Пройден функциональный QA production app, если последующие изменения UI уже интегрированы.
- [ ] Публикация не утверждает pixel-perfect/native Liquid Glass без измеренных baseline screenshots.

**Ограничение:** этот документ описывает проверенные состояния и предлагаемый порядок дальнейших слияний. #182 уже был объединён; PR #188 пока открыт, его слияние с `main` и дальнейшие слияния других веток здесь **не утверждаются**. Production frontend в этом PR не изменялся.
