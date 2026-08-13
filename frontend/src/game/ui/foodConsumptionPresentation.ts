export const PRESENTATION_BITES_PER_ITEM = 10;

export function foodConsumptionPresentation(acceptedTapCount: number, bitesPerItem = PRESENTATION_BITES_PER_ITEM) {
  const bites = Math.max(0, Math.floor(Number.isFinite(acceptedTapCount) ? acceptedTapCount : 0));
  const total = Math.max(1, Math.floor(Number.isFinite(bitesPerItem) ? bitesPerItem : PRESENTATION_BITES_PER_ITEM));
  const remainder = bites % total;
  const complete = bites > 0 && remainder === 0;
  const progress = complete ? 1 : Math.min(1, Math.max(0, remainder / total));
  return { progress, scale: Math.max(0, 1 - progress * 0.32), opacity: Math.max(0, 1 - progress * 0.5), complete };
}
