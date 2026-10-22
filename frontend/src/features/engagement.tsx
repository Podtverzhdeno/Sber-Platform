import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ANIMATION_STORAGE_KEY,
  fetchEngagementOverview,
  fetchFreezeSummary,
  fetchWeeklyRhythm,
  saveWeeklyRhythm,
  useFreezeDay,
} from "./engagement-client";
import "./engagement.scss";

const RHYTHM_PRESETS: Readonly<Record<string, string>> = {
  workdays: "Будни",
  weekends: "Выходные",
  all_week: "Вся неделя",
  twice_week: "Два дня",
  custom: "Свой список",
};

const ISO_WEEKDAY_LABELS: Readonly<Record<number, string>> = {
  1: "Пн",
  2: "Вт",
  3: "Ср",
  4: "Чт",
  5: "Пт",
  6: "Сб",
  7: "Вс",
};

function serverErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && "message" in parsed) {
      const message = (parsed as Record<string, unknown>).message;
      if (typeof message === "string" && message.length > 0) {
        return message;
      }
    }
  } catch {
    // non-JSON body: fall through
  }
  return "Не удалось сохранить недельный ритм.";
}

export function TopbarEngagementIndicator() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const indicatorQuery = useQuery({
    queryKey: ["engagement-overview"],
    queryFn: fetchEngagementOverview,
    retry: false,
  });
  const freezeQuery = useQuery({
    queryKey: ["engagement-freeze"],
    queryFn: fetchFreezeSummary,
    retry: false,
  });
  const freezeUse = useMutation({
    mutationFn: useFreezeDay,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["engagement-overview"] });
      void queryClient.invalidateQueries({ queryKey: ["engagement-freeze"] });
    },
  });
  const rhythmQuery = useQuery({
    queryKey: ["engagement-rhythm"],
    queryFn: fetchWeeklyRhythm,
    retry: false,
  });
  const rhythmSave = useMutation({
    mutationFn: saveWeeklyRhythm,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["engagement-rhythm"] });
    },
  });

  const currentDays = indicatorQuery.data?.current_days ?? 0;
  const bestDays = indicatorQuery.data?.best_days ?? 0;
  const qualifiedDates = indicatorQuery.data?.qualified_dates ?? [];
  const reason = indicatorQuery.data?.reason ?? "";
  const todaySaved = indicatorQuery.data?.today_saved ?? false;
  const loading = indicatorQuery.isPending;

  const [flashDays, setFlashDays] = useState<string | null>(null);
  useEffect(() => {
    if (loading) {
      return;
    }
    const stored = Number(window.localStorage.getItem(ANIMATION_STORAGE_KEY) ?? Number.NaN);
    if (Number.isFinite(stored) && stored < currentDays) {
      setFlashDays(`${String(stored)} → ${String(currentDays)}`);
    }
    window.localStorage.setItem(ANIMATION_STORAGE_KEY, String(currentDays));
  }, [loading, currentDays]);

  const frozenDates = indicatorQuery.data?.frozen_dates ?? [];
  const freezeState = indicatorQuery.data?.freeze_state ?? "idle";
  const freezeStock = freezeQuery.data?.available ?? 0;
  const freezeUsable = freezeState === "break" && freezeStock > 0;
  const mergedDays = Array.from(new Set([...qualifiedDates, ...frozenDates]))
    .sort()
    .slice(-56);
  const qualifiedSet = new Set(qualifiedDates);

  const rhythmData = rhythmQuery.data ?? null;
  const [chosenPreset, setChosenPreset] = useState<string | null>(null);
  const [chosenDays, setChosenDays] = useState<number[] | null>(null);
  const [chosenHour, setChosenHour] = useState<number | null>(null);
  const [chosenWindow, setChosenWindow] = useState<number | null>(null);
  const [chosenEffective, setChosenEffective] = useState<string | null>(null);
  const preset = chosenPreset ?? (rhythmData?.versioned ? (rhythmData.preset ?? "workdays") : "workdays");
  const activeDays = chosenDays ?? rhythmData?.active_days ?? [];
  const reminderHour = chosenHour ?? rhythmData?.reminder_hour ?? 18;
  const reminderWindow = chosenWindow ?? rhythmData?.reminder_window_hours ?? 3;
  const effectiveDate = chosenEffective ?? rhythmData?.week_start ?? "";
  const saveRhythm = () => {
    rhythmSave.mutate({
      preset,
      custom_days: preset === "custom" ? activeDays : [],
      reminder_hour: reminderHour,
      reminder_window_hours: reminderWindow,
      effective_from: effectiveDate,
    });
  };

  return (
    <div className="streak-utility">
      <button
        className="streak-button"
        type="button"
        aria-label={`Учебный стрик: ${loading ? "загрузка" : `${String(currentDays)} дней`}. Открыть детали`}
        aria-expanded={open}
        onClick={() => {
          setOpen((value) => !value);
        }}
      >
        🔥 <strong>{loading ? "…" : String(currentDays)}</strong>
      </button>
      {flashDays && (
        <span className="engagement-flash" role="status">
          Эффективность серии выросла: {flashDays}
        </span>
      )}
      {open && (
        <div className="streak-popover" role="dialog" aria-label="Учебный стрик">
          <header>
            <span>Квалифицированная серия</span>
            <strong>{loading ? "загрузка…" : `${String(currentDays)} дней подряд`}</strong>
          </header>
          <p className="engagement-reason">
            {todaySaved
              ? "Сегодняшнее квалифицируемое действие сохранено."
              : reason || "Первая квалифицируемая работа появится после действий."}
          </p>
          <div
            className="engagement-calendar"
            role="img"
            aria-label={`Квалифицированные дни: ${String(qualifiedDates.length)}, лучшая серия ${String(bestDays)} дней`}
          >
            {mergedDays.length ? (
              mergedDays.map((day) =>
                qualifiedSet.has(day) ? (
                  <span className="engagement-day" key={day}>
                    <i>✓</i>
                    {day}
                  </span>
                ) : (
                  <span className="engagement-day engagement-day--frozen" key={day}>
                    <i>❄</i>
                    {day}
                  </span>
                ),
              )
            ) : (
              <span className="engagement-day engagement-day--empty">
                <i>·</i>
                Пока нет квалифицируемых действий
              </span>
            )}
          </div>
          <dl className="engagement-facts">
            <div>
              <dt>Лучший результат</dt>
              <dd>
                {loading ? "загрузка…" : bestDays > 0 ? `${String(bestDays)} дней` : "Пока ноль"}
              </dd>
            </div>
            <div>
              <dt>Заморозки</dt>
              <dd>
                {freezeQuery.isPending
                  ? "загрузка…"
                  : `${String(freezeStock)} в запасе · использовано ${String(freezeQuery.data?.consumed_total ?? 0)}`}
              </dd>
            </div>
            <div>
              <dt>Как считается</dt>
              <dd>
                Один день за первое квалифицируемое действие: прогресс курса, отправка в
                проект, принятое исправление, подтверждённое участие. Вход, клики и сообщения не
                засчитываются.
              </dd>
            </div>
          </dl>
          {freezeState === "frozen" && (
            <p className="engagement-freeze-note" role="status">
              Вчерашний день закрыт заморозкой; заморозка не считается активностью.
            </p>
          )}
          {freezeUsable && (
            <section className="engagement-freeze-block">
              <p>Пропущен вчерашний день. Заморозка может закрыть его один раз.</p>
              <button
                type="button"
                className="streak-freeze-button"
                disabled={freezeUse.isPending}
                onClick={() => {
                  freezeUse.mutate();
                }}
              >
                {freezeUse.isPending ? "Применяем…" : "Использовать заморозку"}
              </button>
              {freezeUse.isSuccess && (
                <p className="engagement-freeze-note" role="status">
                  Заморозка не применяется: серия прервана глубже одного пропущенного дня.
                </p>
              )}
              {freezeUse.isError && (
                <p className="engagement-freeze-error" role="alert">
                  Служебный сбой зафиксирован без расхода заморозки: не удалось применить
                  заморозку к серии.
                </p>
              )}
            </section>
          )}
          <p className="engagement-hint">
            Календарь показывает только квалифицированные дни; счёт без входов и сообщений.
          </p>
          {rhythmData && (
            <section className="engagement-rhythm-block" aria-label="Недельный ритм">
              <header>
                <span>Недельный ритм</span>
                {rhythmData.versioned && rhythmData.done_days !== null && rhythmData.target_days ? (
                  <strong>{`${String(rhythmData.done_days)} из ${String(rhythmData.target_days)} в этой неделе`}</strong>
                ) : (
                  <strong>не настроен</strong>
                )}
              </header>
              {rhythmData.hint && <p className="engagement-rhythm-hint">{rhythmData.hint}</p>}
              {rhythmData.versioned && rhythmData.scheduled_from && (
                <p className="engagement-rhythm-hint">
                  {`Запланировано новое соглашение: ${
                    rhythmData.scheduled_preset
                      ? (RHYTHM_PRESETS[rhythmData.scheduled_preset] ?? rhythmData.scheduled_preset)
                      : ""
                  }, с ${rhythmData.scheduled_from}.`}
                </p>
              )}
              {!rhythmData.versioned && rhythmData.history_count > 0 && (
                <p className="engagement-rhythm-hint">
                  {(() => {
                    const plannedFrom = rhythmData.scheduled_from ?? rhythmData.effective_from;
                    return plannedFrom
                      ? `Будущее соглашение ещё не действует; запланировано на ${plannedFrom}.`
                      : "Будущее соглашение ещё не действует.";
                  })()}
                </p>
              )}
              <div className="engagement-rhythm-presets">
                {Object.entries(RHYTHM_PRESETS).map(([presetKey, presetLabel]) => (
                  <button
                    type="button"
                    key={presetKey}
                    className={
                      preset === presetKey
                        ? "engagement-rhythm-chip engagement-rhythm-chip--active"
                        : "engagement-rhythm-chip"
                    }
                    onClick={() => {
                      setChosenPreset(presetKey);
                      setChosenDays(
                        presetKey === "custom"
                          ? rhythmData.preset === "custom"
                            ? rhythmData.active_days
                            : []
                          : null,
                      );
                    }}
                  >
                    {presetLabel}
                  </button>
                ))}
              </div>
              {preset === "custom" && (
                <div className="engagement-rhythm-days">
                  {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                    <button
                      type="button"
                      key={day}
                      className={
                        activeDays.includes(day)
                          ? "engagement-rhythm-chip engagement-rhythm-chip--active"
                          : "engagement-rhythm-chip"
                      }
                      aria-pressed={activeDays.includes(day)}
                      onClick={() => {
                        setChosenDays(
                          activeDays.includes(day)
                            ? activeDays.filter((value) => value !== day)
                            : [...activeDays, day].sort((left, right) => left - right),
                        );
                      }}
                    >
                      {ISO_WEEKDAY_LABELS[day]}
                    </button>
                  ))}
                </div>
              )}
              <div className="engagement-rhythm-schedule">
                <label>
                  Напоминание
                  <select
                    value={String(reminderHour)}
                    onChange={(event) => {
                      setChosenHour(Number(event.target.value));
                    }}
                  >
                    {Array.from({ length: 24 }, (_hour, index) => String(index)).map((hour) => (
                      <option key={hour} value={hour}>
                        {`${hour}:00`}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Окно напоминания"
                    value={String(reminderWindow)}
                    onChange={(event) => {
                      setChosenWindow(Number(event.target.value));
                    }}
                  >
                    {[1, 2, 3, 4, 5, 6].map((hours) => (
                      <option key={hours} value={hours}>
                        {`+${String(hours)} ч`}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Действует с
                  <input
                    type="date"
                    min={rhythmData.week_start ?? undefined}
                    value={effectiveDate}
                    onChange={(event) => {
                      setChosenEffective(event.target.value);
                    }}
                  />
                </label>
              </div>
              {rhythmData.versioned && (
                <p className="engagement-rhythm-version">
                  {`Соглашение v${String(rhythmData.version ?? 1)}; всего версий ${String(rhythmData.history_count)}`}
                </p>
              )}
              <button
                type="button"
                className="streak-freeze-button"
                disabled={rhythmSave.isPending}
                onClick={saveRhythm}
              >
                {rhythmSave.isPending ? "Сохраняем…" : "Сохранить ритм"}
              </button>
              {rhythmSave.isSuccess && (
                <p className="engagement-rhythm-note" role="status">
                  {`Соглашение v${String(rhythmSave.data.version ?? 1)} сохранено; начинает действовать с ${rhythmSave.data.effective_from ?? ""}.`}
                </p>
              )}
              {rhythmSave.isError && (
                <p className="engagement-freeze-error" role="alert">
                  {serverErrorMessage(rhythmSave.error)}
                </p>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
