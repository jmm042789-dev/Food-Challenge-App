import type { AvatarV5Appearance } from "./loadout";
import { assessAvatarV5Selections, freezeAppearanceDiagnostics, isAppearanceId, snapshotAppearance, validateAvatarV5Appearance, type AppearanceDiagnostic, type AppearanceSelectionContext } from "./appearanceValidation";
import { resolveAvatarV5TintColors, type AvatarV5PaletteDefinitions } from "./paletteResolution";
export type AvatarV5DraftState = Readonly<{ saved: AvatarV5Appearance; draft: AvatarV5Appearance }>;
type Fields = Exclude<keyof AvatarV5Appearance, "schemaVersion" | "wardrobe" | "itemColorways" | "gearVisibility">;
export type AvatarV5DraftEdit = {
  [K in Fields]: Readonly<{ type: "set"; field: K; value: AvatarV5Appearance[K] }>
}[Fields] | {
  [K in keyof AvatarV5Appearance["wardrobe"]]: Readonly<{ type: "wardrobe"; field: K; value: AvatarV5Appearance["wardrobe"][K] }>
}[keyof AvatarV5Appearance["wardrobe"]]
  | Readonly<{ type: "visibility"; field: keyof AvatarV5Appearance["gearVisibility"]; value: boolean }>
  | Readonly<{ type: "colorway"; itemId: string; value: string | null }>;
export type AvatarV5DraftResult = Readonly<{ ok: true; state: AvatarV5DraftState; diagnostics: readonly AppearanceDiagnostic[] }
  | { ok: false; state: AvatarV5DraftState; diagnostics: readonly AppearanceDiagnostic[] }>;
export type AvatarV5ConfirmationContext = AppearanceSelectionContext & Readonly<{ palettes: AvatarV5PaletteDefinitions }>;
export type AvatarV5Confirmation = Readonly<{ ok: true; candidate: AvatarV5Appearance; diagnostics: readonly AppearanceDiagnostic[] }
  | { ok: false; state: AvatarV5DraftState; diagnostics: readonly AppearanceDiagnostic[] }>;
const makeState = (saved: AvatarV5Appearance, draft: AvatarV5Appearance): AvatarV5DraftState => Object.freeze({ saved, draft });
export function beginAvatarV5Draft(input: unknown): Readonly<{ ok: true; state: AvatarV5DraftState } | { ok: false; diagnostics: readonly AppearanceDiagnostic[] }> {
  const result = validateAvatarV5Appearance(input, { allowIncomplete: true });
  return result.ok ? Object.freeze({ ok: true, state: makeState(snapshotAppearance(result.appearance), snapshotAppearance(result.appearance)) }) : result;
}
export function resetAvatarV5Draft(state: AvatarV5DraftState, reset: unknown): AvatarV5DraftResult {
  const result = validateAvatarV5Appearance(reset, { allowIncomplete: true });
  return result.ok ? Object.freeze({ ok: true, state: makeState(state.saved, result.appearance), diagnostics: result.diagnostics })
    : Object.freeze({ ok: false, state, diagnostics: result.diagnostics });
}
export function editAvatarV5Draft(state: AvatarV5DraftState, edit: AvatarV5DraftEdit): AvatarV5DraftResult {
  const invalid = (): AvatarV5DraftResult => Object.freeze({ ok: false, state,
    diagnostics: freezeAppearanceDiagnostics([{ path: "edit", code: "invalid-edit", severity: "error" }]) });
  if (!edit || typeof edit !== "object" || ![Object.prototype, null].includes(Object.getPrototypeOf(edit))) return invalid();
  const descriptor = Object.getOwnPropertyDescriptor(edit, "type");
  if (!descriptor || !("value" in descriptor)) return invalid();
  const keys = descriptor.value === "colorway" ? ["type", "itemId", "value"] : ["type", "field", "value"];
  if (Reflect.ownKeys(edit).length !== 3 || Reflect.ownKeys(edit).some((key) => typeof key !== "string" || !keys.includes(key)
    || !("value" in Object.getOwnPropertyDescriptor(edit, key)!))) return invalid();
  let next: AvatarV5Appearance = state.draft;
  switch (edit.type) {
    case "set":
      if (!["presentation", "bodyId", "skinTone", "faceId", "eyeColorId", "hairId", "hairColor", "facialHairId", "effectId", "backgroundId"].includes(edit.field)) return invalid();
      next = { ...next, [edit.field]: edit.value }; break;
    case "wardrobe":
      if (!Object.prototype.hasOwnProperty.call(next.wardrobe, edit.field)) return invalid();
      next = { ...next, wardrobe: { ...next.wardrobe, [edit.field]: edit.value } }; break;
    case "visibility":
      if (!["hat", "apron", "outfit"].includes(edit.field)) return invalid();
      next = { ...next, gearVisibility: { ...next.gearVisibility, [edit.field]: edit.value } }; break;
    case "colorway": {
      if (!isAppearanceId(edit.itemId)) return invalid();
      const colors = { ...next.itemColorways };
      if (edit.value === null) delete colors[edit.itemId]; else colors[edit.itemId] = edit.value;
      next = { ...next, itemColorways: colors }; break;
    }
    default: return invalid();
  }
  return resetAvatarV5Draft(state, next);
}
export function cancelAvatarV5Draft(state: AvatarV5DraftState): AvatarV5Appearance { return snapshotAppearance(state.saved); }
export function confirmAvatarV5Draft(state: AvatarV5DraftState, context: AvatarV5ConfirmationContext): AvatarV5Confirmation {
  const shape = validateAvatarV5Appearance(state.draft);
  if (!shape.ok) return Object.freeze({ ok: false, state, diagnostics: shape.diagnostics });
  const selections = assessAvatarV5Selections(shape.appearance, context);
  const tints = resolveAvatarV5TintColors(shape.appearance, context.palettes);
  const diagnostics = freezeAppearanceDiagnostics([...selections, ...tints.diagnostics]);
  return diagnostics.some((d) => d.severity === "error") ? Object.freeze({ ok: false, state, diagnostics })
    : Object.freeze({ ok: true, candidate: snapshotAppearance(shape.appearance), diagnostics });
}
