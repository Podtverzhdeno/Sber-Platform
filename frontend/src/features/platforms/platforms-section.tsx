import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { retrySafeRead } from "../../api/client";
import { csrfHeaders, platformRequest, safeExternalUrl } from "./client";
import {
  PLATFORM_STATUS_LABELS,
  PLATFORM_STATUS_TONES,
  type PlatformsSectionProps,
} from "./statuses";
import type {
  ConnectChallengeView,
  ConnectionViewResponse,
  DeepLinkView,
  PlatformCatalogResponse,
} from "./types";

/**
 * «Платформы» — project platform connection catalog (openspec 22.20).
 * Server-side connection model for GigaCode, GigaCoWork, GigaAgent and
 * GitVerse. The UI never renders credential material: access tokens are
 * sealed on the server and every connect callback round-trips OAuth state
 * plus a fresh idempotency key so retries stay side-effect free.
 */

function catalogPath(projectId: string): string {
  return `/api/v1/projects/${projectId}/platforms`;
}

function providerPath(projectId: string, providerKey: string): string {
  return `${catalogPath(projectId)}/${providerKey}`;
}

function connectionPath(
  projectId: string,
  connectionId: string,
  suffix: string,
): string {
  return `${catalogPath(projectId)}/connections/${connectionId}/${suffix}`;
}

interface ActiveChallenge {
  providerKey: string;
  challenge: ConnectChallengeView;
}

