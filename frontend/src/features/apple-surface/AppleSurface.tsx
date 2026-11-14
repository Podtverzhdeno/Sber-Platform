import { useId, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import "./apple-surface.scss";

export type AppleRowTone = "neutral" | "success" | "warning" | "danger";

type ApplePageProps = {
  title: string;
  context?: string;
  action?: ReactNode;
  children: ReactNode;
};

/** Scoped workspace frame. Does not alter global theme, routes or business logic. */
export function ApplePage({ title, context, action, children }: ApplePageProps) {
  return (
    <div className="apple-surface" data-testid="apple-surface">
      <header className="apple-surface__page-header">
        <div className="apple-surface__title-group">
          <h1 className="apple-surface__page-title">{title}</h1>
          {context && <p className="apple-surface__page-context">{context}</p>}
        </div>
        {action && <div className="apple-surface__page-actions">{action}</div>}
      </header>
      {children}
    </div>
  );
}

type AppleSectionProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
};

/** Unboxed section with aligned title and optional contextual action. */
export function AppleSection({ title, description, action, children }: AppleSectionProps) {
  const id = useId();
  return (
    <section className="apple-surface__section" aria-labelledby={id}>
      <header className="apple-surface__section-header">
        <div>
          <h2 id={id}>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {action && <div className="apple-surface__section-action">{action}</div>}
      </header>
      {children}
    </section>
  );
}

type AppleDisclosureProps = {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: ReactNode;
  testId?: string;
};

/** Browser-native accessible disclosure, with no fragile custom focus management. */
export function AppleDisclosure({
  title,
  description,
  defaultOpen = false,
  children,
  testId,
}: AppleDisclosureProps) {
  return (
    <details className="apple-surface__disclosure" open={defaultOpen || undefined} data-testid={testId}>
      <summary className="apple-surface__disclosure-summary">
        <span>
          <strong>{title}</strong>
          {description && <small>{description}</small>}
        </span>
        <ChevronDown size={19} aria-hidden="true" />
      </summary>
      <div className="apple-surface__disclosure-body">{children}</div>
    </details>
  );
}

type AppleListProps = {
  label: string;
  children: ReactNode;
};

/** A real list so screen readers can announce item count and ordering. */
export function AppleList({ label, children }: AppleListProps) {
  return <ul className="apple-surface__list" aria-label={label}>{children}</ul>;
}

type AppleListRowProps = {
  title: string;
  description?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  state?: string;
  stateTone?: AppleRowTone;
  onSelect?: () => void;
  disabled?: boolean;
  disabledReason?: string;
};

/**
 * Rendering a row is never a mutation. If onSelect is present the caller
 * performs an existing authorized navigation/selection action; otherwise
 * the row is read-only. No hidden nested action buttons.
 */
export function AppleListRow({
  title,
  description,
  leading,
  trailing,
  state,
  stateTone = "neutral",
  onSelect,
  disabled = false,
  disabledReason,
}: AppleListRowProps) {
  const content = (
    <>
      {leading && <span className="apple-surface__row-leading" aria-hidden="true">{leading}</span>}
      <span className="apple-surface__row-copy">
        <strong>{title}</strong>
        {description && <small>{description}</small>}
        {disabled && disabledReason && <small className="apple-surface__row-reason">{disabledReason}</small>}
      </span>
      {state && <span className="apple-surface__row-state" data-tone={stateTone}>{state}</span>}
      {trailing && <span className="apple-surface__row-trailing">{trailing}</span>}
      {onSelect && <ChevronRight size={17} className="apple-surface__row-chevron" aria-hidden="true" />}
    </>
  );

  return (
    <li className="apple-surface__row">
      {onSelect ? (
        <button type="button" className="apple-surface__row-button" onClick={onSelect}
          disabled={disabled} title={disabled && disabledReason ? disabledReason : undefined}>
          {content}
        </button>
      ) : (
        <div className="apple-surface__row-static">{content}</div>
      )}
    </li>
  );
}
