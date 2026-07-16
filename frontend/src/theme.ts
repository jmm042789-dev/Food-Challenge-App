export const theme = {
  colors: {
    // Core Fire Feast palette
    primary: "#FF4D2D",
    brandSecondary: "#FF7A18",

    // Background system
    background: "#0B0D12",
    surface: "#1C1F26",
    surface2: "#2A2E39",

    // Text system
    text: "#FFFFFF",
    textMuted: "#A1A1AA",

    // Reward / economy colors
    gold: "#FFD27D",
    coin: "#F5C542",

    // Status colors
    success: "#22C55E",
    danger: "#EF4444",
    warning: "#F59E0B",
  },

  spacing: {
    xxs: 4,
    xs: 6,
    sm: 10,
    md: 16,
    lg: 24,
    xl: 32,
    screen: 18,
    section: 22,
    cardGap: 12,
  },

  typography: {
    display: { fontSize: 30, lineHeight: 36, letterSpacing: 0.8 },
    screenTitle: { fontSize: 26, lineHeight: 32, letterSpacing: 0.5 },
    sectionTitle: { fontSize: 21, lineHeight: 27, letterSpacing: 0.35 },
    cardTitle: { fontSize: 18, lineHeight: 23, letterSpacing: 0.2 },
    label: { fontSize: 11, lineHeight: 14, letterSpacing: 0.8 },
    value: { fontSize: 18, lineHeight: 22, letterSpacing: 0.15 },
    body: { fontSize: 14, lineHeight: 20, letterSpacing: 0 },
    caption: { fontSize: 12, lineHeight: 16, letterSpacing: 0.1 },
  },

  radius: {
    sm: 10,
    md: 16,
    lg: 20,
    xl: 28,
  },

  shadow: {
    soft: {
      shadowColor: "#000",
      shadowOpacity: 0.3,
      shadowRadius: 10,
      elevation: 6,
    },
    glow: {
      shadowColor: "#FF4D2D",
      shadowOpacity: 0.4,
      shadowRadius: 12,
      elevation: 8,
    },
  },
};
