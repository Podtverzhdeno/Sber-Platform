import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { safeExternalUrl } from "./client";
import { PlatformsSection, PlatformsSectionBody } from "./platforms-section";
import type { PlatformSyncPanel, PlatformsSectionProps } from "./statuses";
import type {
  ConnectChallengeView,
  ConnectionCardView,
  PlatformCatalogResponse,
  SyncItemView,
  TrajectoryCheckpointOption,
} from "./types";

const WORKSPACE_GIGACODE = ["repo:read", "repo:assistant", "repo:review"];

function card(
  providerKey: string,
  status: ConnectionCardView["status"] | "absent",
): PlatformCatalogResponse["items"][number] {
  return {
    provider_key: providerKey,
    title: providerKey === "gitverse" ? "GitVerse" : "GigaCode",
    purpose: "Каталог платформ проекта (openspec 22.20).",
    required_permissions:
      providerKey === "gitverse"
        ? ["repo:read", "repo:commit:read"]
        : WORKSPACE_GIGACODE,
    repository_label: "Репозиторий участник/проект",
    connection:
      status === "absent"
        ? null
        : {
            id: `conn-${providerKey}`,
            provider_key: providerKey,
            workspace_ref: "impulse-demo/navigator",
            scopes:
              providerKey === "gitverse"
                ? ["repo:read", "repo:commit:read"]
                : WORKSPACE_GIGACODE,
            status,
            last_sync_at: "2026-10-19T09:00:00+00:00",
            last_error:
              status === "error"
                ? "Платформа временно недоступна. Повторите позже."
                : null,
          },
  };
}

const challenge: ConnectChallengeView = {
  provider_key: "gitverse",
  authorization_url:
    "https://gitverse.ru/oauth/authorize?state=oauth-state-1&scopes=repo%3Aread",
  state: "oauth-state-1",
  expires_at: "2026-10-19T12:10:00+00:00",
};

const SYNC_ITEM_BASE: SyncItemView = {
  id: "0f0e0d0c-b0a9-4c8d-9e0f-1234567890ab",
  connection_id: "conn-gitverse",
  provider_key: "gitverse",
  kind: "commit",
  status: "imported",
  external_id: "9f8c3a2b1d4e",
  title_label: "Навигатор: первый коммит",
  source_url:
    "https://gitverse.ru/impulse-demo/navigator/commit/9f8c3a2b1d4e",
  occurred_at: "2026-10-19T09:00:00+00:00",
  imported_at: "2026-10-19T12:00:00+00:00",
  last_synced_at: "2026-10-19T12:00:00+00:00",
  bound_checkpoint_key: null,
  verification_status: "not_bound",
};

const CHECKPOINT_OPTIONS: TrajectoryCheckpointOption[] = [
  {
    key: "checkpoint:python-base",
    title: "Первый checkpoint Python",
    state_label: "Текущий шаг",
  },
];

function syncItem(
  overrides: Partial<SyncItemView> = {},
): SyncItemView {
  return { ...SYNC_ITEM_BASE, ...overrides };
}

function syncPanelFixture(
  overrides: Partial<PlatformSyncPanel> = {},
): PlatformSyncPanel {
  return {
    connectionId: "conn-gitverse",
    connectionTitle: "GitVerse",
    pending: false,
    refreshing: false,
    bindPending: false,
    error: null,
    bindError: null,
    items: [syncItem()],
    checkpoints: CHECKPOINT_OPTIONS,
    checkpointsPending: false,
    ...overrides,
  };
}

function baseProps(
  items: PlatformCatalogResponse["items"],
  overrides: Partial<PlatformsSectionProps> = {},
): PlatformsSectionProps {
  return {
    data: { items },
    challenge: null,
    connecting: false,
    revokingConnectionId: null,
    completing: false,
    openingLinkConnectionId: null,
    linkUrl: null,
    syncPanel: null,
    onConnect: () => undefined,
    onCancelChallenge: () => undefined,
    onComplete: () => undefined,
    onReconnect: () => undefined,
    onRevoke: () => undefined,
    onOpenDeepLink: () => undefined,
    onOpenSync: () => undefined,
    onCloseSync: () => undefined,
    onRefreshSync: () => undefined,
    onBindSync: () => undefined,
    onRetry: () => undefined,
    ...overrides,
  };
}

