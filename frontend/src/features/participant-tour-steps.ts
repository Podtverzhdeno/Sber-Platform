export type GuideAccent = "cyan" | "violet" | "blue" | "amber";

export type GuideStep = {
  title: string;
  description: string;
  anchor: string;
  accent: GuideAccent;
  symbol: "layers" | "rocket" | "briefcase" | "message" | "star" | "book" | "compass" | "sparkles";
  label?: string;
};

// One compact tip per arrival, optional short manual walkthrough. Never a mandatory tour.
export const SECTION_TOURS: Record<string, GuideStep[]> = {
  "Главная": [
    { title: "Здесь начинается твой путь", description: "Выбирай реальные задачи и собирай опыт. Платформа поможет связать обучение, проекты и подтверждённые навыки.", anchor: "nav:Главная", accent: "cyan", symbol: "sparkles" },
    { title: "Найди интересную задачу", description: "В каталоге можно сравнить требования и выбрать подходящую задачу. Начинай с небольшой, если пока пробуешь направление.", anchor: "nav:Задачи", accent: "violet", symbol: "rocket" },
    { title: "Сохраняй результаты", description: "Принятые проекты и подтверждения складываются в портфолио — это конкретные примеры твоей работы.", anchor: "nav:Портфолио", accent: "blue", symbol: "briefcase" },
  ],
  "Задачи": [
    { title: "Выбирай задачи под свой интерес", description: "Посмотри описание и требования, чтобы понять, какую проблему предстоит решить.", anchor: ".catalog-v2-card, .catalog-v2-list-item, [data-testid^='task-card'], .catalog-v2-filters", accent: "violet", symbol: "rocket" },
    { title: "Сначала изучи условия", description: "Проверь критерии приёмки, ограничения и итоговые материалы. Сразу после отклика доступность работы зависит от правил конкретной задачи.", anchor: ".catalog-v2-detail, .catalog-v2-workflow-tabs, nav:Задачи", accent: "cyan", symbol: "layers" },
    { title: "Вопросы экономят время", description: "Если что-то непонятно, уточни ожидания у заказчика в доступном канале общения.", anchor: "nav:Сообщения", accent: "blue", symbol: "message" },
  ],
  "Мои проекты": [
    { title: "Все твои проекты — здесь", description: "Следи за статусами и выбирай, над каким проектом работать сейчас.", anchor: ".mp-filters, .mp-detail-hero, .mpv2", accent: "cyan", symbol: "layers" },
    { title: "Проверяй критерии и материалы", description: "Храни решение и подтверждения выполнения, чтобы заказчику было удобно проверить итог.", anchor: ".mp-detail-panel, .mp-table-project, .mp-project-tile, .mp-detail", accent: "amber", symbol: "star" },
    { title: "Не теряй обратную связь", description: "Открывай обсуждения, задавай вопросы и фиксируй договорённости с командой.", anchor: "nav:Сообщения", accent: "violet", symbol: "message" },
  ],
  "Портфолио": [
    { title: "Покажи, что ты сделал", description: "Проекты, результаты и подтверждения опыта помогут заказчику или HR оценить твой вклад.", anchor: ".p2-projects-panel, .p2-project, .p2-root", accent: "violet", symbol: "briefcase" },
    { title: "Skill Passport — доказательства навыков", description: "Здесь важно различать изученные темы и навыки, подтверждённые практической проверкой.", anchor: ".p2-passport-panel, .p2-passport-count, .p2-root", accent: "blue", symbol: "star" },
  ],
  "Аналитика": [
    { title: "Отслеживай реальный прогресс", description: "Активность, Skill Passport и сертификация показывают разные стороны роста. Смотри, что уже подтверждено.", anchor: ".av3-top, .analytics-v3", accent: "blue", symbol: "star" },
    { title: "Сравни свои компетенции", description: "Выдели навыки, которые хочешь усилить следующим курсом или проектом.", anchor: ".av3-embedded-passport, .analytics-v3", accent: "cyan", symbol: "compass" },
  ],
  "Моя траектория": [
    { title: "Развивайся по своему маршруту", description: "Выбери основной путь и проходи курсы и практику в нужной последовательности.", anchor: ".trajectory-v2, .trajectory-page, .workspace-content h1", accent: "violet", symbol: "compass" },
    { title: "Один шаг за раз", description: "Траекторию можно пересмотреть. Выбери ближайшее действие вместо попытки освоить всё сразу.", anchor: "nav:Bootcamp", accent: "blue", symbol: "book" },
  ],
  "Мой путь": [
    { title: "Выстраивай свой путь", description: "Соедини обучение и практику с будущей ролью, которой хочешь заниматься.", anchor: ".trajectory-v2, .workspace-content h1", accent: "violet", symbol: "compass" },
  ],
  "Bootcamp": [
    { title: "Учись для реальной практики", description: "Выбирай курсы по интересам и применяй знания на задачах. Сертификат и проверенный практический навык — не одно и то же.", anchor: ".bc-ref-course-grid, .bootcamp-catalog-toolbar, .bootcamp-experience", accent: "blue", symbol: "book" },
    { title: "Сразу закрепляй материал", description: "Начни с одного модуля и попробуй применить его в подходящей задаче.", anchor: "nav:Задачи", accent: "cyan", symbol: "rocket" },
  ],
  "Сообщения": [
    { title: "Общайся с заказчиком и командой", description: "Здесь удобно обсуждать требования, материалы и вопросы по ходу работы, когда диалог доступен.", anchor: ".messaging-workspace, .messages-layout, .workspace-content h1", accent: "violet", symbol: "message" },
    { title: "Уточняй до начала работы", description: "Согласуй ожидания и формат результата. Не отправляй конфиденциальные данные без разрешения.", anchor: "nav:Задачи", accent: "cyan", symbol: "layers" },
  ],
  "Достижения": [
    { title: "Не теряй свои достижения", description: "Здесь хранятся важные результаты и подтверждения твоего опыта.", anchor: ".workspace-content h1", accent: "amber", symbol: "star" },
  ],
  "Рейтинг": [
    { title: "Рейтинг — только один ориентир", description: "Следи за прогрессом, но не сравнивай свою ценность с местом в списке.", anchor: ".workspace-content h1", accent: "violet", symbol: "star" },
  ],
  "События": [
    { title: "Новые возможности для практики", description: "Выбирай полезные мероприятия, знакомства и задачи, а не просто максимальное число событий.", anchor: ".workspace-content h1", accent: "blue", symbol: "sparkles" },
  ],
  "AI-Buddy": [
    { title: "Есть вопрос — спроси", description: "AI-Buddy поможет разобраться в идеях и следующих шагах, но важные рекомендации стоит проверять.", anchor: ".workspace-content h1", accent: "cyan", symbol: "sparkles" },
  ],
  "Настройки": [
    { title: "Контролируй свой профиль", description: "Проверь настройки аккаунта и приватность информации, которой делишься.", anchor: ".workspace-content h1", accent: "blue", symbol: "layers" },
  ],
};


