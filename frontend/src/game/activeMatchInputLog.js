const ACTIVE_MATCH_INPUT_LOG_KEY = "firefeast_active_match_input_log_v2";
const VALIDATION_VERSION = 3;
const DEFAULT_THROTTLE_MS = 750;

function finiteTimestamp(value) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function createActiveMatchInputLogPersistence(storage, options = {}) {
  const throttleMs = options.throttleMs ?? DEFAULT_THROTTLE_MS;
  const setTimer = options.setTimer ?? setTimeout;
  const clearTimer = options.clearTimer ?? clearTimeout;
  let identity = null;
  let timer = null;
  let writes = Promise.resolve();

  const cancel = () => {
    if (timer !== null) clearTimer(timer);
    timer = null;
  };

  const write = async (buffer, gameplayState, finalized = false) => {
    if (!identity) return false;
    cancel();
    const log = buffer.snapshot();
    const record = {
      schema_version: 1,
      validation_version: VALIDATION_VERSION,
      match_id: identity.matchId,
      contest_id: identity.contestId,
      server_started_at: identity.serverStartedAt,
      next_sequence: log.next_sequence,
      elapsed_ms: log.elapsed_ms,
      finalized: Boolean(finalized || log.finalized),
      input_events: log.events,
      gameplay_state: gameplayState ?? null,
    };
    // This whitelist is intentional: no server seed or credentials can enter storage.
    let succeeded = true;
    writes = writes.catch(() => {}).then(() => storage.setItem(ACTIVE_MATCH_INPUT_LOG_KEY, JSON.stringify(record))).catch(() => {
      succeeded = false;
    });
    try {
      await writes;
      return succeeded;
    } catch { return false; }
  };

  return {
    async bind(authority, buffer) {
      cancel();
      identity = null;
      const startedAt = finiteTimestamp(authority.serverStartedAt);
      const serverTime = finiteTimestamp(authority.serverTime);
      if (startedAt === null || serverTime === null || serverTime < startedAt) return { status: "unsafe" };
      const maximumElapsedMs = Math.max(0, Math.floor(authority.durationMs));
      const authoritativeElapsedMs = Math.min(maximumElapsedMs, Math.max(0, serverTime - startedAt));
      let raw;
      try {
        raw = await storage.getItem(ACTIVE_MATCH_INPUT_LOG_KEY);
      } catch {
        return { status: "unsafe" };
      }
      let saved = null;
      if (raw) {
        try { saved = JSON.parse(raw); } catch { await storage.removeItem(ACTIVE_MATCH_INPUT_LOG_KEY); }
      }
      identity = {
        matchId: authority.matchId,
        contestId: authority.contestId,
        serverStartedAt: authority.serverStartedAt,
      };
      if (!saved) {
        return { status: "new", authoritativeElapsedMs };
      }
      const sameMatch = saved.schema_version === 1
        && saved.validation_version === VALIDATION_VERSION
        && saved.match_id === authority.matchId
        && saved.contest_id === authority.contestId
        && saved.server_started_at === authority.serverStartedAt;
      if (!sameMatch) {
        await storage.removeItem(ACTIVE_MATCH_INPUT_LOG_KEY);
        return { status: "discarded", authoritativeElapsedMs };
      }
      const localOrigin = Date.now();
      const restored = buffer.restore({
        events: saved.input_events,
        finalized: Boolean(saved.finalized),
      }, authoritativeElapsedMs, maximumElapsedMs, localOrigin);
      if (!restored || saved.next_sequence !== saved.input_events.length + 1) return { status: "unsafe" };
      return {
        status: "restored",
        authoritativeElapsedMs,
        localOrigin,
        finalized: Boolean(saved.finalized),
        gameplayState: saved.gameplay_state ?? null,
      };
    },
    schedule(buffer, gameplayState) {
      if (!identity || timer !== null) return;
      timer = setTimer(() => {
        timer = null;
        const capturedState = typeof gameplayState === "function" ? gameplayState() : gameplayState;
        void write(buffer, capturedState, false);
      }, throttleMs);
    },
    flush(buffer, gameplayState, finalized = false) {
      return write(buffer, gameplayState, finalized);
    },
    async clear() {
      cancel();
      identity = null;
      await writes.catch(() => {});
      await storage.removeItem(ACTIVE_MATCH_INPUT_LOG_KEY);
    },
    cancel,
  };
}

module.exports = {
  ACTIVE_MATCH_INPUT_LOG_KEY,
  DEFAULT_THROTTLE_MS,
  createActiveMatchInputLogPersistence,
};
