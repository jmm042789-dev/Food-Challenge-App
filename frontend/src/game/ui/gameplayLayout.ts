export type MatchHudLayout = {
  centerWidth: number;
  horizontalPadding: number;
};

export function resolveMatchHudLayout(viewportWidth: number): MatchHudLayout {
  if (viewportWidth < 380) return { centerWidth: 66, horizontalPadding: 6 };
  return { centerWidth: 72, horizontalPadding: 9 };
}
