import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { learningSummaryQueryKey, loadLearningSummary } from "./learning-progress";
import "./learning-progress-panel.scss";

type Props = { bootcampIndex: number; compact?: boolean };

/** One visible projection of persisted course state, independent of Skill Passport L1. */
export function LearningProgressPanel({ bootcampIndex, compact = false }: Props) {
  const learning = useQuery({
    queryKey: learningSummaryQueryKey,
    queryFn: loadLearningSummary,
  });
  const summary = learning.data;
  const courses = summary?.courses ?? [];
  const recent = courses.slice(0, compact ? 2 : 3);
  return (
    <section className={"learning-progress-bridge" + (compact ? " learning-progress-bridge--compact" : "")} aria-label="Копилка обучения Impulse" data-testid="learning-progress-bridge">
      <header>
        <div><span className="learning-progress-bridge__eyebrow">ПРОГРЕСС ИЗ БАЗЫ ДАННЫХ</span><h3>Копилка обучения Impulse</h3></div>
        <Link to={`/workspace/${String(bootcampIndex)}`}>Открыть Bootcamp →</Link>
      </header>
      {learning.isPending && <p role="status">Загружаем сохранённые результаты…</p>}
      {learning.isError && <p role="alert">Не удалось загрузить учебный прогресс. <button type="button" onClick={() => { void learning.refetch(); }}>Повторить</button></p>}
      {summary && <>
        <div className="learning-progress-bridge__metrics">
          <div><strong data-testid="learn-finished">{summary.finished_courses}</strong><span>курсов пройдено</span></div>
          <div><strong data-testid="learn-lessons">{summary.completed_lessons}</strong><span>уроков завершено</span></div>
          <div><strong data-testid="learn-reviewed">{summary.approved_practices}</strong><span>практик принято</span></div>
        </div>
        {recent.length > 0 ? <ul className="learning-progress-bridge__courses">{recent.map(course => <li key={course.course_key}>
          <div><strong>{course.title}</strong><span>{course.finished ? "Курс пройден" : `Изучено ${String(course.completed_units)} из ${String(course.total_units)} уроков`}{course.practice_status === "pending" ? " · Работа на проверке" : course.practice_status === "approved" ? " · Практика принята" : ""}</span></div>
          <progress max={course.total_units} value={course.completed_units} aria-label={`Учебный прогресс курса «${course.title}»`} />
        </li>)}</ul> : <p className="learning-progress-bridge__empty">Результаты появятся после первого сохранённого урока в Bootcamp.</p>}
      </>}
      <small>Самостоятельное обучение учитывается в учебной статистике. Рейтинг, карьерный грейд и подтверждённый уровень навыков меняются только по отдельным правилам проверки.</small>
    </section>
  );
}
