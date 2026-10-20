import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ANIMATION_STORAGE_KEY,
  fetchEngagementOverview,
} from "./engagement-client";
import "./engagement.css";

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export function TopbarEngagementIndicator() {
  const [open, setOpen] = useState(false);
  const indicatorQuery = useQuery({
    queryKey: ["engagement-overview"],
    queryFn: fetchEngagementOverview,
    retry: false,
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

  const calendarCells = qualifiedDates.slice(-56);

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
            {calendarCells.length ? (
              calendarCells.map((day) => (
                <span className="engagement-day" key={day}>
                  <i>✓</i>
                  {day}
                </span>
              ))
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
              <dt>Как считается</dt>
              <dd>
                Один день за первое квалифицируемое действие: прогресс курса, отправка в
                проект, принятое исправление, подтверждённое участие. Вход, клики и сообщения не
                засчитываются.
              </dd>
            </div>
          </dl>
          <p className="engagement-hint">
            {WEEKDAYS.length > 0
              ? "Календарь показывает только квалифицированные дни; счёт без входов и сообщений."
              : ""}
          </p>
        </div>
      )}
    </div>
  );
}
