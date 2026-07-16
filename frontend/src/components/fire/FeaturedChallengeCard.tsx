
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import FireBadge from "./FireBadge";
import FireButton from "./FireButton";
import FirePanel from "./FirePanel";

type Props = {
  title: string;
  location: string;
  difficulty: string;
  prizePool: number;
  entryFee: number;
  duration: number;
  emoji: string;
  color?: string;
  onPress: () => void;
};

export default function FeaturedChallengeCard({
  title,
  location,
  difficulty,
  prizePool,
  entryFee,
  duration,
  emoji,
  color="#FF8A00",
  onPress,
}: Props) {
  return (
    <FirePanel highlighted borderColor={color}>
      <View style={styles.center}>
        <Text style={styles.hero}>{emoji}</Text>

        <FireBadge
          icon="🏆"
          label={difficulty}
          backgroundColor={color}
        />

        <Text style={styles.title}>{title}</Text>

        <View style={styles.divider} />

        <View style={styles.row}>
          <Text style={styles.info}>💰 ${prizePool}</Text>
          <Text style={styles.info}>🎟 {entryFee}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.info}>📍 {location}</Text>
          <Text style={styles.info}>⏱ {duration}s</Text>
        </View>

        <FireButton
          title="ENTER CHALLENGE"
          size="medium"
          onPress={onPress}
        />
      </View>
    </FirePanel>
  );
}

const styles = StyleSheet.create({
  center:{alignItems:"center"},
  hero:{fontSize:84,marginBottom:10},
  title:{
    color:"#FFF",
    fontSize:28,
    fontWeight:"900",
    textAlign:"center",
    marginTop:12,
  },
  divider:{
    width:"100%",
    height:2,
    backgroundColor:"rgba(255,255,255,0.12)",
    marginVertical:18,
  },
  row:{
    width:"100%",
    flexDirection:"row",
    justifyContent:"space-between",
    marginBottom:10,
  },
  info:{
    color:"#F2F2F2",
    fontSize:16,
    fontWeight:"700",
  },
});