function renderSection(projectId: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <PlatformsSection projectId={projectId} />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("platforms section presenter", () => {
  it("renders provider cards with honest statuses and zero credentials", () => {
    render(<PlatformsSectionBody {...baseProps([card("gitverse", "connected")])} />);
    expect(screen.getByTestId("platform-status-gitverse").textContent).toBe(
      "Подключено",
    );
    expect(screen.getByText(/impulse-demo\/navigator/)).toBeInTheDocument();
    expect(screen.getByText("repo:commit:read")).toBeInTheDocument();
    const html = screen.getByTestId("platforms-section").innerHTML;
    expect(html).not.toMatch(/access_token|refresh_token|Bearer /);
  });

  it("shows error copy with reconnect action for failed connections", () => {
    render(
      <PlatformsSectionBody {...baseProps([card("gigacode", "error")])} />,
    );
    expect(screen.getByTestId("platform-status-gigacode").textContent).toBe(
      "Ошибка подключения",
    );
    expect(screen.getByTestId("platform-error-gigacode").textContent).toBe(
      "Платформа временно недоступна. Повторите позже.",
    );
    expect(
      screen.getByTestId("platform-reconnect-gigacode"),
    ).toBeInTheDocument();
  });

  it("sends connect with workspace and selected scopes", () => {
    const onConnect = vi.fn();
    render(
      <PlatformsSectionBody
        {...baseProps([card("gitverse", "absent")], { onConnect })}
      />,
    );
    fireEvent.click(screen.getByTestId("platform-connect-gitverse"));
    fireEvent.change(screen.getByTestId("platform-workspace-input"), {
      target: { value: "impulse-demo/navigator" },
    });
    fireEvent.click(screen.getByTestId("platform-scope-repo:commit:read"));
    fireEvent.click(screen.getByTestId("platform-connect-submit"));
    expect(onConnect).toHaveBeenCalledWith("gitverse", "impulse-demo/navigator", [
      "repo:read",
    ]);
  });

  it("shows safe authorization link, then completes with state and code", () => {
    const onComplete = vi.fn();
    render(
      <PlatformsSectionBody
        {...baseProps([card("gitverse", "connecting")], {
          challenge,
          onComplete,
        })}
      />,
    );
    const link = screen.getByTestId("platform-challenge-link");
    expect(link.getAttribute("href")).toContain("https://gitverse.ru/oauth/authorize");
    expect(link.getAttribute("rel")).toContain("noreferrer");
    fireEvent.change(screen.getByTestId("platform-callback-code"), {
      target: { value: "oauth-code-1" },
    });
    fireEvent.click(screen.getByTestId("platform-complete"));
    expect(onComplete).toHaveBeenCalledWith(
      "gitverse",
      "oauth-state-1",
      "oauth-code-1",
    );
  });

  it("refuses to open unsafe challenge URLs", () => {
    render(
      <PlatformsSectionBody
        {...baseProps([card("gitverse", "connecting")], {
          challenge: {
            ...challenge,
            authorization_url:
              "http://evil.example/oauth/authorize?state=oauth-state-1",
          },
        })}
      />,
    );
    expect(
      screen.getByTestId("platform-challenge-link-invalid"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("platform-challenge-link"),
    ).not.toBeInTheDocument();
  });

  it("offers revoke and deep link fetch for connected platforms", () => {
    const onRevoke = vi.fn();
    const onOpenDeepLink = vi.fn();
    render(
      <PlatformsSectionBody
        {...baseProps([card("gitverse", "connected")], {
          onRevoke,
          onOpenDeepLink,
        })}
      />,
    );
    fireEvent.click(screen.getByTestId("platform-revoke-gitverse"));
    expect(onRevoke).toHaveBeenCalledWith("conn-gitverse");
    fireEvent.click(screen.getByTestId("platform-open-gitverse"));
    expect(onOpenDeepLink).toHaveBeenCalledWith("conn-gitverse");
  });

  it("renders sync data with honest statuses and keeps credentials out", () => {
    render(
      <PlatformsSectionBody
        {...baseProps([card("gitverse", "connected")], {
          syncPanel: syncPanelFixture(),
        })}
      />,
    );
    expect(
      screen.getByTestId("platform-sync-panel-gitverse"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("platform-sync-item-9f8c3a2b1d4e"),
    ).toBeInTheDocument();
    expect(screen.getByText("Импортировано, не подтверждено")).toBeInTheDocument();
    expect(screen.getByText("Коммит")).toBeInTheDocument();
    const honesty = screen.getByTestId("platform-sync-honesty-gitverse");
    expect(honesty.textContent).toContain("не закрывают checkpoint");
    expect(honesty.textContent).toContain("Skill Passport");
    // Binding is always available in fixture, but never auto: needs a choice.
    expect(screen.getByTestId("platform-sync-bind-9f8c3a2b1d4e")).toHaveProperty(
      "disabled",
      true,
    );
    const html = screen.getByTestId("platforms-section").innerHTML;
    expect(html).not.toMatch(/access_token|refresh_token|Bearer /);
  });

  it("binds exactly to the explicitly chosen actionable checkpoint", () => {
    const onBindSync = vi.fn();
    render(
      <PlatformsSectionBody
        {...baseProps([card("gitverse", "connected")], {
          syncPanel: syncPanelFixture(),
          onBindSync,
        })}
      />,
    );
    fireEvent.change(screen.getByTestId("platform-sync-select-9f8c3a2b1d4e"), {
      target: { value: "checkpoint:python-base" },
    });
    fireEvent.click(screen.getByTestId("platform-sync-bind-9f8c3a2b1d4e"));
    expect(onBindSync).toHaveBeenCalledWith(
      SYNC_ITEM_BASE.id,
      "checkpoint:python-base",
    );
  });

  it("shows bound state honestly: no confirmation claims until verified", () => {
    render(
      <PlatformsSectionBody
        {...baseProps([card("gitverse", "connected")], {
          syncPanel: syncPanelFixture({
            items: [
              syncItem({
                bound_checkpoint_key: "checkpoint:python-base",
                verification_status: "awaiting_human_verification",
              }),
            ],
          }),
        })}
      />,
    );
    const bound = screen.getByTestId("platform-sync-bound-9f8c3a2b1d4e");
    expect(bound.textContent).toContain("checkpoint:python-base");
    expect(bound.textContent).toContain("подтверждения ещё нет");
    expect(
      screen.queryByTestId("platform-sync-select-9f8c3a2b1d4e"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("platform-sync-bind-9f8c3a2b1d4e"),
    ).not.toBeInTheDocument();
  });

  it("stays honest when no checkpoints are available for binding", () => {
    render(
      <PlatformsSectionBody
        {...baseProps([card("gitverse", "connected")], {
          syncPanel: syncPanelFixture({
            checkpoints: [],
            checkpointsPending: true,
          }),
        })}
      />,
    );
    expect(
      screen.getByTestId("platform-sync-checkpoints-pending-9f8c3a2b1d4e"),
    ).toBeInTheDocument();
  });

  it("reflects loading, error and refresh states without hiding passed data", () => {
    render(
      <PlatformsSectionBody
        {...baseProps([card("gitverse", "connected")], {
          syncPanel: syncPanelFixture({
            items: [],
            error: "Платформа временно недоступна. Повторите позже.",
            refreshing: true,
          }),
        })}
      />,
    );
    expect(
      screen.getByTestId("platform-sync-empty-gitverse"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("platform-sync-error-gitverse"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("platform-sync-refresh-gitverse")).toHaveProperty(
      "disabled",
      true,
    );
  });
});

describe("safeExternalUrl", () => {
  it("accepts plain https workspace links and blocks token-bearing ones", () => {
    expect(safeExternalUrl("https://gitverse.ru/impulse-demo/navigator")).toBe(
      "https://gitverse.ru/impulse-demo/navigator",
    );
    expect(safeExternalUrl("http://gitverse.ru/impulse-demo/navigator")).toBeNull();
    expect(safeExternalUrl("https://gitverse.ru/w?access_token=leak")).toBeNull();
    expect(safeExternalUrl("https://user:secret@gitverse.ru/w")).toBeNull();
  });
});

describe("PlatformsSection container", () => {
  it("loads the catalog from the real endpoint contract", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            items: [card("gitverse", "connected"), card("gigacode", "absent")],
          }),
          { status: 200 },
        ),
      );
    renderSection("11111111-1111-4111-8111-111111111111");
    await waitFor(() => {
      expect(screen.getByTestId("platform-status-gitverse")).toBeInTheDocument();
    });
    expect(screen.getByTestId("platform-status-gigacode").textContent).toBe(
      "Не подключено",
    );
    const firstInput: unknown = fetchMock.mock.calls[0]?.[0];
    expect(typeof firstInput === "string").toBe(true);
    expect(firstInput).toBe(
      "/api/v1/projects/11111111-1111-4111-8111-111111111111/platforms",
    );
  });

  it("shows an honest unavailable state when the catalog endpoint fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          code: "PLATFORM_SERVICE_UNAVAILABLE",
          message: "Каталог платформ недоступен.",
          retryable: false,
        }),
        { status: 503 },
      ),
    );
    renderSection("22222222-2222-4222-8222-222222222222");
    await waitFor(() => {
      expect(screen.getByTestId("platforms-error")).toBeInTheDocument();
    });
    expect(screen.getByText("Повторить запрос")).toBeInTheDocument();
  });

  it("sends CSRF header, OAuth state and idempotency key through the lifecycle", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const url = input instanceof Request ? input.url : String(input);
      const method = init?.method ?? "GET";
      if (method === "GET" && url.includes("/platforms")) {
        return Promise.resolve(
          new Response(JSON.stringify({ items: [card("gitverse", "absent")] }), {
            status: 200,
          }),
        );
      }
      if (method === "POST" && url.endsWith("/connect")) {
        const headers = new Headers(init?.headers);
        expect(headers.get("Content-Type")).toBe("application/json");
        return Promise.resolve(
          new Response(JSON.stringify(challenge), { status: 201 }),
        );
      }
      if (method === "POST" && url.endsWith("/callback")) {
        const rawBody: unknown = init?.body;
        expect(typeof rawBody === "string").toBe(true);
        const body = JSON.parse(
          typeof rawBody === "string" ? rawBody : "{}",
        ) as {
          idempotency_key: string;
          state: string;
          code: string;
        };
        expect(body.idempotency_key).toMatch(/^connect-/);
        expect(body.state).toBe("oauth-state-1");
        expect(body.code).toBe("oauth-code-1");
        const csrf = new Headers(init?.headers).get("X-CSRF-Token");
        expect(csrf).not.toBeNull();
        return Promise.resolve(
          new Response(JSON.stringify(card("gitverse", "connected").connection), {
            status: 200,
          }),
        );
      }
      return Promise.resolve(new Response(null, { status: 204 }));
    });
    renderSection("33333333-3333-4333-8333-333333333333");
    await waitFor(() => {
      expect(screen.getByTestId("platform-connect-gitverse")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("platform-connect-gitverse"));
    fireEvent.change(screen.getByTestId("platform-workspace-input"), {
      target: { value: "impulse-demo/navigator" },
    });
    fireEvent.click(screen.getByTestId("platform-connect-submit"));
    await waitFor(() => {
      expect(screen.getByTestId("platform-challenge-link")).toBeInTheDocument();
    });
    fireEvent.change(screen.getByTestId("platform-callback-code"), {
      target: { value: "oauth-code-1" },
    });
    fireEvent.click(screen.getByTestId("platform-complete"));
    await waitFor(() => {
      expect(screen.queryByTestId("platform-challenge")).not.toBeInTheDocument();
    });
  });

  it("loads sync data, refreshes it with CSRF and binds to the chosen checkpoint", async () => {
    const calls: { url: string; method: string; csrf: string | null }[] = [];
    let bound = false;
    const boundItem = syncItem({
      bound_checkpoint_key: "checkpoint:python-base",
      verification_status: "awaiting_human_verification",
    });
    vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const url = input instanceof Request ? input.url : String(input);
      const method = init?.method ?? "GET";
      const call = {
        url,
        method,
        csrf: init?.headers
          ? new Headers(init.headers).get("X-CSRF-Token")
          : null,
      };
      calls.push(call);
      if (method === "GET" && url.endsWith("/platforms")) {
        return Promise.resolve(
          new Response(JSON.stringify({ items: [card("gitverse", "connected")] }), {
            status: 200,
          }),
        );
      }
      if (method === "GET" && url.includes("/me/trajectory-map")) {
        return Promise.resolve(
          new Response(
            JSON.stringify([
              {
                checkpoints: [
                  {
                    key: "checkpoint:python-base",
                    title: "Первый checkpoint Python",
                    state_label: "Текущий шаг",
                    actionable: true,
                  },
                  {
                    key: "checkpoint:sealed",
                    title: "Уже закрытый checkpoint",
                    state_label: "Завершён",
                    actionable: false,
                  },
                ],
              },
            ]),
            { status: 200 },
          ),
        );
      }
      if (method === "GET" && url.endsWith("/sync-items")) {
        return Promise.resolve(
          new Response(JSON.stringify({ items: [bound ? boundItem : syncItem()] }), {
            status: 200,
          }),
        );
      }
      if (method === "POST" && url.endsWith("/sync-items/refresh")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              connection_id: "conn-gitverse",
              checked_at: "2026-10-19T13:00:00+00:00",
              imported_new: 0,
              refreshed_existing: 1,
              skipped_invalid: 0,
              items: [bound ? boundItem : syncItem()],
            }),
            { status: 200 },
          ),
        );
      }
      if (method === "POST" && url.includes("/bind-checkpoint")) {
        const rawBody: unknown = init?.body;
        expect(JSON.parse(typeof rawBody === "string" ? rawBody : "{}")).toEqual(
          { checkpoint_key: "checkpoint:python-base" },
        );
        bound = true;
        return Promise.resolve(
          new Response(JSON.stringify(boundItem), { status: 200 }),
        );
      }
      return Promise.resolve(new Response(null, { status: 204 }));
    });
    renderSection("44444444-4444-4444-8444-444444444444");
    await waitFor(() => {
      expect(screen.getByTestId("platform-sync-open-gitverse")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("platform-sync-open-gitverse"));
    await waitFor(() => {
      expect(screen.getByTestId("platform-sync-item-9f8c3a2b1d4e")).toBeInTheDocument();
    });
    // Only actor-owned actionable checkpoints are offered — no sealed ones.
    expect(screen.getAllByText(/Первый checkpoint Python/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Уже закрытый checkpoint/)).not.toBeInTheDocument();
    // Refresh passes an empty JSON POST with the CSRF header, no body payload.
    fireEvent.click(screen.getByTestId("platform-sync-refresh-gitverse"));
    await waitFor(() => {
      const refresh = calls.find(
        (call) => call.method === "POST" && call.url.endsWith("/sync-items/refresh"),
      );
      expect(refresh).toBeDefined();
      expect(refresh?.csrf).not.toBeNull();
    });
    // Bind posts the explicit checkpoint key with CSRF, then honest bound copy.
    fireEvent.change(screen.getByTestId("platform-sync-select-9f8c3a2b1d4e"), {
      target: { value: "checkpoint:python-base" },
    });
    fireEvent.click(screen.getByTestId("platform-sync-bind-9f8c3a2b1d4e"));
    await waitFor(() => {
      expect(
        screen.getByTestId("platform-sync-bound-9f8c3a2b1d4e"),
      ).toBeInTheDocument();
    });
    expect(screen.getByText("Импортировано, не подтверждено")).toBeInTheDocument();
    const bind = calls.find((call) => call.url.includes("/bind-checkpoint"));
    expect(bind?.method).toBe("POST");
    expect(bind?.csrf).not.toBeNull();
    const html = screen.getByTestId("platforms-section").innerHTML;
    expect(html).not.toMatch(/access_token|refresh_token|Bearer /);
  });
});
