import { Sparkles } from "lucide-react";

/** Icons from Impulse_Tasks_UI (1)/src/icons/ui/icons.tsx, adapted to live skills. */
export function SkillMark({ title }: { title: string }) {
  const name = title.trim().toLocaleLowerCase("ru-RU");
  const kind = /(^nlp$|обработка естественн|natural language|языков)/i.test(name) ? "nlp"
    : /машинн|machine learning|(^ml$)|нейросет|llm/i.test(name) ? "brain"
    : /анализ данных|data analys|аналитик|sql|метрик/i.test(name) ? "data"
    : /продукт|product|гипотез|ux/i.test(name) ? "idea"
    : "other";

  if (kind === "other") return <Sparkles size={17} className="catalog-v2-skill-mark" aria-hidden="true" />;
  return (
    <svg className="catalog-v2-skill-mark" width="17" height="17" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" focusable="false" aria-hidden="true">
      {kind === "brain" ? <>
        <path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 4 3.5 3.5 0 0 0 2 5 3 3 0 0 0 4 3V5a1 1 0 0 0-1-1zM15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 4 3.5 3.5 0 0 1-2 5 3 3 0 0 1-4 3V5a1 1 0 0 1 1-1z" />
      </> : null}
      {kind === "nlp" ? <>
        <circle cx="10" cy="8" r="3" /><path d="M4 19c0-3 2.5-5 6-5M14 15h6v4h-3l-3 2z" />
      </> : null}
      {kind === "data" ? <path d="M5 20v-6M12 20V8M19 20v-9" strokeWidth={3.2} /> : null}
      {kind === "idea" ? <>
        <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" />
      </> : null}
    </svg>
  );
}
