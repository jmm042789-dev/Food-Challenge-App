
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
    <View style={styles.container}>
      <Text style={styles.icon}>{icon}</Text>

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
  },
  icon: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "900",
    textAlign: "center",
  },
  message: {
    color: "#B8B8B8",
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
