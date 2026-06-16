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
