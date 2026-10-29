import { avatarV5EquipmentVisualCandidates, type AvatarV5EquipmentMapping } from "./equipment";
import { sortAvatarV5Parts, sortAvatarV5Passes, type AvatarV5Layer } from "./layers";
import type { AvatarV5Appearance } from "./loadout";
import { avatarV5Item, resolveAvatarV5Item, type AvatarV5Resolution } from "./registry";
import type { AvatarV5BodyId, AvatarV5Catalog, AvatarV5CatalogItem, AvatarV5EquipmentVisualInput, AvatarV5Part, AvatarV5Pass, AvatarV5Slot, AvatarV5TintChannel } from "./types";

export type AvatarV5RenderInput = Readonly<{
  appearance: AvatarV5Appearance;
  catalog: AvatarV5Catalog;
  bodyItemIds: Readonly<Partial<Record<AvatarV5BodyId, string>>>;
  starterIds?: Readonly<Partial<Record<AvatarV5Slot, string>>>;
  tintColors: Readonly<Partial<Record<AvatarV5TintChannel, string>>>;
  equipment: AvatarV5EquipmentVisualInput;
  equipmentMappings?: readonly AvatarV5EquipmentMapping[];
}>;
export type AvatarV5RenderSelection = AvatarV5Resolution & Readonly<{
  slot: AvatarV5Slot;
  origin: "wardrobe" | "performance" | "cosmetic";
}>;
export type AvatarV5RenderPass = Readonly<{
  key: string; itemId: string; partId: string; passId: string;
  layer: AvatarV5Layer; treatment: AvatarV5Pass["treatment"];
  source: AvatarV5Pass["source"]; tintColor?: string;
}>;
export type AvatarV5RenderPlan = Readonly<{
  status: "ready"; mode: "FULL_BODY"; passes: readonly AvatarV5RenderPass[];
  selections: readonly AvatarV5RenderSelection[];
}> | Readonly<{
  status: "fallback"; reasons: readonly string[];
  selections: readonly AvatarV5RenderSelection[];
}>;
type Resolved = { item: AvatarV5CatalogItem; parts: readonly AvatarV5Part[]; priority: number };
const own = <T>(record: Readonly<Record<string, T>>, key: string): T | undefined =>
  Object.prototype.hasOwnProperty.call(record, key) ? record[key] : undefined;
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const conflicts = (a: AvatarV5CatalogItem, b: AvatarV5CatalogItem) =>
  a.compatibility.incompatibleItemIds?.includes(b.id) || b.compatibility.incompatibleItemIds?.includes(a.id);

