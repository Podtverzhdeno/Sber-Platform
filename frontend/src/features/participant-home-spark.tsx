import type { KpiKey } from "./kpi-data";

/**
 * Мини-график KPI-карточки главной участника (openspec 22.25).
 * Каждый столбик фокусируем: hover/focus/touch-press открывает подсказку
 * «число · единица · период» (data-tip + ::after в CSS), aria-label повторяет
 * те же данные для screen reader. Свободная зона над столбиками зарезервирована
 * под подсказку, чтобы она не перекрывала название, значение и пояснение.
 * Единицы соответствуют реальной семантике показателя; относительный период
 * («точка N из M») честен для всего ряда и не выдумывает календарные даты.
 */
export type SparkKpi = KpiKey | "streak";

const KPI_UNIT_FORMS: Record<SparkKpi, [string, string, string]> = {
  verified: ["факт", "факта", "фактов"],
  progress: ["%", "%", "%"],
  projects: ["работа", "работы", "работ"],
  streak: ["день", "дня", "дней"],
};

function unitSuffix(kpiKey: SparkKpi, value: number): string {
  if (kpiKey === "progress") {
    return "%";
  }
  const [one, few, many] = KPI_UNIT_FORMS[kpiKey];
  const mod10 = value % 10;
  const mod100 = value % 100;
  if (mod10 === 1 && mod100 !== 11) {
    return ` ${one}`;
  }
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return ` ${few}`;
  }
  return ` ${many}`;
}

function participantBarLabel(
  kpiKey: SparkKpi,
  seriesValue: number,
  seriesIndex: number,
  seriesLength: number,
): string {
  const period = `точка ${String(seriesIndex + 1)} из ${String(seriesLength)}`;
  return `${String(seriesValue)}${unitSuffix(kpiKey, seriesValue)} · ${period}`;
}

export function ParticipantMetricSpark(props: {
  kpiKey: SparkKpi;
  series: number[];
  testId: string;
}) {
  const series = props.series;
  const peak = series.length > 0 ? Math.max(...series) : 1;
  return (
    <div className="metric-histogram" data-testid={props.testId}>
      {series.map((seriesValue, seriesIndex) => {
        const label = participantBarLabel(
          props.kpiKey,
          seriesValue,
          seriesIndex,
          series.length,
        );
        return (
          <i
            key={seriesIndex}
            role="img"
            tabIndex={0}
            aria-label={label}
            data-tip={label}
            style={{
              height: `${String(Math.max(12, (seriesValue / peak) * 100))}%`,
            }}
          />
        );
      })}
    </div>
  );
}
