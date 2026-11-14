import { ChevronDown, Moon, Monitor, Sun } from "lucide-react";
import type { ThemeChoice } from "../theme";
import "./theme-control.scss";

export type ThemeControlProps = {
  value: ThemeChoice;
  onChange: (next: ThemeChoice) => void;
};

/** The existing app/theme.ts remains the single source of persistence. */
export function ThemeControl({ value, onChange }: ThemeControlProps) {
  return (
    <label className="future-theme-switch" title="Оформление интерфейса">
      <span className="future-theme-switch__icon" aria-hidden="true">
        {value === "light" ? <Sun size={17} /> :
          value === "dark" ? <Moon size={17} /> : <Monitor size={17} />}
      </span>
      <span className="sr-only">Тема оформления</span>
      <select
        aria-label="Тема оформления"
        value={value}
        onChange={(event) => { onChange(event.target.value as ThemeChoice); }}
      >
        <option value="light">Светлая</option>
        <option value="dark">Тёмная</option>
        <option value="system">Как в системе</option>
      </select>
      <ChevronDown className="future-theme-switch__chevron" size={14} aria-hidden="true" />
    </label>
  );
}
