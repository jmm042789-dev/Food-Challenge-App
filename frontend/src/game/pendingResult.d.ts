import type { CompletedMatchPayload } from "./resultSubmission";
import type { AsyncStringStorage } from "./activeMatchInputLog";
export type PendingResult = Readonly<{schema_version:1;player_id:string;match_id:string;contest_id:string;payload:CompletedMatchPayload}>;
export type OfficialResult = {coin_reward:number;xp_reward:number;new_xp:number;new_coins:number;new_tums:number;accepted_score:number;authoritative_opponent_score:number;won:boolean;authoritative_outcome:"win"|"loss"|"tie"};
export type ReceiptEvidence = Readonly<{schema_version:1;player_id:string;match_id:string;contest_id:string;outcome:"settled"|"rejected"|"expired";rewards_granted:boolean;settlement_final:true}>;
type ReceiptIdentity = Readonly<{schema_version:1;player_id:string;match_id:string;contest_id:string}>;
export type ResultReceipt = ReceiptIdentity & (
 {status:"UNRESOLVED"} |
 {status:"SETTLED";receipt:ReceiptEvidence;result:OfficialResult & {verified:true;match_id:string}} |
 {status:"TERMINAL_NO_REWARD";receipt:ReceiptEvidence}
);
export const KEY:string;
export const DIAGNOSTIC_PREFIX:string;
export function validateReceipt(value:unknown,record:PendingResult):ResultReceipt;
export function validPayload(value:unknown):value is CompletedMatchPayload;
export function isOfficialResult(value:unknown):value is OfficialResult;
export function resultRecoveryMessage(error:unknown):string;
export function createPendingResultStore(storage:AsyncStringStorage):{
 read(playerId:string):Promise<PendingResult|null>;
 readForRetry(playerId:string):Promise<PendingResult|null>;
 save(playerId:string,payload:CompletedMatchPayload):Promise<PendingResult>;
 clearSettled(record:PendingResult):Promise<void>;
 resolveReceipt(record:PendingResult,response:unknown):Promise<ResultReceipt>;
 withoutPending<T>(playerId:string,operation:()=>Promise<T>):Promise<T>;
};
