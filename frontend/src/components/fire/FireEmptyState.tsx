
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import FireButton from "./FireButton";

type FireEmptyStateProps = {
  title?: string;
  message?: string;
  icon?: string;
  buttonLabel?: string;
  onPress?: () => void;
};

export default function FireEmptyState({
  title = "Nothing Here Yet",
  message = "There isn't anything to display right now.",
  icon = "🍔",
  buttonLabel,
  onPress,
}: FireEmptyStateProps) {
  return (
    <View accessibilityRole="alert" style={styles.container}>
      <View style={styles.iconFrame}><Text style={styles.icon}>{icon}</Text></View>

      <Text style={styles.title}>{title}</Text>

      <Text style={styles.message}>{message}</Text>

      {buttonLabel && onPress ? (
        <View style={styles.button}>
          <FireButton
            title={buttonLabel}
            onPress={onPress}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 260,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    margin: 16,
    backgroundColor: "rgba(18,12,13,0.92)",
    borderColor: "rgba(217,132,47,0.42)",
    borderRadius: 18,
    borderWidth: 1,
  },
  iconFrame: { alignItems: "center", backgroundColor: "rgba(91,40,16,0.55)", borderColor: "rgba(242,165,69,0.5)", borderRadius: 42, borderWidth: 1, height: 84, justifyContent: "center", marginBottom: 16, width: 84 },
  icon: {
    fontSize: 44,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "900",
    textAlign: "center",
  },
  message: {
    color: "#C9B7A5",
    fontSize: 15,
    textAlign: "center",
    marginTop: 10,
    maxWidth: 300,
    lineHeight: 22,
  },
  button: {
    marginTop: 24,
    width: "100%",
    maxWidth: 240,
  },
});
