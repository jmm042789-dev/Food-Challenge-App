import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { openExternalUrl, validExternalUrl } from "../../utils/externalUrls";

type Props = {
  name?: string;
  logoUrl?: string;
  city?: string;
  state?: string;
  address?: string;
  postalCode?: string;
  verified?: boolean;
  sponsored?: boolean;
  websiteUrl?: string;
  menuUrl?: string;
  variant?: "compact" | "standard";
};

export default function RestaurantIdentity({ name, logoUrl, city, state, address, postalCode, verified = false, sponsored = false, websiteUrl, menuUrl, variant = "standard" }: Props) {
  if (!name) return null;
  const compact = variant === "compact";
  const safeLogo = validExternalUrl(logoUrl);
  const safeWebsite = validExternalUrl(websiteUrl);
  const safeMenu = validExternalUrl(menuUrl);
  const location = [city, state].filter(Boolean).join(", ");
  const addressLine = [address, postalCode].filter(Boolean).join(" ");
  const fallback = name.trim().slice(0, 2).toUpperCase();

  return (
    <View style={[styles.container, compact && styles.compact]}>
      <View style={[styles.logoFrame, compact && styles.logoFrameCompact]}>
        {safeLogo ? <Image source={{ uri: safeLogo }} resizeMode="contain" style={[styles.logo, compact && styles.logoCompact]} /> : <Text style={[styles.fallback, compact && styles.fallbackCompact]}>{fallback}</Text>}
      </View>
      <View style={styles.identity}>
        <View style={styles.nameRow}>
          <Text numberOfLines={1} style={[styles.name, compact && styles.nameCompact]}>{name.toUpperCase()}</Text>
          {verified ? <Text accessibilityLabel="Verified restaurant" style={styles.verified}>✓</Text> : null}
          {sponsored ? <Text style={styles.sponsored}>SPONSOR</Text> : null}
        </View>
        {location ? <Text numberOfLines={1} style={[styles.location, compact && styles.locationCompact]}>{location}</Text> : null}
        {!compact && addressLine ? <Text numberOfLines={2} style={styles.address}>{addressLine}</Text> : null}
        {!compact && (safeWebsite || safeMenu) ? (
          <View style={styles.actions}>
            {safeWebsite ? <Pressable accessibilityRole="link" onPress={() => { void openExternalUrl(safeWebsite); }} style={styles.link}><Text style={styles.linkText}>WEBSITE</Text></Pressable> : null}
            {safeMenu ? <Pressable accessibilityRole="link" onPress={() => { void openExternalUrl(safeMenu); }} style={styles.link}><Text style={styles.linkText}>MENU</Text></Pressable> : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", backgroundColor: "rgba(12,8,9,0.94)", borderColor: "rgba(224,135,45,0.58)", borderRadius: 10, borderWidth: 1, flexDirection: "row", minWidth: 0, padding: 8 },
  compact: { backgroundColor: "rgba(17,10,10,0.72)", borderRadius: 7, paddingHorizontal: 5, paddingVertical: 3 },
  logoFrame: { alignItems: "center", backgroundColor: "#0A0708", borderColor: "#D88A38", borderRadius: 8, borderWidth: 1, height: 42, justifyContent: "center", overflow: "hidden", width: 42 },
  logoFrameCompact: { borderRadius: 5, height: 25, width: 25 },
  logo: { height: 38, width: 38 },
  logoCompact: { height: 22, width: 22 },
  fallback: { color: "#FFD18A", fontSize: 14, fontWeight: "900" },
  fallbackCompact: { fontSize: 9 },
  identity: { flex: 1, marginLeft: 7, minWidth: 0 },
  nameRow: { alignItems: "center", flexDirection: "row", minWidth: 0 },
  name: { color: "#FFF0D7", flexShrink: 1, fontSize: 12, fontWeight: "900", letterSpacing: 0.4 },
  nameCompact: { fontSize: 7 },
  verified: { color: "#F4C56F", fontSize: 10, fontWeight: "900", marginLeft: 4 },
  sponsored: { backgroundColor: "rgba(129,65,18,0.8)", borderColor: "#D99142", borderRadius: 3, borderWidth: 1, color: "#FFE0A9", fontSize: 5, fontWeight: "900", marginLeft: 4, paddingHorizontal: 3, paddingVertical: 1 },
  location: { color: "#BFA181", fontSize: 8, marginTop: 2 },
  locationCompact: { fontSize: 6, marginTop: 0 },
  address: { color: "#9F8B7A", fontSize: 7, marginTop: 2 },
  actions: { flexDirection: "row", gap: 6, marginTop: 6 },
  link: { backgroundColor: "rgba(119,56,17,0.7)", borderColor: "#D98738", borderRadius: 5, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4 },
  linkText: { color: "#FFE3B1", fontSize: 7, fontWeight: "900", letterSpacing: 0.6 },
});
