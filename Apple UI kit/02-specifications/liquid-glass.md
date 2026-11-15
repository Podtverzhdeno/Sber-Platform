# Liquid Glass: техническая спецификация референса

**Официальная база:** https://developer.apple.com/design/human-interface-guidelines/materials и https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass

## 1. Архитектура визуальных слоёв

1. **Content layer:** обычный фон, данные, формы, карточки, таблицы, иллюстрации и графики. Использует solid/standard material; стекло здесь по умолчанию **не** применяется.
2. **Functional layer (Liquid Glass):** плавающие навигационные и управляющие элементы (toolbar, tab bar, sidebar в подходящих режимах, плавающие action controls).
3. **Presentation layer:** alerts, menus, popovers, sheets, которые требуют контраста, правильного z-index, focus management и читаемости.

**Антипаттерн:** glass на всех карточках сразу, многократные вложенные blurs, разноцветные светящиеся обводки и случайные градиенты.

## 2. Материалы

| Материал | Где использовать | Где не использовать |
|---|---|---|
| Liquid Glass **regular** | sidebar, toolbar, popover, alert, где важна читаемость | фактический текстовый документ или любая data card |
| Liquid Glass **clear** | компактный floating control поверх богатого медиа | длинный текст над ярким фоном без затемнения |
| Standard material **ultraThin / thin / regular / thick** | вложенные слои контента, визуальное разделение | как универсальный заменитель всех фонов |
| Solid surface | рабочие таблицы, чат-панель, список задач, data card | плавающая управляющая панель, если она должна показывать контекст под собой |

Apple прямо рекомендует использовать Liquid Glass умеренно. Для clear поверх яркого фона Apple допускает отдельный тёмный dimming layer около **35%**, исходя из контраста. Это не универсальная константа для всех экранов.

## 3. Как выглядит настоящая динамика

- Цвет и свет материала адаптируются к тому, что под ним; стекло не имеет собственного фиксированного цвета.
- По умолчанию компоненты фокусируют внимание на содержимом, а не на эффекте.
- При прикосновении / указателе контрол может визуально изменять форму/выраженность, а navigation elements могут переходить в контекстные menus.
- Адаптация к light/dark, повышенному контрасту, reduced transparency и reduced motion — обязательная часть продукта.
- Плавающие панели могут сопровождать скролл; их содержимое не должно становиться нечитаемым.

## 4. Web-адаптация для React/CSS (приближённая, не нативная)

- Web API: backdrop-filter: blur(...) saturate(...), полутонированный background, деликатный border + soft shadow; плюс @supports fallback без filter.
- Значения в 04-web-reference — **проектные гипотезы**, НЕ выгрузка официальных размеров, blur radii или opacities Apple.
- Не компилировать / не притворяться использованием SwiftUI glassEffect внутри веба.
- Контролы должны иметь явные :hover, :active, :focus-visible, :disabled; анимация должна отключаться в prefers-reduced-motion.
- При prefers-reduced-transparency (где поддерживается) и forced-colors использовать непрозрачный фон / системные цвета.
- На скролле учитывать clipping, stacking contexts, GPU cost и z-index для open popover / toast / modal.
- Sidebar на десктопе допускается стеклянной; **сами сообщения и карточки** остаются контентным слоем.

## 5. Проверки

- Проверять over-photo, over-text, high-contrast content; light/dark.
- Screenshot comparisons вести по референсному **конкретному экрану/состоянию/устройству**, не сравнивать web-приближение с native rendering как автоматическое требование pixel equality.
- Нет потери доступности при отключении backdrop-filter.
- Нет мерцаний, чрезмерного blur, контрастных полос при скролле и кадровых просадок на слабой видеокарте.
- Не навешивать motion только ради красоты.

**Оригинальный источник правды:** официальный Apple UI Kit 27 из 01-sources/official-links.md.
