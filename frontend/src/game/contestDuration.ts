export const DEFAULT_MATCH_DURATION_SECONDS = 60;
export const MIN_MATCH_DURATION_SECONDS = 1;
export const MAX_MATCH_DURATION_SECONDS = 60 * 60;

export type ContestDurationSource = {
  duration_sec?: number | string | null;
};

function parseDurationValue(value: number | string | null | undefined): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) && Number.isInteger(value) ? value : null;
  }

  if (typeof value !== "string") return null;

  const normalized = value.trim().toLowerCase();
  if (/^\d+$/.test(normalized)) return Number(normalized);

  const match = normalized.match(/^(\d+)\s*(seconds?|secs?|minutes?|mins?)$/);
  if (!match) return null;

  const amount = Number(match[1]);
  return match[2].startsWith("m") ? amount * 60 : amount;
}

export function normalizeMatchDurationSeconds(value: number | string | null | undefined): number {
  const parsed = parseDurationValue(value);
  if (parsed === null || parsed <= 0) return DEFAULT_MATCH_DURATION_SECONDS;
  return Math.min(MAX_MATCH_DURATION_SECONDS, Math.max(MIN_MATCH_DURATION_SECONDS, parsed));
}

export function resolveContestDurationSeconds(contest: ContestDurationSource | null | undefined): number {
  return normalizeMatchDurationSeconds(contest?.duration_sec);
}

export function formatMatchDuration(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}
