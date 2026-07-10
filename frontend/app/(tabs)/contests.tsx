import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ImageBackground,
} from "react-native";

import GameButton from "../../src/components/GameButton";
import GameCard from "../../src/components/GameCard";
import { theme } from "../../src/theme";

export default function ContestsScreen() {
  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* HEADER */}
        <Text style={styles.header}>🔥 FEAST ARENA</Text>

        {/* FEATURED EVENT 1 */}
        <ImageBackground
          source={{
            uri: "https://images.unsplash.com/photo-1600891964599-f61ba0e24092",
          }}
          style={styles.featuredCard}
          imageStyle={{ borderRadius: 18 }}
        >
          <View style={styles.badge}>
            <Text style={styles.badgeText}>FEATURED</Text>
          </View>

          <Text style={styles.title}>Hot Dog Hammer Finals</Text>
          <Text style={styles.prize}>$500 PRIZE POOL</Text>

          <View style={{ marginTop: 10 }}>
            <GameButton
              title="ENTER EVENT"
              onPress={() => console.log("enter event")}
            />
          </View>
        </ImageBackground>

        {/* FEATURED EVENT 2 */}
        <ImageBackground
          source={{
            uri: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1",
          }}
          style={styles.featuredCard}
          imageStyle={{ borderRadius: 18 }}
        >
          <View style={[styles.badge, { backgroundColor: theme.colors.gold }]}>
            <Text style={styles.badgeText}>LIMITED</Text>
          </View>

          <Text style={styles.title}>Burger Blaze Championship</Text>
          <Text style={styles.prize}>$300 PRIZE POOL</Text>

          <View style={{ marginTop: 10 }}>
            <GameButton
              title="ENTER EVENT"
              onPress={() => console.log("enter limited")}
            />
          </View>
        </ImageBackground>

        {/* STANDARD CONTESTS */}
        <GameCard title="Coney Beach Derby" subtitle="$250 PRIZE">
          <GameButton title="PLAY NOW" onPress={() => {}} />
        </GameCard>

        <GameCard title="Wing Inferno Challenge" subtitle="$150 PRIZE">
          <GameButton title="PLAY NOW" onPress={() => {}} />
        </GameCard>

        <GameCard title="Spicy Stack Showdown" subtitle="$100 PRIZE">
          <GameButton title="PLAY NOW" onPress={() => {}} />
        </GameCard>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },

  header: {
    color: theme.colors.primary,
    fontSize: 24,
    fontWeight: "900",
    marginTop: 60,
    marginLeft: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    letterSpacing: 1,
  },

  featuredCard: {
    margin: theme.spacing.md,
    padding: theme.spacing.md,
    height: 200,
    justifyContent: "space-between",
  },

  badge: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: "flex-start",
  },

  badgeText: {
    color: "white",
    fontWeight: "900",
    fontSize: 12,
  },

  title: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: "900",
  },

  prize: {
    color: theme.colors.gold,
    fontWeight: "800",
  },
});