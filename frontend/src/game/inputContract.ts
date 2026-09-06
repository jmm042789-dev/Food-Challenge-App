export const INPUT_VALIDATION_VERSION = 3 as const;

export type NormalizedPoint = Readonly<{ x: number; y: number }>;
export type GameplayInputEvidence = Readonly<{
  source: "CONTROL" | "FOOD";
  x?: number;
  y?: number;
  start_x?: number;
  start_y?: number;
  end_x?: number;
  end_y?: number;
  duration_ms?: number;
}>;

export const normalizedCoordinate = (value: number, extent: number): number => {
  if (!Number.isFinite(value) || !Number.isFinite(extent) || extent <= 0) return 0;
  return Math.round(Math.min(1, Math.max(0, value / extent)) * 10_000) / 10_000;
};

export const controlTapEvidence = (x = 0.5, y = 0.5): GameplayInputEvidence => ({
  source: "CONTROL",
  x: Math.min(1, Math.max(0, x)),
  y: Math.min(1, Math.max(0, y)),
});
