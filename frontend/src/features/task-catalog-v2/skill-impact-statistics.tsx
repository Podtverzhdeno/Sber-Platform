import { useState } from "react";
import { BadgeCheck, BarChart3, ChevronDown, CircleHelp, ClipboardCheck } from "lucide-react";

import { SkillMark } from "./skill-mark";
import { displayCatalogTopic } from "./topic-labels";
import type { CatalogItem } from "./types";
import "./skill-impact-statistics.scss";

type Impact = CatalogItem["skill_impact"][number];

export function parseSkillPercent(level: string | null): number | null {
  if (level === null || !/^\d+(?:[.,]\d+)?%$/.test(level.trim())) return null;
  const value = Number(level.replace("%", "").replace(",", "."));
  return Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
}

export function SkillImpactStatistics({ impacts, onGrowthExpand }: {
  impacts: readonly Impact[];
  onGrowthExpand: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const acceptedSkillCount = impacts.filter(item => (item.accepted_evidence_count ?? 0) > 0).length;
  const evidenceCount = impacts.reduce((sum, item) => sum + (item.accepted_evidence_count ?? 0), 0);
  const coverage = impacts.length ? Math.round((acceptedSkillCount / impacts.length) * 100) : 0;
  return <section className="catalog-v2-growth-section catalog-skill-stats" aria-label="Статистика навыков задачи">
    <div className="catalog-v2-section-heading">
      <h3><BarChart3 size={17} aria-hidden="true"/> Развитие твоих навыков</h3>
      <button type="button" aria-expanded={expanded} onClick={() => {
        if (!expanded) onGrowthExpand();
        setExpanded(value => !value);
      }}>{expanded ? "Скрыть подробности" : "Показать подробности"} <ChevronDown size={13} aria-hidden="true"/></button>
    </div>
    <div className="catalog-skill-stats__overview" aria-label="Подтверждения по требованиям задачи">
      <div><strong>{acceptedSkillCount} из {impacts.length}</strong><span>навыков с принятыми работами</span></div>
      <div><strong>{evidenceCount}</strong><span>подтверждений по навыкам</span></div>
      <div><strong>{coverage}%</strong><span>покрытие навыков принятыми работами</span></div>
    </div>
    <div className="catalog-skill-stats__coverage" role="img" aria-label={String(coverage) + "% навыков подкреплено принятыми работами"}>
      <span style={{width: String(coverage) + "%"}}/>
    </div>
    <p className="catalog-skill-stats__meaning">Статистика основана на принятых личных результатах за последние 365 дней. Это <strong>не оценка уровня владения навыком</strong> и не обещание роста после задачи.</p>
    {expanded && (impacts.length ? <>
      <ul className="catalog-skill-stats__list" aria-label="Подтверждённый опыт по навыкам">
        {impacts.map(impact => {
          const count = impact.accepted_evidence_count ?? 0;
          const current = parseSkillPercent(impact.current_level);
          const projected = impact.status === "calculated" ? parseSkillPercent(impact.projected_level) : null;
          const delta = current !== null && projected !== null ? projected - current : null;
          return <li key={impact.skill_id}>
            <div className="catalog-skill-stats__name">
              <SkillMark title={impact.title}/><strong>{displayCatalogTopic(impact.title)}</strong>
              <span className={count > 0 ? "catalog-skill-stats__tag catalog-skill-stats__tag--confirmed" : "catalog-skill-stats__tag"}>
                {count > 0 ? <BadgeCheck size={13} aria-hidden="true"/> : <CircleHelp size={13} aria-hidden="true"/>}
                {count > 0 ? "Есть принятые работы" : "Работ пока нет"}
              </span>
            </div>
            <div className="catalog-skill-stats__facts">
              <div><small>Принято личных работ</small><b>{count}</b></div>
              <div><small>Подтверждённый уровень</small><b>{impact.current_level ?? "Не оценивался"}</b></div>
              <div><small>После этой задачи</small><b>{impact.status === "calculated" && impact.projected_level ? impact.projected_level : "Оценка после проверки"}</b></div>
              <div><small>Изменение уровня</small><b>{delta === null ? "Пока неизвестно" : (delta > 0 ? "+" : "") + String(delta) + "%"}</b></div>
            </div>
            {current !== null && <div className="catalog-skill-stats__measured" aria-label={"Текущий уровень " + impact.current_level}><i style={{width:String(current)+"%"}}/></div>}
            <p>{count > 0 ? "Принятый опыт учтён в статистике задачи. Уровень отдельно определяется системой компетенций." : "Этот навык указан в требованиях задачи. Принятого личного результата по нему пока нет."}</p>
            {impact.last_evidence_submitted_at && count > 0 && <small className="catalog-skill-stats__date">Последняя принятая работа отправлена {new Date(impact.last_evidence_submitted_at).toLocaleDateString("ru-RU")}</small>}
          </li>;
        })}
      </ul>
      <details className="catalog-v2-growth-explanations">
        <summary>Как считаются показатели</summary>
        <p><ClipboardCheck size={13} aria-hidden="true"/> Учитываются только принятые личные вклады с приложенными материалами, в пределах 365 дней. Один и тот же вклад считается один раз для каждого указанного навыка.</p>
        <p>Один вклад может относиться к нескольким навыкам. Поэтому сумма подтверждений по навыкам не обязательно равна числу уникальных проектов.</p>
        <p>Числовой прирост появляется только при наличии утверждённой модели оценки. Прохождение задачи само по себе уровень не повышает.</p>
      </details>
    </> : <p className="catalog-skill-stats__empty">Заказчик пока не опубликовал требования к навыкам для этой задачи.</p>)}
  </section>;
}
