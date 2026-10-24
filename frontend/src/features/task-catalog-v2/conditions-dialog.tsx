import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState } from "react";
import { Award, BriefcaseBusiness, CalendarDays, ClipboardCheck, Clock3, FileText, Laptop2, ShieldCheck, Users } from "lucide-react";

import { ApiClientError } from "../../api/client";
import { StatePanel } from "../../components/ui";
import {
  acceptCurrentTermsAndApply,
  catalogErrorMessage,
  loadCatalogTerms,
} from "./client";
import type { CatalogApplicationResult } from "./analytics";
import type { CatalogItem } from "./types";

const supportModelLabels: Record<string, string> = {
  mentor_review: "Проверка результата ментором",
  mentor: "Поддержка ментора",
  team_review: "Проверка результата командой",
  self_service: "Самостоятельная работа",
};
const notProvided = (value: string) =>
  value === "not_provided" || !value.trim() ? "Не указано заказчиком" : value;

const formatModel = (value: string) => supportModelLabels[value] ?? notProvided(value);

const formatDeadline = (value: string | null) => {
  if (value === null) return "Срок не указан";
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "long", timeStyle: "short" }).format(
    new Date(value),
  );
};

const formatMinutes = (value: number | null) => {
  if (value === null) return "Не указано заказчиком";
  return `${String(Math.floor(value / 60))} ч ${String(value % 60)} мин`;
};

