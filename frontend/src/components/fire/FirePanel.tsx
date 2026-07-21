import React from "react";
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle, type AccessibilityRole, type AccessibilityState } from "react-native";

type Accent = "default" | "gold" | "danger" | "success" | "featured";
type Props = {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  headerRight?: React.ReactNode;
  compact?: boolean;
  elevated?: boolean;
  accent?: Accent;
  highlighted?: boolean;
  borderColor?: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityRole?: AccessibilityRole;
  accessibilityState?: AccessibilityState;
};

const accentColor: Record<Accent, string> = { default: "rgba(255,141,41,0.45)", gold: "rgba(246,199,106,0.7)", danger: "rgba(209,72,63,0.65)", success: "rgba(89,168,111,0.6)", featured: "rgba(255,156,45,0.82)" };

export default function FirePanel({ children, title, subtitle, icon, headerRight, compact = false, elevated = false, accent = "default", highlighted = false, borderColor, onPress, style, accessibilityLabel, accessibilityHint, accessibilityRole, accessibilityState }: Props) {
  const trim = borderColor ?? accentColor[highlighted ? "featured" : accent];
  const body = (
    <View style={[styles.panel, compact && styles.compact, elevated && styles.elevated, { borderColor: trim }, style]}>
      <View pointerEvents="none" style={[styles.topHighlight, { backgroundColor: trim }]} />
      {(title || subtitle || icon || headerRight) ? <View style={styles.header}><View style={styles.headerText}>{title ? <View style={styles.titleRow}>{icon ? <View style={styles.icon}>{icon}</View> : null}<Text style={styles.title}>{title}</Text></View> : null}{subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}</View>{headerRight}</View> : null}
      <View style={(title || subtitle || icon || headerRight) ? styles.content : undefined}>{children}</View>
    </View>
  );
  return onPress ? <Pressable accessibilityHint={accessibilityHint} accessibilityLabel={accessibilityLabel} accessibilityRole={accessibilityRole ?? "button"} accessibilityState={accessibilityState} onPress={onPress} style={({ pressed }) => pressed ? styles.pressed : undefined}>{body}</Pressable> : body;
}

const styles = StyleSheet.create({
  panel: { backgroundColor: "rgba(19, 14, 15, 0.9)", borderRadius: 20, borderWidth: 1, elevation: 5, overflow: "hidden", paddingHorizontal: 20, paddingVertical: 18, shadowColor: "#000", shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.28, shadowRadius: 8 },
  compact: { borderRadius: 15, paddingHorizontal: 14, paddingVertical: 12 },
  elevated: { elevation: 8, shadowOpacity: 0.38, shadowRadius: 11 },
  topHighlight: { height: 1, left: 12, opacity: 0.48, position: "absolute", right: 12, top: 1 },
  header: { alignItems: "flex-start", flexDirection: "row", justifyContent: "space-between" },
  headerText: { flex: 1 }, titleRow: { alignItems: "center", flexDirection: "row" }, icon: { marginRight: 7 },
  title: { color: "#FFF7E8", fontSize: 17, fontWeight: "900", letterSpacing: 0.3 },
  subtitle: { color: "#CDBEAD", fontSize: 12, marginTop: 3 }, content: { marginTop: 12 }, pressed: { opacity: 0.9 },
});
