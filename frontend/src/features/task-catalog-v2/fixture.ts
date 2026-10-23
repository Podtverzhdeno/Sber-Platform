import type { CatalogItem, CatalogPage, CatalogTerms } from "./types";

export const catalogItem: CatalogItem = {
  task_id: "00000000-0000-4000-8000-000000000101",
  snapshot_version: "task-snapshot-1",
  brief_version: 1,
  terms_version: 3,
  title: "Прототип рекомендательной системы",
  customer: {
    id: "00000000-0000-4000-8000-000000000007",
    display_name: "R&D лаборатория",
    verification: "demo",
  },
  brief_summary: "Проверить гипотезу и подготовить воспроизводимый прототип.",
  competency_tags: ["python", "recommender-systems"],
  difficulty: "intermediate",
  duration_minutes: 540,
  work_format: "remote",
  places_total: 3,
  places_available: 2,
  deadline_at: "2026-11-20T18:00:00Z",
  eligibility: { status: "eligible", reason_codes: [], missing_prerequisites: [] },
  match: {
    status: "calculated",
    percent: "84.00",
    coverage: "1.00",
    algorithm_version: "task-match-v1",
    source_snapshot_version: "participant-snapshot-1",
    calculated_at: "2026-10-23T12:00:00Z",
    reasons: [
      { code: "MATCH", label: "Соответствие роли и требованиям: 100%; подтверждённые компетенции: 80%" },
      { code: "GROWTH", label: "Соответствие целям развития: 50%" },
      { code: "FORMAT_FIT", label: "Формат и нагрузка: 100%" },
    ],
    missing_factors: [],
    growth_fit_percent: "50.00",
  },
  skill_impact: [
    {
      skill_id: "python",
      title: "python",
      status: "qualitative",
      current_level: null,
      projected_level: null,
      model_version: null,
      explanation: "Результат требует проверки; числовой прогноз не рассчитывается.",
      verification_required: true,
    },
  ],
  stage_plan: {
    version: 1,
    stages: [
      {
        key: "discovery",
        position: 1,
        title: "Исследование",
        summary: "Уточнить гипотезу и ограничения.",
        estimated_minutes: null,
        state: "planned",
      },
    ],
  },
  benefits: [
    {
      code: "compensation",
      label: "Оплачиваемое участие",
      state: "potential",
      condition: "После приёмки личного вклада.",
      benefit_type: "compensation",
      rule_kind: null,
      evidence_refs: [],
    },
  ],
  application_state: "none",
  allowed_actions: ["open_conditions", "apply", "bookmark", "share"],
  generated_at: "2026-10-23T12:00:00Z",
  bookmarked: false,
  application_id: null,
  assignment_id: null,
  direction_keys: ["python", "ml"],
  weekly_workload_minutes: 240,
  created_at: "2026-10-20T12:00:00Z",
  support_model: "mentor_review",
};

export const insufficientItem: CatalogItem = {
  ...catalogItem,
  task_id: "00000000-0000-4000-8000-000000000102",
  title: "Исследование компьютерного зрения",
  match: {
    ...catalogItem.match,
    status: "insufficient_data",
    percent: null,
    coverage: "0.50",
    reasons: [],
    missing_factors: ["ROLE_REQUIREMENTS", "FORMAT_FIT"],
    growth_fit_percent: null,
  },
  eligibility: {
    status: "ineligible",
    reason_codes: ["PREREQUISITES_NOT_MET"],
    missing_prerequisites: ["computer-vision"],
  },
  allowed_actions: ["bookmark", "share"],
  bookmarked: true,
};

export const catalogTerms: CatalogTerms = {
  task_id: catalogItem.task_id,
  terms_version: 3,
  brief_version: 1,
  version_token: '"terms-marker-1"',
  duration_minutes: 540,
  weekly_workload_minutes: 240,
  deliverable: "Репозиторий, прототип и отчёт.",
  prerequisites: [],
  selection_criteria: ["Подтверждённые компетенции"],
  support_model: "mentor",
  ip_terms: "Авторство сохраняется у участника.",
  portfolio_permission: "conditional",
  paid: true,
  payout_condition: "После приёмки личного вклада.",
  deadline_at: catalogItem.deadline_at,
  data_constraints: "Только синтетические данные.",
};

export function catalogPage(
  items: CatalogItem[],
  nextCursor: string | null = null,
): CatalogPage {
  return {
    items,
    total_found: items.length,
    total_available: items.filter((item) => item.eligibility.status === "eligible").length,
    next_cursor: nextCursor,
    total_saved: items.filter((item) => item.bookmarked).length,
    total_calculated: items.filter((item) => item.match.status === "calculated").length,
    snapshot_at: "2026-10-23T12:00:00Z",
  };
}
