import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import type { ReactNode } from "react";

import { apiRequest } from "../../api/client";
import { StatePanel } from "../../components/ui";

import { learningSummaryQueryKey, loadLearningSummary, type LearningCourse } from "../learning-progress";
import { loadRoleLevel, roleLevelQueryKey, type ImpulseRoleLevel } from "../impulse-role-level";
import { loadDevelopmentOverview, overviewQueryKey } from "../participant-home-v2/client";
import { TrajectoryV2 } from "../trajectory-v2/page";
import { primaryTrajectoryKey } from "../trajectory-v2/role-state";
import { courseDestination } from "./routes";
import "./development-hub.scss";

interface DevelopmentHubContentProps {
  navigation: readonly string[];
  roleKey: string | null;
  roleTitle: string | null;
  level: ImpulseRoleLevel | null;
  levelPending?: boolean;
  courses?: readonly LearningCourse[];
  updatedAt?: string;
  children: ReactNode;
}



export function StudyRequirements({
  level,
  roleKey,
  navigation,
  courses,
  levelPending = false,
}: {
  level: ImpulseRoleLevel | null;
  roleKey: string | null;
  navigation: readonly string[];
  courses: readonly LearningCourse[];
  levelPending?: boolean;
}) {
  if (roleKey === null) {
    return (
      <section className="development-hub__empty" role="status">
        <h2>Выберите направление</h2>
        <p>После выбора роли здесь появятся требования учебного уровня Impulse.</p>
      </section>
    );
  }
  if (level === null) {
    return (
      <section className="development-hub__empty" role="status">
        <h2>{levelPending ? "Загружаем требования" : "Требования пока недоступны"}</h2>
        <p>Личный учебный уровень не отображается без данных сервера.</p>
      </section>
    );
  }

  const maxLevel = level.max_level ?? 3;
  const finished = level.level >= maxLevel;
  const requiredKeys = level.required_course_keys ?? [];
  const bootcamp = courseDestination(navigation, roleKey);

  return (
    <section className="development-hub__requirements" data-testid="development-level-requirements"
      aria-label="Учебные требования выбранной роли">
      <div className="development-hub__requirements-heading">
        <div>
          <span className="development-hub__eyebrow">Учебная программа</span>
          <h2>{finished ? "Программа освоена" : "Следующий уровень"}</h2>
          <p>{finished ? "Полученные результаты сохраняются в истории."
            : "L" + String(level.level) + " → L" + String(level.level + 1) + " · цикл " + String(level.cycle_number)}</p>
        </div>
        <span className="development-hub__level" aria-label={"Текущий учебный уровень L" + String(level.level)}>
          L{level.level}
        </span>
      </div>

      <ol className="development-hub__level-track" aria-label="Этапы уровней Impulse">
        {Array.from({ length: Math.min(maxLevel, 3) + 1 }, (_, index) => (
          <li key={index} data-state={index < level.level ? "completed" : index === level.level ? "current" : "future"}
            aria-current={index === level.level ? "step" : undefined}>
            <span>{index < level.level ? "✓" : "L" + String(index)}</span>
          </li>
        ))}
      </ol>

      {finished ? (
        <p className="development-hub__completion" role="status">
          Все опубликованные учебные циклы завершены. Курсы и подтверждённые результаты доступны в истории.
        </p>
      ) : (
        <div className="development-hub__requirements-grid">
          <section className="development-hub__requirement-card" aria-labelledby="development-hub-courses-title">
            <div className="development-hub__card-heading">
              <div>
                <h3 id="development-hub-courses-title">Обязательные курсы</h3>
                <small>{level.curriculum_state === "published"
                  ? String(level.completed_courses) + " из " + String(level.required_courses) + " завершено"
                  : "Программа пока не опубликована"}</small>
              </div>
              {bootcamp !== null && <Link to={bootcamp} className="development-hub__subtle-link">Все курсы</Link>}
            </div>
            {level.curriculum_state === "published" && level.required_courses > 0 && (
              <div className="development-hub__progress-block">
                <div className="development-hub__progress-label">
                  <span>Прогресс курсов</span>
                  <strong>{Math.min(level.completed_courses, level.required_courses)} / {level.required_courses}</strong>
                </div>
                <progress
                  className="development-hub__progress"
                  max={level.required_courses}
                  value={Math.max(0, Math.min(level.completed_courses, level.required_courses))}
                  aria-label="Завершённые обязательные курсы"
                />
              </div>
            )}
            {level.curriculum_state === "published" && requiredKeys.length > 0 ? (
              <ol className="development-hub__courses" data-testid="development-required-courses">
                {requiredKeys.map((key, index) => {
                  const course = courses.find((item) => item.course_key === key);
                  const studied = course?.finished === true && Boolean(course.certificate_id);
                  const destination = courseDestination(navigation, roleKey, key);
                  return (
                    <li key={key} data-completed={studied ? "true" : "false"}>
                      <span className="development-hub__course-mark" aria-hidden="true">{studied ? "✓" : String(index + 1)}</span>
                      <div className="development-hub__course-content">
                        <strong>{course?.title ?? "Название курса уточняется"}</strong>
                        <small>{studied ? "Учебный сертификат сохранён"
                          : course?.completed_units ? String(course.completed_units) + " из " + String(course.total_units) + " уроков"
                            : "Ожидает прохождения"}</small>
                      </div>
                      {destination !== null && (
                        <Link className="development-hub__course-link" to={destination}
                          aria-label={(studied ? "Посмотреть" : "Открыть") + " курс " + (course?.title ?? key)}>
                          {studied ? "Посмотреть" : "Пройти"} <span aria-hidden="true">↗</span>
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="development-hub__empty-note" role="status">
                {level.curriculum_state === "unpublished"
                  ? "Программа следующего цикла ещё не опубликована. Пройденные курсы сохранены."
                  : level.required_courses === 0
                    ? "На этом уровне обязательных курсов нет."
                    : "Список обязательных курсов пока не получен. Проверьте Bootcamp."}
              </p>
            )}
          </section>
          <section className="development-hub__requirement-card development-hub__practice"
            aria-labelledby="development-hub-practice-title">
            <div className="development-hub__card-heading">
              <div>
                <h3 id="development-hub-practice-title">Практика</h3>
                <small>Отдельно от профессионального подтверждения</small>
              </div>
            </div>
            <strong data-testid="development-practice-count">
              {String(level.credited_practices)} <span>из {String(level.required_practices)}</span>
            </strong>
            {level.required_practices > 0 && (
              <progress
                className="development-hub__progress development-hub__progress--practice"
                max={level.required_practices}
                value={Math.max(0, Math.min(level.credited_practices, level.required_practices))}
                aria-label="Зачтённые практические работы"
              />
            )}
            <details className="development-hub__practice-explanation">
              <summary>Как учитывается практика</summary>
              <p>Отправленная работа учитывается в учебном уровне по действующей политике.
                Независимая проверка компетенций и приёмка проекта отображаются отдельно.</p>
            </details>
            <small>Независимо проверено: {String(level.approved_practices)}</small>
            {level.advance_ready && (
              <p className="development-hub__ready" role="status">
                Учебные требования выполнены. Следующий этап открывается в Bootcamp.
              </p>
            )}
          </section>
        </div>
      )}
      <p className="development-hub__disclaimer">
        Уровень Impulse — учебный показатель, а не официальный карьерный грейд.
      </p>
    </section>
  );
}

/** Source-backed shell: roles, stages, enrollment and grade rules remain in TrajectoryV2. */
export function DevelopmentHubContent({
  navigation,
  roleKey,
  roleTitle,
  level,
  levelPending = false,
  courses = [],
  updatedAt,
  children,
}: DevelopmentHubContentProps) {
  const [params, setParams] = useSearchParams();
  const showingLevels = params.get("hub") === "levels";
  const bootcamp = courseDestination(navigation, roleKey);
  const selectView = (view: "trajectory" | "levels") => {
    const next = new URLSearchParams(params);
    if (view === "levels") next.set("hub", "levels");
    else next.delete("hub");
    setParams(next);
  };

  return (
    <div className="development-hub" data-testid="development-hub"
      data-active-view={showingLevels ? "levels" : "trajectory"}>
      <header className="development-hub__header">
        <div>
          <span className="development-hub__eyebrow">Мой путь</span>
          <h1 id="workspace-title">Развитие</h1>
          <p>{roleTitle ?? "Выберите направление, чтобы построить учебный маршрут"}</p>
        </div>
        {level !== null && (
          <span className="development-hub__header-progress">
            <small>Уровень Impulse</small>
            <strong>L{level.level}</strong>
          </span>
        )}
      </header>
      <nav className="development-hub__tabs" aria-label="Подразделы развития">
        <button type="button" aria-pressed={!showingLevels}
          onClick={() => { selectView("trajectory"); }}>Траектории</button>
        {bootcamp !== null && <Link to={bootcamp}>Курсы</Link>}
        <button type="button" aria-pressed={showingLevels}
          onClick={() => { selectView("levels"); }}>Уровни</button>
      </nav>
      {showingLevels ? (
        <StudyRequirements level={level} roleKey={roleKey} navigation={navigation}
          courses={courses} levelPending={levelPending} />
      ) : (
        <section className="development-hub__trajectory" aria-label="Траектории и этапы">
          {children}
        </section>
      )}
      {updatedAt && <small className="development-hub__updated">
        Обновлено: {new Date(updatedAt).toLocaleDateString("ru-RU")}
      </small>}
    </div>
  );
}

/** Route-ready entrypoint. Existing TrajectoryV2 still owns its dialogs, role mutations and roadmap. */
export function DevelopmentHub() {
  const overview = useQuery({ queryKey: overviewQueryKey, queryFn: loadDevelopmentOverview, retry: false });
  const navigation = useQuery({
    queryKey: ["me"],
    queryFn: () => apiRequest<{ navigation: string[] }>("/api/v1/me"),
  });
  const learning = useQuery({ queryKey: learningSummaryQueryKey, queryFn: loadLearningSummary });
  const [params] = useSearchParams();
  const roles = overview.data?.roles ?? [];
  const selected = roles.find((role) => role.track_key === params.get("role"))
    ?? roles.find((role) => role.track_key === (overview.data ? primaryTrajectoryKey(overview.data) : null))
    ?? null;
  const roleKey = selected?.track_key ?? null;
  const level = useQuery({
    queryKey: roleLevelQueryKey(roleKey),
    queryFn: () => loadRoleLevel(roleKey ?? ""),
    enabled: roleKey !== null && selected?.attempt_number !== null,
    retry: false,
  });

  if (overview.isPending) {
    return <div className="development-hub" data-testid="development-hub">
      <div className="trajectory-v2" data-reference="R-PAR-02"><StatePanel kind="loading" /></div>
    </div>;
  }
  if (overview.isError) {
    return <div className="development-hub" data-testid="development-hub">
      <div className="trajectory-v2" data-reference="R-PAR-02">
        <section className="trajectory-v2-failure" role="status">
          <strong>Не удалось загрузить траекторию.</strong>
          <p>Карта этапов остаётся недоступной без авторизованного снимка.</p>
          <button type="button" onClick={() => { void overview.refetch(); }}>Повторить</button>
        </section>
      </div>
    </div>;
  }
  return (
    <DevelopmentHubContent
      navigation={navigation.data?.navigation ?? []}
      roleKey={roleKey}
      roleTitle={selected?.title ?? null}
      level={level.data?.track_key === roleKey ? level.data : null}
      levelPending={level.isPending}
      courses={learning.data?.courses}
      updatedAt={overview.data.as_of}
    >
      <TrajectoryV2 />
    </DevelopmentHubContent>
  );
}
