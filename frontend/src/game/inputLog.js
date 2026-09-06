const MAX_INPUT_EVENTS = 2000;
const VALIDATION_VERSION = 3;

function isFiniteNormalized(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

function isValidDuration(value) {
  return Number.isInteger(value) && value >= 0 && value <= 5000;
}

function hasValidInputEvidence(event) {
  if (event.type === "ANTACID") return true;
  if (event.source !== "CONTROL" && event.source !== "FOOD") return false;
  if (event.type === "SLICE") {
    return isFiniteNormalized(event.start_x)
      && isFiniteNormalized(event.start_y)
      && isFiniteNormalized(event.end_x)
      && isFiniteNormalized(event.end_y)
      && isValidDuration(event.duration_ms);
  }
  if (event.type === "BITE") {
    const hasTapPoint = isFiniteNormalized(event.x) && isFiniteNormalized(event.y);
    const hasHoldPoint = isFiniteNormalized(event.start_x)
      && isFiniteNormalized(event.start_y)
      && isFiniteNormalized(event.end_x)
      && isFiniteNormalized(event.end_y)
      && isValidDuration(event.duration_ms);
    return hasTapPoint || hasHoldPoint;
  }
  return false;
}
function createInputLogBuffer(clock = Date.now, options = {}) {
  let startedAt = null;
  let elapsedBase = 0;
  let maximumElapsed = 86400000;
  let events = [];
  let frozen = null;
  const requireExplicitTimestamps = options.requireExplicitTimestamps ?? true;

  const elapsedFor = (timestamp, clampToMaximum = true) => {
    if (startedAt === null) return elapsedBase;
    const calculated = Math.max(elapsedBase, elapsedBase + Math.round(timestamp - startedAt));
    return clampToMaximum ? Math.min(maximumElapsed, calculated) : calculated;
  };
  const elapsed = () => elapsedFor(clock(), true);

  return {
    start(maximumElapsedMs = maximumElapsed, originTimestamp = null) {
      maximumElapsed = Math.max(0, Math.floor(maximumElapsedMs));
      if (startedAt === null) {
        startedAt = typeof originTimestamp === "number" && Number.isFinite(originTimestamp)
          ? originTimestamp
          : clock();
      }
    },
    restore(snapshot, authoritativeElapsedMs, maximumElapsedMs, originTimestamp = null) {
      if (startedAt !== null || frozen || events.length) return false;
      if (!snapshot || !Array.isArray(snapshot.events) || snapshot.events.length > MAX_INPUT_EVENTS) return false;
      const restored = [];
      for (let index = 0; index < snapshot.events.length; index += 1) {
        const event = snapshot.events[index];
        if (!event || event.seq !== index + 1 || !Number.isInteger(event.t_ms) || event.t_ms < 0
          || (index > 0 && event.t_ms < restored[index - 1].t_ms)
          || !["BITE", "SLICE", "ANTACID"].includes(event.type)
          || !hasValidInputEvidence(event)) return false;
        restored.push(Object.freeze({ ...event }));
      }
      maximumElapsed = Math.max(0, Math.floor(maximumElapsedMs));
      const lastElapsed = restored.length ? restored[restored.length - 1].t_ms : 0;
      elapsedBase = Math.min(maximumElapsed, Math.max(lastElapsed, Math.floor(authoritativeElapsedMs)));
      events = restored;
      startedAt = typeof originTimestamp === "number" && Number.isFinite(originTimestamp)
        ? originTimestamp
        : clock();
      if (snapshot.finalized) frozen = Object.freeze(events.slice());
      return true;
    },
    canRecord() {
      return startedAt !== null && !frozen && events.length < MAX_INPUT_EVENTS;
    },
    record(type, evidence = {}, occurredAt = null) {
      if (startedAt === null || frozen || events.length >= MAX_INPUT_EVENTS) return false;
      const hasExplicitTimestamp = typeof occurredAt === "number" && Number.isFinite(occurredAt);
      if (requireExplicitTimestamps && !hasExplicitTimestamp) return false;
      const currentElapsed = hasExplicitTimestamp ? elapsedFor(occurredAt, false) : elapsed();
      const prior = events[events.length - 1];
      const event = Object.freeze({
        seq: events.length + 1,
        t_ms: prior ? Math.max(prior.t_ms, currentElapsed) : currentElapsed,
        type,
        ...evidence,
      });
      if (!hasValidInputEvidence(event)) return false;
      events.push(event);
      return true;
    },
    finish() {
      if (!frozen) frozen = Object.freeze(events.slice());
      return frozen;
    },
    elapsed,
    snapshot() {
      return Object.freeze({
        validation_version: VALIDATION_VERSION,
        next_sequence: events.length + 1,
        elapsed_ms: elapsed(),
        finalized: frozen !== null,
        events: Object.freeze(events.slice()),
      });
    },
    clear() {
      startedAt = null;
      elapsedBase = 0;
      maximumElapsed = 86400000;
      events = [];
      frozen = null;
    },
  };
}

module.exports = { MAX_INPUT_EVENTS, VALIDATION_VERSION, createInputLogBuffer, hasValidInputEvidence };
