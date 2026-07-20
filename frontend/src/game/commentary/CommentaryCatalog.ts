import type { CommentaryCatalogEntry, CommentaryEventType } from "./CommentaryTypes";

export const COMMENTARY_CATALOG: Record<CommentaryEventType, CommentaryCatalogEntry> = {
  MATCH_START: { messages: ["LET'S FEAST!", "HERE WE GO!", "BATTLE START!"], priority: 45, cooldownMs: 1000 },
  FIRST_BITE: { messages: ["FIRST BITE!", "DIG IN!", "THE FEAST BEGINS!"], priority: 20, cooldownMs: 500 },
  COMBO_5: { messages: ["NICE!", "KEEP IT GOING!", "HEATING UP!"], priority: 30, cooldownMs: 1000 },
  COMBO_10: { messages: ["INCREDIBLE!", "UNSTOPPABLE!", "WHAT A STREAK!"], priority: 50, cooldownMs: 1000 },
  COMBO_20: { messages: ["COMBO INFERNO!", "ABSOLUTELY WILD!", "CAN'T BE STOPPED!"], priority: 70, cooldownMs: 1000 },
  PERFECT_CHAIN: { messages: ["PERFECT CHAIN!", "FLAWLESS FEAST!", "PURE PRECISION!"], priority: 72, cooldownMs: 1800 },
  PLAYER_TAKES_LEAD: { messages: ["YOU TAKE THE LEAD!", "OUT IN FRONT!", "PLAYER ON TOP!"], priority: 55, cooldownMs: 2000 },
  OPPONENT_TAKES_LEAD: { messages: ["RIVAL TAKES THE LEAD!", "THE PRESSURE IS ON!", "TIME TO ANSWER!"], priority: 55, cooldownMs: 2000 },
  LEAD_CHANGE: { messages: ["LEAD CHANGE!", "BACK AND FORTH!", "WHAT A BATTLE!"], priority: 60, cooldownMs: 2000 },
  CLOSE_MATCH: { messages: ["TOO CLOSE!", "NECK AND NECK!", "ANYONE'S MATCH!"], priority: 58, cooldownMs: 2500 },
  FINAL_10_SECONDS: { messages: ["FINAL TEN!", "NOW OR NEVER!", "ONE LAST PUSH!"], priority: 90, cooldownMs: 10000 },
  MATCH_FINISHED: { messages: ["WHAT A FINISH!", "FEAST COMPLETE!", "THAT'S THE MATCH!"], priority: 100, cooldownMs: 10000 },
  NEW_HIGH_SCORE: { messages: ["NEW HIGH SCORE!", "RECORD BREAKER!", "A NEW PERSONAL BEST!"], priority: 80, cooldownMs: 10000 },
};
