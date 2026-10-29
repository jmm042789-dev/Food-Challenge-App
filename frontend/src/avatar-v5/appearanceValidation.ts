import { AVATAR_V5_UNASSIGNED, type AvatarV5Appearance } from "./loadout";
import { AVATAR_V5_BODY_IDS, AVATAR_V5_PRESENTATIONS, type AvatarV5BodyId, type AvatarV5Catalog, type AvatarV5CatalogItem, type AvatarV5SelectionState, type AvatarV5Slot } from "./types";

export type AppearanceDiagnostic = Readonly<{ path: string; code: string; severity: "error" | "warning" }>;
export type AppearanceValidation = Readonly<
  { ok: true; appearance: AvatarV5Appearance; diagnostics: readonly AppearanceDiagnostic[] } |
  { ok: false; diagnostics: readonly AppearanceDiagnostic[] }
>;
export type AppearanceSelectionContext = Readonly<{
  catalog: AvatarV5Catalog;
  availability: Readonly<Record<string, AvatarV5SelectionState>>;
  bodyItemIds: Readonly<Partial<Record<AvatarV5BodyId, string>>>;
}>;
const unsafe = (key: string) => ["__proto__", "prototype", "constructor"].includes(key);
export const isAppearanceId = (value: unknown): value is string => typeof value === "string"
  && value.length <= 128 && value.trim() === value && !unsafe(value) && (value === AVATAR_V5_UNASSIGNED || /^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(value));
export const ownAppearanceValue = <T>(map: Readonly<Record<string, T>>, key: string): T | undefined =>
  Object.prototype.hasOwnProperty.call(map, key) ? map[key] : undefined;
export function freezeAppearanceDiagnostics(diagnostics: AppearanceDiagnostic[]): readonly AppearanceDiagnostic[] {
  return Object.freeze(diagnostics.map((d) => Object.freeze(d)));
}
// Call only after structural validation. Every nested appearance container is copied.
export function snapshotAppearance(a: AvatarV5Appearance): AvatarV5Appearance {
  return Object.freeze({ ...a, skinTone: Object.freeze({ ...a.skinTone }), hairColor: Object.freeze({ ...a.hairColor }),
    wardrobe: Object.freeze({ ...a.wardrobe }), itemColorways: Object.freeze({ ...a.itemColorways }), gearVisibility: Object.freeze({ ...a.gearVisibility }) });
}
export function validateAvatarV5Appearance(input: unknown, options: Readonly<{ allowIncomplete?: boolean }> = {}): AppearanceValidation {
  const diagnostics: AppearanceDiagnostic[] = [];
  const issue = (path: string, code: string) => { diagnostics.push({ path, code, severity: "error" }); };
  const at = (path: string, key: string) => path ? `${path}.${key}` : key;
  function object(value: unknown, path: string, keys?: readonly string[]): Record<string, unknown> | undefined {
    if (!value || typeof value !== "object" || Array.isArray(value)
      || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) { issue(path, "invalid-object"); return; }
    const record = value as Record<string, unknown>;
    let safe = true;
    for (const key of Reflect.ownKeys(record).sort((a, b) => String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0)) {
      if (typeof key !== "string") { issue(path, "unexpected-symbol"); safe = false; continue; }
      if (unsafe(key)) { issue(at(path, key), "unsafe-key"); safe = false; }
      else if (keys && !keys.includes(key)) issue(at(path, key), "unexpected-field");
      const descriptor = Object.getOwnPropertyDescriptor(record, key)!;
      if (!("value" in descriptor) || !descriptor.enumerable) { issue(at(path, key), "invalid-property"); safe = false; }
    }
    if (!safe) return;
    if (keys) for (const key of keys) if (!Object.prototype.hasOwnProperty.call(record, key)) issue(at(path, key), "missing-field");
    return record;
  }
  function id(value: unknown, path: string, nullable = false) {
    if (nullable && value === null) return;
    if (!isAppearanceId(value)) issue(path, "invalid-id");
    else if (value === AVATAR_V5_UNASSIGNED && !options.allowIncomplete) issue(path, "unassigned");
  }
  function palette(value: unknown, path: string) {
    const p = object(value, path, ["paletteId", "value"]); if (!p) return;
    id(p.paletteId, `${path}.paletteId`);
    if (typeof p.value !== "number" || !Number.isFinite(p.value) || p.value < 0 || p.value > 100) issue(`${path}.value`, "invalid-palette-value");
  }
  const a = object(input, "", ["schemaVersion", "presentation", "bodyId", "skinTone", "faceId", "eyeColorId", "hairId", "hairColor", "facialHairId", "wardrobe", "itemColorways", "effectId", "backgroundId", "gearVisibility"]);
  if (a) {
    if (a.schemaVersion !== 5) issue("schemaVersion", "invalid-version");
    if (!(AVATAR_V5_PRESENTATIONS as readonly unknown[]).includes(a.presentation)) issue("presentation", "invalid-enum");
    if (!(AVATAR_V5_BODY_IDS as readonly unknown[]).includes(a.bodyId)) issue("bodyId", "invalid-enum");
    palette(a.skinTone, "skinTone"); palette(a.hairColor, "hairColor");
    for (const key of ["faceId", "eyeColorId", "backgroundId"]) id(a[key], key);
    for (const key of ["hairId", "facialHairId", "effectId"]) id(a[key], key, true);
    const wardrobe = object(a.wardrobe, "wardrobe", ["topId", "bottomId", "shoesId", "socksId", "apronId", "headwearId", "eyewearId", "neckAccessoryId", "wristAccessoryId", "miscAccessoryId"]);
    if (wardrobe) for (const key of Object.keys(wardrobe).sort()) id(wardrobe[key], `wardrobe.${key}`, !["topId", "bottomId", "shoesId"].includes(key));
    const colors = object(a.itemColorways, "itemColorways");
    if (colors) for (const key of Object.keys(colors).sort()) { id(key, `itemColorways.${key}`); id(colors[key], `itemColorways.${key}`); }
    const visibility = object(a.gearVisibility, "gearVisibility", ["hat", "apron", "outfit"]);
    if (visibility) for (const key of ["hat", "apron", "outfit"]) if (typeof visibility[key] !== "boolean") issue(`gearVisibility.${key}`, "invalid-boolean");
  }
  const frozen = freezeAppearanceDiagnostics(diagnostics);
  return diagnostics.length ? Object.freeze({ ok: false, diagnostics: frozen })
    : Object.freeze({ ok: true, appearance: snapshotAppearance(input as AvatarV5Appearance), diagnostics: frozen });
}

