import { useEffect, useRef, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Check, Flame, Sparkles, X } from "lucide-react";
import "./streak-celebration.scss";

type StreakCelebrationProps = {
  from: number;
  to: number;
  onClose: () => void;
  mode?: "streak-increase" | "course-complete";
};

/**
 * A lightweight, first-party motion recreation of the approved Impulse streak
 * video. Unlike a baked video, the award number is server-derived, responsive,
 * accessible and never claims more days than the verified projection reports.
 */
export function StreakCelebration({ from, to, onClose, mode = "streak-increase" }: StreakCelebrationProps) {
  const courseComplete = mode === "course-complete";
  const closeRef = useRef(onClose);
  const dismissRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const prefersReducedMotion = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timeout = window.setTimeout(() => { closeRef.current(); }, prefersReducedMotion ? 3500 : 6400);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
      }
    };
    dismissRef.current?.focus({ preventScroll: true });
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(timeout);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const sparks = Array.from({ length: 36 }, (_, index) => {
    const angle = (index * 137.508 + 14) * Math.PI / 180;
    const spread = 24 + (index % 6) * 11;
    return {
      index,
      style: {
        "--spark-x": `${(Math.cos(angle) * spread).toFixed(2)}vw`,
        "--spark-y": `${(Math.sin(angle) * spread).toFixed(2)}vh`,
        "--spark-delay": `${((index % 8) * 0.068).toFixed(3)}s`,
        "--spark-size": `${String(3 + index % 4)}px`,
      } as CSSProperties,
    };
  });

  return createPortal(
    <div className="impulse-streak-celebration" role="dialog" aria-modal="true"
      aria-label={courseComplete ? `Курс завершён. Текущая серия: ${String(to)} дней` : `Серия продолжена: ${String(to)} дней подряд`}
      data-testid="streak-celebration">
      <div className="impulse-streak-grid" aria-hidden="true" />
      <div className="impulse-streak-burst" aria-hidden="true" />
      <div className="impulse-streak-particles" aria-hidden="true">
        {sparks.map(spark => <i key={spark.index} style={spark.style} />)}
      </div>
      <div className="impulse-streak-topline">
        <span className="impulse-streak-brand">IMPULSE<span className="impulse-streak-brand-dot">•</span></span>
        <span className="impulse-streak-topline-end">ТВОЙ ПРОГРЕСС</span>
      </div>
      <button ref={dismissRef} type="button" className="impulse-streak-dismiss"
        aria-label="Пропустить анимацию" onClick={onClose}>
        <X size={18} aria-hidden="true" /><span>Пропустить</span>
      </button>
      <main className="impulse-streak-content">
        <div className="impulse-streak-confirmed">
          <span className="impulse-streak-confirmed-icon"><Check size={19} strokeWidth={3} /></span>
          <span>{courseComplete ? "ОБУЧЕНИЕ ЗАВЕРШЕНО" : "ЗАДАНИЕ ЗАСЧИТАНО"}</span>
        </div>
        <div className="impulse-streak-ring">
          <div className="impulse-streak-ring-inner" aria-hidden="true" />
          <div className="impulse-streak-ring-ticks" aria-hidden="true" />
          <span className="impulse-streak-orbit impulse-streak-orbit-one" aria-hidden="true" />
          <span className="impulse-streak-orbit impulse-streak-orbit-two" aria-hidden="true" />
          <div className="impulse-streak-milestone">
            <span className="impulse-streak-overline"><Sparkles size={20} /> {courseComplete ? "КУРС ЗАВЕРШЁН" : "СЕРИЯ ПРОДОЛЖЕНА"}</span>
            <div className="impulse-streak-number">
              {!courseComplete && <span className="impulse-streak-previous" aria-hidden="true">{from}</span>}
              <strong>{to}</strong>
            </div>
            <span className="impulse-streak-days">ДНЕЙ ПОДРЯД</span>
            <span className="impulse-streak-award"><Flame size={18} fill="currentColor" aria-hidden="true" /> {courseComplete ? "Твоя серия подтверждена" : `+${String(to - from)} день к твоей серии`}</span>
          </div>
        </div>
        <p className="impulse-streak-footer-copy">{courseComplete ? "Обучение сохранено. Продолжай практику и сохраняй ритм" : "Каждый выполненный шаг приближает тебя к цели"}</p>
        <button type="button" className="impulse-streak-continue" onClick={onClose}>Продолжить <span aria-hidden="true">→</span></button>
      </main>
      <div className="impulse-streak-bottomline" aria-hidden="true">
        <span>{courseComplete ? "КУРС ЗАВЕРШЁН" : "КВАЛИФИЦИРУЕМОЕ ДЕЙСТВИЕ"}</span><span>{courseComplete ? "ПРОГРЕСС СОХРАНЁН" : "УРОВЕНЬ ВЫШЕ"}</span>
        <div className="impulse-streak-progress"><i /></div>
      </div>
    </div>,
    document.body,
  );
}
