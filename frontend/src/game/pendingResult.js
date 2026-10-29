const KEY = "firefeast_pending_result_v1";
const DIAGNOSTIC_PREFIX = "firefeast_terminal_result_v1:";
const stores = new WeakMap();
const identifier = value => typeof value === "string" && /^[A-Za-z0-9._:-]{1,128}$/.test(value);
const finite = value => typeof value === "number" && Number.isFinite(value) && value >= 0;
const { hasValidInputEvidence } = require("./inputLog");
function failure(code) {
  const error = new Error({
    PENDING_RESULT: "A completed result needs recovery before another match can start.",
    PERSISTENCE_FAILED: "The completed result could not be saved. Keep this screen open and retry; restart recovery is not available yet.",
    CLEANUP_FAILED: "The official outcome was verified, but its local pending record could not be cleared. Please retry verification.",
    READ_FAILED: "Saved result could not be read. Retry without clearing app data.",
    INVALID_RECORD: "Saved result is incompatible or damaged. It has been preserved; recovery needs support.",
    WRONG_PLAYER: "This result belongs to another saved player. Restore the original account; the record has been preserved.",
    STALE_RECORD: "The saved result changed. It has not been removed.",
    INVALID_RECEIPT: "The official receipt could not be verified. Saved evidence remains protected.",
    DIAGNOSTIC_FAILED: "The terminal receipt could not be saved. Your pending evidence remains protected. Please retry.",
    DIAGNOSTIC_CONFLICT: "Existing diagnostic evidence does not match this result. Nothing was overwritten; recovery needs support.",
  }[code] || "Result recovery could not be completed.");
  error.code = code;
  return error;
}
function freeze(value) {
  if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
function validPayload(p) {
  if (!p || typeof p !== "object" || Array.isArray(p)) return false;
  const fields = ["match_id", "contest_id", "score", "opponent_score", "duration_sec", "accepted_taps", "completed_progress", "maximum_combo", "opponent_id", "tums_used", "completion_reason", "is_tournament", "validation_version", "input_events"];
  if (Object.keys(p).some(k => !fields.includes(k)) || fields.filter(k => k !== "is_tournament").some(k => !Object.hasOwn(p, k))) return false;
  if (![p.match_id,p.contest_id,p.opponent_id].every(identifier) || p.validation_version !== 3) return false;
  if (![p.score,p.opponent_score,p.duration_sec,p.accepted_taps,p.completed_progress,p.maximum_combo,p.tums_used].every(finite)) return false;
  if (![p.accepted_taps,p.maximum_combo,p.tums_used].every(Number.isInteger) || p.duration_sec <= 0) return false;
  if (!["timer_completed","challenge_completed","player_exited","other"].includes(p.completion_reason)) return false;
  if (Object.hasOwn(p,"is_tournament") && typeof p.is_tournament !== "boolean") return false;
  if (!Array.isArray(p.input_events) || p.input_events.length > 2000) return false;
  const eventFields = ["seq","t_ms","type","source","x","y","start_x","start_y","end_x","end_y","duration_ms"];
  return p.input_events.every((e,i) => e && e.seq === i + 1 && finite(e.t_ms) && Number.isInteger(e.t_ms)
    && (i === 0 || e.t_ms >= p.input_events[i-1].t_ms)
    && Object.keys(e).every(k => eventFields.includes(k)) && hasValidInputEvidence(e));
}
function parse(raw) {
  try {
    const r = JSON.parse(raw);
    if (!r || Object.keys(r).sort().join() !== "contest_id,match_id,payload,player_id,schema_version"
      || r.schema_version !== 1 || !identifier(r.player_id) || !validPayload(r.payload)
      || r.match_id !== r.payload.match_id || r.contest_id !== r.payload.contest_id) throw Error();
    return freeze(r);
  } catch { throw failure("INVALID_RECORD"); }
}
function createPendingResultStore(storage) {
  if (stores.has(storage)) return stores.get(storage);
  let queue = Promise.resolve(), unsaved = null;
  const serial = fn => { const next = queue.then(fn); queue = next.catch(() => {}); return next; };
  const rawRead = async () => { try { return await storage.getItem(KEY); } catch { throw failure("READ_FAILED"); } };
  const read = async playerId => {
    const raw = await rawRead();
    if (unsaved && raw !== unsaved) throw failure("PERSISTENCE_FAILED");
    if (!raw) return null;
    const record = parse(raw);
    if (record.player_id !== playerId) throw failure("WRONG_PLAYER");
    return record;
  };
  const store = {
    read: playerId => serial(() => read(playerId)),
    readForRetry: playerId => serial(async () => {
      const raw = await rawRead();
      const candidate = raw || unsaved;
      if (!candidate) return null;
      if (raw && unsaved && raw !== unsaved) throw failure("PENDING_RESULT");
      const record = parse(candidate);
      if (record.player_id !== playerId) throw failure("WRONG_PLAYER");
      return record;
    }),
    save: (playerId,payload) => serial(async () => {
      const record = parse(JSON.stringify({schema_version:1,player_id:playerId,match_id:payload.match_id,contest_id:payload.contest_id,payload}));
      const serialized = JSON.stringify(record);
      let raw;
      try { raw = await rawRead(); } catch (error) { unsaved ??= serialized; throw error; }
      if ((raw && JSON.stringify(parse(raw)) !== serialized) || (unsaved && unsaved !== serialized)) throw failure("PENDING_RESULT");
      if (raw) { unsaved = null; return record; }
      unsaved = serialized;
      try {
        if (await storage.setItem(KEY,serialized) === false) throw Error();
        if (await storage.getItem(KEY) !== serialized) throw Error();
      } catch { throw failure("PERSISTENCE_FAILED"); }
      unsaved = null;
      return record;
    }),
    clearSettled: record => serial(async () => {
      const raw = await rawRead();
      if (!raw) return;
      if (JSON.stringify(parse(raw)) !== JSON.stringify(record)) throw failure("STALE_RECORD");
      try { if (await storage.removeItem(KEY) === false) throw Error(); }
      catch { throw failure("CLEANUP_FAILED"); }
      unsaved = null;
    }),
    resolveReceipt: (record, response) => serial(async () => {
      const verified = validateReceipt(response, record);
      if (verified.status === "UNRESOLVED") return verified;
      const raw = await rawRead();
      if (raw && JSON.stringify(parse(raw)) !== JSON.stringify(record)) throw failure("STALE_RECORD");
      if (unsaved && unsaved !== JSON.stringify(record)) throw failure("STALE_RECORD");
      if (verified.status === "TERMINAL_NO_REWARD") {
        const key = DIAGNOSTIC_PREFIX + encodeURIComponent(record.player_id) + ":" + encodeURIComponent(record.match_id);
        const diagnostic = JSON.stringify({schema_version:1, pending:record, receipt:verified});
        let previous;
        try { previous = await storage.getItem(key); } catch { throw failure("READ_FAILED"); }
        if (previous !== null && previous !== undefined && previous !== diagnostic) throw failure("DIAGNOSTIC_CONFLICT");
        try {
          if (previous == null && await storage.setItem(key, diagnostic) === false) throw Error();
          if (await storage.getItem(key) !== diagnostic) throw Error();
        } catch { throw failure("DIAGNOSTIC_FAILED"); }
      }
      // This queue is shared with save/new-entry guards. It is not cross-process CAS.
      if (raw) {
        const latest = await rawRead();
        if (latest !== raw) throw failure("STALE_RECORD");
        try {
          if (await storage.removeItem(KEY) === false || await storage.getItem(KEY) != null) throw Error();
        } catch { throw failure("CLEANUP_FAILED"); }
      }
      unsaved = null;
      return verified;
    }),
    withoutPending: (playerId, operation) => serial(async () => {
      if (await read(playerId)) throw failure("PENDING_RESULT");
      return operation();
    }),
  };
  stores.set(storage,store);
  return store;
}
function isOfficialResult(r) {
  return r && [r.coin_reward,r.xp_reward,r.new_xp,r.new_coins,r.new_tums,r.accepted_score,r.authoritative_opponent_score].every(finite)
    && typeof r.won === "boolean" && ["win","loss","tie"].includes(r.authoritative_outcome);
}
function validateReceipt(value, record) {
  const bound = x => x && typeof x === "object" && !Array.isArray(x) && x.schema_version === 1
    && x.player_id === record.player_id && x.match_id === record.match_id && x.contest_id === record.contest_id;
  if (!bound(value)) throw failure("INVALID_RECEIPT");
  const envelope = {schema_version:1, player_id:record.player_id, match_id:record.match_id, contest_id:record.contest_id, status:value.status};
  if (value.status === "UNRESOLVED") {
    if (Object.hasOwn(value,"receipt") || Object.hasOwn(value,"result")) throw failure("INVALID_RECEIPT");
    return freeze(envelope);
  }
  const e = value.receipt;
  if (!bound(e) || e.settlement_final !== true) throw failure("INVALID_RECEIPT");
  const receipt = {schema_version:1, player_id:record.player_id, match_id:record.match_id, contest_id:record.contest_id,
    outcome:e.outcome, rewards_granted:e.rewards_granted, settlement_final:true};
  if (value.status === "TERMINAL_NO_REWARD" && ["rejected","expired"].includes(e.outcome) && e.rewards_granted === false && !Object.hasOwn(value,"result")) {
    return freeze({...envelope, receipt});
  }
  if (value.status === "SETTLED" && e.outcome === "settled" && e.rewards_granted === true
      && isOfficialResult(value.result) && value.result.verified === true && value.result.match_id === record.match_id) {
    const fields = ["coin_reward","xp_reward","new_xp","new_coins","new_tums","accepted_score","authoritative_opponent_score","won","authoritative_outcome"];
    const result = {verified:true,match_id:record.match_id,...Object.fromEntries(fields.map(k=>[k,value.result[k]]))};
    return freeze({...envelope,receipt,result});
  }
  throw failure("INVALID_RECEIPT");
}
function resultRecoveryMessage(error) {
  if (error?.code === "MATCH_EXPIRED") return "The server reports this match expired. Its saved result has been retained; contact support if settlement is uncertain.";
  if (error?.code === "MATCH_RESULT_REJECTED") return "The server rejected this result. Its saved evidence has been retained for support.";
  if (error?.code === "MATCH_NOT_ACTIVE") return "The server could not locate this pending match. The result has been retained for support.";
  return error instanceof Error && ["PENDING_RESULT","PERSISTENCE_FAILED","CLEANUP_FAILED","READ_FAILED","INVALID_RECORD","WRONG_PLAYER","STALE_RECORD","INVALID_RECEIPT","DIAGNOSTIC_FAILED","DIAGNOSTIC_CONFLICT"].includes(error.code)
    ? error.message : "Result not verified. Check your connection and retry. Any server settlement will be retrieved without another entry fee.";
}
module.exports = { KEY, DIAGNOSTIC_PREFIX, createPendingResultStore, validPayload, isOfficialResult, validateReceipt, resultRecoveryMessage };