// Bounded composition only: no state writes, inferred IDs, palette defaults or retries.
export function buildAvatarV5RenderPlan(input: AvatarV5RenderInput): AvatarV5RenderPlan {
  const { appearance: a, catalog } = input;
  const selections: AvatarV5RenderSelection[] = [];
  const reasons: string[] = [];
  const fallback = (): AvatarV5RenderPlan => ({ status: "fallback", reasons, selections });
  const requests: readonly (readonly [AvatarV5Slot, string | null])[] = [
    ["body", own(input.bodyItemIds, a.bodyId) ?? null], ["face", a.faceId],
    ["top", a.wardrobe.topId], ["bottom", a.wardrobe.bottomId], ["shoes", a.wardrobe.shoesId],
    ["socks", a.wardrobe.socksId], ["apron", a.wardrobe.apronId], ["headwear", a.wardrobe.headwearId],
    ["eyewear", a.wardrobe.eyewearId], ["neckAccessory", a.wardrobe.neckAccessoryId],
    ["wristAccessory", a.wardrobe.wristAccessoryId], ["miscAccessory", a.wardrobe.miscAccessoryId],
    ["facialHair", a.facialHairId], ["background", a.backgroundId], ["effect", a.effectId],
  ];
  let active: Resolved[] = [];
  function resolve(slot: AvatarV5Slot, id: string | null, origin: AvatarV5RenderSelection["origin"], headwearFit?: AvatarV5CatalogItem["compatibility"]["headwearFit"]): Resolved | undefined {
    const result = resolveAvatarV5Item({ id, slot, bodyId: a.bodyId,
      starterId: origin === "wardrobe" ? own(input.starterIds ?? {}, slot) : undefined,
      colorwayId: id === null ? undefined : own(a.itemColorways, id), headwearFit,
    }, catalog);
    selections.push({ ...result, slot, origin });
    if (result.resolvedId === null) {
      if (origin === "wardrobe" && result.outcome === "useExistingAvatar") reasons.push(`missing-required:${slot}`);
      return undefined;
    }
    const item = avatarV5Item(result.resolvedId, catalog)!;
    if (item.id !== result.resolvedId) { reasons.push(`catalog-id-mismatch:${result.resolvedId}`); return undefined; }
    return { item, parts: result.parts, priority: origin === "cosmetic" ? 2 : origin === "performance" ? 1 : 0 };
  }
  for (const [slot, id] of requests) {
    const resolved = resolve(slot, id, "wardrobe");
    if (resolved) active.push(resolved);
  }
  // Required base wardrobe must be valid even when an outfit might cover it.
  if (reasons.length) return fallback();
  const candidates = [...avatarV5EquipmentVisualCandidates(input.equipment, a.gearVisibility, input.equipmentMappings)]
    .sort((x, y) => Number(x.kind === "cosmetic") - Number(y.kind === "cosmetic")
      || compare(x.slot, y.slot) || compare(x.backendId, y.backendId));
  const seenCandidateSlots = new Set<string>();
  for (const candidate of candidates) {
    const candidateKey = `${candidate.kind}:${candidate.slot}`;
    if (seenCandidateSlots.has(candidateKey)) { reasons.push(`ambiguous-override:${candidateKey}`); return fallback(); }
    seenCandidateSlots.add(candidateKey);
    const slot = candidate.slot === "hat" ? "headwear" : candidate.slot === "outfit" ? "top" : "apron";
    const resolved = resolve(slot, candidate.visualItemId, candidate.kind);
    if (!resolved) continue;
    const remaining = active.filter((entry) => entry.item.slot !== slot);
    // Check both directions, including hair whose final fit is resolved below.
    const hairItem = a.hairId === null ? undefined : avatarV5Item(a.hairId, catalog);
    if (remaining.some((entry) => conflicts(entry.item, resolved.item))
      || (hairItem && conflicts(hairItem, resolved.item))) continue;
    active = [...remaining, resolved];
  }
  if (reasons.length) return fallback();
  const headwear = active.find((entry) => entry.item.slot === "headwear")?.item;
  const hair = resolve("hair", a.hairId, "wardrobe", headwear?.compatibility.headwearFit);
  if (hair && !headwear?.compatibility.hidesHair) active.push(hair);
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      if (conflicts(active[i].item, active[j].item)) reasons.push(`incompatible:${active[i].item.id}:${active[j].item.id}`);
    }
  }
  // Coverage is explicit and atomic. Partial removal of multipart items is unsupported.
  const covered = new Set<string>();
  for (const overlay of active) {
    const covers = overlay.item.compatibility.covers ?? [];
    if (covers.includes("modestyUnderlayer") || covers.includes("bodySkin")) reasons.push(`protected-coverage:${overlay.item.id}`);
    for (const under of active) {
      if (under === overlay || under.priority > overlay.priority || !under.parts.some((part) => covers.includes(part.layer))) continue;
      if (under.item.slot === "body" || !under.parts.every((part) => covers.includes(part.layer))) {
        reasons.push(`partial-coverage:${overlay.item.id}:${under.item.id}`);
      } else if (!under.parts.every((part) => overlay.parts.some((replacement) => replacement.layer === part.layer))) {
        reasons.push(`unbacked-coverage:${overlay.item.id}:${under.item.id}`);
      } else covered.add(under.item.id);
    }
  }
  // A covered item may not itself suppress another item: reject chains/cycles.
  for (const entry of active) if (covered.has(entry.item.id) && entry.item.compatibility.covers?.length) reasons.push(`coverage-chain:${entry.item.id}`);
  if (reasons.length) return fallback();
  active = active.filter((entry) => !covered.has(entry.item.id));
  const parts = active.flatMap(({ item, parts: itemParts }) => itemParts.map((part) => ({ ...part, itemId: item.id })));
  const passes: AvatarV5RenderPass[] = [];
  const keys = new Set<string>();
  const partKeys = new Set<string>();
  // Stable item pre-sort supplies the final tie-break without changing Step 2C ordering.
  for (const part of sortAvatarV5Parts(parts.sort((x, y) => compare(x.itemId, y.itemId)))) {
    const partKey = JSON.stringify([part.itemId, part.id]);
    if (partKeys.has(partKey)) reasons.push(`duplicate-part:${partKey}`);
    partKeys.add(partKey);
    for (const pass of sortAvatarV5Passes(part.passes)) {
      const key = JSON.stringify([part.itemId, part.id, pass.id]);
      if (keys.has(key)) reasons.push(`duplicate-pass:${key}`);
      keys.add(key);
      const tintColor = pass.tint === undefined ? undefined : own(input.tintColors, pass.tint);
      if (pass.tint !== undefined && (pass.treatment !== "fill" || !tintColor?.trim())) reasons.push(`missing-or-invalid-tint:${key}`);
      passes.push({ key, itemId: part.itemId, partId: part.id, passId: pass.id,
        layer: part.layer, treatment: pass.treatment, source: pass.source,
        ...(tintColor === undefined ? {} : { tintColor }) });
    }
  }
  return reasons.length ? fallback() : { status: "ready", mode: "FULL_BODY", passes, selections };
}
