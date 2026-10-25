export type GuideAccent = "cyan" | "violet" | "blue" | "amber";

export type GuideStep = {
  title: string;
  description: string;
  anchor: string;
  accent: GuideAccent;
  symbol: "layers" | "rocket" | "briefcase" | "message" | "star" | "book" | "compass" | "sparkles";
  label?: string;
  topicId?: string;
};

// Contextual tours are deliberately optional; long instructions live in the help center.
export const SECTION_TOURS: Record<string, GuideStep[]> = {
  "Главная": [
    { title: "Здесь начинается твой путь", description: "Платформа помогает связать обучение, практику и проверенный результат. Выбирай комфортный ритм.", anchor: "nav:Главная", accent: "cyan", symbol: "sparkles", topicId: "start-why" },
    { title: "Найди интересную задачу", description: "Изучи реальные проблемы заказчиков и выбери ту, где сможешь принести пользу и вырасти.", anchor: "nav:Задачи", accent: "violet", symbol: "rocket", topicId: "task-discover" },
    { title: "Сохраняй результаты", description: "Принятые проекты и оценки важнее числа кликов. Собери их в портфолио и Skill Passport.", anchor: "nav:Портфолио", accent: "blue", symbol: "briefcase", topicId: "profile-case" },
  ],
  "Задачи": [
    { title: "Выбирай задачи под свой интерес", description: "Сравни сложность, сроки, требования и формат результата, а не только название.", anchor: ".catalog-v2-filters, .catalog-v2-workspace", accent: "violet", symbol: "rocket", topicId: "task-discover" },
    { title: "Прочитай условия до отклика", description: "Заказчик объясняет проблему, ограничения, файлы и результат. Открывай подробную карточку.", anchor: ".catalog-v2-detail, .catalog-v2-workflow-tabs, nav:Задачи", accent: "cyan", symbol: "layers", topicId: "task-brief" },
    { title: "Проверь критерии приёмки", description: "Выпиши обязательные условия и заранее подумай, чем докажешь выполнение.", anchor: ".catalog-v2-workflow-tabs, nav:Задачи", accent: "blue", symbol: "star", topicId: "task-criteria" },
    { title: "Отклик ещё не назначение", description: "Пока заявка рассматривается, изучай только доступные условия и подготовительные материалы.", anchor: ".catalog-v2-detail-actions, nav:Задачи", accent: "amber", symbol: "compass", topicId: "task-apply" },
    { title: "Продумай передачу решения", description: "Файлы, ссылки и инструкция должны быть проверяемы. Оценка появляется после проверки.", anchor: "nav:Мои проекты", accent: "cyan", symbol: "briefcase", topicId: "task-submit" },
  ],
  "Мои проекты": [
    { title: "Держи проект перед глазами", description: "Здесь сосредоточены условия, команда, этапы и твой вклад. Начни с обзора.", anchor: ".mp-detail-hero, .mp-project-list, .my-projects-v2", accent: "cyan", symbol: "briefcase", topicId: "project-overview" },
    { title: "Смотри актуальные требования", description: "Перед выполнением сверь критерии и актуальную версию задания.", anchor: ".mp-detail-tabs, .mp-detail-panel, nav:Мои проекты", accent: "blue", symbol: "star", topicId: "task-criteria" },
    { title: "Управляй своим прогрессом", description: "Отличай запланированное от выполненного и подтверждённого; замечай блокеры вовремя.", anchor: ".mp-detail-tabs, nav:Мои проекты", accent: "violet", symbol: "compass", topicId: "project-progress" },
    { title: "Сохраняй доказательства вклада", description: "Опиши личную роль, добавь разрешённые артефакты и версии решения.", anchor: ".mp-detail-tabs, nav:Мои проекты", accent: "amber", symbol: "layers", topicId: "project-contribution" },
    { title: "Не оставляй вопросы без ответа", description: "Согласуй непонятные требования и формат результата в доступном диалоге.", anchor: "nav:Сообщения", accent: "blue", symbol: "message", topicId: "messages-start" },
  ],
  "Bootcamp": [
    { title: "Выбирай курс под реальную цель", description: "Смотри навыки и практику, необходимые для ближайшей задачи, а не просто количество уроков.", anchor: ".bc-ref-course-grid, .bootcamp-catalog-toolbar, .bootcamp-experience", accent: "blue", symbol: "book", topicId: "course-choose" },
    { title: "Теория → пример → практика", description: "Не спеши отмечать материал пройденным: попробуй применить знание самостоятельно.", anchor: ".bootcamp-experience, nav:Bootcamp", accent: "cyan", symbol: "layers", topicId: "course-content" },
    { title: "Проверь задание до сдачи", description: "Уточни формат результата, обязательные требования и способ проверки.", anchor: ".bootcamp-experience, nav:Bootcamp", accent: "violet", symbol: "star", topicId: "course-practice" },
    { title: "Завершение курса — не вся оценка", description: "Проверь, засчитались ли шаги, нужен ли тест и как выдаётся подтверждение.", anchor: "nav:Аналитика", accent: "amber", symbol: "compass", topicId: "course-complete" },
    { title: "Применяй знания на задачах", description: "Закреплённый практикой навык ценнее формальной отметки о прохождении.", anchor: "nav:Задачи", accent: "cyan", symbol: "rocket", topicId: "task-discover" },
  ],
  "Моя траектория": [
    { title: "Траектория под твою роль", description: "Посмотри, какие компетенции нужны, чтобы двигаться к выбранному направлению.", anchor: ".trajectory-v2, .trajectory-page, nav:Моя траектория", accent: "violet", symbol: "compass", topicId: "path-start" },
    { title: "Не смешивай типы прогресса", description: "Пройденный урок, выполненный проект и подтверждённый навык показывают разные факты.", anchor: ".trajectory-v2-passport-panel, .trajectory-v2", accent: "cyan", symbol: "star", topicId: "path-progress" },
    { title: "Выбирай ближайший шаг", description: "Лучше одно достижимое действие, чем десяток параллельных намерений.", anchor: ".trajectory-v2-action-status, .trajectory-v2", accent: "blue", symbol: "rocket", topicId: "start-pace" },
    { title: "Закрой пробел обучением", description: "Найди курс, который поможет решить конкретную задачу.", anchor: "nav:Bootcamp", accent: "cyan", symbol: "book", topicId: "course-choose" },
  ],
  "Мой путь": [
    { title: "Пойми общую картину роста", description: "Связывай роль, обучение и практические доказательства навыков.", anchor: ".trajectory-v2, nav:Мой путь", accent: "violet", symbol: "compass", topicId: "path-start" },
    { title: "Смотри на подтверждения", description: "Активность и сертификация — разные части опыта.", anchor: "nav:Аналитика", accent: "blue", symbol: "star", topicId: "passport" },
    { title: "Планируй следующий результат", description: "Выбирай небольшой шаг, который можно завершить и проверить.", anchor: "nav:Задачи", accent: "cyan", symbol: "rocket", topicId: "task-discover" },
  ],
  "Портфолио": [
    { title: "Покажи, что ты сделал", description: "Главное — твоя роль, решённая проблема и проверяемый итог, а не список красивых слов.", anchor: ".p2-projects-panel, .p2-root", accent: "violet", symbol: "briefcase", topicId: "profile-case" },
    { title: "Подтверждения усиливают профиль", description: "Добавляй сертификаты и оценки с понятным источником и условиями выдачи.", anchor: ".p2-passport-panel, .p2-root", accent: "blue", symbol: "star", topicId: "passport" },
    { title: "Проверь видимость кейсов", description: "Перед показом HR убедись, что разрешения и доступ к материалам соответствуют правилам.", anchor: ".p2-root, nav:Портфолио", accent: "cyan", symbol: "layers", topicId: "profile-visibility" },
    { title: "Сделай профиль понятным", description: "Выбери специализацию и несколько сильных кейсов, которые подтверждают твой уровень.", anchor: "nav:Настройки", accent: "amber", symbol: "compass", topicId: "profile-search" },
  ],
  "Аналитика": [
    { title: "Активность — это ритм", description: "Она показывает участие, но не заменяет проверку качества работ.", anchor: ".av3-top, .analytics-v3", accent: "blue", symbol: "compass", topicId: "analytics-activity" },
    { title: "Skill Passport показывает источники", description: "Отделяй заявленные навыки от тех, что подтверждены практикой.", anchor: ".av3-embedded-passport, .analytics-v3", accent: "cyan", symbol: "star", topicId: "passport" },
    { title: "Сертификация требует критериев", description: "Узнай, какая проверка нужна и где отображается опубликованный результат.", anchor: ".av3-cert-pair, .analytics-v3", accent: "violet", symbol: "layers", topicId: "certification" },
    { title: "Выбирай следующую цель по фактам", description: "Найди навыки без практического подтверждения и подбери полезную задачу.", anchor: "nav:Задачи", accent: "amber", symbol: "rocket", topicId: "path-progress" },
  ],
  "Сообщения": [
    { title: "Задавай конкретные вопросы", description: "Назови задачу, место затруднения и ожидаемый ответ — так проще помочь.", anchor: ".messaging-workspace, .messages-layout, nav:Сообщения", accent: "violet", symbol: "message", topicId: "messages-start" },
    { title: "Показывай, что уже попробовал", description: "Если застрял, опиши фактический результат и безопасный способ повторить ошибку.", anchor: ".messaging-workspace, nav:Сообщения", accent: "cyan", symbol: "layers", topicId: "messages-blocker" },
    { title: "Сохраняй договорённости", description: "Уточнённые требования стоит переносить в рабочий план и проверять до сдачи.", anchor: "nav:Мои проекты", accent: "blue", symbol: "briefcase", topicId: "messages-feedback" },
  ],
  "Достижения": [
    { title: "Разберись, за что дана награда", description: "Открывай детали достижения и проверяй источник.", anchor: ".workspace-content h1", accent: "amber", symbol: "star", topicId: "achievements" },
    { title: "Сохраняй подтверждение", description: "Сертификат, диплом и принятый проект имеют разные правила выдачи.", anchor: "nav:Портфолио", accent: "violet", symbol: "briefcase", topicId: "profile-rewards" },
  ],
  "Рейтинг": [
    { title: "Рейтинг — только ориентир", description: "Не сравнивай ценность своего опыта с одним числом.", anchor: ".workspace-content h1", accent: "violet", symbol: "star", topicId: "start-pace" },
    { title: "Качество важнее количества", description: "Посмотри на принятые работы и подтверждения, а не только активность.", anchor: "nav:Аналитика", accent: "cyan", symbol: "compass", topicId: "analytics-activity" },
  ],
  "События": [
    { title: "Выбирай события с пользой", description: "Учитывай навыки, которые сможешь развить, и доступное время.", anchor: ".workspace-content h1", accent: "blue", symbol: "sparkles", topicId: "start-why" },
    { title: "Сохраняй значимые результаты", description: "После мероприятия проверь, есть ли подтверждение участия или достижения.", anchor: "nav:Достижения", accent: "amber", symbol: "star", topicId: "achievements" },
  ],
  "AI-Buddy": [
    { title: "Помощь не заменяет твоё решение", description: "Проверяй подсказки на требованиях задачи и разрешённых источниках.", anchor: ".workspace-content h1", accent: "cyan", symbol: "sparkles", topicId: "task-prepare" },
  ],
  "Настройки": [
    { title: "Управляй доступом к данным", description: "Проверь видимость кейсов, контактов и разрешений для HR.", anchor: ".workspace-content h1", accent: "blue", symbol: "layers", topicId: "profile-visibility" },
    { title: "Выбери комфортный режим", description: "Настройки нужны, чтобы платформа подстраивалась под тебя.", anchor: "nav:Главная", accent: "cyan", symbol: "compass", topicId: "start-pace" },
  ],
};

