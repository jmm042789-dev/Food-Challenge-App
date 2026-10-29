import React, { memo, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { AVATAR_OPTIONS, resolveHairColor, resolveSkinTone, sanitizeAvatar, type AvatarCategory, type AvatarConfiguration } from "./PlayerIdentity";
import { anchoredBox, AVATAR_ANCHORS, AVATAR_BOARD_SIZE, renderModeForSize } from "./avatarGeometry";

type EquippedGearSlots = Partial<Record<"hat" | "apron" | "outfit", string>>;
type Palette = { primary: string; accent: string; dark: string };
const option = (category: AvatarCategory, id: string) => AVATAR_OPTIONS[category].find((item) => item.id === id) ?? AVATAR_OPTIONS[category][0];
const SET_PALETTES: Record<string, Palette> = { shannon: { primary: "#22685C", accent: "#69D0B2", dark: "#123D36" }, lynette: { primary: "#693B7C", accent: "#D38BE5", dark: "#3B2148" }, brittany: { primary: "#285F88", accent: "#80C8F0", dark: "#163A59" } };
const gearPalette = (id: string | undefined, fallback: Palette): Palette => { const set = Object.keys(SET_PALETTES).find((name) => id?.includes(name)); if (set) return SET_PALETTES[set]; const colors: Record<string, string> = { gold: "#D6A52F", cool: "#398997", combo: "#987238", heat: "#B23B2C", ember: "#B84827", champion: "#E6D8B6" }; const key = Object.keys(colors).find((name) => id?.includes(name)); return key ? { primary: colors[key], accent: "#F4D48A", dark: "#40281E" } : fallback; };

function Hair({ id, primary, highlight, back = false }: { id: string; primary: string; highlight: string; back?: boolean }) {
  if (back && !["long", "ponytail", "braids"].includes(id)) return null;
  if (!back && id === "long") return <View style={[styles.hairCap, { backgroundColor: primary, borderColor: highlight }]}><View style={[styles.hairHighlight, { backgroundColor: highlight }]} /></View>;
  if (back) return <><View style={[styles.backHair, { backgroundColor: primary }]} />{id === "ponytail" ? <View style={[styles.ponytail, { backgroundColor: primary, borderColor: highlight }]} /> : null}</>;
  if (id === "shaved") return <View style={[styles.buzz, { backgroundColor: primary, borderColor: highlight }]} />;
  if (id === "fade") return <><View style={[styles.fade, { backgroundColor: primary, borderColor: highlight }]} /><View style={[styles.fadeLine, { backgroundColor: highlight }]} /></>;
  if (id === "curls" || id === "waves" || id === "braids") return <View style={styles.hairCluster}>{[0, 1, 2, 3, 4].map((n) => <View key={n} style={[styles.hairLobe, id === "braids" && styles.braidLobe, { backgroundColor: n === 2 ? highlight : primary }]} />)}</View>;
  if (id === "mohawk" || id === "spiked") return <View style={styles.spikes}>{[20, 29, 24, 18].map((height, n) => <View key={`${height}-${n}`} style={[styles.spike, { backgroundColor: n === 1 ? highlight : primary, height: id === "mohawk" ? height + 5 : height }]} />)}</View>;
  return <View style={[styles.hairCap, { backgroundColor: primary, borderColor: highlight }]}><View style={[styles.hairHighlight, { backgroundColor: highlight }]} /></View>;
}

function Face({ avatar, skin, hair, detailed }: { avatar: AvatarConfiguration; skin: string; hair: string; detailed: boolean }) {
  const geometry = avatar.base === "round" ? { width: 70, radius: 34 } : avatar.base === "square" ? { width: 73, radius: 20 } : avatar.base === "oval" ? { width: 64, radius: 31 } : avatar.base === "soft" ? { width: 67, radius: 28 } : { width: 69, radius: 23 };
  const eyeHeight = avatar.eyes === "happy" || avatar.eyes === "wink" ? 3 : avatar.eyes === "intense" ? 5 : 8;
  return <>
    <View style={[styles.ear, anchoredBox("left_ear", 12, 18), { backgroundColor: skin }]} /><View style={[styles.ear, anchoredBox("right_ear", 12, 18), { backgroundColor: skin }]} />
    <View style={[styles.head, { backgroundColor: skin, borderRadius: geometry.radius, left: AVATAR_ANCHORS.head_center.x - geometry.width / 2, width: geometry.width }]}>
      <View style={styles.faceShade} /><View style={styles.faceHighlight} />
      <View style={[styles.eyeRow, anchoredBox("eyes", 47, 12), { left: (geometry.width - 47) / 2, top: 25 }]}><View style={[styles.eye, { height: eyeHeight }, avatar.eyes === "bold" && styles.boldEye]} /><View style={[styles.eye, { height: avatar.eyes === "wink" ? 2 : eyeHeight }, avatar.eyes === "bold" && styles.boldEye]} /></View>
      {detailed ? <><View style={styles.browRow}><View style={[styles.brow, avatar.eyes === "intense" && styles.leftIntense]} /><View style={[styles.brow, avatar.eyes === "intense" && styles.rightIntense]} /></View><View style={styles.nose} /><View style={[styles.mouth, avatar.eyes === "happy" && styles.happyMouth]} /></> : null}
      {detailed && avatar.accessory === "bandage" ? <View style={styles.bandage} /> : null}
      {detailed ? <FacialHair id={avatar.facialHair} color={hair} /> : null}
      {avatar.glasses !== "none" ? <Glasses id={avatar.glasses} /> : null}
    </View>
  </>;
}

function FacialHair({ id, color }: { id: string; color: string }) {
  if (id === "none") return null;
  if (id === "stubble") return <View style={[styles.stubble, { borderColor: color }]} />;
  if (id === "mustache") return <View style={[styles.mustache, { backgroundColor: color }]} />;
  if (id === "goatee") return <><View style={[styles.mustache, { backgroundColor: color }]} /><View style={[styles.goatee, { backgroundColor: color }]} /></>;
  return <View style={[styles.beard, id === "full_beard" && styles.fullBeard, { backgroundColor: color }]} />;
}
function Glasses({ id }: { id: string }) { return <View style={[styles.glasses, id === "sport" && styles.sportGlasses]}><View style={[styles.lens, id === "round" && styles.roundLens, ["shades", "sport"].includes(id) && styles.tintLens]} /><View style={styles.bridge} /><View style={[styles.lens, id === "round" && styles.roundLens, ["shades", "sport"].includes(id) && styles.tintLens]} /></View>; }

function Outfit({ style, palette, detailed }: { style: string; palette: Palette; detailed: boolean }) {
  const wide = style === "grill" || style === "champion";
  return <View style={[styles.torso, wide && styles.wideTorso, { backgroundColor: palette.primary, borderColor: palette.dark }]}><View style={[styles.shoulderLight, { borderColor: palette.accent }]} />
    {detailed && ["jacket", "champion", "classic"].includes(style) ? <><View style={[styles.lapel, styles.leftLapel, { borderColor: palette.accent }]} /><View style={[styles.lapel, styles.rightLapel, { borderColor: palette.accent }]} /></> : null}
    {detailed && style === "chefcoat" ? <View style={styles.buttons}>{[0, 1, 2, 3].map((n) => <View key={n} style={[styles.button, { backgroundColor: palette.dark }]} />)}</View> : null}
    {style === "hoodie" ? <View style={[styles.hood, { borderColor: palette.accent }]} /> : null}
    {style === "street" ? <View style={[styles.streetStripe, { backgroundColor: palette.accent }]} /> : null}
  </View>;
}

function Apron({ id, palette, detailed }: { id: string; palette: Palette; detailed: boolean }) {
  if (id === "none") return null;
  const waist = id === "waist";
  return <View style={[styles.apron, waist && styles.waistApron, id === "grill" && styles.grillApron, { backgroundColor: palette.primary, borderColor: palette.accent }]}>{!waist ? <View style={[styles.apronStrap, { borderColor: palette.accent }]} /> : null}{detailed ? <View style={[styles.apronPocket, { borderColor: palette.accent }]} /> : null}</View>;
}

function Headwear({ id, palette, gearId }: { id: string; palette: Palette; gearId?: string }) {
  const gear = Boolean(gearId);
  if (id === "none" && !gear) return null;
  const style = gearId?.includes("shannon") ? "chef" : gearId?.includes("lynette") ? "visor" : gearId?.includes("brittany") ? "cap" : gear ? "gear" : id;
  if (style === "chef" || style === "gear") return <View style={styles.toque}><View style={[styles.toquePuff, { backgroundColor: gear ? palette.accent : "#FFF0D8", borderColor: palette.dark }]} /><View style={[styles.toqueBand, { backgroundColor: palette.primary, borderColor: palette.accent }]} /></View>;
  if (style === "crown") return <View style={[styles.crown, { borderBottomColor: palette.primary, borderLeftColor: "transparent", borderRightColor: "transparent" }]} />;
  if (["bandana", "flame"].includes(style)) return <View style={[styles.headBand, { backgroundColor: palette.accent }]} />;
  if (style === "visor") return <View style={[styles.visor, { backgroundColor: palette.primary, borderColor: palette.accent }]} />;
  return <View style={[styles.cap, style === "back_cap" && styles.backCap, { backgroundColor: palette.primary, borderColor: palette.accent }]}><View style={[styles.capBill, style === "back_cap" && styles.backBill, { backgroundColor: palette.accent }]} /></View>;
}

function Accessory({ id, palette }: { id: string; palette: Palette }) {
  if (id === "earring") return <View style={[styles.earring, { backgroundColor: palette.accent }]} />;
  if (id === "hoops") return <><View style={[styles.hoop, styles.leftHoop, { borderColor: palette.accent }]} /><View style={[styles.hoop, styles.rightHoop, { borderColor: palette.accent }]} /></>;
  if (id === "necklace" || id === "medal") return <View style={[styles.necklace, { borderColor: palette.accent }]}>{id === "medal" ? <View style={[styles.medal, { backgroundColor: palette.accent }]} /> : null}</View>;
  if (id === "scarf") return <View style={[styles.scarf, { backgroundColor: palette.accent, borderColor: palette.dark }]} />;
  if (id === "badge") return <View style={[styles.badge, { backgroundColor: palette.accent }]} />;
  if (id === "wristband") return <View accessibilityLabel="Heat band on visible arm" style={[styles.armBand, { backgroundColor: palette.accent, borderColor: palette.dark }]} />;
  return null;
}

function AvatarRenderer({ configuration, size = 132, equippedGearSlots }: { configuration: AvatarConfiguration; size?: number; equippedGearSlots?: EquippedGearSlots }) {
  const avatar = useMemo(() => sanitizeAvatar(configuration), [configuration]);
  const visual = useMemo(() => { const outfit = option("outfitColor", avatar.outfitColor); const background = option("background", avatar.background); return { skin: resolveSkinTone(avatar.skinToneValue), hair: resolveHairColor(avatar.hairColorValue), outfit: { primary: outfit.color!, accent: outfit.secondaryColor!, dark: "#3A211D" }, background }; }, [avatar]);
  const mode = renderModeForSize(size); const detailed = mode === "detailed"; const scale = size / AVATAR_BOARD_SIZE;
  const outfit = gearPalette(equippedGearSlots?.outfit, visual.outfit); const apron = gearPalette(equippedGearSlots?.apron, { primary: visual.outfit.accent, accent: "#FFE0A0", dark: visual.outfit.dark }); const hat = gearPalette(equippedGearSlots?.hat, visual.outfit);
  const outfitGear = equippedGearSlots?.outfit; const apronGear = equippedGearSlots?.apron;
  const effectiveOutfit = outfitGear?.includes("shannon") ? "chefcoat" : outfitGear?.includes("lynette") ? "champion" : outfitGear?.includes("brittany") ? "classic" : outfitGear ? "champion" : avatar.clothing;
  const effectiveApron = apronGear?.includes("shannon") ? "trimmed" : apronGear?.includes("lynette") ? "competition" : apronGear?.includes("brittany") ? "classic" : apronGear ? "tester" : avatar.apron;
  return <View accessibilityLabel="Customized Fire Feast competitor" accessibilityRole="image" style={[styles.stage, { backgroundColor: visual.background.color, borderColor: visual.background.secondaryColor, borderRadius: size * .22, height: size, width: size }]}><View style={[styles.board, { transform: [{ scale }] }]}>
    <View style={[styles.glow, { backgroundColor: visual.background.secondaryColor }]} /><View style={[styles.arenaRing, { borderColor: visual.background.secondaryColor }]} />
    <Hair id={avatar.hair} primary={visual.hair.color} highlight={visual.hair.secondaryColor} back />
    <Outfit style={effectiveOutfit} palette={outfit} detailed={detailed} />
    <View style={[styles.neck, { backgroundColor: visual.skin }]} />
    <Face avatar={avatar} skin={visual.skin} hair={visual.hair.color} detailed={mode !== "compact"} />
    <Hair id={avatar.hair} primary={visual.hair.color} highlight={visual.hair.secondaryColor} />
    <Headwear id={equippedGearSlots?.hat ? "none" : avatar.headwear} palette={hat} gearId={equippedGearSlots?.hat} />
    <Apron id={effectiveApron} palette={apron} detailed={detailed} />
    {mode !== "compact" ? <Accessory id={avatar.accessory} palette={visual.outfit} /> : null}
    <View style={[styles.frameShine, { borderColor: visual.background.secondaryColor }]} />
  </View></View>;
}
export default memo(AvatarRenderer);

const styles = StyleSheet.create({
  stage: { alignItems: "center", borderWidth: 2, justifyContent: "center", overflow: "hidden" }, board: { height: 132, width: 132 }, glow: { borderRadius: 50, height: 100, left: 16, opacity: .18, position: "absolute", top: 8, width: 100 }, arenaRing: { borderRadius: 50, borderWidth: 2, height: 96, left: 18, opacity: .22, position: "absolute", top: 12, width: 96 }, frameShine: { borderRadius: 27, borderRightWidth: 2, borderTopWidth: 2, height: 122, left: 5, opacity: .35, position: "absolute", top: 5, width: 122 },
  torso: { borderRadius: 28, borderWidth: 2, height: 57, left: 13, overflow: "hidden", position: "absolute", top: 96, width: 106 }, wideTorso: { left: 9, width: 114 }, shoulderLight: { borderRadius: 30, borderTopWidth: 3, height: 48, left: 5, opacity: .65, position: "absolute", top: 4, width: 92 }, lapel: { borderTopWidth: 3, height: 27, position: "absolute", top: 2, width: 31 }, leftLapel: { left: 24, transform: [{ rotate: "34deg" }] }, rightLapel: { right: 24, transform: [{ rotate: "-34deg" }] }, buttons: { flexDirection: "row", flexWrap: "wrap", gap: 5, left: 48, position: "absolute", top: 14, width: 12 }, button: { borderRadius: 2, height: 4, width: 4 }, hood: { borderRadius: 25, borderTopWidth: 4, height: 34, left: 22, position: "absolute", top: 1, width: 62 }, streetStripe: { height: 60, left: 49, opacity: .65, position: "absolute", top: 0, width: 8 },
  neck: { borderColor: "rgba(50,25,20,.35)", borderRadius: 10, borderWidth: 1, height: 27, left: 52, position: "absolute", top: 84, width: 28 }, ear: { borderColor: "rgba(50,25,20,.4)", borderRadius: 8, borderWidth: 1, position: "absolute" }, head: { borderColor: "rgba(255,239,216,.5)", borderWidth: 1.5, height: 76, overflow: "hidden", position: "absolute", top: 23 }, faceShade: { backgroundColor: "rgba(70,31,27,.11)", bottom: 0, height: 26, left: 0, position: "absolute", width: "100%" }, faceHighlight: { backgroundColor: "rgba(255,255,255,.14)", borderRadius: 25, height: 48, left: 6, position: "absolute", top: 5, width: 22 }, eyeRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", position: "absolute" }, eye: { backgroundColor: "#251519", borderRadius: 6, width: 9 }, boldEye: { borderColor: "#F3C96A", borderWidth: 1 }, browRow: { flexDirection: "row", justifyContent: "space-between", left: 12, position: "absolute", top: 20, width: 43 }, brow: { backgroundColor: "rgba(45,25,24,.72)", borderRadius: 2, height: 2, width: 13 }, leftIntense: { transform: [{ rotate: "12deg" }] }, rightIntense: { transform: [{ rotate: "-12deg" }] }, nose: { borderBottomColor: "rgba(80,40,32,.48)", borderBottomWidth: 1, borderRightColor: "rgba(80,40,32,.48)", borderRightWidth: 1, height: 9, left: 31, position: "absolute", top: 39, transform: [{ rotate: "24deg" }], width: 6 }, mouth: { borderBottomColor: "#773833", borderBottomWidth: 2, borderRadius: 8, bottom: 14, height: 5, left: 25, position: "absolute", width: 17 }, happyMouth: { borderBottomWidth: 3, height: 9 }, bandage: { backgroundColor: "#E8C79C", borderColor: "#9A7456", borderWidth: 1, height: 6, position: "absolute", right: 8, top: 45, transform: [{ rotate: "-18deg" }], width: 17 },
  backHair: { borderBottomLeftRadius: 26, borderBottomRightRadius: 26, height: 78, left: 27, position: "absolute", top: 24, width: 78 }, ponytail: { borderRadius: 18, borderWidth: 2, height: 48, position: "absolute", right: 20, top: 35, transform: [{ rotate: "-12deg" }], width: 24 }, hairCap: { borderBottomLeftRadius: 18, borderBottomRightRadius: 18, borderWidth: 1, height: 25, left: 32, overflow: "hidden", position: "absolute", top: 16, width: 68 }, hairHighlight: { borderRadius: 10, height: 5, left: 12, opacity: .55, position: "absolute", top: 5, transform: [{ rotate: "-8deg" }], width: 32 }, buzz: { borderRadius: 30, borderWidth: 1, height: 15, left: 35, position: "absolute", top: 22, width: 62 }, fade: { borderBottomLeftRadius: 17, borderBottomRightRadius: 17, borderWidth: 1, height: 23, left: 33, position: "absolute", top: 17, width: 67 }, fadeLine: { height: 3, left: 35, position: "absolute", top: 34, width: 20 }, hairCluster: { flexDirection: "row", left: 25, position: "absolute", top: 10 }, hairLobe: { borderRadius: 13, height: 24, marginLeft: -4, width: 24 }, braidLobe: { borderRadius: 6, height: 27, width: 17 }, spikes: { alignItems: "flex-end", flexDirection: "row", left: 26, position: "absolute", top: 4 }, spike: { borderTopLeftRadius: 15, borderTopRightRadius: 5, marginLeft: -5, transform: [{ rotate: "9deg" }], width: 21 },
  glasses: { alignItems: "center", flexDirection: "row", left: 6, position: "absolute", top: 24 }, sportGlasses: { transform: [{ skewX: "-8deg" }] }, lens: { borderColor: "#23191B", borderRadius: 4, borderWidth: 2, height: 17, width: 24 }, roundLens: { borderRadius: 13 }, tintLens: { backgroundColor: "rgba(22,20,30,.74)" }, bridge: { backgroundColor: "#23191B", height: 2, width: 7 }, stubble: { borderBottomWidth: 4, borderRadius: 20, bottom: 5, height: 20, left: 14, opacity: .38, position: "absolute", width: 40 }, mustache: { borderRadius: 8, bottom: 13, height: 6, left: 23, position: "absolute", width: 22 }, goatee: { borderBottomLeftRadius: 9, borderBottomRightRadius: 9, bottom: 1, height: 14, left: 29, position: "absolute", width: 10 }, beard: { borderBottomLeftRadius: 23, borderBottomRightRadius: 23, bottom: -2, height: 20, left: 13, opacity: .92, position: "absolute", width: 42 }, fullBeard: { height: 29, left: 9, width: 50 },
  apron: { borderBottomLeftRadius: 12, borderBottomRightRadius: 12, borderWidth: 2, height: 47, left: 39, position: "absolute", top: 102, width: 54 }, waistApron: { height: 24, top: 119, width: 60, left: 36 }, grillApron: { borderRadius: 5, width: 61, left: 35 }, apronStrap: { borderRadius: 15, borderTopWidth: 3, height: 19, left: 13, position: "absolute", top: -10, width: 25 }, apronPocket: { borderBottomLeftRadius: 7, borderBottomRightRadius: 7, borderWidth: 1, bottom: 6, height: 13, left: 14, position: "absolute", width: 23 },
  toque: { alignItems: "center", left: 29, position: "absolute", top: -3, width: 74 }, toquePuff: { borderRadius: 28, borderWidth: 1.5, height: 31, width: 68 }, toqueBand: { borderRadius: 5, borderWidth: 1.5, height: 15, marginTop: -6, width: 72 }, crown: { borderBottomWidth: 25, borderLeftWidth: 15, borderRightWidth: 15, height: 0, left: 36, position: "absolute", top: 0, width: 60 }, headBand: { borderRadius: 5, height: 8, left: 31, position: "absolute", top: 29, width: 70 }, visor: { borderBottomLeftRadius: 12, borderBottomRightRadius: 12, borderWidth: 2, height: 13, left: 31, position: "absolute", top: 22, width: 70 }, cap: { borderBottomLeftRadius: 15, borderBottomRightRadius: 15, borderWidth: 1.5, height: 21, left: 29, position: "absolute", top: 13, width: 74 }, backCap: { transform: [{ rotate: "-4deg" }] }, capBill: { borderRadius: 6, bottom: -4, height: 7, position: "absolute", right: -8, width: 35 }, backBill: { left: -8, right: undefined },
  earring: { borderColor: "#FFF0B0", borderRadius: 5, borderWidth: 1, height: 9, left: 27, position: "absolute", top: 61, width: 9 }, hoop: { borderRadius: 9, borderWidth: 2, height: 15, position: "absolute", top: 63, width: 11 }, leftHoop: { left: 25 }, rightHoop: { right: 25 }, necklace: { borderBottomWidth: 2, borderLeftWidth: 1, borderRadius: 20, borderRightWidth: 1, height: 25, left: 45, position: "absolute", top: 94, width: 42 }, medal: { borderRadius: 7, bottom: -4, height: 13, left: 14, position: "absolute", width: 13 }, scarf: { borderRadius: 7, borderWidth: 1, height: 13, left: 45, position: "absolute", top: 92, width: 42 }, badge: { borderRadius: 6, height: 12, left: 82, position: "absolute", top: 108, transform: [{ rotate: "8deg" }], width: 12 }, armBand: { borderRadius: 4, borderWidth: 1, height: 7, left: 12, position: "absolute", top: 111, transform: [{ rotate: "16deg" }], width: 20 },
});
