import { AVATAR_V5_LAYER_ORDER, sortAvatarV5Parts, sortAvatarV5Passes } from "./layers";
import type { AvatarV5BodyId, AvatarV5Catalog, AvatarV5CatalogItem, AvatarV5HeadwearFit, AvatarV5Part, AvatarV5Slot } from "./types";

// Expo/Metro must see literal require("...png") calls. Never construct asset paths.
// No production-ready artwork exists yet; do not register invented item IDs.
export const AVATAR_V5_CATALOG: AvatarV5Catalog = Object.freeze({});
const own = <T>(record: Readonly<Record<string, T>>, key: string): T | undefined =>
  Object.prototype.hasOwnProperty.call(record, key) ? record[key] : undefined;

export function avatarV5Item(id: string, catalog: AvatarV5Catalog = AVATAR_V5_CATALOG): AvatarV5CatalogItem | undefined {
  return own(catalog, id);
}
export function avatarV5ItemsForBody(bodyId: AvatarV5BodyId, catalog: AvatarV5Catalog = AVATAR_V5_CATALOG): readonly AvatarV5CatalogItem[] {
  return Object.values(catalog).filter((item) => own(item.variants, bodyId));
}

export type AvatarV5Resolution = Readonly<{
  requestedId: string | null;
  resolvedId: string | null;
  outcome: "selected" | "starterFallback" | "omitted" | "useExistingAvatar";
  parts: readonly AvatarV5Part[];
}>;
export type AvatarV5ResolveRequest = Readonly<{
  id: string | null;
  slot: AvatarV5Slot;
  bodyId: AvatarV5BodyId;
  starterId?: string;
  colorwayId?: string;
  headwearFit?: AvatarV5HeadwearFit;
  selectedItemIds?: readonly string[];
}>;

function compatibleParts(item: AvatarV5CatalogItem | undefined, request: AvatarV5ResolveRequest): readonly AvatarV5Part[] | undefined {
  if (!item || item.slot !== request.slot) return undefined;
  if (item.compatibility.incompatibleItemIds?.some((id) => request.selectedItemIds?.includes(id))) return undefined;
  const variant = own(item.variants, request.bodyId);
  if (!variant) return undefined;
  const alternative = request.headwearFit && variant.headwearAlternatives
    ? own(variant.headwearAlternatives, request.headwearFit) : undefined;
  // A full cover suppresses hair unless an explicit approved alternative exists.
  if (item.slot === "hair" && request.headwearFit === "full-cover" && !alternative) return [];
  const sourceParts = alternative ?? variant.parts;
  // Invalid artwork is rejected as a unit, rather than showing a half-dressed body.
  if (!sourceParts.length || sourceParts.some((part) => !AVATAR_V5_LAYER_ORDER.includes(part.layer))) return undefined;
  const parts = sortAvatarV5Parts(sourceParts).map((part) => {
    const passes = request.colorwayId && part.authoredColorways
      ? own(part.authoredColorways, request.colorwayId) ?? part.passes : part.passes;
    return { ...part, passes: sortAvatarV5Passes(passes) };
  });
  if (parts.some((part) => !part.passes.length || part.passes.some((pass) =>
    pass.source == null || (pass.tint !== undefined && pass.treatment !== "fill")))) return undefined;
  if (item.slot === "body" && (!parts.some((part) => part.layer === "bodySkin")
    || !parts.some((part) => part.layer === "modestyUnderlayer"))) return undefined;
  return parts;
}

// Pure resolution only. No storage, network, retry, equipment writes or renderer activation.
export function resolveAvatarV5Item(request: AvatarV5ResolveRequest, catalog: AvatarV5Catalog = AVATAR_V5_CATALOG): AvatarV5Resolution {
  const required = ["body", "face", "top", "bottom", "shoes"].includes(request.slot);
  if (request.id !== null) {
    const parts = compatibleParts(avatarV5Item(request.id, catalog), request);
    if (parts) return { requestedId: request.id, resolvedId: request.id, outcome: "selected", parts };
  }
  // null means deliberately absent for optional items, not a request for starter artwork.
  if ((required || request.id !== null) && request.starterId) {
    const parts = compatibleParts(avatarV5Item(request.starterId, catalog), { ...request, colorwayId: undefined });
    if (parts) return { requestedId: request.id, resolvedId: request.starterId, outcome: "starterFallback", parts };
  }
  return { requestedId: request.id, resolvedId: null, outcome: required ? "useExistingAvatar" : "omitted", parts: [] };
}
