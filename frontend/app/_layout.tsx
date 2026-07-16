import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { AnimationProvider } from "@/src/animations";

// Keep the native splash visible from cold start until icon fonts register.
// Required because @expo/vector-icons' componentDidMount fallback fires
// Font.loadAsync against a broken vendor path if any <Icon> mounts before
// the family is registered — which throws on Android Expo Go.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useIconFonts();

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  // If the CDN is unreachable we fall through on error rather than wedging
  // the app — icons will tofu, but the app still boots.
  if (!loaded && !error) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#070405" }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <AnimationProvider>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#070405" } }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="play/[contestId]" options={{ presentation: "fullScreenModal", animation: "fade" }} />
            <Stack.Screen name="result" options={{ presentation: "fullScreenModal", animation: "fade" }} />
            <Stack.Screen name="matchmaking" options={{ animation: "fade" }} />
            <Stack.Screen name="tutorial" options={{ animation: "slide_from_right" }} />
          </Stack>
        </AnimationProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