export const TASK_DETAIL_TOUR: GuideStep[] = [
    { title: "Начни с постановки проблемы", description: "Кто заказчик, какой нужен результат, какие данные и ограничения доступны?", anchor: ".catalog-v2-detail-header, .catalog-v2-detail", accent: "violet", symbol: "layers", topicId: "task-brief" },
    { title: "Проверь условия приёмки", description: "Изучи обязательные критерии и то, чем будет подтверждаться их выполнение.", anchor: ".catalog-v2-workflow-tabs, .catalog-v2-workflow-panel", accent: "cyan", symbol: "star", topicId: "task-criteria" },
    { title: "Раздели отклик и выполнение", description: "Отклик не означает назначения. Некоторые подготовительные материалы могут быть доступны раньше.", anchor: ".catalog-v2-detail-actions, .catalog-v2-workflow-section", accent: "amber", symbol: "compass", topicId: "task-before-approval" },
    { title: "Подготовь воспроизводимое решение", description: "Спланируй этапы, проверь результат и сохрани ссылки на артефакты.", anchor: ".catalog-v2-workflow-panel, .catalog-v2-detail", accent: "blue", symbol: "rocket", topicId: "task-prepare" },
    { title: "Отправка — ещё не подтверждение", description: "После передачи дождись проверки и используй замечания для доработок.", anchor: ".catalog-v2-workflow-section, .catalog-v2-detail", accent: "cyan", symbol: "briefcase", topicId: "task-review" },
];

