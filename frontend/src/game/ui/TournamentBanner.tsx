import React from "react";
import { StyleSheet, Text, View } from "react-native";
import RestaurantIdentity from "./RestaurantIdentity";
import SponsorStrip from "./SponsorStrip";

type Props = {
  eventTitle?: string;
  contestName?: string;
  location?: string;
  food?: string;
  roundLabel?: string;
  difficulty?: string;
  variant?: "compact" | "full";
  embedded?: boolean;
  restaurantName?: string;
  restaurantLogoUrl?: string;
  city?: string;
  state?: string;
  verified?: boolean;
  sponsored?: boolean;
  sponsorName?: string;
  sponsorLogoUrl?: string;
  sponsorMessage?: string;
  showPartnerDetails?: boolean;
};

function difficultyTone(difficulty?: string) {
  const value = difficulty?.toLowerCase();
  if (value === "easy") return styles.easy;
  if (value === "medium") return styles.medium;
  return styles.hard;
}

export default function TournamentBanner({
  eventTitle = "FIRE FEAST WORLD TOUR",
  contestName,
  location,
  food,
  roundLabel,
  difficulty,
  variant = "full",
  embedded = false,
  restaurantName,
  restaurantLogoUrl,
  city,
  state,
  verified,
  sponsored,
  sponsorName,
  sponsorLogoUrl,
  sponsorMessage,
  showPartnerDetails = false,
}: Props) {
  const compact = variant === "compact";

  return (
    <View style={[styles.banner, compact ? styles.compact : styles.full, embedded && styles.embedded]}>
      <View pointerEvents="none" style={styles.topHighlight} />
      <View style={styles.brandRow}>
        <Text numberOfLines={1} style={[styles.eventTitle, compact && styles.eventTitleCompact]}>{eventTitle.toUpperCase()}</Text>
        {roundLabel ? <Text numberOfLines={1} style={[styles.round, compact && styles.roundCompact]}>{roundLabel.toUpperCase()}</Text> : null}
      </View>
      {contestName ? <Text numberOfLines={1} style={[styles.contest, compact && styles.contestCompact]}>{contestName.toUpperCase()}</Text> : null}
      {!compact && (location || food || difficulty) ? (
        <View style={styles.metaRow}>
          <View style={styles.metaText}>
            {location ? <Text numberOfLines={1} style={styles.location}>⌖ {location.toUpperCase()}</Text> : null}
            {food ? <Text numberOfLines={1} style={styles.food}>{food.toUpperCase()}</Text> : null}
          </View>
          {difficulty ? <View style={[styles.difficulty, difficultyTone(difficulty)]}><Text style={styles.difficultyText}>{difficulty.toUpperCase()}</Text></View> : null}
        </View>
      ) : null}
      {showPartnerDetails ? <RestaurantIdentity name={restaurantName} logoUrl={restaurantLogoUrl} city={city} state={state} verified={verified} sponsored={sponsored} variant="compact" /> : null}
      {showPartnerDetails ? <SponsorStrip name={sponsorName} logoUrl={sponsorLogoUrl} message={sponsorMessage} compact /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { backgroundColor: "rgba(13,8,10,0.97)", borderColor: "rgba(232,145,48,0.76)", borderRadius: 9, borderWidth: 1, overflow: "hidden" },
  full: { paddingHorizontal: 17, paddingVertical: 11 },
  compact: { paddingHorizontal: 9, paddingVertical: 4 },
  embedded: { backgroundColor: "transparent", borderColor: "transparent", borderRadius: 0, borderWidth: 0 },
  topHighlight: { backgroundColor: "rgba(255,218,154,0.18)", height: 1, left: 8, position: "absolute", right: 8, top: 1 },
  brandRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  eventTitle: { color: "#F4BE66", flexShrink: 1, fontSize: 9, fontWeight: "900", letterSpacing: 1.5 },
  eventTitleCompact: { fontSize: 6, letterSpacing: 1 },
  round: { color: "#D29148", fontSize: 8, fontWeight: "900", letterSpacing: 1, marginLeft: 8 },
  roundCompact: { fontSize: 6 },
  contest: { color: "#FFF0D5", fontSize: 22, fontWeight: "900", letterSpacing: 0.8, marginTop: 3 },
  contestCompact: { fontSize: 9, lineHeight: 11, marginTop: 1 },
  metaRow: { alignItems: "center", flexDirection: "row", gap: 9, justifyContent: "space-between", marginTop: 6 },
  metaText: { flex: 1, minWidth: 0 },
  location: { color: "#C8A27A", fontSize: 8, fontWeight: "800", letterSpacing: 0.6 },
  food: { color: "#D99143", fontSize: 8, fontWeight: "900", letterSpacing: 0.5, marginTop: 2 },
  difficulty: { borderRadius: 5, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 3 },
  difficultyText: { color: "#FFF0D8", fontSize: 7, fontWeight: "900", letterSpacing: 0.6 },
  easy: { backgroundColor: "rgba(28,91,53,0.7)", borderColor: "#62B878" },
  medium: { backgroundColor: "rgba(124,73,16,0.72)", borderColor: "#E3A13C" },
  hard: { backgroundColor: "rgba(105,28,27,0.74)", borderColor: "#D95848" },
});
