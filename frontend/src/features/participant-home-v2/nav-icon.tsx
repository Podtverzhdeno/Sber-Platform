/** Exact 24×24 stroke paths from the approved standalone Impulse app.js.
 * Scoped to the participant home, while other roles retain their icons. */
const NAV_PATHS = {
  "Главная": "house",
  "Мой путь": "route",
  "Моя траектория": "route",
  Bootcamp: "layers",
  "Задачи": "clipboard-check",
  "Мои проекты": "briefcase",
  "Сообщения": "message",
  "Портфолио": "file-text",
  "Достижения": "trophy",
  "Рейтинг": "trophy",
  "Аналитика": "chart",
  "AI Buddy": "sparkles",
  "AI-Buddy": "sparkles",
  "AI-помощник": "sparkles",
  "Настройки": "settings",
} as const;

export function HomeNavigationIcon({ section }: { section: string }) {
  const icon = NAV_PATHS[section as keyof typeof NAV_PATHS] ?? "circle";
  return (
    <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {icon === "house" && <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" />}
      {icon === "route" && <><circle cx="6" cy="19" r="2" /><path d="M9 19h6a4 4 0 0 0 0-8H9a4 4 0 0 1 0-8h8" /><circle cx="18" cy="3" r="2" /></>}
      {icon === "layers" && <><rect x="3" y="3" width="18" height="7" rx="2" /><path d="M3 14v4a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3v-4M7 10v4m10-4v4" /></>}
      {icon === "clipboard-check" && <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V2h6v2m-6 9 2 2 4-4" /></>}
      {icon === "briefcase" && <><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M2 13c5 4 15 4 20 0" /></>}
      {icon === "message" && <><path d="M20 11a8 8 0 0 1-8 8 9 9 0 0 1-4-.9L3 21l1.5-5A8 8 0 1 1 20 11Z" /><path d="m8 11 2 2 4-4" /></>}
      {icon === "file-text" && <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6M8 13h8M8 17h8" /></>}
      {icon === "trophy" && <><path d="M8 21h8m-4-5v5M7 4h10v6a5 5 0 0 1-10 0V4Z" /><path d="M7 6H3v3a4 4 0 0 0 4 4m10-7h4v3a4 4 0 0 1-4 4" /></>}
      {icon === "chart" && <><rect x="3" y="11" width="3" height="10" rx=".7" /><rect x="10" y="4" width="4" height="17" rx=".7" /><rect x="18" y="8" width="3" height="13" rx=".7" /></>}
      {icon === "sparkles" && <path d="m12 2 1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2ZM5 17l.8 2.2L8 20l-2.2.8L5 23l-.8-2.2L2 20l2.2-.8L5 17Z" />}
      {icon === "settings" && <><circle cx="12" cy="12" r="3" /><path d="M10 2h4l.7 3 2.4 1 2.6-1.5 2.4 3.3-2 2 .1 3 1.9 2-2.4 3.2-2.6-1.4-2.4 1L14 22h-4l-.7-3-2.5-1-2.5 1.4L2 16.2l2-2 .1-3-2-2 2.3-3.3L7 7l2.3-1z" /></>}
      {icon === "circle" && <circle cx="12" cy="12" r="9" />}
    </svg>
  );
}
