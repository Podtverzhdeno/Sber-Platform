/** Single-purpose state machine for three owner-approved visual modes. */
export type ImpulseVisualMode = "light" | "blue" | "midnight";

const modes: readonly ImpulseVisualMode[] = ["light", "blue", "midnight"];

export function nextImpulseVisualMode(current: ImpulseVisualMode): ImpulseVisualMode {
  return modes[(modes.indexOf(current) + 1) % modes.length] ?? "light";
}
