/**
 * Belt rank visual helpers — backend already returns belt info on player & leaderboard,
 * but we keep this helper for client-side fallback styling.
 */
export type Belt = {
  key: string;
  name: string;
  min_xp: number;
  color: string;
  icon: string;
};

export const BELTS: Belt[] = [
  { key: "bronze",   name: "Bronze Belly",     min_xp: 0,    color: "#CD7F32", icon: "🥉" },
  { key: "silver",   name: "Silver Stomach",   min_xp: 200,  color: "#C0C0C0", icon: "🥈" },
  { key: "gold",     name: "Gold Glutton",     min_xp: 800,  color: "#FFB800", icon: "🥇" },
  { key: "platinum", name: "Platinum Plate",   min_xp: 2000, color: "#E5E4E2", icon: "🏆" },
  { key: "diamond",  name: "Diamond Devourer", min_xp: 5000, color: "#7AB8FF", icon: "💎" },
];

export function beltForXp(xp: number): Belt {
  let current = BELTS[0];
  for (const b of BELTS) if (xp >= b.min_xp) current = b;
  return current;
}

export function nextBelt(xp: number): Belt | null {
  return BELTS.find((b) => b.min_xp > xp) || null;
}

export function progressToNext(xp: number): number {
  const cur = beltForXp(xp);
  const nxt = nextBelt(xp);
  if (!nxt) return 1;
  const span = nxt.min_xp - cur.min_xp;
  return Math.min(1, (xp - cur.min_xp) / span);
}

/** Presentation only: never infer account level from belt tier. */
export function resolveOfficialProgression(input: { xp?: unknown; level?: unknown }) {
  const field = (value: unknown, minimum: number) => value == null ? "missing" as const
    : typeof value === "number" && Number.isSafeInteger(value) && value >= minimum ? "available" as const : "invalid" as const;
  const fields = { xp: field(input.xp, 0), level: field(input.level, 1) };
  const xp = fields.xp === "available" ? input.xp as number : null;
  const level = fields.level === "available" ? input.level as number : null;
  const belt = xp === null ? null : beltForXp(xp);
  const next = xp === null ? null : nextBelt(xp);
  const intervalSize = belt ? next ? next.min_xp - belt.min_xp : 1 : null;
  const intervalXp = belt && xp !== null ? next ? xp - belt.min_xp : 1 : null;
  return { available: xp !== null && level !== null, fields, xp, level, belt,
    beltTierIndex: belt ? BELTS.indexOf(belt) + 1 : null, nextBelt: next, intervalXp, intervalSize,
    progress: intervalXp !== null && intervalSize !== null ? intervalXp / intervalSize : null } as const;
}
