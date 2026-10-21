import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ANIMATION_STORAGE_KEY,
  fetchEngagementOverview,
  fetchFreezeSummary,
  useFreezeDay,
} from "./engagement-client";
import "./engagement.css";

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
        </div>
      )}
    </div>
  );
}