/** Presenter: every state, label and safe-link check is exercised directly. */
export function PlatformsSectionBody(props: PlatformsSectionProps) {
  const [formProvider, setFormProvider] = useState<string | null>(null);
  const [workspaceRef, setWorkspaceRef] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<Record<string, boolean>>(
    {},
  );
  const [callbackCode, setCallbackCode] = useState("");

  const openForm = useCallback((providerKey: string) => {
    setFormProvider(providerKey);
    setSelectedScopes({});
    setWorkspaceRef("");
  }, []);

  const cardProvider = props.data.items.find(
    (item) => item.provider_key === formProvider,
  );
  const scopesForForm = useMemo(
    () => cardProvider?.required_permissions ?? [],
    [cardProvider],
  );

  const submitForm = useCallback(() => {
    if (formProvider === null) return;
    const scopes = scopesForForm.filter(
      (scope) => selectedScopes[scope] !== false,
    );
    props.onConnect(formProvider, workspaceRef, scopes);
  }, [
    formProvider,
    scopesForForm,
    selectedScopes,
    props,
    workspaceRef,
  ]);

  if (props.challenge !== null) {
    const challenge = props.challenge;
    const safeChallengeUrl = safeExternalUrl(challenge.authorization_url);
    const card = props.data.items.find(
      (item) => item.provider_key === challenge.provider_key,
    );
    return (
      <section
        aria-labelledby="platform-challenge-title"
        data-testid="platform-challenge"
      >
        <h3 id="platform-challenge-title">
          Подключение {card?.title ?? challenge.provider_key}
        </h3>
        <p>
          Шаг 1. Откройте авторизацию платформы — ссылка проверяется на https и
          отсутствие токенов в адресе.{" "}
          {safeChallengeUrl === null ? (
            <span data-testid="platform-challenge-link-invalid">
              Ссылка не прошла проверку безопасности и не открывается.
            </span>
          ) : (
            <a
              href={safeChallengeUrl}
              target="_blank"
              rel="noreferrer noopener external"
              data-testid="platform-challenge-link"
            >
              Открыть авторизацию платформы
            </a>
          )}
        </p>
        <p>
          Шаг 2. Введите код подтверждения, который показала платформа:{" "}
          <input
            type="text"
            value={callbackCode}
            onChange={(event) => { setCallbackCode(event.target.value); }}
            aria-label="Код подтверждения платформы"
            data-testid="platform-callback-code"
          />
        </p>
        <button
          type="button"
          disabled={props.completing || callbackCode.trim().length === 0}
          onClick={() => {
            props.onComplete(challenge.provider_key, challenge.state, callbackCode);
          }}
          data-testid="platform-complete"
        >
          Подтвердить подключение
        </button>
        <button
          type="button"
          className="secondary-button"
          onClick={props.onCancelChallenge}
          data-testid="platform-challenge-cancel"
        >
          Отменить подключение
        </button>
      </section>
    );
  }

  return (
    <section aria-labelledby="platforms-title" data-testid="platforms-section">
      <h2 id="platforms-title">Платформы проекта</h2>
      <p>
        Каждая связь подключается к одному проекту и держит только минимальный
        набор разрешений; учётные данные платформ никогда не попадают в
        интерфейс.
      </p>
      {props.data.items.map((card) => {
        const connection = card.connection;
        const status = connection?.status ?? "not_connected";
        return (
          <article
            key={card.provider_key}
            data-testid={`platform-card-${card.provider_key}`}
          >
            <header>
              <h3>{card.title}</h3>
              <span
                className={`ui-badge ui-badge--${PLATFORM_STATUS_TONES[status]}`}
                data-testid={`platform-status-${card.provider_key}`}
              >
                {PLATFORM_STATUS_LABELS[status]}
              </span>
            </header>
            <p>{card.purpose}</p>
            <p>
              {card.repository_label}: {connection?.workspace_ref ?? "—"}
            </p>
            <ul aria-label={`Разрешения ${card.title}`}>
              {(connection?.scopes ?? card.required_permissions).map((scope) => (
                <li key={scope}>{scope}</li>
              ))}
            </ul>
            {connection?.last_error ? (
              <p role="status" data-testid={`platform-error-${card.provider_key}`}>
                {connection.last_error}
              </p>
            ) : null}
            {connection !== null && connection.status === "connected" ? (
              <footer>
                <button
                  type="button"
                  disabled={props.openingLinkConnectionId === connection.id}
                  onClick={() => { props.onOpenDeepLink(connection.id); }}
                  data-testid={`platform-open-${card.provider_key}`}
                >
                  Открыть рабочую область
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={props.revokingConnectionId === connection.id}
                  onClick={() => { props.onRevoke(connection.id); }}
                  data-testid={`platform-revoke-${card.provider_key}`}
                >
                  Отозвать доступ
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => { props.onReconnect(card.provider_key); }}
                  data-testid={`platform-reconnect-${card.provider_key}`}
                >
                  Переподключить
                </button>
                {props.linkUrl?.connectionId === connection.id ? (
                  <p>
                    <a
                      href={safeExternalUrl(props.linkUrl.url) ?? undefined}
                      target="_blank"
                      rel="noreferrer noopener external"
                      data-testid={`platform-link-${card.provider_key}`}
                    >
                      Рабочая область платформы
                    </a>
                  </p>
                ) : null}
              </footer>
            ) : null}
            {connection === null ||
            connection.status === "not_connected" ||
            connection.status === "revoked" ? (
              <button
                type="button"
                onClick={() => { openForm(card.provider_key); }}
                data-testid={`platform-connect-${card.provider_key}`}
              >
                Подключить
              </button>
            ) : null}
            {connection !== null &&
            (connection.status === "expired" || connection.status === "error") ? (
              <button
                type="button"
                onClick={() => { props.onReconnect(card.provider_key); }}
                data-testid={`platform-reconnect-${card.provider_key}`}
              >
                Повторить подключение
              </button>
            ) : null}
          </article>
        );
      })}
      {formProvider !== null && cardProvider !== undefined ? (
        <form
          aria-labelledby="platform-connect-form-title"
          data-testid="platform-connect-form"
          onSubmit={(event) => {
            event.preventDefault();
            submitForm();
          }}
        >
          <h3 id="platform-connect-form-title">
            Подключить {cardProvider.title}
          </h3>
          <label htmlFor="platform-workspace-ref">
            {cardProvider.repository_label}
          </label>
          <input
            id="platform-workspace-ref"
            type="text"
            value={workspaceRef}
            onChange={(event) => { setWorkspaceRef(event.target.value); }}
            required
            data-testid="platform-workspace-input"
          />
          <fieldset>
            <legend>Разрешения платформы</legend>
            {scopesForForm.map((scope) => (
              <label key={scope}>
                <input
                  type="checkbox"
                  checked={selectedScopes[scope] !== false}
                  onChange={(event) => { setSelectedScopes((previous) => ({
                      ...previous,
                      [scope]: event.target.checked,
                    })); }
                  }
                  data-testid={`platform-scope-${scope}`}
                />
                {scope}
              </label>
            ))}
          </fieldset>
          <button
            type="submit"
            disabled={props.connecting}
            data-testid="platform-connect-submit"
          >
            Запустить подключение
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => { setFormProvider(null); }}
            data-testid="platform-connect-cancel"
          >
            Отмена
          </button>
        </form>
      ) : null}
    </section>
  );
}

