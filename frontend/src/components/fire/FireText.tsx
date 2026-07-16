import React from "react";
import { StyleProp, StyleSheet, Text, TextProps, TextStyle } from "react-native";

type Variant = "display" | "screenTitle" | "sectionTitle" | "cardTitle" | "label" | "value" | "body" | "caption" | "button" | "badge";
type Props = TextProps & { variant?: Variant; style?: StyleProp<TextStyle> };

/** Shared warm arcade typography; callers can still provide local layout styles. */
export default function FireText({ variant = "body", style, ...props }: Props) {
  return <Text {...props} style={[styles.base, styles[variant], style]} />;
}

const styles = StyleSheet.create({
  base: { color: "#FFF7E8" },
  display: { fontSize: 30, fontWeight: "900", letterSpacing: 0.8, lineHeight: 36 },
  screenTitle: { fontSize: 26, fontWeight: "900", letterSpacing: 0.5, lineHeight: 32 },
  sectionTitle: { color: "#F6C76A", fontSize: 21, fontWeight: "900", letterSpacing: 0.35, lineHeight: 27 },
  cardTitle: { fontSize: 18, fontWeight: "900", letterSpacing: 0.2, lineHeight: 23 },
  label: { color: "#F6C76A", fontSize: 11, fontWeight: "900", letterSpacing: 0.8, lineHeight: 14 },
  value: { color: "#FFF7E8", fontSize: 18, fontWeight: "900", lineHeight: 22 },
  body: { color: "#E5D9CC", fontSize: 14, lineHeight: 20 },
  caption: { color: "#CDBEAD", fontSize: 12, lineHeight: 16 },
  button: { color: "#FFF7E8", fontSize: 16, fontWeight: "900", letterSpacing: 0.8 },
  badge: { color: "#FFF7E8", fontSize: 11, fontWeight: "900", letterSpacing: 0.6 },
});