/** Smaller, focused overlays when a task or an assigned project is already open. */
export const TASK_DETAIL_TOUR: GuideStep[] = [
  { title: "Сначала изучи раздел «О задаче»", description: "Прочитай контекст, цель, ожидаемый результат и ограничения. Это сэкономит время перед началом работы.", anchor: ".catalog-v2-detail-header, .catalog-v2-detail", accent: "violet", symbol: "layers" },
  { title: "Критерии — это ориентир", description: "Проверь требования к результату и правила приёмки. Если чего-то не хватает — уточни у заказчика.", anchor: ".catalog-v2-workflow-tabs, .catalog-v2-workflow-panel", accent: "cyan", symbol: "star" },
  { title: "Доведи работу до проверки", description: "Открой рабочую область, сохраняй материалы и передавай решение по правилам задачи. Подтверждение навыков появляется после оценки.", anchor: ".catalog-v2-workflow-section, .catalog-v2-detail", accent: "blue", symbol: "rocket" },
];

export const PROJECT_DETAIL_TOUR: GuideStep[] = [
  { title: "Здесь всё для твоего проекта", description: "Работай с условиями, материалами и командой в одном пространстве.", anchor: ".mp-detail-hero, .mp-detail", accent: "cyan", symbol: "briefcase" },
  { title: "Сначала проверь требования", description: "Сверяй действия с критериями заказчика, прикладывай доказательства и сохраняй черновики.", anchor: ".mp-detail-panel, .mp-detail", accent: "amber", symbol: "star" },
  { title: "Согласуй сложные моменты", description: "Задавай вопросы по данным, срокам и формату результата через доступное обсуждение.", anchor: ".mp-detail-tabs, .mp-detail", accent: "violet", symbol: "message" },
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
