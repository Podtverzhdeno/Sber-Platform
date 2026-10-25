/**
 * Strictly test-only composition data. Never import from production runtime.
 * Scenario volume approximates the approved 10-row table without presenting
 * mock companies, grades or forecast percentages as real user evidence.
 */
import { catalogItem, catalogPage, catalogTerms } from "../src/features/task-catalog-v2/fixture";
import type { CatalogItem } from "../src/features/task-catalog-v2/types";

// Visual-only company samples copied from the approved mock (not a list of real partners).
// The API projection below retains verification="demo" in every record.
const referenceCustomers = [
  "Сбер", "Т-Банк", "Astra", "Яндекс", "red_mad_robot",
  "Газпром нефть", "Сбер", "VK", "Positive Technologies", "Тинькофф",
] as const;

const taskTitles = [
  "Прототип рекомендательной системы для статей",
  "MVP чат-ассистента внутренних знаний",
  "Исследование методов сжатия изображений",
  "Прогнозирование нагрузки контактного центра",
  "Детекция аномалий сетевого трафика",
  "Разработка аналитического AI-ассистента",
  "Анализ пользовательских сценариев",
  "Классификация обращений с помощью NLP",
  "Оптимизация SQL-запросов для аналитики",
  "Исследование A/B-тестирования кампаний",
] as const;

const stages: CatalogItem["stage_plan"]["stages"] = [
  { key: "discovery", position: 1, title: "Анализ требований", summary: "Уточнение постановки", estimated_minutes: 60, state: "planned" },
  { key: "data", position: 2, title: "Подготовка данных", summary: "Исследование источников", estimated_minutes: 60, state: "locked" },
  { key: "prototype", position: 3, title: "Разработка прототипа", summary: "Проверка гипотезы", estimated_minutes: 120, state: "locked" },
  { key: "validation", position: 4, title: "Тестирование и оценка", summary: "Воспроизводимость", estimated_minutes: 120, state: "locked" },
  { key: "presentation", position: 5, title: "Презентация результата", summary: "Демонстрация", estimated_minutes: 60, state: "locked" },
];

const benefits: CatalogItem["benefits"] = [
  { code: "growth", label: "Развитие компетенций", benefit_type: "learning", state: "potential", condition: "Только после верификации", rule_kind: null, evidence_refs: [] },
  { code: "case", label: "Потенциальный кейс в портфолио", benefit_type: "portfolio", state: "potential", condition: "По условиям заказчика", rule_kind: null, evidence_refs: [] },
  { code: "team", label: "Работа над реальным процессом", benefit_type: "support", state: "potential", condition: "После согласования участия", rule_kind: null, evidence_refs: [] },
  { code: "feedback", label: "Обратная связь от ментора", benefit_type: "mentorship", state: "potential", condition: "При наличии назначенного ментора", rule_kind: null, evidence_refs: [] },
];

export const approvedGeometryTasks: CatalogItem[] = taskTitles.map((title, index) => ({
  ...catalogItem,
  task_id: `00000000-0000-4000-8000-${String(index + 300).padStart(12, "0")}`,
  title,
  customer: { ...catalogItem.customer, id: `00000000-0000-4000-8000-${String(index + 400).padStart(12, "0")}`, display_name: referenceCustomers[index], verification: "demo" },
  brief_summary: "Синтетическая задача для проверки верстки и навигации каталога",
  competency_tags: index % 2 ? ["Python", "Аналитика", "SQL"] : ["ML", "Python", "NLP"],
  match: { ...catalogItem.match, percent: (90 - index * 4).toFixed(2) },
  skill_impact: [
    { skill_id: "python", title: "Python", status: "qualitative", current_level: null, projected_level: null, model_version: null, explanation: "Требуется независимая проверка результата", verification_required: true },
    { skill_id: "ml", title: "Машинное обучение", status: "qualitative", current_level: null, projected_level: null, model_version: null, explanation: "Рост не рассчитывается без подтверждённой модели", verification_required: true },
  ],
  stage_plan: { version: 1, stages },
  benefits,
  direction_keys: ["ml", "analytics"],
  bookmarked: index === 0,
  allowed_actions: ["open_conditions", "apply", "bookmark", "share"],
}));

export const approvedGeometryPage = catalogPage(approvedGeometryTasks);
export const approvedGeometryTerms = {
  ...catalogTerms,
  task_id: approvedGeometryTasks[0].task_id,
  prerequisites: ["Основы Python", "Готовность к командной работе"],
  selection_criteria: ["Соответствие требованиям задачи", "Проверяемый опыт"],
  support_model: "Встречи с ментором после согласования",
};
