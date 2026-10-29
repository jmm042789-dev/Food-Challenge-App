import type { Contest } from "../api";
export type ResumeResponse = {
  status: "resumable"; match_id: string; contest_id: string; server_time: string;
  start: { match_id: string; contest: Contest; opponent: { id: string }; opponent_config: unknown;
    server_started_at: string; server_time: string; expires_at: string; authoritative_duration_sec: number;
    player_tums: number; equipped_gear: string | null;
    perk_modifiers: {tap_power:number;combo_window_ms:number;score_multiplier:number;heat_generation_multiplier:number};
  };
};
export function validateResumeResponse(value: unknown, matchId: string, contestId: string): ResumeResponse {
  const r = value as ResumeResponse | null;
  const s = r?.start;
  const finite = (n:unknown):n is number => typeof n === "number" && Number.isFinite(n);
  if (!r || r.status !== "resumable" || r.match_id !== matchId || r.contest_id !== contestId
    || !s || s.match_id !== matchId || s.contest?.id !== contestId || !s.opponent?.id || !s.opponent_config
    || ![r.server_time,s.server_started_at,s.expires_at].every(t => typeof t === "string" && Number.isFinite(Date.parse(t)))
    || Date.parse(r.server_time) < Date.parse(s.server_started_at) || Date.parse(r.server_time) >= Date.parse(s.expires_at)
    || !finite(s.authoritative_duration_sec) || s.authoritative_duration_sec <= 0
    || s.contest.duration_sec !== s.authoritative_duration_sec
    || !finite(s.player_tums) || s.player_tums < 0
    || !s.perk_modifiers || ![s.perk_modifiers.tap_power,s.perk_modifiers.combo_window_ms,s.perk_modifiers.score_multiplier,s.perk_modifiers.heat_generation_multiplier].every(finite)) {
    throw new Error("The server returned an invalid resume configuration. No replacement match was started.");
  }
  return r;
}
export function resumeFailureMessage(error: unknown): string {
  const e = error as {status?:number;code?:string};
  if (e?.status === 410 && e.code === "MATCH_EXPIRED") return "This match has expired. No new match was started or entry fee charged.";
  if (e?.status === 409) return "This match cannot be resumed. No replacement match was started.";
  if (e?.status === 404 || e?.status === 405) return "Safe match recovery is not available on this server yet. No new match was started.";
  return "The match could not be resumed. Check your connection and retry. No replacement match was started.";
}
export async function resolveMatchEntry<T>(options: {
  playerId:string;contestId:string;coins:unknown;entryFee:number;expectedMatchId?:string;onResumeIdentified?:(matchId:string)=>void;
  api:{activeMatch:()=>Promise<{status:string;match_id?:string;contest_id?:string}>;
    resumeMatch:(matchId:string,contestId:string,playerId:string)=>Promise<ResumeResponse>;
    startMatch:(contestId:string,playerId?:string)=>Promise<T>};
}):Promise<{match:T|ResumeResponse["start"];resumed:boolean;serverTime?:string}> {
  const active = await options.api.activeMatch();
  if (options.expectedMatchId && (active.status !== "resumable" || active.match_id !== options.expectedMatchId || active.contest_id !== options.contestId)) {
    throw new Error("The requested match is no longer resumable. No replacement match was started.");
  }
  if (active.status === "resumable") {
    if (!active.match_id || active.contest_id !== options.contestId) throw new Error("A different or invalid active match requires recovery.");
    options.onResumeIdentified?.(active.match_id);
    try {
      const r = validateResumeResponse(await options.api.resumeMatch(active.match_id,options.contestId,options.playerId),active.match_id,options.contestId);
      return {match:r.start,resumed:true,serverTime:r.server_time};
    } catch (error) { throw new Error(resumeFailureMessage(error)); }
  }
  if (!["absent","expired","cancelled","rejected","settled"].includes(active.status)) throw new Error("Active match state is unavailable.");
  if (typeof options.coins !== "number" || !Number.isFinite(options.coins) || options.coins < options.entryFee) throw new Error("Not enough coins for this contest");
  return {match:await options.api.startMatch(options.contestId,options.playerId),resumed:false};
}
