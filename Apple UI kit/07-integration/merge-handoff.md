# Совмещение параллельных Apple UI kit PR для IMPULSE

**Срез:** 2026-11-15, ссылки и состояния PR проверены через GitHub в ходе этой работы. Статусы могут меняться после проверки.

## Что существует

| PR | Базовая ветка на момент аудита | Содержание | Путь риска |
|---|---|---|---|
| [#181](https://github.com/Podtverzhdeno/Sber-Platform/pull/181) | main | 13 каталожных категорий, ссылки, SVG, HIG, web reference gallery | **Apple UI kit/README.md** |
| [#184](https://github.com/Podtverzhdeno/Sber-Platform/pull/184) | docs/apple-ui-kit-refs-20261115 (#181) | 16 отдельный reference-cases/*.svg | зависимость от #181 |
| [#186](https://github.com/Podtverzhdeno/Sber-Platform/pull/186) | docs/apple-ui-kit-visual-cases-20261115 (#184) | 10 advanced-cases, по 2 SVG состояния | зависимость от #184 |
| [#182](https://github.com/Podtverzhdeno/Sber-Platform/pull/182) | main | Базовые спецификации и casebook, **объединён 2026-11-15 14:56:55 UTC**; новые SVG и уточнения добавлены **после merge** и переносятся отдельным PR | Корневой README при следующем слиянии |
| [#183](https://github.com/Podtverzhdeno/Sber-Platform/pull/183) | main | 9 component packs, Figma sources, browser comparator, measurements | **Apple UI kit/README.md** |

**Важно:** ветки имеют собственные корневые README и многократно описывают одну задачу, но большинство каталогов и визуальных примеров у них *разные*. Простое «merge all PR» без контролируемой разрешающей правки README рискованно. Не делать force push и не создавать второй «истинный» \`Apple UI kit\`.

## Рекомендуемый безопасный порядок

1. Зафиксировать новейший \`main\`, проверить неизменность существующих production UI PR / claims, CI и авторов веток.
2. Ревью #181 как канонической индексной библиотеки; если одобрено, объединить #181 в main.
3. Перенастроить #184 на актуальный main после слияния #181, проверить diff исключительно \`reference-cases/\`, сравнить SHA файлов, CI и визуальные SVG. Объединить после ревью.
4. Аналогично #186 после #184, сохранив \`advanced-cases/\`.
5. Базовый #182 уже объединён; перенести только пост-merge изменения из нового PR (12 SVG, галерея, источники, тесты). Исходные каталоги уже в main: \`01-sources,\` \`02-specifications,\` \`03-impulse,\` \`04-web-reference,\` \`05-legal-and-sources,\` \`06-cases,\` \`07-integration\`) на свежий main. **В корневом README вручную объединить ссылки**, не перезаписывать README из #181.
6. Перенести уникальное содержимое #183 (папки \`01-Liquid-Glass\` … \`09-Applications-Patterns\`, online comparator и measurement ledger) и включить их в канонический README.
7. Выполнить поиск всех \`Apple UI kit/README.md\`, проверку ссылок, provenance, лицензию, валидаторы каждой коллекции и пробный визуальный QA. После объединения оставить *один* входной README и единый индекс ссылок.

## Не путать разные коллекции

- \`06-cases/\` в #182: 12 сценариев + 12 собственных схем векторного дизайна 1600×900.
- \`reference-cases/\` в #184: 16 отдельных типов ситуаций.
- \`advanced-cases/\` в #186: 10 случаев в светлой и тёмной версиях.
- \`01-liquid-glass-materials/\` … \`13-official-visual-references/\` в #181: 13 других каталогов и SVG.
- \`01-Liquid-Glass/\` … \`09-Applications-Patterns/\` в #183: 9 блоков спецификации.

Похожесть тем ≠ совпадение файлов. Можно сгруппировать ссылками, не требуется дублировать артефакты при каждом переносе.

## Verification gate для release manager

- [ ] \`git fetch\` и сравнение актуального \`main\` / head каждой ветки.
- [ ] Проверка PR dependency chain; после merge родительского PR следить, чтобы не прилетели повторные файлы/исторические коммиты.
- [ ] Ни одного конфликта в корневом README, source manifest или лицензиях не разрешать автоматически «ours/theirs» без сравнения информации.
- [ ] \`node "Apple UI kit/04-web-reference/verify-library.mjs"\` для #182, \`node "Apple UI kit/verify.mjs"\` для #183, Python validator #181; команды запускать только если соответствующие пути присутствуют.
- [ ] Открыть SVG и обе gallery в browser. Проверить, что каждый \`<img>\` грузится и читаем.
- [ ] Нет оригиналов Apple UI kit, SF Pro fonts, SF Symbols, встроенных сторонних скриншотов/логотипов.
- [ ] Пройден функциональный QA production app, если последующие изменения UI уже интегрированы.
- [ ] Публикация не утверждает pixel-perfect/native Liquid Glass без измеренных baseline screenshots.

**Ограничение:** этот документ описывает план и состояние на дату ревизии. Merge, rebase и применение к production frontend здесь **не выполнялись**.
