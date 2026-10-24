import { useEffect, useMemo, useState } from "react";

import { learningProgramFor } from "./programs";
import "./learning-content.scss";

type Props = {
  courseKey: string;
  courseTitle?: string | null;
  sourceUrl?: string | null;
};

export function CourseLearningContent({ courseKey, courseTitle, sourceUrl }: Props) {
  const program = learningProgramFor(courseKey);
  const [current, setCurrent] = useState(0);
  const [opened, setOpened] = useState<ReadonlySet<string>>(() => new Set());
  const [checks, setChecks] = useState<ReadonlySet<string>>(() => new Set());
  const [showExpected, setShowExpected] = useState(false);

  useEffect(() => {
    setCurrent(0);
    setOpened(new Set());
    setChecks(new Set());
    setShowExpected(false);
  }, [courseKey]);

  const unit = program?.units[current];
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
          <strong>{String(program.units.length)} урока</strong>
          <span>≈ {String(totalMinutes)} мин</span>
        </div>
      </header>
      <p className="bc-learning__boundary">
        Это учебные материалы платформы, а не опубликованная программа провайдера.
        Открытие урока и самопроверка не начисляют XP, не выдают сертификат и не изменяют серверный статус курса.
      </p>
      <div className="bc-learning__body">
        <nav className="bc-learning__toc" aria-label="Шаги обучения">
          <strong>План обучения</strong>
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
        <article className="bc-learning__lesson" aria-labelledby="bc-learning-title">
          <p className="bc-learning__eyebrow">Урок {String(current + 1)} из {String(program.units.length)}</p>
          <h4 id="bc-learning-title">{unit.title}</h4>
          <p className="bc-learning__purpose"><strong>Цель:</strong> {unit.purpose}</p>
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
          <div className="bc-learning__navigation">
            <button type="button" disabled={current === 0} onClick={() => { selectUnit(current - 1); }}>Предыдущий урок</button>
            <span>{String(current + 1)} / {String(program.units.length)}</span>
            <button type="button" disabled={current === program.units.length - 1} onClick={() => { selectUnit(current + 1); }}>Следующий урок</button>
          </div>
        </article>
      </div>
      <footer className="bc-learning__footer">
        <strong>Результат практикума:</strong> {program.result}
        {sourceUrl?.startsWith("https://") && <a href={sourceUrl} target="_blank" rel="noopener noreferrer">Открыть первоисточник материалов курса</a>}
      </footer>
    </section>
  );
}
