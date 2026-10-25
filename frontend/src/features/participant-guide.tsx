import { useEffect, useRef, useState } from "react";
import { ArrowRight, BookOpenText, Check, CircleHelp, Compass, Lightbulb, Sparkles, X } from "lucide-react";
import "./participant-guide.scss";

type GuideContent = {
  heading: string;
  explanation: string;
  action: string;
  benefit: string;
  destination?: string;
  destinationLabel?: string;
};

export const PARTICIPANT_GUIDES: Record<string, GuideContent> = {
  "Главная": {
    heading: "Здесь начинается твой путь",
    explanation: "Выбирай интересные задачи, пробуй навыки на практике и собирай результаты в одном профиле.",
    action: "Начни с небольшой задачи, в которой уже разбираешься. Не обязательно уметь всё заранее.",
    benefit: "У тебя появятся реальные работы, которые можно показать заказчику или HR.",
    destination: "Задачи",
    destinationLabel: "Посмотреть задачи",
  },
  "Задачи": {
    heading: "Задачи — возможность попробовать себя",
    explanation: "Здесь собраны реальные проблемы и запросы заказчиков. Смотри условия, ожидаемый результат и критерии приёмки до отклика.",
    action: "Открой подходящую задачу и оцени, какие навыки пригодятся. Отправка отклика и назначение — разные этапы.",
    benefit: "Каждая выполненная и принятая работа может стать подтверждённым кейсом.",
  },
  "Мои проекты": {
    heading: "Здесь ты доводишь идеи до результата",
    explanation: "Следи за своими задачами, статусами, материалами и обратной связью, чтобы ничего не потерялось.",
    action: "Проверь ближайший шаг и условия сдачи. Сохраняй ссылки и артефакты работы.",
    benefit: "Именно результат и его проверка помогают подтвердить практический опыт.",
  },
  "Bootcamp": {
    heading: "Учись под реальные задачи",
    explanation: "Короткие курсы помогут закрыть пробелы, которые мешают двигаться в выбранной роли.",
    action: "Выбери тему, нужную для текущей задачи, и проходи материал с практикой, а не ради числа уроков.",
    benefit: "Прогресс обучения и оценка практической работы — разные вещи. Подтверждение навыка зависит от условий проверки.",
  },
  "Моя траектория": {
    heading: "Маршрут — это ориентир, а не обязательство",
    explanation: "Траектория показывает последовательность навыков и шагов к роли, которую хочешь освоить.",
    action: "Выбери ближайший достижимый шаг. Маршрут можно пересматривать, когда появляются новые интересы.",
    benefit: "Так проще видеть, зачем нужен следующий курс или проект.",
  },
  "Мой путь": {
    heading: "Твой рост — шаг за шагом",
    explanation: "Здесь можно сопоставить цели, обучение и практические результаты, не теряя общую картину.",
    action: "Посмотри на ближайший шаг и выбери одну понятную цель.",
    benefit: "Не количество действий, а применённые навыки и результат делают путь сильнее.",
  },
  "Портфолио": {
    heading: "Покажи не только что знаешь, но и что сделал",
    explanation: "Собери проекты, достижения, сертификаты и Skill Passport в одном профессиональном профиле.",
    action: "Добавь понятное описание своей роли, результата и ссылки на доступные материалы.",
    benefit: "Заказчикам и HR проще оценить твой опыт, когда он подтверждён конкретными работами и соблюдены настройки доступа.",
  },
  "Аналитика": {
    heading: "Смотри на рост, а не только на цифры",
    explanation: "Активность, Skill Passport и сертификация помогают различать участие, практические навыки и подтверждённый результат.",
    action: "Сравни, что ты изучил, что применил и что уже прошло проверку.",
    benefit: "Так ты увидишь сильные стороны и поймёшь, над чем работать дальше.",
  },
  "Достижения": {
    heading: "Важные результаты не должны теряться",
    explanation: "Здесь собираются значимые события и результаты твоей активности на платформе.",
    action: "Проверь детали достижения и наличие подтверждения, прежде чем использовать его в портфолио.",
    benefit: "История достижений дополняет профессиональный профиль конкретными фактами.",
  },
  "События": {
    heading: "Больше способов попробовать себя",
    explanation: "Встречи, соревнования и другие события могут дать новые контакты и практический опыт.",
    action: "Выбирай то, что соответствует интересам и не перегружает расписание.",
    benefit: "Один полезный опыт ценнее участия во всём подряд.",
  },
  "Рейтинг": {
    heading: "Рейтинг — ориентир, не экзамен",
    explanation: "Сравнивай динамику и активность, но не воспринимай место в таблице как оценку своих возможностей.",
    action: "Посмотри правила начисления баллов и обращай внимание на подтверждённые результаты.",
    benefit: "Главная ценность платформы — твои навыки и работы, а не позиция относительно других.",
  },
  "Сообщения": {
    heading: "Вопросы лучше задавать сразу",
    explanation: "Обсуждай условия задач, уточняй ожидания и получай обратную связь от участников и заказчиков, когда доступен диалог.",
    action: "Перед началом работы уточни критерии результата и ограничения. Не отправляй конфиденциальные данные без разрешения.",
    benefit: "Хороший вопрос вовремя часто экономит часы переделок.",
  },
  "AI-Buddy": {
    heading: "Помощник рядом, решения — за тобой",
    explanation: "AI-Buddy помогает разобраться в следующем шаге, идеях и формулировках, но может ошибаться.",
    action: "Сформулируй конкретную проблему и проверь рекомендации на реальных требованиях задачи.",
    benefit: "Используй подсказки для движения вперёд, а не как замену собственным выводам.",
  },
  "Настройки": {
    heading: "Платформа должна подстраиваться под тебя",
    explanation: "Проверяй параметры аккаунта и доступность информации о себе.",
    action: "Посмотри разрешения и настройки приватности, прежде чем делиться личными результатами.",
    benefit: "Ты сохраняешь контроль над тем, как представляешь свой опыт.",
  },
};

