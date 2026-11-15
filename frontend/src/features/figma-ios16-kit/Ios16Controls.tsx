import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import "./ios16-controls.scss";

/**
 * Figma iOS 16 Community UI Kit:
 * 839:9700 light filled, 839:9707 light tinted, 839:9728 dark filled.
 * Native button semantics replace the static frame in the design export.
 */
export type Ios16ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "filled" | "tinted";
  icon?: ReactNode;
};

export function Ios16Button({
  children,
  className = "",
  variant = "filled",
  icon,
  type = "button",
  ...props
}: Ios16ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={`ios16-kit-button ios16-kit-button--${variant} ${className}`.trim()}
      data-figma-light-node={variant === "filled" ? "839:9700" : "839:9707"}
      data-figma-dark-node={variant === "filled" ? "839:9728" : undefined}
    >
      {icon && <span className="ios16-kit-button__icon" aria-hidden="true">{icon}</span>}
      <span className="ios16-kit-button__label">{children}</span>
    </button>
  );
}

/**
 * Figma TextField 211:5737 (light default), 211:5752 (light active).
 * This is a real input: keyboard, form state, validation and accessible name
 * remain native rather than reproducing the design as inert markup.
 * The reference's optional clear SVG is not emitted when no asset is supplied.
 */
export type Ios16TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  label: string;
};

export function Ios16TextField({
  label,
  className = "",
  placeholder,
  type = "text",
  ...props
}: Ios16TextFieldProps) {
  return (
    <span
      className={`ios16-kit-field ${className}`.trim()}
      data-figma-light-node="211:5737"
      data-figma-focus-node="211:5752"
    >
      <span className="ios16-kit-field__content">
        <input
          {...props}
          type={type}
          aria-label={props["aria-label"] ?? label}
          placeholder={placeholder ?? label}
        />
      </span>
    </span>
  );
}
