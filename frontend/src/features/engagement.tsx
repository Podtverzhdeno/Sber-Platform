import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, ArrowRight, BarChart3, Bell, CalendarDays, Check, ChevronDown,
  CircleHelp, Snowflake, Trophy, X,
} from "lucide-react";
import {
  ANIMATION_STORAGE_KEY,
  fetchEngagementOverview,
  fetchFreezeSummary,
  fetchWeeklyRhythm,
  saveWeeklyRhythm,
  useFreezeDay,
} from "./engagement-client";
import "./engagement.scss";
import { StreakCelebration } from "./streak-celebration";
import { rhythmReminderDueDate } from "./rhythm-reminder";

const RHYTHM_PRESETS: Readonly<Record<string, string>> = {
  workdays: "Будни",
  weekends: "Выходные",
  all_week: "Вся неделя",
  twice_week: "Два дня",
  custom: "Свой список",
};
const WEEKDAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const EMPTY_QUALIFIED_DATES: string[] = [];
function dateKey(day: Date): string {
  return [day.getFullYear(), String(day.getMonth()+1).padStart(2, "0"), String(day.getDate()).padStart(2, "0")].join("-");
}
function dayCountLabel(count: number): string {
  const lastTwo = count % 100;
  const last = count % 10;
  const suffix = lastTwo >= 11 && lastTwo <= 14 ? "дней" :
    last === 1 ? "день" : last >= 2 && last <= 4 ? "дня" : "дней";
  return `${String(count)} ${suffix}`;
}
function recentDays(): Array<{ date: string; label: string }> {
  const now = new Date();
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6 + index);
    return { date: dateKey(day), label: WEEKDAY_LABELS[(day.getDay() + 6) % 7] ?? "" };
  });
}
function serverErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && "message" in parsed) {
      const message = (parsed as Record<string, unknown>).message;
      if (typeof message === "string" && message) return message;
    }
  } catch { /* Non-JSON response */ }
  return "Не удалось сохранить недельный ритм.";
}