export const PROJECT_DETAIL_TOUR: GuideStep[] = [
    { title: "Здесь вся работа по проекту", description: "Условия, команда, прогресс и твой вклад связаны и доступны по вкладкам.", anchor: ".mp-detail-hero, .mp-detail", accent: "cyan", symbol: "briefcase", topicId: "project-overview" },
    { title: "Критерии задают приоритет", description: "Перед работой проверь актуальную версию требований.", anchor: ".mp-detail-tabs, .mp-detail-panel", accent: "blue", symbol: "star", topicId: "task-criteria" },
    { title: "Фиксируй именно свой вклад", description: "Приложи версии, ссылки и описание собственной работы.", anchor: ".mp-detail-tabs, .mp-detail-panel", accent: "amber", symbol: "layers", topicId: "project-contribution" },
    { title: "Проверь комплектность сдачи", description: "Убедись, что ссылки доступны, инструкция понятна, файлы соответствуют условиям.", anchor: ".mp-detail-tabs, .mp-detail-panel", accent: "violet", symbol: "rocket", topicId: "task-submit" },
    { title: "Реагируй на обратную связь", description: "Уточни замечания и подготовь новую версию, если проверка запросила доработку.", anchor: ".mp-detail-tabs, .mp-detail-panel", accent: "cyan", symbol: "message", topicId: "task-review" },
];

