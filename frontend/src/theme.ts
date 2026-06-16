import { Platform } from "react-native";

export const theme = {
  c: {
    surface: "#0F1115",
    surfaceSecondary: "#1C1F26",
    surfaceTertiary: "#2A2E39",
    onSurface: "#FFFFFF",
    onSurfaceSecondary: "#D1D5DB",
    onSurfaceTertiary: "#A1A8B5",
    brand: "#FF2A00",
    brandSecondary: "#FFB800",
    brandTertiary: "#E05A00",
    success: "#39FF14",
    error: "#FF2A00",
    border: "#2A2E39",
    borderStrong: "#4B5563",
  },
  s: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 },
  r: { sm: 6, md: 12, lg: 20, pill: 999 },
  f: {
    display: Platform.select({ ios: "Impact", android: "sans-serif-condensed", default: "System" }) as string,
    text: Platform.select({ ios: "System", android: "sans-serif", default: "System" }) as string,
  },
  fs: { sm: 12, base: 14, lg: 16, xl: 20, xxl: 24, xxxl: 36, hero: 52 },
};

export type Theme = typeof theme;
