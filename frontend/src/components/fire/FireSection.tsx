
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ViewStyle,
} from "react-native";

type FireSectionProps = {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onActionPress?: () => void;
  style?: ViewStyle;
  children?: React.ReactNode;
};

export default function FireSection({
  title,
  subtitle,
  actionLabel,
  onActionPress,
  style,
  children,
}: FireSectionProps) {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.headerRow}>
        <View style={styles.textBlock}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? (
            <Text style={styles.subtitle}>{subtitle}</Text>
          ) : null}
        </View>

        {actionLabel ? (
          <Pressable
            style={styles.actionButton}
            onPress={onActionPress}
          >
            <Text style={styles.actionText}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.content}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 22,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  textBlock: {
    flex: 1,
    paddingRight: 12,
  },
  title: {
    color: "#FFD54A",
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  subtitle: {
    color: "#BDBDBD",
    fontSize: 13,
    marginTop: 4,
  },
  actionButton: {
    backgroundColor: "#FF8A00",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  actionText: {
    color: "#FFF",
    fontWeight: "900",
    fontSize: 12,
    letterSpacing: 0.5,
  },
  content: {
    gap: 12,
  },
});
