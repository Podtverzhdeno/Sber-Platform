import { useEffect, useId, useRef } from "react";
import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  KeyboardEvent,
  ReactNode,
} from "react";

/**
 * Independent web interpretations of Apple HIG semantics.
 * NOT an Apple library, licensed Apple asset or native Liquid Glass renderer.
 */
export type GlassVariant = "regular" | "clear";
export type ButtonTone = "primary" | "secondary" | "destructive";
export type NoticeKind = "loading" | "empty" | "error" | "restricted" | "stale" | "offline";

export function GlassControl({
  variant = "regular",
  className = "",
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement> & {
  variant?: GlassVariant;
  children: ReactNode;
}) {
  return <div {...rest} className={["aui-glass", "aui-glass--" + variant, className].filter(Boolean).join(" ")}>{children}</div>;
}

export function ContentSurface({
  className = "",
  children,
  ...rest
}: HTMLAttributes<HTMLElement> & { children: ReactNode }) {
  return <section {...rest} className={["aui-content", className].filter(Boolean).join(" ")}>{children}</section>;
}

export function ControlButton({
  tone = "secondary",
  busy = false,
  children,
  className = "",
  disabled,
  type = "button",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: ButtonTone;
  busy?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      {...rest}
      type={type}
      disabled={Boolean(disabled || busy)}
      aria-busy={busy || undefined}
      className={["aui-button", "aui-button--" + tone, className].filter(Boolean).join(" ")}
    >
      {children}
      {busy && <span className="aui-busy-label"> · Загрузка</span>}
    </button>
  );
}

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
}
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  const refs = useRef(new Map<T, HTMLButtonElement>());
  const selected = options.find((option) => option.value === value && !option.disabled);
  const fallback = options.find((option) => !option.disabled);
  const tabStop = selected?.value ?? fallback?.value;
  function advance(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return;
    const allowed = options.filter((option) => !option.disabled);
    if (!allowed.length) return;
    event.preventDefault();
    const current = allowed.findIndex((option) => option.value === options[index]?.value);
    const forward = event.key === "ArrowRight";
    // A controlled value can be temporarily absent from the options (async filters).
    // In that case choose the first/last enabled option rather than a negative index.
    const nextIndex = event.key === "Home" ? 0
      : event.key === "End" ? allowed.length - 1
      : current < 0 ? (forward ? 0 : allowed.length - 1)
      : (current + (forward ? 1 : allowed.length - 1)) % allowed.length;
    const target = allowed[nextIndex];
    if (!target) return;
    onChange(target.value);
    refs.current.get(target.value)?.focus();
  }
  return (
    <div className="aui-segmented" role="group" aria-label={label}>
      {options.map((option, index) => (
        <button
          key={option.value}
          type="button"
          className="aui-segmented__item"
          aria-pressed={option.value === value}
          disabled={option.disabled}
          tabIndex={option.value === tabStop ? 0 : -1}
          ref={(node) => {
            if (node) refs.current.set(option.value, node);
            else refs.current.delete(option.value);
          }}
          onKeyDown={(event) => advance(event, index)}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function SearchField({
  label,
  value,
  onChange,
  placeholder,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const clear = () => {
    // Focus the field before removing the clear button. Otherwise keyboard focus
    // can be stranded on an element which React immediately removes.
    inputRef.current?.focus();
    onChange("");
  };
  return (
    <div className="aui-search">
      <label htmlFor={id}>{label}</label>
      <div className="aui-search__line">
        <input
          ref={inputRef}
          id={id}
          type="search"
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(event) => onChange(event.currentTarget.value)}
        />
        {value.length > 0 && !disabled && (
          <button type="button" onClick={clear} aria-label={"Очистить: " + label}>
            ×
          </button>
        )}
      </div>
    </div>
  );
}

export function FloatingToolbar({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return <nav className="aui-toolbar aui-glass aui-glass--regular" aria-label={label}>{children}</nav>;
}

export function StatusNotice({
  kind,
  title,
  detail,
  actionLabel,
  onAction,
}: {
  kind: NoticeKind;
  title: string;
  detail: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const urgent = kind === "error" || kind === "restricted";
  return (
    <section
      className={"aui-notice aui-notice--" + kind}
      role={urgent ? "alert" : "status"}
      aria-busy={kind === "loading" || undefined}
    >
      <h2>{title}</h2>
      <p>{detail}</p>
      {actionLabel && onAction && <ControlButton onClick={onAction}>{actionLabel}</ControlButton>}
    </section>
  );
}

function Overlay({
  open, onClose, title, children, kind,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  kind: "dialog" | "drawer";
}) {
  const element = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const id = useId();
  useEffect(() => {
    const dialog = element.current;
    if (!dialog) return;
    if (open) {
      trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      if (!dialog.open) dialog.showModal();
      const closeButton = dialog.querySelector<HTMLButtonElement>("[data-aui-close]");
      closeButton?.focus();
    } else {
      if (dialog.open) dialog.close();
      if (trigger.current?.isConnected) trigger.current.focus();
    }
    return () => {
      if (dialog.open) dialog.close();
      if (trigger.current?.isConnected) trigger.current.focus();
    };
  }, [open]);
  return (
    <dialog
      ref={element}
      className={"aui-overlay aui-overlay--" + kind}
      aria-labelledby={id}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
    >
      <header>
        <h2 id={id}>{title}</h2>
        <ControlButton data-aui-close aria-label="Закрыть" onClick={onClose}>×</ControlButton>
      </header>
      <div className="aui-overlay__body">{children}</div>
    </dialog>
  );
}

export function ActionDialog({
  open, title, children, onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return <Overlay kind="dialog" open={open} title={title} onClose={onClose}>{children}</Overlay>;
}

export function NavigationDrawer({
  open, title = "Навигация", children, onClose,
}: {
  open: boolean;
  title?: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return <Overlay kind="drawer" open={open} title={title} onClose={onClose}>{children}</Overlay>;
}
