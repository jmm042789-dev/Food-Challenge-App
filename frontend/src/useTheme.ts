import { theme } from "./theme";
// Safe access layer (prevents undefined crashes)
export const useTheme = () => {
  return {
    colors: {
      background: theme?.colors?.background ?? "#0B0D12",
      surface: theme?.colors?.surface ?? "#1C1F26",
      surface2: theme?.colors?.surface2 ?? "#2A2E39",

      primary: theme?.colors?.primary ?? "#FF4D2D",
      brandSecondary: theme?.colors?.brandSecondary ?? "#FF7A18",

      text: theme?.colors?.text ?? "#FFFFFF",
      textMuted: theme?.colors?.textMuted ?? "#A1A1AA",

      gold: theme?.colors?.gold ?? "#FFD27D",
    },

    spacing: theme?.spacing ?? {
      xs: 6,
      sm: 10,
      md: 16,
      lg: 24,
      xl: 32,
    },

    radius: theme?.radius ?? {
      sm: 10,
      md: 16,
      lg: 20,
    },
  };
};