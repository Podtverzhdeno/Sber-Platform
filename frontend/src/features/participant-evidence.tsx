import { useQuery } from "@tanstack/react-query";
import { learningSummaryQueryKey, loadLearningSummary } from "./learning-progress";
import "./participant-evidence.scss";

type Journey = { stages: { key: string; count: number }[] };

export function ParticipantEvidence({ compact = false }: { compact?: boolean }) {
  const learning = useQuery({
    queryKey: learningSummaryQueryKey,
    queryFn: loadLearningSummary,
    refetchOnMount: "always",
  });
  const work = useQuery({
    queryKey: ["participant-analytics"],
    queryFn: async () => {
      const { apiRequest } = await import("../api/client");
      return apiRequest<Journey>("/api/v1/me/analytics/journey");
    },
    refetchOnMount: "always",
  });
  const summary = learning.data;
  const accepted = work.data?.stages.find(stage => stage.key === "verified_experience")?.count;
  const recent = summary?.courses.filter(course => course.finished).slice(0, compact ? 1 : 2) ?? [];
  return <section className={"participant-evidence" + (compact ? " participant-evidence--compact" : "")}
    data-testid="participant-live-evidence" aria-label="Мой подтверждённый учебный прогресс Impulse">
    <div className="participant-evidence__heading">
      <strong>Мои результаты в Impulse</strong>
      <small>Данные аккаунта · обучение и практика</small>
    </div>
    {learning.isPending && <p role="status">Загружаем учебные результаты…</p>}
    {learning.isError && <p role="alert">Учебные результаты недоступны. <button type="button" onClick={() => { void learning.refetch(); }}>Повторить</button></p>}
    {summary && <div className="participant-evidence__metrics">
      <div><b data-testid="evidence-courses">{summary.finished_courses}</b><span>курсов пройдено</span></div>
      <div><b data-testid="evidence-lessons">{summary.completed_lessons}</b><span>уроков завершено</span></div>
      <div><b data-testid="evidence-practices">{summary.credited_practices}</b><span>практик зачтено</span></div>
      <div><b data-testid="evidence-accepted">{work.isError || work.isPending || accepted === undefined ? "—" : accepted}</b><span>принятых работ</span></div>
    </div>}
    {recent.length > 0 && <div className="participant-evidence__recent">
      <span>Последние курсы</span>
      {recent.map(course => <span key={course.course_key} className="participant-evidence__course">{course.title}</span>)}
    </div>}
    <p className="participant-evidence__disclaimer">
      Это фактические действия участника, а не уровень по шкале Agentic Coding 1–4.
      Для бирюзового контура нужны отдельно квалифицированные данные по каждой из 6 компетенций.
    </p>
  </section>;
}