type PersistedGuide = { seen: string[]; lastAutoAt: number; autoDisabled: boolean };
const defaultPrefs = (): PersistedGuide => ({ seen: [], lastAutoAt: 0, autoDisabled: false });
export const GUIDE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
const prefKey = (personId: string) => `impulse:guide:v1:${personId}`;
const sessionKey = (personId: string) => `impulse:guide:session:v1:${personId}`;

function readPreferences(personId: string): PersistedGuide {
  try {
    const parsed = JSON.parse(localStorage.getItem(prefKey(personId)) ?? "null") as Partial<PersistedGuide> | null;
    return {
      seen: Array.isArray(parsed?.seen) ? parsed.seen.filter((value): value is string => typeof value === "string") : [],
      lastAutoAt: typeof parsed?.lastAutoAt === "number" && Number.isFinite(parsed.lastAutoAt) ? parsed.lastAutoAt : 0,
      autoDisabled: parsed?.autoDisabled === true,
    };
  } catch { return defaultPrefs(); }
}
function storePreferences(personId: string, value: PersistedGuide): void {
  try { localStorage.setItem(prefKey(personId), JSON.stringify(value)); } catch { /* Browser storage can be disabled. */ }
}
function readSessionShown(personId: string): boolean {
  try { return sessionStorage.getItem(sessionKey(personId)) === "1"; } catch { return false; }
}
function storeSessionShown(personId: string): void {
  try { sessionStorage.setItem(sessionKey(personId), "1"); } catch { /* Continue without storage. */ }
}

export function shouldAutomaticallySuggest(
  prefs: PersistedGuide,
  section: string,
  now: number,
  shownInSession: boolean,
): boolean {
  return !prefs.autoDisabled &&
    !shownInSession &&
    !prefs.seen.includes(section) &&
    (prefs.lastAutoAt === 0 || now - prefs.lastAutoAt >= GUIDE_COOLDOWN_MS) &&
    Object.hasOwn(PARTICIPANT_GUIDES, section);
}

type Props = {
  personId: string;
  section: string;
  navigation: string[];
  onNavigate: (index: number) => void;
};

