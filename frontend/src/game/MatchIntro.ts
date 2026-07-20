import { RESTAURANT_BY_ID, RESTAURANT_CATALOG } from "../restaurants/RestaurantCatalog";
import { TOURNAMENT_BY_ID } from "../tournaments/TournamentCatalog";

export type MatchIntroData = {
  restaurantName?: string;
  restaurantTheme?: string;
  playerName: string;
  playerTitle?: string;
  playerRank?: string;
  opponentName: string;
  opponentSubtitle?: string;
  opponentSignature?: string;
  foodName?: string;
  challengeName?: string;
};

type MatchIntroSource = {
  tournamentOccurrenceId?: string;
  foodId?: string;
  foodName?: string;
  challengeName?: string;
  playerName?: string;
  playerTitle?: string;
  playerRank?: string;
  opponentName: string;
  opponentSubtitle?: string;
  opponentSignature?: string;
};

const clean = (value?: string): string | undefined => {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
};

export function resolveMatchIntroData(source: MatchIntroSource): MatchIntroData {
  const tournamentId = source.tournamentOccurrenceId?.split(":")[0];
  const tournament = tournamentId ? TOURNAMENT_BY_ID.get(tournamentId) : undefined;
  const restaurant = tournament
    ? RESTAURANT_BY_ID.get(tournament.featuredRestaurantId)
    : RESTAURANT_CATALOG.find((item) => source.foodId && item.foodsAvailable.includes(source.foodId));
  return {
    restaurantName: clean(restaurant?.displayName),
    restaurantTheme: clean(restaurant?.theme),
    playerName: clean(source.playerName) ?? "Hungry Hero",
    playerTitle: clean(source.playerTitle),
    playerRank: clean(source.playerRank),
    opponentName: clean(source.opponentName) ?? "Opponent",
    opponentSubtitle: clean(source.opponentSubtitle),
    opponentSignature: clean(source.opponentSignature),
    foodName: clean(source.foodName),
    challengeName: clean(source.challengeName),
  };
}
