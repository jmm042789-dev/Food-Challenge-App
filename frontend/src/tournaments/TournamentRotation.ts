import { TOURNAMENT_CATALOG } from "./TournamentCatalog";
import type { ActiveTournament } from "./TournamentTypes";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function getWeekBounds(date = new Date()): { start: Date; end: Date; weekKey: string } {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const end = new Date(start.getTime() + WEEK_MS);
  const weekKey = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
  return { start, end, weekKey };
}

export function getActiveTournament(date = new Date()): ActiveTournament {
  const { start, end, weekKey } = getWeekBounds(date);
  const weekIndex = Math.floor(start.getTime() / WEEK_MS);
  const definition = TOURNAMENT_CATALOG[((weekIndex % TOURNAMENT_CATALOG.length) + TOURNAMENT_CATALOG.length) % TOURNAMENT_CATALOG.length];
  return { ...definition, occurrenceId: `${definition.id}:${weekKey}`, startDate: start.toISOString(), endDate: end.toISOString() };
}

export function formatTournamentTimeRemaining(tournament: ActiveTournament, now = new Date()): string {
  const remaining = Math.max(0, new Date(tournament.endDate).getTime() - now.getTime());
  const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
  const hours = Math.floor((remaining / (60 * 60 * 1000)) % 24);
  return days > 0 ? `${days}D ${hours}H REMAINING` : `${hours}H REMAINING`;
}