export const clampToViewport = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

export function locatePopover(
  anchor: { left: number; right: number; top: number; bottom: number; width: number; height: number },
  card: { width: number; height: number },
  screen: { width: number; height: number },
): { left: number; top: number; side: "left" | "right" | "top" | "bottom" } {
  const margin = 12;
  const spaceRight = screen.width - anchor.right;
  const spaceLeft = anchor.left;
  const spaceBelow = screen.height - anchor.bottom;
  const spaceAbove = anchor.top;
  let side: "left" | "right" | "top" | "bottom";
  if (spaceRight >= card.width + 26) side = "right";
  else if (spaceLeft >= card.width + 26) side = "left";
  else if (spaceBelow >= card.height + 25) side = "bottom";
  else if (spaceAbove >= card.height + 25) side = "top";
  else side = spaceBelow >= spaceAbove ? "bottom" : "top";
  const horizontal = side === "right" ? anchor.right + 16 : side === "left" ? anchor.left - card.width - 16 : anchor.left + anchor.width / 2 - card.width / 2;
  const vertical = side === "bottom" ? anchor.bottom + 14 : side === "top" ? anchor.top - card.height - 14 : anchor.top + anchor.height / 2 - card.height / 2;
  return { side, left: clampToViewport(horizontal, margin, Math.max(margin, screen.width - card.width - margin)), top: clampToViewport(vertical, margin, Math.max(margin, screen.height - card.height - margin)) };
}
