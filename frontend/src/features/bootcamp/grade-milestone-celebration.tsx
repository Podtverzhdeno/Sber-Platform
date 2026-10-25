import { useEffect, useRef, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, Award, Check, Crown, Sparkles, X } from "lucide-react";
import "./grade-milestone-celebration.scss";

type CelebrationProps = {
  mode: "stage-unlocked" | "official-grade-up";
  roleTitle: string;
  fromGrade?: string;
  toGrade?: string;
  onClose: () => void;
  onContinue: () => void;
};

/** The first animation celebrates study progression; an official-grade animation
 * may only be invoked after a NEW authoritative server snapshot changes grade.
 * Never derive a career grade from client XP, courses, or project milestones. */
export function GradeMilestoneCelebration({
  mode, roleTitle, fromGrade, toGrade, onClose, onContinue,
}: CelebrationProps) {
  const official = mode === "official-grade-up";
  const closeRef = useRef(onClose);
  const primaryRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    primaryRef.current?.focus({ preventScroll: true });
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); closeRef.current(); }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      previouslyFocused?.focus({ preventScroll: true });
    };
  }, []);

  const sparks = Array.from({ length: 42 }, (_, i) => {
    const angle = (i * 137.508 + 35) * Math.PI / 180;
    const radius = 28 + (i % 8) * 6;
    return {
      key: i,
      style: {
        "--particle-x": `${(Math.cos(angle) * radius).toFixed(2)}vw`,
        "--particle-y": `${(Math.sin(angle) * radius).toFixed(2)}vh`,
        "--particle-delay": `${((i % 9) * 0.074).toFixed(2)}s`,
        "--particle-size": `${String(4 + i % 5)}px`,
      } as CSSProperties,
    };
  });

  return createPortal(
    <div className="imp-grade-celebration" role="dialog" aria-modal="true"
      aria-label={official ? "Грейд повышен" : "Новый учебный этап открыт"}
      data-testid="grade-milestone-celebration" data-mode={mode}>
      <div className="imp-grade-celebration__aurora" aria-hidden="true" />
      <div className="imp-grade-celebration__grid" aria-hidden="true" />
      <div className="imp-grade-celebration__particles" aria-hidden="true">
        {sparks.map(({ key, style }) => <i key={key} style={style} />)}
      </div>
      <div className="imp-grade-celebration__panel">
        <button className="imp-grade-celebration__close" type="button" onClick={onClose} aria-label="Закрыть анимацию"><X size={23}/></button>
        <div className="imp-grade-celebration__badge"><Sparkles size={15}/>{official ? "ОФИЦИАЛЬНЫЙ ПЕРЕХОД ПОДТВЕРЖДЁН" : "ТВОЁ РАЗВИТИЕ ПРОДОЛЖАЕТСЯ"}</div>
        <div className="imp-grade-celebration__crest" aria-hidden="true">
          <div className="imp-grade-celebration__orbit imp-grade-celebration__orbit--one" />
          <div className="imp-grade-celebration__orbit imp-grade-celebration__orbit--two" />
          <span className="imp-grade-celebration__crown">{official ? <Crown size={79} strokeWidth={1.55} /> : <Award size={75} strokeWidth={1.65}/>}</span>
          <span className="imp-grade-celebration__check"><Check size={21}/></span>
        </div>
        <div className="imp-grade-celebration__eyebrow">{roleTitle}</div>
        <h2>{official ? <>ГРЕЙД <span>ПОВЫШЕН!</span></> : <>НОВЫЙ ЭТАП <span>ОТКРЫТ!</span></>}</h2>
        {official ? (
          <div className="imp-grade-celebration__ladder" data-testid="grade-promotion-ladder">
            <span>{fromGrade ?? "Предыдущий грейд"}</span><ArrowRight size={24}/><strong>{toGrade}</strong>
          </div>
        ) : (
          <div className="imp-grade-celebration__stage" data-testid="study-stage-unlocked">
            <Check size={19}/> Учебные требования пройдены
          </div>
        )}
        <p>{official
          ? "Все условия опубликованной программы подтверждены. Новый грейд официально закреплён за твоим профилем."
          : "Теперь начинается следующий шаг: практические задачи, реальные результаты и подтверждение компетенций. Покажи, на что способен!"}</p>
        <button ref={primaryRef} type="button" className="imp-grade-celebration__cta" onClick={onContinue}>
          {official ? "К новым требованиям" : "Начать следующий этап"}<ArrowRight size={19}/>
        </button>
        <button className="imp-grade-celebration__skip" type="button" onClick={onClose}>Продолжить позже</button>
      </div>
    </div>,
    document.body,
  );
}
