import { apiRequest } from "../api/client";
import type { CreateTaskBrief } from "./customer-create-task";

export type ServerCustomerTask = {
  id: string;
  project_key: string;
  task_key: string;
  title: string;
  status: "draft" | "submitted" | "awaiting_support" | "ready_to_publish" | "published";
  places: number;
  mode?: "open" | "invitation_only";
  competency_tags?: string[];
};

export type ServerTaskDetail = {
  task: ServerCustomerTask;
  problem: string;
  deliverable: string;
  acceptance_criteria: string[];
  data_constraints: string;
  ip_terms: string;
  terms: { deadline_at: string } | null;
};

const csrf = () => ({ "X-CSRF-Token": sessionStorage.getItem("impulse_csrf") ?? "" });
const criteria = (value: string) => value.split(/\n|;/).map(s => s.replace(/^\s*[-•\d.)]+\s*/, "").trim()).filter(Boolean).slice(0,30);

export function customerTaskPayload(brief: CreateTaskBrief, taskKey: string) {
  const rubric = brief.skills.length ? {
    version: 1,
    result: "Качество и полнота результата по критериям приёмки",
    reasoning: "Обоснованность выбранного метода и логики решения",
    uncertainty: "Указаны ограничения, риски и пограничные случаи",
    ai_use: "Прозрачность использования ИИ и возможность проверки",
    defense: "Демонстрация результата, воспроизводимость и ответы на вопросы",
  } : null;
  return {
    task_key: taskKey,
    title: brief.title.trim(),
    problem: [brief.shortSummary.trim(), brief.problem.trim(), `Сопровождение: ${brief.support.trim()}`].filter(Boolean).join("\n\n").slice(0,4000),
    deliverable: brief.deliverable.trim(),
    acceptance_criteria: criteria(brief.criteria),
    deadline_at: new Date(`${brief.deadline}T18:00:00`).toISOString(),
    data_constraints: brief.dataTerms.trim(),
    ip_terms: brief.ipTerms.trim(),
    nominated_mentor_id: null,
    places: brief.places,
    mode: brief.mode,
    competency_tags: brief.skills,
    case_rubric: rubric,
    catalog: { direction_keys: [], prerequisite_tags: brief.skills, difficulty: "intermediate" },
    compensation: {
      paid: false, base_amount_per_assignee: null, currency: null, a_multiplier: "2.50",
      quantum: "0.01", rounding_mode: "half_up", policy_version: 1,
      payout_condition: "Без денежной выплаты; индивидуальные бонусы определяются условиями программы",
    },
  };
}

/**
 * Persist on the server first. Retries recover the existing draft by its stable task key,
 * preventing duplicate tasks if the network fails between creation and submission.
 * No frontend code can moderate or publish a task: operator approval is required.
 */
export async function submitCustomerBrief(brief: CreateTaskBrief, taskKey: string): Promise<ServerCustomerTask> {
  if (brief.mode === "invitation_only") {
    throw new Error("Приглашения возможны только после выбора подтверждённых участников из серверной базы. Выберите открытую задачу.");
  }
  let existing: ServerCustomerTask | undefined;
  const owned = await apiRequest<ServerCustomerTask[]>("/api/v1/customer/tasks");
  existing = owned.find(task => task.project_key === "demo-rd-lab" && task.task_key === taskKey);
  if (!existing) {
    existing = await apiRequest<ServerCustomerTask>("/api/v1/customer/projects/demo-rd-lab/tasks", {
      method: "POST",
      headers: csrf(),
      body: JSON.stringify(customerTaskPayload(brief, taskKey)),
    });
  }
  if (existing.status === "draft") {
    return await apiRequest<ServerCustomerTask>(`/api/v1/customer/tasks/${existing.id}/submit`, {
      method: "POST", headers: csrf(),
    });
  }
  return existing;
}
