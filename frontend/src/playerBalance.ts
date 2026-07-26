import { useSyncExternalStore } from "react";

let balance: number | null = null;
let latestResponseSequence = 0;
const listeners = new Set<() => void>();

function coinValue(response: unknown): number | null {
  if (!response || typeof response !== "object") return null;
  const record = response as Record<string, unknown>;
  const nested = record.player && typeof record.player === "object"
    ? (record.player as Record<string, unknown>).coins
    : undefined;
  const candidate = record.new_coins ?? record.player_coins ?? record.coins ?? nested;
  return typeof candidate === "number" && Number.isFinite(candidate)
    ? Math.max(0, Math.floor(candidate))
    : null;
}

export function applyPlayerBalanceResponse(
  response: unknown,
  sequence: number,
  authoritativeMutation = false,
): void {
  const next = coinValue(response);
  if (next === null || (!authoritativeMutation && sequence < latestResponseSequence)) return;
  latestResponseSequence = Math.max(sequence, latestResponseSequence);
  if (next === balance) return;
  balance = next;
  listeners.forEach((listener) => listener());
}

export function clearPlayerBalance(): void {
  balance = null;
  latestResponseSequence = 0;
  listeners.forEach((listener) => listener());
}

export function usePlayerBalance(fallback = 0): number {
  const current = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => balance,
    () => balance,
  );
  return current ?? fallback;
}
