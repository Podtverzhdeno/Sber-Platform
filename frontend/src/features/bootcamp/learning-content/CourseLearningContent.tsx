import { useEffect, useMemo, useRef, useState } from "react";

import { learningProgramFor } from "./programs";
import { blueprintFor } from "./course-blueprints";
import { knowledgeCheckFor } from "./knowledge-checks";
import { ManualCompanionCard } from "./ManualCompanionCard";
import "./learning-content.scss";

type Props = {
  courseKey: string;
  courseTitle?: string | null;
  sourceUrl?: string | null;
};

export function CourseLearningContent({ courseKey, courseTitle, sourceUrl }: Props) {
  const program = learningProgramFor(courseKey);
  const blueprint = blueprintFor(courseKey);
  const [activeView, setActiveView] = useState<"lessons" | "project">("lessons");
  const [current, setCurrent] = useState(0);
  const [opened, setOpened] = useState<ReadonlySet<string>>(() => new Set());
  const [checks, setChecks] = useState<ReadonlySet<string>>(() => new Set());
  const [showExpected, setShowExpected] = useState(false);
  const lessonRef = useRef<HTMLElement>(null);
  const [knowledgeAnswers, setKnowledgeAnswers] = useState<Record<string, number>>({});

  useEffect(() => {
    setCurrent(0);
    setActiveView("lessons");
    setOpened(new Set());
    setChecks(new Set());
    setShowExpected(false);
    setKnowledgeAnswers({});
  }, [courseKey]);

  // After switching lessons, make the updated material visible under the sticky reader header.
  useEffect(() => {
    if (current === 0) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    lessonRef.current?.scrollIntoView?.({
      block: "start",
      behavior: reducedMotion ? "instant" : "smooth",
    });
  }, [current]);

  const unit = program?.units[current];
  const knowledgeCheck = unit ? knowledgeCheckFor(courseKey, unit.id) : null;
  const totalMinutes = useMemo(
    () => program?.units.reduce((sum, item) => sum + item.minutes, 0) ?? 0,
    [program],
  );

  if (!program || !unit) {
    return (
      <section className="bc-learning" aria-label="Материалы курса">
        <p role="status">Для этого курса практические материалы пока не подготовлены.</p>
        <p>Доступность и подтверждение прохождения определяются только данными учебной платформы.</p>
      </section>
    );
  }

  const selectUnit = (index: number) => {
    const selected = program.units[index];
    if (!selected) return;
    setCurrent(index);
    setOpened(before => new Set([...before, selected.id]));
    setShowExpected(false);
  };

  const markCheck = (index: number, checked: boolean) => {
    const key = `${unit.id}:${String(index)}`;
    setChecks(before => {
      const next = new Set(before);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  return (
    <section className="bc-learning" data-course-key={program.courseKey} aria-label="Учебные материалы курса">
      <header className="bc-learning__header">
        <div>
          <span className="bc-learning__eyebrow">Практикум Impulse · самостоятельное обучение</span>
          <h3>{courseTitle ?? program.title}</h3>
          <p>{program.description}</p>
        </div>
        <div className="bc-learning__meta">
          <strong>{String(program.units.length)} уроков</strong>
          <span>≈ {String(totalMinutes)} мин</span>
        </div>
      </header>
      <p className="bc-learning__boundary">
        Это учебные материалы платформы, а не опубликованная программа провайдера.
        Открытие урока и самопроверка не начисляют XP, не выдают сертификат и не изменяют серверный статус курса.
      </p>

      {blueprint && (
        <div className="bc-learning__orientation">
          <div className="bc-learning__orientation-head">
            <span><strong>Уровень:</strong> {blueprint.level}</span>
            <span><strong>Для кого:</strong> {blueprint.audience}</span>
          </div>
          <details>
            <summary>Что нужно знать перед началом</summary>
            <ul>{blueprint.prereqs.map(item => <li key={item}>{item}</li>)}</ul>
          </details>
          <details>
            <summary>Какие компетенции сформируете</summary>
            <ul>{blueprint.outcomes.map(item => <li key={item}>{item}</li>)}</ul>
          </details>
        </div>
      )}
      <div className="bc-learning__view-switch" role="group" aria-label="Раздел практикума">
        <button type="button" aria-pressed={activeView === "lessons"} onClick={() => { setActiveView("lessons"); }}>Уроки и задания</button>
        {blueprint && <button type="button" aria-pressed={activeView === "project"} onClick={() => { setActiveView("project"); }}>Итоговый проект</button>}
      </div>
      {activeView === "project" && blueprint ? (
        <article className="bc-learning__capstone" aria-label="Итоговый проект">
          <div className="bc-learning__capstone-heading">
            <span className="bc-learning__eyebrow">Практический проект · самостоятельная работа</span>
            <h4>{blueprint.capstone.title}</h4>
            <p>{blueprint.capstone.scenario}</p>
          </div>
          <section>
            <h5>Пошаговый план</h5>
            <ol>{blueprint.capstone.steps.map((step, index) => <li key={step}><strong>Шаг {String(index + 1)}.</strong> {step}</li>)}</ol>
          </section>
          <section>
            <h5>Что должно получиться</h5>
            <ul>{blueprint.capstone.artifacts.map(item => <li key={item}>{item}</li>)}</ul>
          </section>
          <section>
            <h5>Проверка результата</h5>
            <ul>{blueprint.capstone.validation.map(item => <li key={item}>{item}</li>)}</ul>
          </section>
          <section>
            <h5>Критерии оценки проекта</h5>
            <table>
              <thead><tr><th>Критерий</th><th>Вес</th><th>Условие успешного выполнения</th></tr></thead>
              <tbody>{blueprint.capstone.rubric.map(item => <tr key={item.criterion}><td>{item.criterion}</td><td>{String(item.weight)}%</td><td>{item.pass}</td></tr>)}</tbody>
            </table>
            <p className="bc-learning__review-note">Это прозрачные критерии для самопроверки. Официальная оценка и сертификат требуют отдельной процедуры проверки.</p>
          </section>
          <button type="button" className="bc-learning__back" onClick={() => { setActiveView("lessons"); }}>Вернуться к урокам</button>
        </article>
      ) : <div className="bc-learning__body">
        <nav className="bc-learning__toc" aria-label="Шаги обучения">
          <strong>План обучения · {String(program.units.length)} шагов</strong>
          <ol>
            {program.units.map((item, index) => (
              <li key={item.id}>
                <button
                  type="button"
                  aria-current={index === current ? "step" : undefined}
                  className={index === current ? "bc-learning__toc-current" : ""}
                  onClick={() => { selectUnit(index); }}
                >
                  <span className="bc-learning__num">{String(index + 1)}</span>
                  <span><strong>{item.title}</strong><small>{String(item.minutes)} мин · {opened.has(item.id) ? "открыт" : "не открыт"}</small></span>
                </button>
              </li>
            ))}
          </ol>
        </nav>
        <article ref={lessonRef} className="bc-learning__lesson" aria-labelledby="bc-learning-title">
          <p className="bc-learning__eyebrow">{current < 4 ? "Основы" : "Прикладная практика"} · Урок {String(current + 1)} из {String(program.units.length)}</p>
          <h4 id="bc-learning-title">{unit.title}</h4>
          <p className="bc-learning__purpose"><strong>Цель:</strong> {unit.purpose}</p>
          <ManualCompanionCard courseKey={courseKey} lessonIndex={current} />
          <h5>Разберёмся</h5>
          {unit.theory.map((paragraph, index) => <p key={String(index)}>{paragraph}</p>)}
          <h5>Пример</h5>
          <div className="bc-learning__example">{unit.example}</div>
          <h5>Практическое задание</h5>
          <p>{unit.practice}</p>
          <div className="bc-learning__selfcheck">
            <h5>Самопроверка</h5>
            <p>Отметьте пункты, которые вы проверили самостоятельно. Это только локальные отметки для удобства.</p>
            {unit.checklist.map((item, index) => (
              <label key={item}>
                <input
                  type="checkbox"
                  checked={checks.has(`${unit.id}:${String(index)}`)}
                  onChange={(event) => { markCheck(index, event.target.checked); }}
                />
                <span>{item}</span>
              </label>
            ))}
            <button type="button" className="bc-learning__reveal" aria-expanded={showExpected} onClick={() => { setShowExpected(value => !value); }}>
              {showExpected ? "Скрыть ожидаемый результат" : "Показать ожидаемый результат"}
            </button>
            {showExpected && <p className="bc-learning__expected" role="status">{unit.expected}</p>}
          </div>
          {knowledgeCheck && (
            <section className="bc-learning__knowledge" aria-label="Проверка понимания">
              <span className="bc-learning__eyebrow">Контрольная точка · без официальной оценки</span>
              <h5>Проверьте понимание на примере</h5>
              <p>{knowledgeCheck.question}</p>
              <div className="bc-learning__knowledge-options" role="group" aria-label="Варианты ответа">
                {knowledgeCheck.options.map((option, index) => (
                  <button
                    type="button"
                    key={option}
                    aria-pressed={knowledgeAnswers[unit.id] === index}
                    onClick={() => { setKnowledgeAnswers(previous => ({ ...previous, [unit.id]: index })); }}
                  >
                    <span>{String(index + 1)}.</span> {option}
                  </button>
                ))}
              </div>
              {knowledgeAnswers[unit.id] !== undefined && (
                <p className="bc-learning__knowledge-feedback" role="status">
                  <strong>{knowledgeAnswers[unit.id] === knowledgeCheck.correctIndex ? "Верно." : "Ещё раз проверьте логику."}</strong>{" "}
                  {knowledgeCheck.explanation}
                </p>
              )}
            </section>
          )}
          <div className="bc-learning__navigation">
            <button type="button" disabled={current === 0} onClick={() => { selectUnit(current - 1); }}>Предыдущий урок</button>
            <span>{String(current + 1)} / {String(program.units.length)}</span>
            <button type="button" disabled={current === program.units.length - 1} onClick={() => { selectUnit(current + 1); }}>Следующий урок</button>
          </div>
        </article>
      </div>}
      <footer className="bc-learning__footer">
        <strong>Результат практикума:</strong> {program.result}
        {sourceUrl?.startsWith("https://") && <a href={sourceUrl} target="_blank" rel="noopener noreferrer">Открыть первоисточник материалов курса</a>}
      </footer>
    </section>
  );
}
