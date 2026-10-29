import * as NavigationBar from "expo-navigation-bar";
import { useEffect } from "react";
import { AppState, Platform } from "react-native";

async function hideAndroidNavigationBar(): Promise<void> {
  if (Platform.OS !== "android") return;
  // setVisibilityAsync remains supported with Android edge-to-edge enabled.
  // Startup/reveal behavior is configured by the Expo config plugin rather
  // than runtime position/behavior calls, which SDK 54 does not support in
  // edge-to-edge mode.
  NavigationBar.setStyle("dark");
  await NavigationBar.setVisibilityAsync("hidden");
}

export function useAndroidImmersiveMode(): void {
  useEffect(() => {
    let mounted = true;
    const apply = () => {
      if (!mounted || Platform.OS !== "android") return;
      void hideAndroidNavigationBar().catch(() => {
        // System UI control can be unavailable briefly during an Activity
        // transition. The next foreground event safely reapplies it.
      });
    };

    apply();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") apply();
    });
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);
}