export function ConditionsDialog(props: {
  task: CatalogItem;
  onClose: () => void;
  onApplied: () => void;
  onApplicationResult?: (result: CatalogApplicationResult) => void;
}) {
  const { task } = props;
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(props.onClose);
  const pendingRef = useRef(false);
  const [consent, setConsent] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [termsChangedFrom, setTermsChangedFrom] = useState<number | null>(null);
  const client = useQueryClient();
  const terms = useQuery({
    queryKey: ["task-catalog-v2-terms", task.task_id],
    queryFn: () => loadCatalogTerms(task.task_id),
    staleTime: 0,
    refetchOnMount: "always",
  });
  const termsAccessDenied =
    terms.error instanceof ApiClientError && [403, 404].includes(terms.error.status);
  // An authorization failure revokes previously loaded conditions rather than
  // leaving a private terms snapshot and consent form active in the dialog.
  const termsData = termsAccessDenied ? undefined : terms.data;
  const apply = useMutation({
    mutationFn: async () => {
      if (termsData === undefined) throw new Error("Terms are not loaded");
      await acceptCurrentTermsAndApply(task.task_id, termsData);
    },
    onMutate: () => {
      setActionError(null);
    },
    onError: (error: unknown) => {
      const result: CatalogApplicationResult =
        error instanceof ApiClientError && error.code === "TERMS_CHANGED"
          ? "terms_changed"
          : error instanceof TypeError || !navigator.onLine
            ? "offline"
            : "error";
      props.onApplicationResult?.(result);
      setActionError(catalogErrorMessage(error));
      if (error instanceof ApiClientError && error.code === "TERMS_CHANGED") {
        setTermsChangedFrom(termsData?.terms_version ?? null);
        setConsent(false);
        client.removeQueries({ queryKey: ["task-catalog-v2-terms", task.task_id] });
        void terms.refetch();
      }
    },
    onSuccess: () => {
      props.onApplicationResult?.("success");
      props.onApplied();
    },
  });
  pendingRef.current = apply.isPending;

  useEffect(() => {
    onCloseRef.current = props.onClose;
  }, [props.onClose]);

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pendingRef.current) {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), a[href], [tabindex="0"]',
        ) ?? [],
      );
      const first = focusable[0];
      const last = focusable.at(-1);
      if (first === undefined || last === undefined) {
        event.preventDefault();
        closeRef.current?.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previous?.focus();
    };
  }, []);

  return (
    <div
      className="catalog-v2-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !apply.isPending) props.onClose();
      }}
    >
      <section
        ref={panelRef}
        className="catalog-v2-conditions"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <header className="catalog-v2-conditions-header">
          <span className="catalog-v2-conditions-avatar" aria-hidden="true"><BriefcaseBusiness size={26} /></span>
          <div>
            <h2 id={titleId}>{termsAccessDenied ? "Условия участия недоступны" : "Условия участия"}</h2>
            <strong>{termsAccessDenied ? "Доступ к задаче ограничен" : task.title}</strong>
            <p>{task.customer.display_name} · версия условий {termsData?.terms_version ?? "…"}</p>
            <ul className="catalog-v2-tags" aria-label="Компетенции задачи">{task.competency_tags.slice(0, 5).map((tag) => <li key={tag}>{tag}</li>)}</ul>
          </div>
          <button ref={closeRef} type="button" aria-label="Закрыть условия"
            disabled={apply.isPending} onClick={props.onClose}>×</button>
        </header>
        <p id={descriptionId} className="catalog-v2-conditions-note">
          Отклик — заявка заказчику, а не автоматическое назначение. Согласие действительно только для текущей версии условий.
        </p>
        {terms.isPending ? <StatePanel kind="loading" /> : null}
        {terms.isError ? (
          <StatePanel
            kind={
              termsAccessDenied
                ? "restricted"
                : terms.error instanceof TypeError || !navigator.onLine
                  ? "offline"
                  : "error"
            }
            action="Повторить загрузку условий"
            onAction={() => {
              void terms.refetch();
            }}
          />
        ) : null}
        {termsData !== undefined ? (
          <>
            <div className="catalog-v2-conditions-stats" aria-label="Ключевые параметры задачи">
              <div><CalendarDays size={20} aria-hidden="true" /><strong>{termsData.duration_minutes === null ? "Не указано" : formatMinutes(termsData.duration_minutes)}</strong><small>Срок выполнения</small></div>
              <div><Clock3 size={20} aria-hidden="true" /><strong>{formatMinutes(termsData.weekly_workload_minutes)}</strong><small>Нагрузка в неделю</small></div>
              <div><Users size={20} aria-hidden="true" /><strong>{String(task.places_total)} участников</strong><small>Размер команды · мест {task.places_available ?? "—"}</small></div>
              <div><FileText size={20} aria-hidden="true" /><strong>{notProvided(termsData.deliverable)}</strong><small>Ожидаемый результат</small></div>
            </div>
            <div className="catalog-v2-terms-grid">
              <section>
                <h3><ClipboardCheck size={19} aria-hidden="true" /> Что нужно для отклика</h3>
                {termsData.prerequisites.length > 0 ? <ul>{termsData.prerequisites.map((value) => <li key={value}>{value}</li>)}</ul> : <p>Дополнительные требования не опубликованы.</p>}
              </section>
              <section>
                <h3><FileText size={19} aria-hidden="true" /> Что сдаёшь в итоге</h3>
                <p>{notProvided(termsData.deliverable)}</p>
                <h4>Критерии приёмки</h4>
                {termsData.acceptance_criteria.length > 0 ? <ul>{termsData.acceptance_criteria.map((value) => <li key={value}>{value}</li>)}</ul> : <p>Критерии приёмки не опубликованы.</p>}
              </section>
              <section>
                <h3><Laptop2 size={19} aria-hidden="true" /> Формат работы</h3>
                <p>{task.work_format === "remote" ? "Удалённо" : task.work_format === "hybrid" ? "Гибрид" : task.work_format === "onsite" ? "На площадке" : task.work_format ?? "Формат не указан"}</p>
                <p>Дедлайн отклика: {formatDeadline(termsData.deadline_at)}</p>
                <p>Поддержка: {formatModel(termsData.support_model)}</p>
              </section>
              <section>
                <h3><Award size={19} aria-hidden="true" /> Критерии отбора</h3>
                {termsData.selection_criteria.length > 0 ? <ul>{termsData.selection_criteria.map((value) => <li key={value}>{value}</li>)}</ul> : <p>Критерии отбора не опубликованы.</p>}
              </section>
              <section className="catalog-v2-terms-support">
                <h3><Users size={19} aria-hidden="true" /> Поддержка</h3>
                <p>{formatModel(termsData.support_model)}</p>
              </section>
              <section className="catalog-v2-terms-disclosure">
                <h3><ShieldCheck size={19} aria-hidden="true" /> Условия использования результата</h3>
                <p>{termsData.data_constraints ?? "Ограничения данных не указаны."}</p>
                <p>{notProvided(termsData.ip_terms)}</p>
                <p>{termsData.paid ? "Участие оплачивается." : "Оплата не предусмотрена."} {termsData.payout_condition ?? "Условия выплаты не опубликованы."}</p>
                <p>Портфолио: {termsData.portfolio_permission === "none" ? "не разрешено" : termsData.portfolio_permission === "full" ? "разрешено по условиям заказчика" : "только при выполнении дополнительных условий"}.</p>
              </section>
            </div>
          </>
        ) : null}
        {actionError !== null ? <p className="catalog-v2-action-error" role="alert">{actionError}</p> : null}
        {termsChangedFrom !== null ? <p className="catalog-v2-terms-changed" role="status">Версия {termsChangedFrom} больше не действует. Сейчас открыта версия {termsData?.terms_version ?? "…"}; согласие нужно подтвердить заново.</p> : null}
        {termsData !== undefined ? (
          <form
            className="catalog-v2-consent"
            onSubmit={(event) => {
              event.preventDefault();
              if (consent && !apply.isPending) apply.mutate();
            }}
          >
            <label>
              <input
                type="checkbox"
                checked={consent}
                disabled={apply.isPending}
                onChange={(event) => {
                  setConsent(event.target.checked);
                }}
              />
              Я прочитал(а) условия версии {termsData.terms_version} и подтверждаю их перед откликом.
            </label>
            <div className="catalog-v2-conditions-actions">
              <button type="button" disabled={apply.isPending} onClick={props.onClose}>Закрыть</button>
              <button type="submit" className="catalog-v2-primary" aria-label="Подтвердить и отправить отклик" disabled={!consent || apply.isPending}>
                {apply.isPending ? "Проверяем и отправляем…" : "Откликнуться"}
              </button>
            </div>
          </form>
        ) : null}
      </section>
    </div>
  );
}
