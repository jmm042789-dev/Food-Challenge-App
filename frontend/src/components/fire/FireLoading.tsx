
import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

type FireLoadingProps = {
  title?: string;
  subtitle?: string;
};

export default function FireLoading({
  title = "Loading...",
  subtitle = "Preparing your feast",
}: FireLoadingProps) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#FF8A00" />

      <Text style={styles.title}>{title}</Text>

      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 220,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  title: {
    marginTop: 18,
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900",
  },
  subtitle: {
    marginTop: 8,
    color: "#A9A9A9",
    fontSize: 14,
    textAlign: "center",
  },
});
