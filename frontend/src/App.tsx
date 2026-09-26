const milestones = [
  { label: "Выбрать направление", state: "done" },
  { label: "Пройти базовый Bootcamp", state: "active" },
  { label: "Взять реальную задачу", state: "next" },
];

export function App() {
  return (
    <main className="page-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Impulse — на главную">
          <span className="brand-mark" aria-hidden="true">I</span>
          <span>Impulse</span>
        </a>
        <span className="demo-badge">Демо-данные</span>
      </header>

      <section className="hero" aria-labelledby="hero-title">
        <div>
          <p className="eyebrow">Ваш путь в профессию</p>
          <h1 id="hero-title">Пробуйте. Делайте реальное. Подтверждайте опыт.</h1>
          <p className="lead">
            Курсы дают основу, проекты — практику, а прозрачная оценка показывает,
            что именно вы уже умеете.
          </p>
          <button type="button">Продолжить маршрут</button>
        </div>

        <aside className="journey-card" aria-label="Ближайшие шаги">
          <p className="card-kicker">Roadmap · Python-разработчик</p>
          <ol>
            {milestones.map((milestone) => (
              <li className={milestone.state} key={milestone.label}>
                <span aria-hidden="true" />
                {milestone.label}
              </li>
            ))}
          </ol>
          <p className="why">Следующий шаг приблизит вас к первой оплачиваемой задаче.</p>
        </aside>
      </section>
    </main>
  );
}
