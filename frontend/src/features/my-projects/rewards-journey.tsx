import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import {
  ArrowRight, Award, BadgeCheck, BriefcaseBusiness, Check, ChevronRight,
  Code2, Crown, FileBadge2, Gift, GraduationCap, HelpCircle, Info,
  Layers3, LockKeyhole, Medal, MessageSquare, Rocket, ShieldCheck,
  Sparkles, Star, TrendingUp, Trophy, Users, X,
} from "lucide-react";
import "./rewards-journey.scss";

const rewards = [
  {
    id: "gitverse", name: "Токены GitVerse", threshold: 0, when: "Старт программы",
    short: "Бонусные токены для работы в экосистеме",
    detail: "Дополнительный ресурс для знакомства с инструментами, практики и работы над задачами.",
    conditions: "Возможность получения зависит от правил программы и доступных предложений.",
    icon: Layers3, tone: "teal",
  },
  {
    id: "gigacode", name: "Токены GigaCode", threshold: 1, when: "После 1 проекта",
    short: "Токены для разработки и AI-инструментов",
    detail: "Помогают экспериментировать с AI-инструментами и ускорять разработку решений.",
    conditions: "Выдача возможна после подтверждения результата и проверки условий программы.",
    icon: Code2, tone: "teal",
  },
  {
    id: "gigaagent", name: "Премиум GigaAgent", threshold: 2, when: "После 2 проектов",
    short: "Доступ к премиум-возможностям GigaAgent",
    detail: "Дополнительные инструменты для работы с AI-агентами и сложными проектными сценариями.",
    conditions: "Доступ и срок его действия определяются актуальными условиями программы.",
    icon: Crown, tone: "blue",
  },
  {
    id: "internship", name: "Возможность стажировки в Сбере", threshold: 5, when: "После 5 проектов",
    short: "Возможность участия в отборе на стажировку",
    detail: "Практический опыт и подтверждённые результаты могут помочь выделиться при рассмотрении на стажировку.",
    conditions: "Порог открывает возможность участия в отборе, но не гарантирует приглашение или трудоустройство.",
    icon: BriefcaseBusiness, tone: "blue",
  },
  {
    id: "community", name: "Закрытое сообщество лучших", threshold: 10, when: "После 10 проектов",
    short: "Нетворкинг, обмен опытом и сообщество",
    detail: "Возможность общаться с активными участниками, делиться решениями и узнавать об интересных инициативах.",
    conditions: "Доступ предоставляется с учётом действующих требований и правил сообщества.",
    icon: Users, tone: "purple",
  },
  {
    id: "mentor", name: "Стать ментором", threshold: 20, when: "После 20 проектов",
    short: "Возможность помогать будущим участникам",
    detail: "Опыт выполнения проектов может стать основанием для рассмотрения на роль ментора.",
    conditions: "20 проектов дают возможность подать заявку; назначение зависит от отбора и потребностей программы.",
    icon: GraduationCap, tone: "green",
  },
] as const;

const ongoing = [
  {
    id: "assessment", name: "Оценка личного вклада", when: "При сдаче результатов",
    short: "Подтверждение результатов и достижений",
    detail: "Результаты вашей работы и вклад в проект могут быть оценены заказчиком и отражены в развитии компетенций.",
    conditions: "Оценка зависит от фактически представленных доказательств и решения проверяющего.",
    icon: Medal, tone: "purple",
  },
  {
    id: "portfolio", name: "Пополнение портфолио", when: "После завершения каждого проекта",
    short: "Подтверждённые кейсы и достижения",
    detail: "Завершённые проекты помогают собирать структурированное портфолио с примерами решений и результатов.",
    conditions: "Запись формируется по правилам платформы на основании подтверждённых результатов.",
    icon: Star, tone: "teal",
  },
] as const;

type Reward = (typeof rewards)[number] | (typeof ongoing)[number];
type RewardKey = Reward["id"] | "passport";

const passportAdvantages = [
  { title: "Признание среди работодателей", copy: "Подтверждённые результаты помогают говорить с работодателем на языке реальных компетенций.", icon: BadgeCheck },
  { title: "Приоритетное внимание к кандидатуре", copy: "Доказательства навыков могут выделить вашу заявку среди кандидатов с похожим резюме.", icon: BriefcaseBusiness },
  { title: "Ускоренный карьерный рост", copy: "Понятная карта развития помогает быстрее находить пробелы, демонстрировать прогресс и готовиться к новым ролям.", icon: TrendingUp },
  { title: "Эксклюзивные рабочие возможности", copy: "Сильное портфолио и подтверждённые компетенции помогают претендовать на специальные программы и проекты.", icon: Star },
] as const;

