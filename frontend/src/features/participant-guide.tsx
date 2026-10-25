import { useEffect, useRef, useState } from "react";
import { ArrowRight, BookOpenText, Check, CircleHelp, Compass, Lightbulb, Sparkles, X } from "lucide-react";
import "./participant-guide.scss";
import { PARTICIPANT_GUIDES, shouldAutomaticallySuggest, type PersistedGuide } from "./participant-guide-data";

const defaultPrefs = (): PersistedGuide => ({ seen: [], lastAutoAt: 0, autoDisabled: false });
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
  const current = (PARTICIPANT_GUIDES[section] ?? PARTICIPANT_GUIDES["Главная"]) as NonNullable<(typeof PARTICIPANT_GUIDES)[string]>;
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
    {open && <section id="participant-guide-panel" className="participant-guide-card" aria-labelledby="participant-guide-title" aria-describedby="participant-guide-description">
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
    <button type="button" className="participant-guide-trigger" aria-expanded={open} aria-controls={open ? "participant-guide-panel" : undefined} aria-label={open ? "Скрыть помощь" : "Как здесь всё устроено?"} title="Зачем этот раздел и что здесь делать" onClick={openManually}>
      {open ? <BookOpenText size={18} aria-hidden="true" /> : <CircleHelp size={19} aria-hidden="true" />}
      <span>{open ? "Скрыть помощь" : "Как здесь всё устроено?"}</span>
    </button>
  </div>;
}
