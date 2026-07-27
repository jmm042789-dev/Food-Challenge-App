import type { BiteMechanic } from "../../api";

export type ActionControlKind = "tap" | "rapid" | "hold_release" | "swipe";

export function resolveActionControlKind(mechanic?: BiteMechanic | string): ActionControlKind {
  if (mechanic === "rapid" || mechanic === "hold_release" || mechanic === "swipe") return mechanic;
  return "tap";
}
