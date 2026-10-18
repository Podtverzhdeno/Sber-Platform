import { useState } from "react";

import { Badge, Card } from "../components/ui";

const managerCopy: Record<string, { eyebrow: string; title: string; lead: string; cards: string[] }> = {
  "Главная": { eyebrow: "Руководитель · обзор", title: "Команда, инициативы и ближайшие решения", lead: "Единая сводка сроков, загрузки и принятых результатов без доступа к личным перепискам.", cards: ["6 активных инициатив", "18 участников в работе", "3 результата на проверке"] },
  "Команда": { eyebrow: "Руководитель · команда", title: "Состав команды и подтверждённая загрузка", lead: "Роли, доступность и участие показаны только в рамках назначенной команды.", cards: ["Backend · 6", "Data · 5", "Design · 3"] },
  "Аналитика": { eyebrow: "Руководитель · аналитика", title: "Динамика результата с явными знаменателями", lead: "Нулевые значения отделены от отсутствующих данных, период и когорта видны рядом с метрикой.", cards: ["71% принятых", "18 дней до результата", "8 повторных использований"] },
  "Календарь команды": { eyebrow: "Руководитель · календарь", title: "Контрольные точки команды", lead: "Сроки инициатив и доступность участников собраны в недельном календаре.", cards: ["Сегодня · 2 проверки", "Завтра · checkpoint API", "Пятница · demo review"] },
  "База участников": { eyebrow: "Руководитель · база", title: "Участники с подтверждёнными кейсами", lead: "Подбор использует только разрешённые профили и проверяемый опыт.", cards: ["Python · 24", "ML · 18", "Product · 11"] },
  "Настройки": { eyebrow: "Руководитель · настройки", title: "Права, уведомления и рабочий контур", lead: "Изменения не расширяют назначенные роли и сохраняются с аудитом.", cards: ["Уведомления", "Видимость команды", "Экспорт отчётов"] },
};

const operatorCopy: Record<string, { eyebrow: string; title: string; lead: string; cards: string[] }> = {
  "Главная": { eyebrow: "Оператор · обзор", title: "Состояние платформы и приоритеты смены", lead: "Очереди, SLA и инциденты сведены без раскрытия закрытого содержимого.", cards: ["24 новых дела", "3 нарушения SLA", "Все core flows доступны"] },
  "Задачи и проекты": { eyebrow: "Оператор · задачи", title: "Модерация задач и проектных зависимостей", lead: "Публикация остаётся отдельным человеческим решением.", cards: ["7 на модерации", "2 требуют уточнения", "12 опубликованы"] },
  "Выплаты": { eyebrow: "Оператор · выплаты", title: "Сверка статусов без обещаний и дублей", lead: "Расчёт, подтверждение адаптера и фактическая выплата показаны раздельно.", cards: ["8 рассчитано", "6 подтверждено", "2 требуют сверки"] },
  "Пользователи": { eyebrow: "Оператор · пользователи", title: "Доступы и безопасные проекции профилей", lead: "Оператор видит только данные, необходимые для назначенного дела.", cards: ["4 запроса доступа", "2 отзыва согласия", "0 критических"] },
  "События и трофеи": { eyebrow: "Оператор · источники", title: "События, достижения и версии доказательств", lead: "Отозванный источник блокирует новые производные и запускает проверку.", cards: ["9 на проверке", "3 подтверждены", "1 источник отозван"] },
};

const managerDefault = managerCopy["Главная"] as { eyebrow: string; title: string; lead: string; cards: string[] };
const operatorDefault = operatorCopy["Главная"] as { eyebrow: string; title: string; lead: string; cards: string[] };

function VisualGapPage({ copy, reference }: { copy: { eyebrow: string; title: string; lead: string; cards: string[] }; reference: string }) {
  const [notice, setNotice] = useState("");
  return <div className="feature-stack visual-gap-page" data-reference={reference}><header className="dashboard-heading"><div><p className="eyebrow">{copy.eyebrow}</p><h1 id="workspace-title">{copy.title}</h1><p className="lead">{copy.lead}</p></div><Badge tone="success">{reference}</Badge></header><section className="metric-grid" aria-label="Сводка">{copy.cards.map((item, index) => <article className={`metric-card metric-card--${(["teal", "blue", "violet"] as const)[index] ?? "teal"}`} key={item}><span className="metric-icon">◇</span><strong>{item}</strong><small>Проверяемая проекция</small><i aria-hidden="true" /></article>)}</section><section className="manager-control-grid"><Card title="Требует внимания"><p>Откройте безопасную детализацию и подтвердите следующее действие вручную.</p><button type="button" onClick={() => { setNotice("Действие зафиксировано в локальной рабочей области."); }}>Открыть рабочий список</button>{notice && <p role="status">{notice}</p>}</Card><Card title="Границы доступа"><p>Личные сообщения, закрытые артефакты и решения других ролей недоступны.</p></Card></section></div>;
}

export function ManagerVisualPage({ section }: { section: string }) {
  const order = ["Главная", "Инициативы", "Команда", "Аналитика", "Результаты", "Календарь команды", "База участников", "Настройки"];
  const copy = managerCopy[section] ?? managerDefault;
  return <VisualGapPage copy={copy} reference={`R-MGR-0${String(order.indexOf(section) + 1)}`} />;
}

export function OperatorVisualPage({ section }: { section: string }) {
  const order = ["Главная", "Операционная очередь", "Проверки", "Задачи и проекты", "Выплаты", "Споры", "Пользователи", "События и трофеи", "Аналитика"];
  const copy = operatorCopy[section] ?? operatorDefault;
  return <VisualGapPage copy={copy} reference={`R-OPS-0${String(order.indexOf(section) + 1)}`} />;
}
