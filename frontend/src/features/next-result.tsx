import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "../api/client";
import type { components } from "../api/schema";

export type NextStepView = components["schemas"]["NextStepView"];
export type SkillGapView = components["schemas"]["SkillGapView"];
export type ScoredStepView = components["schemas"]["ScoredStepView"];

export type NextTargetKind = "course" | "task";

const UNCONFIRMED_LEVEL = "не подтверждено";

const KIND_LABEL: Record<string, string> = {
  course: "Курс",
  task: "Задача",
};

function targetKindLabel(kind: string): string {
  return KIND_LABEL[kind] ?? kind;
}

/**
 * Карта «Следующий результат» вокруг Skill Passport gap (openspec 22.2).
 * Данные — только из /me/growth/next-step: уровень навыка, целевой уровень,
 * недостающие источники, объяснение выбора объекта и честный fallback.
 * Пока evidence не проверен платформой, карта не обещает повышение уровня.
 */
export function PassportNextResultCard(props: {
  onOpenWorkspace: () => void;
  onOpenTarget: (kind: NextTargetKind, key: string) => void;
}) {
  const query = useQuery<NextStepView>({
    queryKey: ["growth-next-step"],
    queryFn: () =>
      apiRequest<NextStepView>("/api/v1/me/growth/next-step"),
  });
  return (
    <NextResultBody
      state={query.status}
      data={query.data}
      onOpenWorkspace={props.onOpenWorkspace}
      onOpenTarget={props.onOpenTarget}
    />
  );
}

export function NextResultBody(props: {
  state: "pending" | "error" | "success";
  data: NextStepView | undefined;
  onOpenWorkspace: () => void;
  onOpenTarget: (kind: NextTargetKind, key: string) => void;
}) {
  const gap = props.data?.skill ?? null;
  const step = props.data?.next_available ?? null;
  const staleSteps = (props.data?.steps ?? []).filter((item) => item.stale_reason !== null);
  const withoutOpenStep = step === null && staleSteps.length > 0;
  return (
    <>
      <div className="next-result-card" data-testid="next-result-card">
        <div className="next-result-flow">
          <p className="eyebrow">Следующий результат</p>
          <GapBadge gap={gap} />
          <GapTitle gap={gap} />
          <GapBody state={props.state} gap={gap} withoutOpenStep={withoutOpenStep} staleReason={staleSteps[0]?.stale_reason ?? null} />
          {step !== null ? (
            <StepRecommendation step={step} />
          ) : null}
          {withoutOpenStep ? (
            <p className="next-result-stale" data-testid="next-result-blocked" role="note">
              Подходящего открытого объекта нет, действие заблокировано: невыполненные
              обязательные шаги нужно обновить в траектории после проверки платформой.
              Прогноз повышения уровня не показываем.
            </p>
          ) : null}
          <div className="next-result-actions" data-testid="next-result-actions">
            {step !== null ? (
              <button
                type="button"
                className="next-result-target"
                data-testid="next-result-target"
                onClick={() => {
                  props.onOpenTarget(step.target_kind === "course" ? "course" : "task", step.target_key);
                }}
              >
                {step.target_kind === "course"
                  ? `Перейти к курсу «${step.target_title}»`
                  : `Открыть задачу «${step.target_title}» в каталоге`}
              </button>
            ) : null}
            <button
              type="button"
              onClick={props.onOpenWorkspace}
              aria-label="Открыть рабочую область"
            >
              Открыть рабочую область →
            </button>
          </div>
        </div>
      </div>
      <div className="focus-visual" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </>
  );
}

function StepRecommendation({ step }: { step: ScoredStepView }) {
  return (
    <div className="next-result-step" data-testid="next-result-step">
      <p className="next-result-object" data-testid="next-result-object">
        Объект: {targetKindLabel(step.target_kind)} · {step.target_title}
      </p>
      {step.reasons.length > 0 ? (
        <ul className="next-result-reasons" data-testid="next-result-reasons">
          {step.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      ) : null}
      <p className="next-result-forecast" data-testid="next-result-forecast" role="note">
        Прогноз прироста отдельный: уровень повышается только после проверки
        evidence платформой.
      </p>
    </div>
  );
}

function GapBadge({ gap }: { gap: SkillGapView | null }) {
  const label = gap
    ? gap.current_known
      ? `${gap.current_level} → ${gap.target_level}`
      : `${UNCONFIRMED_LEVEL} → ${gap.target_level}`
    : "Навык · план";
  return (
    <span className="ui-badge ui-badge--info" data-testid="next-result-badge">
      {label}
    </span>
  );
}

function GapTitle({ gap }: { gap: SkillGapView | null }) {
  return <h2>{gap ? gap.title : "Сборка Skill Passport начнётся после первого шага"}</h2>;
}

function GapBody({
  state,
  gap,
  withoutOpenStep,
  staleReason,
}: {
  state: "pending" | "error" | "success";
  gap: SkillGapView | null;
  withoutOpenStep: boolean;
  staleReason: string | null;
}) {
  if (state === "pending") {
    return (
      <p data-testid="next-result-loading" aria-busy="true">
        Определяем паспорт навыка: уровень, цель и недостающие источники.
      </p>
    );
  }
  if (state === "error" || !gap) {
    return (
      <p data-testid="next-result-unavailable">
        Служба Skill Passport недоступна: платформа не показывает уровень, пока не
        проверит ваши источники. Попробуйте позже — карта не подменяет данные
        вымышленными.
      </p>
    );
  }
  if (withoutOpenStep) {
    return (
      <>
        <p data-testid="next-result-explanation">{gap.explanation}</p>
        {staleReason ? (
          <p
            className="next-result-stale"
            data-testid="next-result-stale"
            role="note"
          >
            Причина недоступности: {staleReason}
          </p>
        ) : null}
      </>
    );
  }
  return (
    <>
      <p data-testid="next-result-explanation">{gap.explanation}</p>
      {gap.missing_evidence.length > 0 ? (
        <p className="next-result-missing" data-testid="next-result-missing">
          Нужно подтвердить: {gap.missing_evidence.join(", ")}
        </p>
      ) : null}
      {gap.fallback ? (
        <p
          className="next-result-fallback"
          data-testid="next-result-fallback"
          role="note"
        >
          {gap.fallback}
        </p>
      ) : null}
    </>
  );
}