function rewardById(id: RewardKey): Reward | null {
  return [...rewards, ...ongoing].find(reward => reward.id === id) ?? null;
}

function PassportArtwork({ large = false }: { large?: boolean }) {
  return <div className={large ? "mpr-passport-art mpr-passport-art--large" : "mpr-passport-art"} aria-hidden="true">
    <span className="mpr-passport-art__orbit" />
    <span className="mpr-passport-art__spark mpr-passport-art__spark--one">✦</span>
    <span className="mpr-passport-art__spark mpr-passport-art__spark--two">✧</span>
    <span className="mpr-passport-art__card"><Crown /><strong>SKILL<br/>PASSPORT</strong></span>
  </div>;
}

export function RewardsJourney({ completedCount }: { completedCount: number }) {
  const [focused, setFocused] = useState<RewardKey | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const chosen = focused && focused !== "passport" ? rewardById(focused) : null;
  const passportOpen = focused === "passport";

  const openDetails = (id: RewardKey) => {
    triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setFocused(id);
  };
  const closeDetails = () => {
    setFocused(null);
    triggerRef.current?.focus({ preventScroll: true });
  };

  useEffect(() => {
    if (!focused) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus({ preventScroll: true });
    return () => { document.body.style.overflow = original; };
  }, [focused]);

  const onModalKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") { event.preventDefault(); closeDetails(); return; }
    if (event.key !== "Tab") return;
    const items = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled), a[href]") ?? []);
    const first = items[0], last = items[items.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };

  return <>
    <section className="mpr" aria-label="Твой путь и возможности">
      <div className="mpr-main">
        <div className="mpr-main__header">
          <span className="mpr-header-emblem"><Trophy size={24}/></span>
          <h2>Твой путь и возможности</h2>
          <p>Выполняй проекты — получай новые возможности и развивайся вместе со Сбером</p>
        </div>
        <div className="mpr-journey">
          <span className="mpr-journey__route" aria-hidden="true" />
          {rewards.map((reward, index) => {
            const Icon = reward.icon;
            const reached = completedCount >= reward.threshold;
            return <button
              key={reward.id} type="button" onClick={() => { openDetails(reward.id); }}
              className={`mpr-stage mpr-stage--${reward.tone}${reached ? " is-reached" : ""}`}
              aria-label={`${reward.name}. ${reward.when}. Узнать о награде`}
            >
              <span className="mpr-stage__index">{index + 1}</span>
              {reached && <span className="mpr-stage__check" aria-label="Порог достигнут"><Check size={13}/></span>}
              <span className="mpr-stage__icon"><Icon size={30}/></span>
              <strong className="mpr-stage__name">{reward.name}</strong>
              <span className="mpr-stage__threshold">{reached ? "Порог достигнут · выдача по условиям" : reward.when}</span>
              <span className="mpr-stage__benefit"><span>Что получаешь:</span><small>{reward.short}</small></span>
              {index < rewards.length - 1 && <ChevronRight className="mpr-stage__arrow" aria-hidden="true" size={20}/>}
            </button>;
          })}
        </div>
      </div>
      <div className="mpr-ongoing">
        <div className="mpr-ongoing__heading"><Sparkles size={25}/>
          <span><strong>Пока работаешь над проектами</strong><small>Дополнительные выгоды на каждом шаге</small></span>
        </div>
        <div className="mpr-ongoing__list">
          {ongoing.map(reward => {
            const Icon = reward.icon;
            return <button key={reward.id} type="button" className={`mpr-perk mpr-perk--${reward.tone}`} onClick={() => { openDetails(reward.id); }}>
              <span className="mpr-perk__icon"><Icon size={28}/></span>
              <span><strong>{reward.name}</strong><small>{reward.when}</small></span>
              <ChevronRight size={18} aria-hidden="true"/>
            </button>;
          })}
        </div>
      </div>
      <div className="mpr-golden">
        <button type="button" className="mpr-golden__click" onClick={() => { openDetails("passport"); }} aria-label="Skill Passport. Узнать подробнее">
          <PassportArtwork />
          <span className="mpr-golden__intro">
            <span className="mpr-golden__title">SKILL PASSPORT <span className="mpr-golden__question" aria-hidden="true">?</span></span>
            <span className="mpr-golden__caption">Живое подтверждение твоих навыков, результатов и компетенций</span>
            <span className="mpr-golden__subcaption">Обновляется по мере твоего развития в проектах</span>
          </span>
          <span className="mpr-golden__benefits" aria-hidden="true">
            <span><ShieldCheck size={23}/>Подтверждённые навыки</span>
            <span><TrendingUp size={23}/>Карьерные возможности</span>
            <span><LockKeyhole size={23}/>Профессиональная репутация</span>
            <span><Rocket size={23}/>Развитие и рост</span>
          </span>
        </button>
      </div>
      <button type="button" className="mpr-hint" onClick={() => { openDetails("passport"); }}>
        <Info size={15}/> Нажмите на награду, чтобы узнать больше о её преимуществах <ArrowRight size={14}/>
      </button>
    </section>

    {focused && createPortal(<div className="mpr-modal-root">
      <button type="button" className="mpr-modal-shade" aria-label="Закрыть сведения о награде" onClick={closeDetails}/>
      <div ref={dialogRef} className={`mpr-modal${passportOpen ? " mpr-modal--passport" : ""}`}
        role="dialog" aria-modal="true" aria-label={passportOpen ? "Skill Passport" : `Награда: ${chosen?.name ?? ""}`}
        tabIndex={-1} onKeyDown={onModalKeyDown}>
        <button ref={closeRef} type="button" className="mpr-modal__close" aria-label="Закрыть информацию о бонусе" onClick={closeDetails}><X size={19}/></button>
        {passportOpen ? <>
          <div className="mpr-modal__gold-head"><span><Crown size={30}/></span>
            <div><h2>SKILL PASSPORT</h2><p>Твой профессиональный паспорт подтверждённых компетенций</p></div>
          </div>
          <div className="mpr-modal__visual"><PassportArtwork large />
            <div className="mpr-modal__visual-copy"><strong>Твой опыт — больше, чем строчка в резюме</strong><p>Проекты, результаты и подтверждённые навыки складываются в единый профиль профессионального развития.</p></div>
          </div>
          <div className="mpr-modal__advantages">
            {passportAdvantages.map(advantage => {const Icon=advantage.icon;return <div key={advantage.title} className="mpr-modal__advantage">
              <span><Icon size={23}/></span><div><strong>{advantage.title}</strong><p>{advantage.copy}</p></div>
            </div>;})}
          </div>
          <div className="mpr-modal__employers">
            <h3>Компании, в которых востребованы подтверждённые навыки</h3>
            <div><span className="mpr-modal__employer-sber"><img src="/task-catalog/brands/sber.svg" alt="" />Сбер</span><span className="mpr-modal__employer-mts">МТС</span><span className="mpr-modal__employer-alfa">Альфа-Банк</span><span className="mpr-modal__employer-vtb">ВТБ</span></div>
            <small>Примеры работодателей IT-рынка. Логотипы не означают партнёрство, признание конкретного паспорта или гарантированный приоритет при найме. Число компаний-партнёров не подтверждено.</small>
          </div>
          <p className="mpr-modal__disclaimer"><Info size={15}/> Skill Passport дополняет резюме, но не заменяет отбор и не гарантирует работу, повышение или приглашение.</p>
        </> : chosen ? <>
          <div className="mpr-modal__reward-head"><span className={`mpr-modal__reward-icon mpr-modal__reward-icon--${chosen.tone}`}><chosen.icon size={31}/></span>
            <div><span>ВОЗМОЖНОСТЬ В IMPULSE</span><h2>{chosen.name}</h2><p>{chosen.when}</p></div>
          </div>
          <div className="mpr-modal__reward-highlight"><Gift size={25}/><div><strong>Что ты получаешь</strong><p>{chosen.short}</p></div></div>
          <div className="mpr-modal__reward-description"><h3>Почему это ценно?</h3><p>{chosen.detail}</p><h3>Как получить?</h3><p>{chosen.conditions}</p></div>
        </> : null}
        <button type="button" className="mpr-modal__primary" onClick={closeDetails}>Понятно <ArrowRight size={18}/></button>
      </div>
    </div>, document.body)}
  </>;
}
