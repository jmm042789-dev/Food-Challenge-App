import type { InputLogBuffer } from "./inputLog";

export type ActiveMatchInputLogAuthority = {
  matchId: string;
  contestId: string;
  serverStartedAt: string;
  serverTime: string;
  durationMs: number;
};
export type InputLogRecoveryResult = {
  status: "new" | "restored" | "discarded" | "unsafe";
  authoritativeElapsedMs?: number;
  localOrigin?: number;
  finalized?: boolean;
  gameplayState?: unknown;
};
export type AsyncStringStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<unknown>;
  removeItem(key: string): Promise<unknown>;
};
export type ActiveMatchInputLogPersistence = {
  bind(authority: ActiveMatchInputLogAuthority, buffer: InputLogBuffer): Promise<InputLogRecoveryResult>;
  schedule(buffer: InputLogBuffer, gameplayState?: unknown | (() => unknown)): void;
  flush(buffer: InputLogBuffer, gameplayState?: unknown, finalized?: boolean): Promise<boolean>;
  clear(): Promise<void>;
  suspend(): void;
  cancel(): void;
};
export const ACTIVE_MATCH_INPUT_LOG_KEY: string;
export const DEFAULT_THROTTLE_MS: number;
export function createActiveMatchInputLogPersistence(
  storage: AsyncStringStorage,
  options?: { throttleMs?: number; setTimer?: typeof setTimeout; clearTimer?: typeof clearTimeout },
): ActiveMatchInputLogPersistence;
