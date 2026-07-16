import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type TabIconProps = {
  color: string;
  focused: boolean;
  name: React.ComponentProps<typeof Ionicons>["name"];
};

function TabIcon({ color, focused, name }: TabIconProps) {
  return (
    <View style={[styles.iconFrame, focused && styles.iconFrameActive]}>
      <Ionicons name={name} size={21} color={color} />
    </View>
  );
}

export default function Layout() {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 5);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: styles.scene,
        tabBarHideOnKeyboard: true,
        tabBarStyle: [styles.tabBar, { height: 55 + bottomInset, paddingBottom: bottomInset }],
        tabBarBackground: () => <View pointerEvents="none" style={styles.tabBarBackground}><View style={styles.topHighlight} /></View>,
        tabBarActiveTintColor: "#FFC45A",
        tabBarInactiveTintColor: "#8F7868",
        tabBarItemStyle: styles.tabItem,
        tabBarLabelStyle: styles.tabLabel,
        tabBarIconStyle: styles.tabIcon,
      }}
    >
      <Tabs.Screen name="home" options={{ title: "Home", tabBarIcon: ({ color, focused }) => <TabIcon name="home" color={color} focused={focused} /> }} />
      <Tabs.Screen name="contests" options={{ title: "Contests", tabBarIcon: ({ color, focused }) => <TabIcon name="trophy" color={color} focused={focused} /> }} />
      <Tabs.Screen name="shop" options={{ title: "Shop", tabBarIcon: ({ color, focused }) => <TabIcon name="cart" color={color} focused={focused} /> }} />
      <Tabs.Screen name="leaderboard" options={{ title: "Ranks", tabBarIcon: ({ color, focused }) => <TabIcon name="podium" color={color} focused={focused} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: ({ color, focused }) => <TabIcon name="person" color={color} focused={focused} /> }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  scene: { backgroundColor: "#070405" },
  tabBar: { backgroundColor: "transparent", borderTopColor: "rgba(237,148,54,0.64)", borderTopWidth: 1, elevation: 12, paddingTop: 4, shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.38, shadowRadius: 8 },
  tabBarBackground: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(8,6,7,0.98)" },
  topHighlight: { backgroundColor: "rgba(255,196,90,0.18)", height: 1, left: 12, position: "absolute", right: 12, top: 1 },
  tabItem: { borderRadius: 9, marginHorizontal: 1 },
  tabIcon: { height: 27 },
  tabLabel: { fontSize: 9, fontWeight: "900", letterSpacing: 0.25, lineHeight: 11, marginTop: 0 },
  iconFrame: { alignItems: "center", borderColor: "transparent", borderRadius: 9, borderWidth: 1, height: 27, justifyContent: "center", width: 38 },
  iconFrameActive: { backgroundColor: "rgba(126,55,14,0.46)", borderColor: "rgba(241,151,51,0.48)" },
});
