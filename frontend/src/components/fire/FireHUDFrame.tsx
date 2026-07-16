import React from "react";
import { StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";

type FireHUDFrameProps = {
  label?: string;
  value?: string | number;
  icon?: React.ReactNode;
  compact?: boolean;
  valueAlign?: "left" | "center" | "right";
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** Shared dark-metal shell for counters, meters, and compact game HUD stats. */
export default function FireHUDFrame({
  label,
  value,
  icon,
  compact = false,
  valueAlign = "right",
  children,
  style,
}: FireHUDFrameProps) {
  return (
    <View style={[styles.frame, compact ? styles.compact : styles.standard, style]}>
      <View pointerEvents="none" style={styles.topHighlight} />
      {(label || value !== undefined || icon) ? (
        <View style={styles.header}>
          <View style={styles.labelGroup}>
            {icon ? <View style={styles.icon}>{icon}</View> : null}
            {label ? <Text style={[styles.label, compact && styles.labelCompact]}>{label}</Text> : null}
          </View>
          {value !== undefined ? (
            <Text numberOfLines={1} style={[styles.value, compact && styles.valueCompact, valueAlign === "left" && styles.valueLeft, valueAlign === "center" && styles.valueCenter]}>
              {value}
            </Text>
          ) : null}
        </View>
      ) : null}
      {children ? <View style={label || value !== undefined || icon ? [styles.content, compact && styles.contentCompact] : undefined}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    backgroundColor: "rgba(10, 10, 12, 0.9)",
    borderColor: "rgba(255, 148, 48, 0.72)",
    borderRadius: 16,
    borderWidth: 1,
    elevation: 4,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 7,
  },
  standard: { padding: 12 },
  compact: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8 },
  topHighlight: {
    backgroundColor: "rgba(255, 216, 149, 0.13)",
    height: 1,
    left: 10,
    position: "absolute",
    right: 10,
    top: 1,
  },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  labelGroup: { alignItems: "center", flexDirection: "row", flexShrink: 1 },
  icon: { marginRight: 5 },
  label: { color: "#F6C76A", fontSize: 11, fontWeight: "900", letterSpacing: 0.8 },
  labelCompact: { fontSize: 8, letterSpacing: 0.6 },
  value: { color: "#FFF7E8", fontSize: 18, fontWeight: "900", marginLeft: 8 },
  valueCompact: { fontSize: 13, marginLeft: 5 },
  valueLeft: { textAlign: "left" },
  valueCenter: { flex: 1, textAlign: "center" },
  content: { marginTop: 8 },
  contentCompact: { marginTop: 5 },
});
