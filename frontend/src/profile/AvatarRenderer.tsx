import React, { memo, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { AVATAR_OPTIONS, type AvatarCategory, type AvatarConfiguration } from "./PlayerIdentity";

function option(category: AvatarCategory, id: string) {
  return AVATAR_OPTIONS[category].find((item) => item.id === id) ?? AVATAR_OPTIONS[category][0];
}

function AvatarRenderer({ configuration, size = 132 }: { configuration: AvatarConfiguration; size?: number }) {
  const visual = useMemo(() => ({
    background: option("background", configuration.background).color,
    skin: option("skinTone", configuration.skinTone).color,
    hair: option("hair", configuration.hair).preview,
    hairColor: option("hairColor", configuration.hairColor).color,
    eyes: option("eyes", configuration.eyes).preview,
    facialHair: option("facialHair", configuration.facialHair).preview,
    glasses: option("glasses", configuration.glasses).preview,
    headwear: option("headwear", configuration.headwear).preview,
    clothing: option("clothing", configuration.clothing),
    accessory: option("accessory", configuration.accessory).preview,
  }), [configuration]);
  const scale = size / 132;
  return <View accessibilityLabel="Customized Fire Feast avatar" style={[styles.stage, { backgroundColor: visual.background, borderRadius: size / 2, height: size, width: size }]}>
    <View style={[styles.clothing, { backgroundColor: visual.clothing.color, borderRadius: 22 * scale, bottom: -10 * scale, height: 55 * scale, width: 98 * scale }]}><Text style={[styles.clothingMark, { fontSize: 18 * scale }]}>{visual.clothing.preview}</Text></View>
    <View style={[styles.face, { backgroundColor: visual.skin, borderRadius: 36 * scale, height: 78 * scale, top: 30 * scale, width: 72 * scale }]}>
      <Text style={[styles.hair, { color: visual.hairColor, fontSize: 25 * scale, top: -17 * scale }]}>{visual.hair}</Text>
      <Text style={[styles.eyes, { fontSize: 14 * scale, top: 24 * scale }]}>{visual.eyes}</Text>
      {configuration.glasses !== "none" ? <Text style={[styles.glasses, { fontSize: 15 * scale, top: 21 * scale }]}>{visual.glasses}</Text> : null}
      {configuration.facialHair !== "none" ? <Text style={[styles.facialHair, { fontSize: 14 * scale, top: 48 * scale }]}>{visual.facialHair}</Text> : null}
    </View>
    {configuration.headwear !== "none" ? <Text style={[styles.headwear, { fontSize: 29 * scale, top: 2 * scale }]}>{visual.headwear}</Text> : null}
    {configuration.accessory !== "none" ? <Text style={[styles.accessory, { fontSize: 19 * scale, right: 15 * scale, top: 75 * scale }]}>{visual.accessory}</Text> : null}
  </View>;
}
export default memo(AvatarRenderer);

const styles = StyleSheet.create({
  stage: { alignItems: "center", borderColor: "#E8A54A", borderWidth: 2, justifyContent: "center", overflow: "hidden" },
  clothing: { alignItems: "center", borderColor: "rgba(255,219,155,0.4)", borderWidth: 1, position: "absolute" },
  clothingMark: { color: "#FFD06A", fontWeight: "900", marginTop: 7 },
  face: { alignItems: "center", borderColor: "rgba(255,237,204,0.5)", borderWidth: 1, position: "absolute" },
  hair: { fontWeight: "900", position: "absolute" }, eyes: { color: "#241513", fontWeight: "900", position: "absolute" },
  glasses: { color: "#171216", fontWeight: "900", position: "absolute" }, facialHair: { color: "#3A211B", fontWeight: "900", position: "absolute" },
  headwear: { position: "absolute" }, accessory: { color: "#FFD06A", fontWeight: "900", position: "absolute" },
});
