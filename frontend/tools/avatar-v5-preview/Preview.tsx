import React, { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import FlattenedStandardProof from "../../src/avatar-v5/proof/FlattenedStandardProof";

export const PREVIEW_SIZES = [128, 192, 256] as const;
export default function Preview() {
  const [size, setSize] = useState<number>(192);
  const [dark, setDark] = useState(false);
  const [generation, setGeneration] = useState(0);
  const foreground = dark ? "#ffffff" : "#171717";
  const button = { padding: 12, margin: 4, borderWidth: 1, borderColor: foreground };
  return <ScrollView style={{ flex: 1, backgroundColor: dark ? "#171717" : "#ffffff" }}
    contentContainerStyle={{ alignItems: "center", paddingHorizontal: 8, paddingTop: 48, paddingBottom: 40 }}>
    <Text accessibilityRole="header" style={{ color: foreground, fontSize: 20 }}>Avatar V5 proof preview</Text>
    <Text style={{ color: foreground, textAlign: "center", margin: 12 }}>One flattened composite. No wardrobe or layered customization.</Text>
    <View style={{ width: size, height: size }}>
      <FlattenedStandardProof key={generation} size={size} fallback={
        <View accessible accessibilityRole="text" accessibilityLabel="Avatar proof unavailable or loading"
          style={{ width: size, height: size, alignItems: "center", justifyContent: "center", backgroundColor: "#d8d8d8" }}>
          <Text style={{ color: "#171717", textAlign: "center" }}>Avatar proof unavailable or loading</Text>
        </View>
      } />
    </View>
    <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center" }}>
      {PREVIEW_SIZES.map((value) => <Pressable key={value} style={button} accessibilityRole="button"
        accessibilityLabel={`Preview size ${value}`} accessibilityState={{ selected: size === value }} onPress={() => setSize(value)}>
        <Text style={{ color: foreground }}>{value}</Text>
      </Pressable>)}
    </View>
    <View style={{ flexDirection: "row" }}>
      {[false, true].map((value) => <Pressable key={String(value)} style={button} accessibilityRole="button"
        accessibilityLabel={`${value ? "Dark" : "Light"} preview background`} accessibilityState={{ selected: dark === value }} onPress={() => setDark(value)}>
        <Text style={{ color: foreground }}>{value ? "Dark" : "Light"}</Text>
      </Pressable>)}
    </View>
    <Pressable style={button} accessibilityRole="button" accessibilityLabel="Remount avatar proof" onPress={() => setGeneration((value) => value + 1)}>
      <Text style={{ color: foreground }}>Remount proof</Text>
    </Pressable>
  </ScrollView>;
}