export function TopbarEngagementIndicator({ personId = "participant" }: { personId?: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [rhythmHelpOpen, setRhythmHelpOpen] = useState(false);
  const [reminderClock, setReminderClock] = useState(() => new Date());
  const [reminderVisible, setReminderVisible] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const indicatorQuery = useQuery({
    queryKey: ["engagement-overview"], queryFn: fetchEngagementOverview, retry: false,
    refetchInterval: 60_000,
  });
  const freezeQuery = useQuery({
    queryKey: ["engagement-freeze"], queryFn: fetchFreezeSummary, retry: false,
  });
  const rhythmQuery = useQuery({
    queryKey: ["engagement-rhythm"], queryFn: fetchWeeklyRhythm, retry: false,
  });
  const freezeUse = useMutation({
    mutationFn: useFreezeDay,
    onSuccess: (result) => {
      queryClient.setQueryData(["engagement-overview"], result);
      void queryClient.invalidateQueries({ queryKey: ["engagement-overview"] });
      void queryClient.invalidateQueries({ queryKey: ["engagement-freeze"] });
    },
  });
  const rhythmSave = useMutation({
    mutationFn: saveWeeklyRhythm,
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["engagement-rhythm"] }); },
  });

  const loading = indicatorQuery.isPending;
  const currentDays = indicatorQuery.data?.current_days ?? 0;
  const bestDays = indicatorQuery.data?.best_days ?? 0;
  const nextGoal = [7, 14, 30, 60, 100, 365].find(days => days > currentDays);
  const daysToGoal = nextGoal === undefined ? null : nextGoal - currentDays;
  const todaySaved = indicatorQuery.data?.today_saved ?? false;
  const reason = indicatorQuery.data?.reason ?? "";
  const qualifiedDates = indicatorQuery.data?.qualified_dates ?? EMPTY_QUALIFIED_DATES;
  const frozenDates = indicatorQuery.data?.frozen_dates ?? [];
  const qualifiedSet = new Set(qualifiedDates);
  const frozenSet = new Set(frozenDates);
  const mergedDays = Array.from(new Set([...qualifiedDates, ...frozenDates])).sort();
  const week = recentDays();
  const today = week[6]?.date ?? "";
  const freezeState = indicatorQuery.data?.freeze_state ?? "idle";
  const freezeStock = freezeQuery.data?.available ?? 0;
  const freezeUsable = freezeState === "break" && freezeStock > 0;
  const rhythmData = rhythmQuery.data ?? null;
  // Open-tab reminders use persisted server preferences; browser notifications
  // are emitted only when permission was granted previously, never requested here.
  useEffect(() => {
    const timer = window.setInterval(() => { setReminderClock(new Date()); }, 60_000);
    return () => { window.clearInterval(timer); };
  }, []);
  useEffect(() => {
    const dueDate = rhythmReminderDueDate(rhythmData, qualifiedDates, reminderClock);
    if (!dueDate) { setReminderVisible(false); return; }
    const reminderKey = `impulse:rhythm:reminded:${String(rhythmData?.version ?? "v0")}:${dueDate}`;
    try {
      if (window.sessionStorage.getItem(reminderKey) === "1") return;
      window.sessionStorage.setItem(reminderKey, "1");
    } catch { /* Privacy mode can block storage: in-tab reminder remains available. */ }
    setReminderVisible(true);
    try {
      if (typeof Notification !== "undefined" && Notification.permission === "granted" && document.hidden) {
        new Notification("Impulse · Время для практики", {
          body: "Сегодня запланирован день твоего ритма. Сделай шаг в курсе или проекте!",
        });
      }
    } catch { /* The in-page reminder still works without system notifications. */ }
  }, [rhythmData, qualifiedDates, reminderClock]);

  const [celebration, setCelebration] = useState<{ from: number; to: number } | null>(null);
  const lastPersonId = useRef(personId);
  useEffect(() => {
    if (loading || indicatorQuery.isError) return;
    // The verified overview is the source of truth. Never celebrate an
    // unverified click, a freeze, or a second activity already credited today.
    const storageKey = `${ANIMATION_STORAGE_KEY}:${personId}`;
    const identityChanged = lastPersonId.current !== personId;
    lastPersonId.current = personId;
    if (identityChanged) setCelebration(null);
    try {
      const previousRaw = window.localStorage.getItem(storageKey) ??
        (personId === "participant" ? window.localStorage.getItem(ANIMATION_STORAGE_KEY) : null);
      const previous = previousRaw === null ? null : Number(previousRaw);
      if (!identityChanged && previous !== null && Number.isFinite(previous) &&
          currentDays === previous + 1 && todaySaved && qualifiedDates.length > 0) {
        setCelebration({ from: previous, to: currentDays });
      }
      window.localStorage.setItem(storageKey, String(currentDays));
    } catch {
      // Some browsers block storage; the real count still renders normally.
    }
  }, [personId, loading, currentDays, todaySaved, qualifiedDates, indicatorQuery.isError]);

  const [chosenPreset, setChosenPreset] = useState<string | null>(null);
  const [chosenDays, setChosenDays] = useState<number[] | null>(null);
  const [chosenHour, setChosenHour] = useState<number | null>(null);
  const [chosenWindow, setChosenWindow] = useState<number | null>(null);
  const [chosenEffective, setChosenEffective] = useState<string | null>(null);
  const preset = chosenPreset ?? (rhythmData?.versioned ? (rhythmData.preset ?? "workdays") : "workdays");
  const activeDays = chosenDays ?? rhythmData?.active_days ?? [];
  const reminderHour = chosenHour ?? rhythmData?.reminder_hour ?? 18;
  const reminderWindow = chosenWindow ?? rhythmData?.reminder_window_hours ?? 3;
  // A new agreement starts today by default, never last Monday (a retroactive date).
  const effectiveDate = chosenEffective ?? today;
  const close = () => {
    setOpen(false);
    setCalendarOpen(false);
    setRhythmHelpOpen(false);
    triggerRef.current?.focus({ preventScroll: true });
  };
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus({ preventScroll: true });
    return () => { document.body.style.overflow = previous; };
  }, [open]);
  const onDialogKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      if (calendarOpen) setCalendarOpen(false);
      else if (rhythmHelpOpen) setRhythmHelpOpen(false);
      else close();
    }
    if (event.key !== "Tab") return;
    const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
      "button:not(:disabled), select:not(:disabled), input:not(:disabled)"
    ) ?? []);
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };
  const saveRhythm = () => {
    if (!rhythmData || (preset === "custom" && activeDays.length === 0) || !effectiveDate) return;
    rhythmSave.mutate({
      preset, custom_days: preset === "custom" ? activeDays : [],
      reminder_hour: reminderHour, reminder_window_hours: reminderWindow,
      effective_from: effectiveDate,
    });
  };

  return (
    <div className="streak-utility">
      <button ref={triggerRef} className="streak-button" type="button"
        aria-label={`Учебный стрик: ${loading || indicatorQuery.isError ? "загрузка" : `${String(currentDays)} дней`}. Открыть детали`}
        aria-expanded={open} aria-haspopup="dialog"
        onClick={() => { setOpen(value => !value); setCalendarOpen(false); }}>
        <span className="streak-button-fire" aria-hidden="true">🔥</span>
        <strong>{loading || indicatorQuery.isError ? "…" : String(currentDays)}</strong>
      </button>
      {celebration && <StreakCelebration from={celebration.from} to={celebration.to} onClose={() => { setCelebration(null); }} />}
      {reminderVisible && createPortal(<aside className="streak-rhythm-reminder-toast" role="status">
        <span className="streak-rhythm-reminder-symbol" aria-hidden="true"><Bell size={19}/></span>
        <span><strong>Время для практики</strong><small>Сегодня день твоего ритма. Короткий шаг в курсе или задаче поможет сохранить серию.</small></span>
        <button type="button" aria-label="Закрыть напоминание" onClick={() => { setReminderVisible(false); }}><X size={17}/></button>
      </aside>, document.body)}
      {open && createPortal(
        <div className="streak-modal-root">
          <button type="button" className="streak-modal-backdrop" aria-label="Закрыть серию" onClick={close} />
          <section ref={dialogRef} tabIndex={-1} className="streak-popover streak-redesign"
            role="dialog" aria-modal="true" aria-label="Учебный стрик" onKeyDown={onDialogKeyDown}>
            <button type="button" className="streak-modal-close" aria-label="Закрыть" onClick={close}><X size={22}/></button>
            {calendarOpen ? (
              <div className="streak-history">
                <button type="button" className="streak-history-back" onClick={() => { setCalendarOpen(false); }}>
                  <ArrowLeft size={18} /> Вернуться к серии
                </button>
                <div className="streak-history-heading">
                  <CalendarDays size={29} />
                  <div><h2>Календарь серии</h2><p>Подтверждённые дни и использованные заморозки</p></div>
                </div>
                <div className="streak-history-legend">
                  <span><Check size={15}/> Квалифицированное действие</span>
                  <span><Snowflake size={15}/> Заморозка</span>
                </div>
                <div className="engagement-calendar" aria-label="История квалифицированной серии">
                  {mergedDays.length ? mergedDays.map(day =>
                    <span className={qualifiedSet.has(day) ? "engagement-day" : "engagement-day engagement-day--frozen"} key={day}>
                      {qualifiedSet.has(day) ? <Check size={17}/> : <Snowflake size={16}/>}
                      {day}
                    </span>
                  ) : <span className="engagement-day engagement-day--empty">Пока нет квалифицируемых действий</span>}
                </div>
                <p className="engagement-hint">Календарь отражает только квалифицируемые дни. Входы и сообщения не учитываются.</p>
              </div>
            ) : (
              <>
                <div className="streak-hero">
                  <div className="streak-hero-copy">
                    <div className="streak-heading"><span className="streak-emoji" aria-hidden="true">🔥</span>
                      <h2>Квалифицированная серия</h2></div>
                    <div className="streak-headline">
                      <strong>{loading || indicatorQuery.isError ? "Загрузка…" : dayCountLabel(currentDays)}</strong> подряд
                    </div>
                    <p className="engagement-reason">
                      {indicatorQuery.isError ? "Не удалось загрузить данные о серии. Повторите попытку." :
                        todaySaved ? <>Отличный результат! Продолжай развиваться, и серия будет расти.<span className="sr-only">Сегодняшнее квалифицируемое действие сохранено.</span></> :
                        reason || "Выполни квалифицируемое действие, чтобы продолжить серию."}
                    </p>
                  </div>
                  <div className="streak-hero-illustration" aria-hidden="true">
                    {daysToGoal !== null && <div className="streak-next-goal"><strong>Ещё {dayCountLabel(daysToGoal)}</strong><span>до нового достижения!</span></div>}
                    <span className="streak-hero-spark">✦</span>
                    <span className="streak-hero-flame">🔥</span>
                    <img src="/streak-reference/mascot.svg" alt="" />
                  </div>
                </div>
                <button type="button" className="streak-week-card" onClick={() => { setCalendarOpen(true); }}
                  aria-label="Открыть полный календарь серии">
                  <span className="streak-week-arrow" aria-hidden="true"><ChevronDown size={26}/></span>
                  <span className="streak-week-days">
                    {week.map(({date, label}) => {
                      const qualified = qualifiedSet.has(date);
                      const frozen = frozenSet.has(date);
                      return <span className="streak-week-cell" key={date}>
                        <span>{label}</span>
                        <i className={`streak-week-dot${qualified ? " is-qualified" : frozen ? " is-frozen" : ""}${today === date ? " is-today" : ""}`}>
                          {qualified ? <Check size={20}/> : frozen ? <Snowflake size={17}/> : null}
                        </i>
                      </span>;
                    })}
                  </span>
                  <span className="streak-week-link">
                    <span>Календарь серии</span><span>Открыть полный календарь <ArrowRight size={18}/></span>
                  </span>
                </button>
                <div className="streak-facts" aria-label="Статистика серии">
                  <div className="streak-fact"><span className="streak-fact-icon is-growth"><BarChart3 size={26}/></span><div><strong>{loading || indicatorQuery.isError ? "—" : dayCountLabel(currentDays)}</strong><small>Текущая серия</small></div></div>
                  <div className="streak-fact"><span className="streak-fact-icon is-best"><Trophy size={27}/></span><div><strong>{loading || indicatorQuery.isError ? "—" : bestDays > 0 ? dayCountLabel(bestDays) : "Пока ноль"}</strong><small>Лучший результат</small></div></div>
                  <div className="streak-fact"><span className="streak-fact-icon is-freeze"><Snowflake size={27}/></span><div><strong>{freezeQuery.isPending || freezeQuery.isError ? "—" : dayCountLabel(freezeQuery.data.consumed_total)}</strong><small>Заморозки использовано<span className="streak-freeze-stock">{freezeQuery.isPending || freezeQuery.isError ? "—" : `${String(freezeStock)} в запасе`}</span></small></div></div>
                </div>
                <div className="streak-rule">
                  <CircleHelp size={23} aria-hidden="true" /><div>
                  <h3>Как считается серия</h3>
                  <p>Один день за первое квалифицируемое действие: прогресс курса, отправка в проект, принятое исправление, подтверждённое участие. Вход, клики и сообщения не учитываются.</p>
                  </div>
                </div>
                {freezeState === "frozen" && <p className="engagement-freeze-note" role="status">Вчерашний день закрыт заморозкой; заморозка не считается активностью.</p>}
                {freezeUsable && <div className="engagement-freeze-block">
                  <p>Пропущен вчерашний день. Можно использовать заморозку, если условия позволяют.</p>
                  <button type="button" className="streak-freeze-button" disabled={freezeUse.isPending}
                    onClick={() => { freezeUse.mutate(); }}>{freezeUse.isPending ? "Применяем…" : "Использовать заморозку"}</button>
                  {freezeUse.isSuccess && freezeUse.data.current_days === 0 &&
                    <p className="engagement-freeze-note" role="status">Заморозка не применяется: серия прервана глубже одного пропущенного дня.</p>}
                  {freezeUse.isError && <p className="engagement-freeze-error" role="alert">Не удалось применить заморозку. Запас не подтверждён как изменённый.</p>}
                </div>}
                {rhythmData && <div className="streak-rhythm-group"><section className="engagement-rhythm-block" aria-label="Недельный ритм">
                  <div className="engagement-rhythm-header">
                    <h3>Недельный ритм
                      <span className="engagement-help-wrap">
                        <button type="button" className="engagement-help-button" aria-label="Что такое недельный ритм?"
                          aria-expanded={rhythmHelpOpen} aria-describedby="engagement-rhythm-tooltip"
                          onClick={() => { setRhythmHelpOpen(value => !value); }}>?</button>
                        <span id="engagement-rhythm-tooltip" className={`engagement-help-tooltip${rhythmHelpOpen ? " is-open" : ""}`} role="tooltip">
                          Недельный ритм — это дни, в которые ты планируешь поддерживать серию. По ним строятся напоминания и ожидание активности.<span className="sr-only">Сам по себе ритм не засчитывает дни.</span>
                        </span>
                      </span>
                    </h3>
                    <span className="engagement-rhythm-status">
                      {rhythmData.versioned && rhythmData.done_days !== null && rhythmData.target_days
                        ? `${String(rhythmData.done_days)} из ${String(rhythmData.target_days)} за неделю` : "Не настроен"}
                    </span>
                  </div>
                  <p className="engagement-rhythm-hint" role="note">
                    Выбранные дни определяют недельную цель. Стрик по-прежнему растёт только от подтверждённых действий, даже вне расписания.
                  </p>
                  {rhythmData.scheduled_from && <p className="engagement-rhythm-hint">
                    {rhythmData.versioned ? "Новое расписание" : "Будущее расписание"}: {RHYTHM_PRESETS[rhythmData.scheduled_preset ?? ""] ?? rhythmData.scheduled_preset ?? "—"}, с {rhythmData.scheduled_from}
                  </p>}
                  {!rhythmData.versioned && rhythmData.history_count > 0 && !rhythmData.scheduled_from && <p className="engagement-rhythm-hint">Будущее соглашение ещё не действует.</p>}
                  {rhythmData.hint && <p className="engagement-rhythm-hint">{rhythmData.hint}</p>}
                  <div className="engagement-rhythm-presets">
                    {Object.entries(RHYTHM_PRESETS).map(([key,label]) => <button type="button" key={key}
                      className={`engagement-rhythm-chip${preset === key ? " engagement-rhythm-chip--active" : ""}`}
                      aria-pressed={preset === key} onClick={() => { setChosenPreset(key); setChosenDays(key === "custom" ? (rhythmData.preset === "custom" ? rhythmData.active_days : []) : null); }}>{label}</button>)}
                  </div>
                  {preset === "custom" && <div className="engagement-rhythm-days" aria-label="Дни недельного ритма">
                    {WEEKDAY_LABELS.map((label,index) => {
                      const day = index + 1, selected = activeDays.includes(day);
                      return <button type="button" key={label}
                        className={`engagement-rhythm-chip${selected ? " engagement-rhythm-chip--active" : ""}`}
                        aria-pressed={selected} onClick={() => { setChosenDays(
                          selected ? activeDays.filter(value => value !== day) : [...activeDays,day].sort((a,b)=>a-b)
                        ); }}>{label}</button>;
                    })}
                  </div>}
                  <div className="engagement-rhythm-schedule">
                    <div className="engagement-rhythm-reminder">
                      <span className="streak-reminder-icon"><Bell size={22}/></span>
                      <div><strong>Напоминание</strong><small>Чтобы не прерывать серию</small></div>
                    </div>
                    <label>Время
                      <select value={String(reminderHour)} onChange={e => { setChosenHour(Number(e.target.value)); }}>
                        {Array.from({length:24},(_,i)=>i).map(h=><option key={h} value={h}>{String(h).padStart(2,"0")}:00</option>)}
                      </select>
                    </label>
                    <label>Окно
                      <select aria-label="Окно напоминания" value={String(reminderWindow)} onChange={e => { setChosenWindow(Number(e.target.value)); }}>
                        {[1,2,3,4,5,6].map(h=><option key={h} value={h}>+{h} ч</option>)}
                      </select>
                    </label>
                    <label>Действует с
                      <input type="date" min={today}
                        value={effectiveDate} onChange={e => { setChosenEffective(e.target.value); }} />
                    </label>
                  </div>
                  {rhythmData.versioned && <p className="engagement-rhythm-version sr-only">Соглашение v{rhythmData.version ?? 1}; всего версий {rhythmData.history_count}</p>}
                </section>
                  <button type="button" className="streak-save-button" disabled={rhythmSave.isPending || rhythmQuery.isError || (preset === "custom" && activeDays.length === 0) || !effectiveDate || effectiveDate < today}
                    onClick={saveRhythm}>{rhythmSave.isPending ? "Сохраняем…" : "Сохранить ритм"}</button>
                  {rhythmSave.isSuccess && <p role="status" className="engagement-rhythm-note">Ритм сохранён ✓ Версия {rhythmSave.data.version ?? 1} действует с {rhythmSave.data.effective_from ?? "выбранной даты"}. Настройки сохраняются в профиле.</p>}
                  {rhythmSave.isError && <p role="alert" className="engagement-freeze-error">{serverErrorMessage(rhythmSave.error)}</p>}
                </div>}
              </>
            )}
          </section>
        </div>, document.body
      )}
    </div>
  );
}
