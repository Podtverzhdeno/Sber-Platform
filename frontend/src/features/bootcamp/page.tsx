import type { ReactNode } from "react";

import type { components } from "../../api/schema";

export type BootcampOverview = components["schemas"]["BootcampOverviewV2"];
export type CourseSnapshot = components["schemas"]["CourseSnapshot"];
type ContinueLearningModel = components["schemas"]["ContinueLearning"];
type RoleSummaryModel = components["schemas"]["RoleSummary"];
type CurriculumModel = components["schemas"]["CurriculumRemainder"];

export function ContinueLearning({
  item,
  courseTitle,
  onContinue,
}: {
  item: ContinueLearningModel | null;
  courseTitle: string | null;
  onContinue: (courseKey: string) => void;
}) {
  if (item === null) {
    return (
      <section aria-labelledby="continue-title" className="ui-card">
        <h2 id="continue-title">Продолжить обучение</h2>
        <p>Активного шага пока нет. Выберите курс в каталоге.</p>
      </section>
    );
  }
  return (
    <section aria-labelledby="continue-title" className="ui-card">
      <p className="eyebrow">Следующий шаг</p>
      <h2 id="continue-title">{courseTitle ?? item.course_key}</h2>
      {item.progress && (
        <p>
          Пройдено {item.progress.numerator} из {item.progress.denominator} · {item.progress.percent}%
        </p>
      )}
      {item.checkpoint_key && <p>Checkpoint: {item.checkpoint_key}</p>}
      <button type="button" onClick={() => { onContinue(item.course_key); }}>
        {item.action}
      </button>
    </section>
  );
}

export function RoleSummary({ summary }: { summary: RoleSummaryModel }) {
  return (
    <section aria-labelledby="role-summary-title" className="ui-card">
      <h2 id="role-summary-title">Профиль роли</h2>
      {summary.grade_state === "known" ? (
        <>
          <p>{summary.current_grade_title} → {summary.target_grade_title}</p>
          {summary.matrix_skill_count !== null && <p>Навыков в матрице: {summary.matrix_skill_count}</p>}
          {summary.readiness && <p>Готовность: {summary.readiness.percent}%</p>}
        </>
      ) : (
        <p>{summary.unavailable_reason}</p>
      )}
    </section>
  );
}

export function GradeRequirements({
  curriculum,
  onOpen,
}: {
  curriculum: CurriculumModel;
  onOpen: () => void;
}) {
  const remaining = curriculum.requirements.filter((item) => item.state !== "verified");
  return (
    <section aria-labelledby="grade-requirements-title" className="ui-card">
      <h2 id="grade-requirements-title">Требования к следующему грейду</h2>
      {curriculum.state !== "known" ? (
        <p>{curriculum.unavailable_reason}</p>
      ) : remaining.length === 0 ? (
        <p>Опубликованные требования выполнены.</p>
      ) : (
        <>
          <p>Осталось требований: {remaining.length}</p>
          <button type="button" onClick={onOpen}>Посмотреть требования</button>
        </>
      )}
    </section>
  );
}

export function CatalogToolbar({
  view,
  onViewChange,
}: {
  view: "card" | "list";
  onViewChange: (view: "card" | "list") => void;
}) {
  return (
    <div className="catalog-toolbar" role="group" aria-label="Вид каталога">
      <button type="button" aria-pressed={view === "card"} onClick={() => { onViewChange("card"); }}>
        Карточки
      </button>
      <button type="button" aria-pressed={view === "list"} onClick={() => { onViewChange("list"); }}>
        Список
      </button>
    </div>
  );
}

function CourseFacts({ course }: { course: CourseSnapshot }) {
  return (
    <>
      <h3>{course.card.title}</h3>
      <p>{course.card.access_note}</p>
      <p>Статус: {course.card.completion_state}</p>
    </>
  );
}

export function CourseCard({ course, onOpen }: { course: CourseSnapshot; onOpen: (key: string) => void }) {
  return (
    <article className="ui-card" data-course-key={course.card.key}>
      <CourseFacts course={course} />
      <button type="button" onClick={() => { onOpen(course.card.key); }}>Подробнее</button>
    </article>
  );
}

export function CourseListRow({ course, onOpen }: { course: CourseSnapshot; onOpen: (key: string) => void }) {
  return (
    <li className="course-row" data-course-key={course.card.key}>
      <CourseFacts course={course} />
      <button type="button" onClick={() => { onOpen(course.card.key); }}>Подробнее</button>
    </li>
  );
}

export function BootcampDrawers({ children }: { children?: ReactNode }) {
  return <div className="bootcamp-drawers" data-testid="bootcamp-drawers">{children}</div>;
}

export function BootcampPage({
  overview,
  view,
  onViewChange,
  onContinue,
  onOpenCourse,
  onOpenRequirements,
  drawers,
}: {
  overview: BootcampOverview;
  view: "card" | "list";
  onViewChange: (view: "card" | "list") => void;
  onContinue: (courseKey: string) => void;
  onOpenCourse: (courseKey: string) => void;
  onOpenRequirements: () => void;
  drawers?: ReactNode;
}) {
  const continueTitle = overview.continue_learning === null
    ? null
    : (overview.courses.find((course) => course.card.key === overview.continue_learning?.course_key)?.card.title ?? null);
  return (
    <div className="feature-stack" data-reference="BC-R01">
      <header>
        <p className="eyebrow">Bootcamp</p>
        <h1 id="workspace-title">Развивайтесь в выбранной роли</h1>
      </header>
      <ContinueLearning item={overview.continue_learning} courseTitle={continueTitle} onContinue={onContinue} />
      <RoleSummary summary={overview.role_summary} />
      <GradeRequirements curriculum={overview.curriculum} onOpen={onOpenRequirements} />
      <section aria-labelledby="course-catalog-title">
        <h2 id="course-catalog-title">Каталог курсов</h2>
        <CatalogToolbar view={view} onViewChange={onViewChange} />
        {view === "card" ? (
          <div className="course-grid">
            {overview.courses.map((course) => <CourseCard course={course} key={course.card.key} onOpen={onOpenCourse} />)}
          </div>
        ) : (
          <ul className="course-rows" aria-label="Каталог Bootcamp списком">
            {overview.courses.map((course) => <CourseListRow course={course} key={course.card.key} onOpen={onOpenCourse} />)}
          </ul>
        )}
      </section>
      <BootcampDrawers>{drawers}</BootcampDrawers>
    </div>
  );
}
