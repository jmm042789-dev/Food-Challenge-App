import React, { memo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import FirePanel from "../components/fire/FirePanel";

export type CareerStat = { label: string; value: string | number; placeholder?: boolean };

function CareerSection({ title, subtitle, stats, initiallyOpen = true, largeText = false, children }: { title: string; subtitle?: string; stats?: readonly CareerStat[]; initiallyOpen?: boolean; largeText?: boolean; children?: React.ReactNode }) {
  const [open, setOpen] = useState(initiallyOpen);
  return <FirePanel compact>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen((current) => !current)} style={styles.header}>
      <View style={styles.headerCopy}><Text style={[styles.title, largeText && styles.largeTitle]}>{title}</Text>{subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}</View><Text style={styles.chevron}>{open ? "−" : "+"}</Text>
    </Pressable>
    {open ? <View style={styles.body}>{stats?.map((stat) => <View accessible accessibilityLabel={`${stat.label}: ${stat.value}`} key={stat.label} style={styles.row}><Text style={[styles.label, largeText && styles.largeLabel]}>{stat.label}</Text><Text style={[styles.value, stat.placeholder && styles.placeholder, largeText && styles.largeValue]}>{stat.value}</Text></View>)}{children}</View> : null}
  </FirePanel>;
}
export default memo(CareerSection);

const styles = StyleSheet.create({
  header: { alignItems: "center", flexDirection: "row", minHeight: 48 }, headerCopy: { flex: 1 }, title: { color: "#F2C47D", fontSize: 14, fontWeight: "900", letterSpacing: 0.9 }, largeTitle: { fontSize: 18 },
  subtitle: { color: "#9E8572", fontSize: 9, marginTop: 2 }, chevron: { color: "#FFD06A", fontSize: 24, fontWeight: "700", paddingHorizontal: 8 },
  body: { borderTopColor: "rgba(225,143,58,0.22)", borderTopWidth: 1, marginTop: 5, paddingTop: 5 }, row: { alignItems: "center", borderBottomColor: "rgba(220,145,69,0.13)", borderBottomWidth: 1, flexDirection: "row", flexWrap: "wrap", minHeight: 43, paddingHorizontal: 3, paddingVertical: 5 },
  label: { color: "#BDA58E", flex: 1, flexBasis: 130, fontSize: 11, fontWeight: "800", minWidth: 120 }, largeLabel: { fontSize: 14 }, value: { color: "#FFF0D8", flexShrink: 1, fontSize: 12, fontWeight: "900", minWidth: 90, textAlign: "right" }, largeValue: { fontSize: 15 }, placeholder: { color: "#8E7B70", fontSize: 9 },
});
