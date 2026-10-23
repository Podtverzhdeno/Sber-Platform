import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState } from "react";

import { ApiClientError } from "../../api/client";
import { StatePanel } from "../../components/ui";
import {
  acceptCurrentTermsAndApply,
  catalogErrorMessage,
  loadCatalogTerms,
} from "./client";
import type { CatalogApplicationResult } from "./analytics";
import type { CatalogItem } from "./types";

const notProvided = (value: string) =>
  value === "not_provided" || !value.trim() ? "Не указано заказчиком" : value;

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
        <header>
          <div>
            <p className="eyebrow">Актуальные условия · версия {termsData?.terms_version ?? "…"}</p>
            <h2 id={titleId}>
              {termsAccessDenied ? "Условия участия недоступны" : `Участие в задаче «${task.title}»`}
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            aria-label="Закрыть условия"
            disabled={apply.isPending}
            onClick={props.onClose}
          >
            ×
          </button>
        </header>
        <p id={descriptionId}>
          Отклик означает отправку заявки заказчику, а не автоматическое назначение на задачу.
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
          <div className="catalog-v2-terms-grid">
            <section>
              <h3>Результат</h3>
              <p>{notProvided(termsData.deliverable)}</p>
            </section>
            <section>
              <h3>Критерии приёмки</h3>
              {termsData.acceptance_criteria.length ? (
                <ul>{termsData.acceptance_criteria.map((item) => <li key={item}>{item}</li>)}</ul>
              ) : <p>Критерии приёмки не опубликованы.</p>}
            </section>
            <section>
              <h3>Требования к участнику</h3>
              {termsData.prerequisites.length ? (
                <ul>{termsData.prerequisites.map((item) => <li key={item}>{item}</li>)}</ul>
              ) : <p>Дополнительные prerequisites не опубликованы.</p>}
            </section>
            <section>
              <h3>Критерии отбора</h3>
              {termsData.selection_criteria.length ? (
                <ul>{termsData.selection_criteria.map((item) => <li key={item}>{item}</li>)}</ul>
              ) : <p>Критерии отбора не опубликованы.</p>}
            </section>
            <section>
              <h3>Срок и поддержка</h3>
              <p>{formatDeadline(termsData.deadline_at)}</p>
              <p>Длительность: {formatMinutes(termsData.duration_minutes)}</p>
              <p>Нагрузка в неделю: {formatMinutes(termsData.weekly_workload_minutes)}</p>
              <p>Поддержка: {notProvided(termsData.support_model)}</p>
            </section>
            <section>
              <h3>Данные и интеллектуальная собственность</h3>
              <p>{termsData.data_constraints ?? "Ограничения данных не указаны."}</p>
              <p>{notProvided(termsData.ip_terms)}</p>
            </section>
            <section>
              <h3>Оплата и портфолио</h3>
              <p>{termsData.paid ? "Участие оплачивается." : "Оплата не предусмотрена."}</p>
              <p>{termsData.payout_condition ?? "Условие выплаты не указано."}</p>
              <p>Портфолио: {termsData.portfolio_permission}.</p>
            </section>
          </div>
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
            <button type="submit" className="catalog-v2-primary" disabled={!consent || apply.isPending}>
              {apply.isPending ? "Проверяем и отправляем…" : "Подтвердить и отправить отклик"}
            </button>
          </form>
        ) : null}
      </section>
    </div>
  );
}
