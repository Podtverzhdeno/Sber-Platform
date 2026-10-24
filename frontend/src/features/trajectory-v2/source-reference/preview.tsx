/* ISOLATED QA PREVIEW ONLY. Never import into App.tsx or production routes.
 * Source demonstrative fixtures are intentionally confined to this file. */
import { useState } from "react";
import { createRoot } from "react-dom/client";

import { overviewFixture } from "../../participant-home-v2/fixture";
import type { RoadmapView, RoleCardView } from "../client";
import { SourceTrajectoryLayout } from "./source-layout";

const roles: RoleCardView[] = [
  { track_key: "product", title: "Продуктовый аналитик", state: "active", attempt_number: 1, completed_milestones: 2, total_milestones: 7 },
  { track_key: "ml", title: "ML-инженер", state: "active", attempt_number: 1, completed_milestones: 3, total_milestones: 4 },
  { track_key: "python", title: "Python-разработчик", state: "paused", attempt_number: 1, completed_milestones: 2, total_milestones: 4 },
  { track_key: "data", title: "Аналитик данных", state: "unselected", attempt_number: null, completed_milestones: 0, total_milestones: 0 },
  { track_key: "backend", title: "Backend-разработчик", state: "unselected", attempt_number: null, completed_milestones: 0, total_milestones: 0 },
  { track_key: "ux", title: "UX/UI-дизайнер", state: "unselected", attempt_number: null, completed_milestones: 0, total_milestones: 0 },
  { track_key: "manager", title: "Менеджер проекта", state: "unselected", attempt_number: null, completed_milestones: 0, total_milestones: 0 },
];
const stageNames = [
  "База и основы", "Исследование пользователей", "Продуктовые гипотезы",
  "Метрики и приоритизация", "Реальные задачи и проекты", "Подтверждение компетенций", "Новые возможности",
];
const roadmap: RoadmapView = {
  track_key: "product",
  policy_version: 1,
  replacement_reason: null,
  milestones: stageNames.map((title, index) => ({
    key: `stage-${String(index + 1)}`,
    position: index + 1,
    title,
    purpose: index === 2 ? "Формулирование и проверка гипотез по результатам исследований" : title,
    skill: "Продуктовое мышление",
    target_kind: "task",
    target_key: `qa-task-${String(index + 1)}`,
    completed: index < 2,
    deliverable: null,
  })),
  next_step: {
    key: "stage-3", position: 3, title: "Продуктовые гипотезы",
    purpose: "Формулирование и проверка гипотез по результатам исследований",
    skill: "Продуктовое мышление", target_kind: "task", target_key: "qa-task-3", completed: false, deliverable: null,
  },
};
const grade = {
  ...overviewFixture.concepts.career_grade,
  state: "ready" as const,
  current_grade: "5",
  target_grade: "6",
  readiness_percent: 88,
  hint: "Остался 1 шаг",
  reason: null,
};
const baselineNextOutcome = overviewFixture.next_outcome;
if (baselineNextOutcome === null) throw new Error("Preview fixture must have next_outcome");
const nextOutcome = {
  ...baselineNextOutcome,
  trajectory_key: "product",
  trajectory_title: "Продуктовый аналитик",
  milestone_key: "stage-3",
  milestone_position: 3,
  target_kind: "task" as const,
  target_key: "qa-task-3",
  target_title: "Оценка и приоритизация гипотез",
};
export function Preview() {
  const [roleKey, setRoleKey] = useState("product");
  const [stageKey, setStageKey] = useState("stage-3");
  const [notice, setNotice] = useState("");
  const roleRoadmap = roleKey === "product" ? roadmap : null;
  return <div className="preview-app">
    <div className="preview-sidebar"><strong>◈ Impulse</strong><nav>Главная<div className="active">Моя траектория</div>Bootcamp<div>Задачи</div>Мои проекты<div>События</div>Сообщения<div>Портфолио</div>Достижения<div>Аналитика</div>AI Buddy<div>Настройки</div></nav></div>
    <div className="preview-main">
      <div className="preview-topbar"><div>⌕ Поиск по задачам, навыкам, проектам, людям...</div><span>◯ Алексей Смирнов  Участник</span></div>
      <main className="preview-workspace">
        <SourceTrajectoryLayout
          roles={roles} selectedRoleKey={roleKey} primaryRoleKey="product"
          roadmap={roleRoadmap} selectedStageKey={stageKey}
          grade={grade} nextOutcome={nextOutcome}
          competencies={[
            { key: "Аналитика данных", confirmed_case_count: 7, practical_level: "verified" },
            { key: "Продуктовое мышление", confirmed_case_count: 6, practical_level: "verified" },
            { key: "Коммуникация", confirmed_case_count: 8, practical_level: "verified" },
            { key: "Бизнес-анализ", confirmed_case_count: 4, practical_level: "verified" },
          ]}
          stageTasks={[
            { id: "qa-a", title: "Анализ пользовательских интервью", kind: "Исследование", status: "completed", xp: 150 },
            { id: "qa-b", title: "Продуктовые гипотезы и JTBD", kind: "Теория", status: "completed", xp: 120 },
            { id: "qa-c", title: "Оценка и приоритизация гипотез", kind: "Практическая задача", status: "current", xp: 150 },
          ]}
          onSelectRole={key => { setRoleKey(key); setStageKey("stage-3"); }}
          onSelectStage={setStageKey}
          onOpenRole={() => { setNotice("О роли — тестовый стенд"); }}
          onOpenActions={() => { setNotice("Меню — тестовый стенд"); }}
          onOpenGrades={() => { setNotice("Грейды — тестовый стенд"); }}
          onOpenTask={() => { setNotice("Детали задания — тестовый стенд"); }}
          onOpenNext={() => { setNotice("Следующий шаг — тестовый стенд"); }}
          onOpenPassport={() => { setNotice("Скилл-паспорт — тестовый стенд"); }}
        />
        {notice && <div role="status">{notice}</div>}
      </main>
    </div>
    <style>{`
      .preview-app{display:grid;grid-template-columns:236px minmax(0,1fr);min-height:100vh;background:#04111e;color:#f2f6fc;font-family:Inter,Arial,sans-serif}
      .preview-sidebar{padding:17px;background:#031320;border-right:1px solid #17364d;font-size:14px}
      .preview-sidebar>strong{font-size:20px}
      .preview-sidebar nav{display:grid;gap:14px;margin-top:36px;color:#acbed0}
      .preview-sidebar nav>div{padding:9px}
      .preview-sidebar nav>.active{background:#064454;color:#16f0e6;border-left:3px solid #16f0e6}
      .preview-topbar{height:66px;border-bottom:1px solid #17364d;display:flex;align-items:center;justify-content:space-between;padding:0 25px;color:#a8c4de;font-size:12px}
      .preview-workspace{padding:0 24px}
      @media(max-width:890px){.preview-app{grid-template-columns:1fr}.preview-sidebar{display:none}.preview-topbar{height:52px}.preview-workspace{padding:0 12px}}
    `}</style>
  </div>;
}
const root = document.getElementById("root");
if (root === null) throw new Error("Missing QA preview root");
createRoot(root).render(<Preview />);
