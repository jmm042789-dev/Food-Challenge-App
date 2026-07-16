import React from "react";
import { ImageBackground, StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import FirePanel from "./FirePanel";

type Props = { title?: string; subtitle?: string; badge?: React.ReactNode; image?: any; highlighted?: boolean; selected?: boolean; disabled?: boolean; compact?: boolean; onPress?: () => void; children?: React.ReactNode; style?: StyleProp<ViewStyle> };

export default function FireCard({ title, subtitle, badge, image, highlighted = false, selected = false, disabled = false, compact = false, onPress, children, style }: Props) {
  return <FirePanel compact={compact} elevated={highlighted || selected} accent={highlighted || selected ? "featured" : "default"} onPress={disabled ? undefined : onPress} style={[styles.card, disabled && styles.disabled, style]}>
    {badge ? <View style={styles.badge}>{badge}</View> : null}
    {image ? <ImageBackground source={image} style={styles.image} imageStyle={styles.imageRadius} /> : null}
    {title ? <Text style={styles.title}>{title}</Text> : null}
    {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    {children ? <View style={(title || subtitle || image) ? styles.children : undefined}>{children}</View> : null}
  </FirePanel>;
}

const styles = StyleSheet.create({ card: { marginBottom: 12 }, disabled: { opacity: 0.5 }, badge: { position: "absolute", right: 14, top: 14, zIndex: 2 }, image: { height: 140, marginBottom: 14 }, imageRadius: { borderRadius: 13 }, title: { color: "#FFF7E8", fontSize: 21, fontWeight: "900" }, subtitle: { color: "#F6C76A", fontSize: 14, fontWeight: "700", marginTop: 5 }, children: { marginTop: 14 } });
