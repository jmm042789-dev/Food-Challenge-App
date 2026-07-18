import React from "react";
import { StyleSheet, Text, View } from "react-native";

type Variant = "default" | "gold" | "danger" | "success" | "info" | "muted";
type Props = { icon?: string; label: string; variant?: Variant; backgroundColor?: string; color?: string };
const tones: Record<Variant, { backgroundColor: string; color: string; borderColor: string }> = {
  default: { backgroundColor: "rgba(188,73,13,0.86)", color: "#FFF7E8", borderColor: "#FFB347" }, gold: { backgroundColor: "rgba(125,81,13,0.88)", color: "#FFF0C2", borderColor: "#F6C76A" },
  danger: { backgroundColor: "rgba(112,36,34,0.9)", color: "#FFE2DC", borderColor: "#E36A61" }, success: { backgroundColor: "rgba(32,83,55,0.9)", color: "#E2F8E7", borderColor: "#75C78C" },
  info: { backgroundColor: "rgba(105,64,28,0.88)", color: "#FFE9C2", borderColor: "#D7A55A" }, muted: { backgroundColor: "rgba(45,37,35,0.9)", color: "#D8CEC4", borderColor: "#786961" },
};
export default function FireBadge({ icon, label, variant = "default", backgroundColor, color }: Props) {
  const tone = tones[variant];
  return <View style={[styles.container, { backgroundColor: backgroundColor ?? tone.backgroundColor, borderColor: tone.borderColor }]}>{icon ? <Text style={styles.icon}>{icon}</Text> : null}<Text numberOfLines={1} style={[styles.label, { color: color ?? tone.color }]}>{label}</Text></View>;
}
const styles = StyleSheet.create({ container: { alignItems: "center", alignSelf: "flex-start", borderRadius: 999, borderWidth: 1, flexDirection: "row", flexShrink: 1, marginBottom: 8, maxWidth: "100%", minWidth: 0, paddingHorizontal: 10, paddingVertical: 5 }, icon: { flexShrink: 0, fontSize: 13, marginRight: 5 }, label: { flexShrink: 1, fontSize: 11, fontWeight: "900", letterSpacing: 0.6 } });
