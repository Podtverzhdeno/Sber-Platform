import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "../api/client";
import type { components } from "../api/schema";

export type NextStepView = components["schemas"]["NextStepView"];
export type SkillGapView = components["schemas"]["SkillGapView"];

const UNCONFIRMED_LEVEL = "не подтверждено";

/**
 * Карта «Следующий результат» вокруг Skill Passport gap (openspec 22.2).
 * Данные — только из /me/growth/next-step: уровень навыка, целевой уровень,
 * недостающие источники, объяснение выбора шаг и честный fallback. Пока
 * evidence не проверен платформой, карта не обещает повышение уровня.
 */
export function PassportNextResultCard(props: {
  onOpenWorkspace: () => void;
}) {
  const query = useQuery<NextStepView>({
    queryKey: ["growth-next-step"],
    queryFn: () =>
      apiRequest<NextStepView>("/api/v1/me/growth/next-step"),
  });
  return <NextResultBody state={query.status} data={query.data} onOpenWorkspace={props.onOpenWorkspace} />;
}

export function NextResultBody(props: {
  state: "pending" | "error" | "success";
  data: NextStepView | undefined;
  onOpenWorkspace: () => void;
}) {
  const gap = props.data?.skill ?? null;
  return (
    <article className="focus-panel" data-testid="next-result-card">
      <div>
        <p className="eyebrow">Следующий результат</p>
        <GapBadge gap={gap} />
        <GapTitle gap={gap} />
        <GapBody state={props.state} gap={gap} />
        <button
          type="button"
          onClick={props.onOpenWorkspace}
          aria-label="Открыть рабочую область"
        >
          Открыть рабочую область →
        </button>
      </div>
      <div className="focus-visual" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </article>
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
}: {
  state: "pending" | "error" | "success";
  gap: SkillGapView | null;
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
