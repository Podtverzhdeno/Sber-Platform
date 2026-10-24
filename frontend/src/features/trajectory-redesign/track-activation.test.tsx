import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TrajectoryActivation } from "./track-activation";
import type { RoleCardView } from "../trajectory-v2/client";

const role: RoleCardView = {
  track_key: "product",
  title: "Продакт-менеджер",
  state: "unselected",
  attempt_number: null,
  completed_milestones: 0,
  total_milestones: 3,
};

const tracks = [
  { key: "python", title: "Python-разработчик", status: "active", completed_milestones: ["intro"] },
  { key: "product", title: "Продакт-менеджер", status: null, completed_milestones: [] },
];

function setup(activeCount: number, maxActive: number) {
  const posts: { method: string; body: string }[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation((_input, init) => {
    if (init?.method === "POST") {
      posts.push({ method: init.method, body: typeof init.body === "string" ? init.body : "" });
      return Promise.resolve(new Response(JSON.stringify({ active_count: 1, max_active: maxActive, tracks }), { status: 200 }));
    }
    return Promise.resolve(new Response(JSON.stringify({ active_count: activeCount, max_active: maxActive, tracks }), { status: 200 }));
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><TrajectoryActivation role={role} allowed /></QueryClientProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Начать осваивать" }));
  return posts;
}

afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
});

describe("trajectory role activation", () => {
  it("requires explicit confirmation, no freeze, and a server POST while a slot is free", async () => {
    const posts = setup(1, 2);
    const dialog = await screen.findByRole("dialog", { name: "Выбрать направление: Продакт-менеджер" });
    expect(posts).toHaveLength(0);
    fireEvent.click(await within(dialog).findByRole("button", { name: "Подтвердить выбор" }));
    await waitFor(() => { expect(posts).toHaveLength(1); });
    expect(JSON.parse(posts[0]?.body ?? "")).toEqual({ track_key: "product" });
  });

  it("never freezes the other role without explicitly choosing it", async () => {
    const posts = setup(1, 1);
    const dialog = await screen.findByRole("dialog", { name: "Выбрать направление: Продакт-менеджер" });
    const freeze = await within(dialog).findByRole("button", { name: /Поставить «Python-разработчик» на паузу/ });
    expect(posts).toHaveLength(0);
    fireEvent.click(freeze);
    await waitFor(() => { expect(posts).toHaveLength(1); });
    expect(JSON.parse(posts[0]?.body ?? "")).toEqual({ track_key: "product", freeze_track_key: "python" });
  });

  it("does not enable role selection when snapshot permissions deny it", () => {
    render(<QueryClientProvider client={new QueryClient()}>
      <TrajectoryActivation role={role} allowed={false} />
    </QueryClientProvider>);
    expect(screen.queryByRole("button", { name: "Начать осваивать" })).toBeNull();
    expect(screen.getByText("Выбор направлений недоступен для текущих прав")).toBeInTheDocument();
  });
});