// Does not resolve replacements or import the renderer. Missing art is a warning,
// not a reason to rewrite or prohibit an otherwise permitted selection.
export function assessAvatarV5Selections(a: AvatarV5Appearance, context: AppearanceSelectionContext): readonly AppearanceDiagnostic[] {
  const diagnostics: AppearanceDiagnostic[] = [];
  const issue = (path: string, code: string, severity: "error" | "warning" = "error") => diagnostics.push({ path, code, severity });
  const requests: [string, AvatarV5Slot, string | null | undefined][] = [
    ["bodyId", "body", ownAppearanceValue(context.bodyItemIds, a.bodyId)], ["faceId", "face", a.faceId],
    ["hairId", "hair", a.hairId], ["facialHairId", "facialHair", a.facialHairId],
    ["effectId", "effect", a.effectId], ["backgroundId", "background", a.backgroundId],
  ];
  const slots: Record<keyof AvatarV5Appearance["wardrobe"], AvatarV5Slot> = {
    topId: "top", bottomId: "bottom", shoesId: "shoes", socksId: "socks", apronId: "apron", headwearId: "headwear", eyewearId: "eyewear",
    neckAccessoryId: "neckAccessory", wristAccessoryId: "wristAccessory", miscAccessoryId: "miscAccessory",
  };
  for (const key of Object.keys(slots) as (keyof typeof slots)[]) requests.push([`wardrobe.${key}`, slots[key], a.wardrobe[key]]);
  const selected: { path: string; item: AvatarV5CatalogItem }[] = [];
  for (const [path, slot, id] of requests) {
    if (id === null) continue;
    if (id === undefined) { issue(path, "missing-body-mapping"); continue; }
    if (id === AVATAR_V5_UNASSIGNED) { issue(path, "unassigned"); continue; }
    const item = ownAppearanceValue(context.catalog, id);
    if (!item) { issue(path, "unknown-item"); continue; }
    if (item.id !== id) issue(path, "catalog-id-mismatch");
    if (item.slot !== slot) issue(path, "wrong-slot");
    const availability = ownAppearanceValue(context.availability, id);
    if (availability === "lockedPreview") issue(path, "locked-selection");
    else if (availability !== "owned" && availability !== "available") issue(path, "unknown-availability");
    const variant = ownAppearanceValue(item.variants, a.bodyId);
    if (!variant) issue(path, "missing-geometry-variant");
    else if (!variant.parts.length || variant.parts.some((part) => !part.passes.length || part.passes.some((pass) => pass.source == null))) issue(path, "missing-artwork", "warning");
    selected.push({ path, item });
  }
  for (let i = 0; i < selected.length; i++) for (let j = i + 1; j < selected.length; j++) {
    const x = selected[i], y = selected[j];
    if (x.item.compatibility.incompatibleItemIds?.includes(y.item.id) || y.item.compatibility.incompatibleItemIds?.includes(x.item.id)) {
      issue(x.path, "incompatible-selection"); issue(y.path, "incompatible-selection");
    }
  }
  // Retain dormant colorway preferences, but validate their item and geometry too.
  for (const id of Object.keys(a.itemColorways).sort()) {
    const path = `itemColorways.${id}`, item = ownAppearanceValue(context.catalog, id);
    if (!item) { issue(path, "unknown-item"); continue; }
    const variant = ownAppearanceValue(item.variants, a.bodyId);
    if (!variant) { issue(path, "missing-geometry-variant"); continue; }
    const access = ownAppearanceValue(context.availability, id);
    if (access === "lockedPreview") issue(path, "locked-selection");
    else if (access !== "available" && access !== "owned") issue(path, "unknown-availability");
    const colorway = a.itemColorways[id];
    const parts = [...variant.parts, ...Object.values(variant.headwearAlternatives ?? {}).flatMap((v) => v ?? [])];
    const authored = parts.flatMap((p) => ownAppearanceValue(p.authoredColorways ?? {}, colorway) ?? []);
    if (!parts.some((p) => Object.prototype.hasOwnProperty.call(p.authoredColorways ?? {}, colorway))) issue(path, "invalid-colorway");
    else if (!authored.length || authored.some((pass) => pass.source == null)) issue(path, "missing-artwork", "warning");
  }
  return freezeAppearanceDiagnostics(diagnostics);
}
