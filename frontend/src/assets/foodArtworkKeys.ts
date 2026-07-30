const FOOD_ARTWORK_ALIASES: Readonly<Record<string, string>> = {
  "hot-dog": "nathans-hotdogs",
  "hot-dogs": "nathans-hotdogs",
  hotdog: "nathans-hotdogs",
  hotdogs: "nathans-hotdogs",
};

export function normalizeFoodArtworkKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function resolveFoodArtworkKey(value: string): string {
  const normalized = normalizeFoodArtworkKey(value);
  return FOOD_ARTWORK_ALIASES[normalized] ?? normalized;
}
