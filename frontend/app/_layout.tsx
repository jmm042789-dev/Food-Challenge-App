import { Stack, useRouter, useSegments, type ErrorBoundaryProps } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { AppState, StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { AnimationProvider } from "@/src/animations";
import FireButton from "@/src/components/fire/FireButton";
import FirePanel from "@/src/components/fire/FirePanel";
import ArcadeBackground from "@/src/game/ui/ArcadeBackground";
import { disposeAudio, initializeAudio, pauseAllAudio, resumeAudio, stopMusic, transitionMusic } from "@/src/audio/AdaptiveAudioManager";
import { AppPreferencesProvider } from "@/src/preferences/AppPreferences";

export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  const router = useRouter();

  return (
    <GestureHandlerRootView style={styles.errorScreen}>
      <SafeAreaProvider>
        <ArcadeBackground />
        <View accessibilityRole="alert" style={styles.errorContent}>
          <FirePanel accent="gold" elevated style={styles.errorPanel}>
            <Text accessibilityRole="header" style={styles.errorTitle}>THE FLAME FLICKERED</Text>
            <Text style={styles.errorMessage}>Something unexpected happened. Your progress is still safe.</Text>
            <FireButton accessibilityLabel="Retry Fire Feast" fullWidth onPress={retry} title="RETRY" variant="gold" />
            <FireButton accessibilityLabel="Return to Home" fullWidth onPress={() => router.replace("/(tabs)/home")} title="RETURN HOME" variant="secondary" />
          </FirePanel>
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// Keep the native splash visible from cold start until icon fonts register.
// Required because @expo/vector-icons' componentDidMount fallback fires
// Font.loadAsync against a broken vendor path if any <Icon> mounts before
// the family is registered — which throws on Android Expo Go.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useIconFonts();
  const segments = useSegments();

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  useEffect(() => {
    void initializeAudio();
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") void resumeAudio();
      else pauseAllAudio();
    });
    return () => {
      subscription.remove();
      disposeAudio();
    };
  }, []);

  useEffect(() => {
    if (segments[0] === "play") void stopMusic(500);
    else void transitionMusic("MENU");
  }, [segments]);

  // If the CDN is unreachable we fall through on error rather than wedging
  // the app — icons will tofu, but the app still boots.
  if (!loaded && !error) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#070405" }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <AppPreferencesProvider>
          <AnimationProvider>
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#070405" } }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="play/[contestId]" options={{ presentation: "fullScreenModal", animation: "fade" }} />
            <Stack.Screen name="result" options={{ presentation: "fullScreenModal", animation: "fade" }} />
            <Stack.Screen name="matchmaking" options={{ animation: "fade" }} />
            <Stack.Screen name="tutorial" options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="settings" options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="legal/[document]" options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="daily-rewards" options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="achievements" options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="missions" options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="avatar-customization" options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="career" options={{ animation: "slide_from_right" }} />
            </Stack>
          </AnimationProvider>
        </AppPreferencesProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  errorScreen: { backgroundColor: "#070405", flex: 1 },
  errorContent: { flex: 1, justifyContent: "center", padding: 20 },
  errorPanel: { gap: 12, marginHorizontal: "auto", maxWidth: 420, width: "100%" },
  errorTitle: { color: "#FFF0D8", fontSize: 25, fontWeight: "900", textAlign: "center" },
  errorMessage: { color: "#CDBEAD", fontSize: 15, lineHeight: 22, marginBottom: 4, textAlign: "center" },
});
