import React, { type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

export default function CompactScreenHeader({ title, context, right }: { title: string; context?: string; right?: ReactNode }) {
  return <View style={styles.header}>
    <View style={styles.titleBlock}>
      {context ? <Text numberOfLines={1} style={styles.context}>{context}</Text> : null}
      <Text numberOfLines={1} adjustsFontSizeToFit style={styles.title}>{title}</Text>
    </View>
    {right ? <View style={styles.right}>{right}</View> : null}
  </View>;
}

const styles = StyleSheet.create({
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", minHeight: 48, minWidth: 0 },
  titleBlock: { flex: 1, minWidth: 0, paddingRight: 8 },
  context: { color: "#B98450", fontSize: 7, fontWeight: "900", letterSpacing: 1.5 },
  title: { color: "#FFF1DD", fontSize: 23, fontWeight: "900", letterSpacing: 1, lineHeight: 26 },
  right: { alignItems: "flex-end", flexShrink: 0 },
});