export function PlatformsSection(props: { projectId: string }) {
  const projectId = props.projectId;
  const queryClient = useQueryClient();
  const [challenge, setChallenge] = useState<ActiveChallenge | null>(null);
  const [linkUrl, setLinkUrl] = useState<PlatformsSectionProps["linkUrl"]>(null);

  const query = useQuery<PlatformCatalogResponse>({
    queryKey: ["platforms", projectId],
    queryFn: () =>
      platformRequest<PlatformCatalogResponse>(catalogPath(projectId)),
    retry: retrySafeRead,
  });

  const refreshCatalog = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["platforms", projectId] });
  }, [projectId, queryClient]);

  const connect = useMutation({
    mutationFn: (input: {
      providerKey: string;
      workspaceRef: string;
      scopes: string[];
    }) =>
      platformRequest<ConnectChallengeView>(
        `${providerPath(projectId, input.providerKey)}/connect`,
        {
          method: "POST",
          headers: csrfHeaders(),
          body: JSON.stringify({
            workspace_ref: input.workspaceRef,
            scopes: input.scopes,
          }),
        },
      ),
    onSuccess: (data, variables) => {
      setChallenge({ providerKey: variables.providerKey, challenge: data });
    },
    onSettled: refreshCatalog,
  });

  const complete = useMutation({
    mutationFn: (input: { providerKey: string; state: string; code: string }) =>
      platformRequest<ConnectionViewResponse>(
        `${providerPath(projectId, input.providerKey)}/callback`,
        {
          method: "POST",
          headers: csrfHeaders(),
          body: JSON.stringify({
            state: input.state,
            code: input.code,
            idempotency_key: `connect-${crypto.randomUUID()}`,
          }),
        },
      ),
    onSuccess: () => {
      setChallenge(null);
    },
    onSettled: refreshCatalog,
  });

  const revoke = useMutation({
    mutationFn: (connectionId: string) =>
      platformRequest<ConnectionViewResponse>(
        connectionPath(projectId, connectionId, "revoke"),
        { method: "POST", headers: csrfHeaders() },
      ),
    onSettled: refreshCatalog,
  });

  const reconnect = useMutation({
    mutationFn: (providerKey: string) =>
      platformRequest<ConnectChallengeView>(
        `${providerPath(projectId, providerKey)}/reconnect`,
        { method: "POST", headers: csrfHeaders(), body: JSON.stringify({}) },
      ),
    onSuccess: (data, variables) => {
      setChallenge({ providerKey: variables, challenge: data });
    },
    onSettled: refreshCatalog,
  });

  const openDeepLink = useMutation({
    mutationFn: (connectionId: string) =>
      platformRequest<DeepLinkView>(
        connectionPath(projectId, connectionId, "deep-link"),
        { method: "GET" },
      ),
    onSuccess: (data, connectionId) => {
      setLinkUrl({ connectionId, url: data.url });
    },
  });

  const sectionProps = useMemo<PlatformsSectionProps>(
    () => ({
      data: query.data ?? { items: [] },
      challenge: challenge?.challenge ?? null,
      connecting:
        connect.isPending || reconnect.isPending || complete.isPending,
      revokingConnectionId: revoke.isPending ? revoke.variables : null,
      completing: complete.isPending,
      openingLinkConnectionId: openDeepLink.isPending
        ? openDeepLink.variables
        : null,
      linkUrl,
      onConnect: (providerKey, workspaceRef, scopes) => { connect.mutate({ providerKey, workspaceRef, scopes }); },
      onCancelChallenge: () => { setChallenge(null); },
      onComplete: (providerKey, state, code) => { complete.mutate({ providerKey, state, code }); },
      onReconnect: (providerKey) => { reconnect.mutate(providerKey); },
      onRevoke: (connectionId) => { revoke.mutate(connectionId); },
      onOpenDeepLink: (connectionId) => { openDeepLink.mutate(connectionId); },
      onRetry: refreshCatalog,
    }),
    [
      query.data,
      challenge,
      connect,
      complete,
      revoke,
      reconnect,
      openDeepLink,
      linkUrl,
      refreshCatalog,
    ],
  );

  if (query.status !== "success") {
    return (
      <section aria-labelledby="platforms-title" data-testid="platforms-section">
        <h2 id="platforms-title">Платформы проекта</h2>
        {query.status === "pending" ? (
          <p role="status" aria-busy="true" data-testid="platforms-loading">
            Загружаем каталог платформ…
          </p>
        ) : (
          <div role="status" data-testid="platforms-error">
            <p>Каталог платформ недоступен.</p>
            <button type="button" onClick={refreshCatalog}>
              Повторить запрос
            </button>
          </div>
        )}
      </section>
    );
  }
  return <PlatformsSectionBody {...sectionProps} />;
}
