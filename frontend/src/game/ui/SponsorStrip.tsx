import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";

import { validExternalUrl } from "../../utils/externalUrls";

type Props = { name?: string; logoUrl?: string; message?: string; compact?: boolean };

export default function SponsorStrip({ name, logoUrl, message, compact = true }: Props) {
  if (!name) return null;
  const safeLogo = validExternalUrl(logoUrl);
  return (
    <View style={[styles.strip, compact && styles.compact]}>
      <Text style={styles.label}>PRESENTED BY</Text>
      {safeLogo ? <Image source={{ uri: safeLogo }} resizeMode="contain" style={styles.logo} /> : null}
      <Text numberOfLines={1} style={styles.name}>{name.toUpperCase()}</Text>
      {!compact && message ? <Text numberOfLines={2} style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { alignItems: "center", backgroundColor: "rgba(18,10,10,0.9)", borderColor: "rgba(211,126,42,0.46)", borderRadius: 7, borderWidth: 1, flexDirection: "row", minWidth: 0, paddingHorizontal: 7, paddingVertical: 5 },
  compact: { paddingVertical: 3 },
  label: { color: "#94765D", fontSize: 5, fontWeight: "900", letterSpacing: 0.8, marginRight: 5 },
  logo: { height: 18, marginRight: 4, width: 24 },
  name: { color: "#E8B86D", flexShrink: 1, fontSize: 7, fontWeight: "900", letterSpacing: 0.5 },
  message: { color: "#BCA58F", flex: 1, fontSize: 7, marginLeft: 7 },
});