export function ParticipantGuide({ personId, section, navigation, onNavigate }: Props) {
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState<PersistedGuide>(() => readPreferences(personId));
  const container = useRef<HTMLDivElement>(null);
  const current = PARTICIPANT_GUIDES[section] ?? PARTICIPANT_GUIDES["Главная"];
  const destinationIndex = current.destination ? navigation.indexOf(current.destination) : -1;
  const sectionTitle = section === "Главная" ? "Зачем участвовать в Impulse?" : `Зачем нужен раздел «${section}»?`;

  useEffect(() => {
    setPrefs(readPreferences(personId));
    setOpen(false);
  }, [personId]);
  useEffect(() => {
    setOpen(false);
    const timeout = window.setTimeout(() => {
      const stored = readPreferences(personId);
      if (!shouldAutomaticallySuggest(stored, section, Date.now(), readSessionShown(personId))) return;
      const next = { ...stored, seen: [...new Set([...stored.seen, section])], lastAutoAt: Date.now() };
      storePreferences(personId, next);
      storeSessionShown(personId);
      setPrefs(next);
      setOpen(true);
    }, 1800);
    return () => { window.clearTimeout(timeout); };
  }, [personId, section]);
  useEffect(() => {
    if (!open) return;
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !container.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("keydown", keydown);
    document.addEventListener("pointerdown", outside);
    return () => {
      document.removeEventListener("keydown", keydown);
      document.removeEventListener("pointerdown", outside);
    };
  }, [open]);

  const openManually = () => {
    if (open) { setOpen(false); return; }
    const stored = readPreferences(personId);
    const next = { ...stored, seen: [...new Set([...stored.seen, section])] };
    storePreferences(personId, next);
    setPrefs(next);
    setOpen(true);
  };
  const disableAutomatic = () => {
    const next = { ...prefs, autoDisabled: true };
    storePreferences(personId, next);
    setPrefs(next);
    setOpen(false);
  };
  const enableAutomatic = () => {
    const next = { ...prefs, autoDisabled: false };
    storePreferences(personId, next);
    setPrefs(next);
  };
  return <div className="participant-guide" ref={container} data-testid="participant-guide">
    {open && <section className="participant-guide-card" aria-labelledby="participant-guide-title" aria-describedby="participant-guide-description">
      <header className="participant-guide-header">
        <span className="participant-guide-icon"><Compass size={19} aria-hidden="true" /></span>
        <span className="participant-guide-context">ПОДСКАЗКА ПО РАЗДЕЛУ</span>
        <button type="button" className="participant-guide-close" aria-label="Закрыть подсказку" onClick={() => { setOpen(false); }}><X size={17} /></button>
      </header>
      <h2 id="participant-guide-title">{current.heading}</h2>
      <p id="participant-guide-description">{current.explanation}</p>
      <div className="participant-guide-advice"><Lightbulb size={17} aria-hidden="true" /><div><strong>Что попробовать</strong><p>{current.action}</p></div></div>
      <div className="participant-guide-benefit"><Sparkles size={16} aria-hidden="true" /><span>{current.benefit}</span></div>
      <div className="participant-guide-actions">
        <button type="button" className="participant-guide-done" onClick={() => { setOpen(false); }}><Check size={15} /> Понятно</button>
        {destinationIndex >= 0 && current.destinationLabel && <button type="button" className="participant-guide-next" onClick={() => { setOpen(false); onNavigate(destinationIndex); }}>{current.destinationLabel} <ArrowRight size={15} /></button>}
      </div>
      <footer className="participant-guide-footer">
        <span>{sectionTitle}</span>
        {!prefs.autoDisabled ? <button type="button" onClick={disableAutomatic}>Не показывать автоматически</button> : <button type="button" onClick={enableAutomatic}>Включить автоподсказки</button>}
      </footer>
    </section>}
    <button type="button" className="participant-guide-trigger" aria-expanded={open} aria-controls="participant-guide-title" title="Зачем этот раздел и что здесь делать" onClick={openManually}>
      {open ? <BookOpenText size={18} aria-hidden="true" /> : <CircleHelp size={19} aria-hidden="true" />}
      <span>{open ? "Скрыть помощь" : "Как здесь всё устроено?"}</span>
    </button>
  </div>;
}
