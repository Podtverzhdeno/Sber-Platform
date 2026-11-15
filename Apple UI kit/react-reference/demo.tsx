import { useState } from "react";
import {
  ActionDialog, ContentSurface, ControlButton, FloatingToolbar, GlassControl,
  NavigationDrawer, SearchField, SegmentedControl, StatusNotice,
} from "./components";
import "./styles.css";

/** This demo uses only synthetic local state, not any Impulse API. */
export function AppleReferenceDemo() {
  const [mode, setMode] = useState<"list" | "cards">("list");
  const [query, setQuery] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  return (
    <div className="aui-kit" data-theme={theme} style={{ padding: 24, minHeight: "100vh" }}>
      <FloatingToolbar label="Учебная навигация">
        <ControlButton aria-label="Открыть навигацию" onClick={() => setDrawerOpen(true)}>☰</ControlButton>
        <strong>IMPULSE · UI reference</strong>
        <ControlButton onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>Тема</ControlButton>
      </FloatingToolbar>
      <main style={{ display: "grid", gap: 16, marginTop: 24 }}>
        <ContentSurface aria-label="Пример каталога">
          <h1>Компоненты и состояния</h1>
          <SearchField label="Поиск примеров" value={query} onChange={setQuery} />
          <SegmentedControl
            label="Режим просмотра"
            options={[{ label: "Список", value: "list" }, { label: "Карточки", value: "cards" }]}
            value={mode}
            onChange={setMode}
          />
          <p>Поиск: {query || "не задан"} · Режим: {mode}</p>
          <ControlButton tone="primary" onClick={() => setDialogOpen(true)}>Открыть диалог</ControlButton>
        </ContentSurface>
        <GlassControl variant="regular" style={{ padding: 20, borderRadius: 20 }}>
          Навигация и управление: web-приближение Glass.
        </GlassControl>
        <StatusNotice kind="empty" title="Пустой пример" detail="Здесь нет реальных данных." />
      </main>
      <NavigationDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <p>Контент демонстрационной навигации. Закройте окно по Escape.</p>
      </NavigationDrawer>
      <ActionDialog open={dialogOpen} title="Подтверждение" onClose={() => setDialogOpen(false)}>
        <p>Демо не вызывает API и не отправляет реальные действия.</p>
        <ControlButton onClick={() => setDialogOpen(false)}>Закрыть</ControlButton>
      </ActionDialog>
    </div>
  );
}
