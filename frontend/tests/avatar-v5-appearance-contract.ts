import type { AvatarV5Appearance } from "../src/avatar-v5/loadout";
import { beginAvatarV5Draft, editAvatarV5Draft, confirmAvatarV5Draft, type AvatarV5DraftState, type AvatarV5DraftEdit, type AvatarV5ConfirmationContext } from "../src/avatar-v5/appearanceDraft";
import type { AvatarV5RenderPlan } from "../src/avatar-v5/renderPlan";
import type { AvatarV5PaletteDefinitions } from "../src/avatar-v5/paletteResolution";

type Assert<T extends true> = T;
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
export type AppearanceOnly = Assert<Equal<Extract<keyof AvatarV5Appearance, "equippedGear" | "modifiers" | "stats">, never>>;
export type NoAuthorityContext = Assert<Equal<Extract<keyof AvatarV5ConfirmationContext, "save" | "equip" | "modifiers">, never>>;
export type DraftFields = Assert<Equal<keyof AvatarV5DraftState, "saved" | "draft">>;
// Never invoked. Compile-time assertions must fail if the editing boundary broadens.
function contracts(state: AvatarV5DraftState, context: AvatarV5ConfirmationContext, plan: AvatarV5RenderPlan, palettes: AvatarV5PaletteDefinitions) {
  editAvatarV5Draft(state, { type: "set", field: "bodyId", value: "broad" });
  editAvatarV5Draft(state, { type: "wardrobe", field: "apronId", value: null });
  // @ts-expect-error Saved baseline is readonly.
  state.saved = state.draft;
  // @ts-expect-error Deep appearance field is readonly.
  state.draft.wardrobe.topId = "another";
  // @ts-expect-error Visibility is readonly.
  state.draft.gearVisibility.hat = false;
  // @ts-expect-error Colorway map is readonly.
  state.draft.itemColorways.shirt = "red";
  // @ts-expect-error Palette definitions are readonly.
  palettes.skin.example = [];
  // @ts-expect-error Equipment is not an editable appearance field.
  const equipment: AvatarV5DraftEdit = { type: "set", field: "equippedGear", value: "gear" };
  // @ts-expect-error Version cannot be edited.
  editAvatarV5Draft(state, { type: "set", field: "schemaVersion", value: 5 });
  // @ts-expect-error Required wardrobe slots cannot be null.
  editAvatarV5Draft(state, { type: "wardrobe", field: "topId", value: null });
  // @ts-expect-error Field/value pairs remain correlated.
  editAvatarV5Draft(state, { type: "set", field: "bodyId", value: "male" });
  // @ts-expect-error Render plans are not draft states or confirmation inputs.
  confirmAvatarV5Draft(plan, context);
  const r = confirmAvatarV5Draft(state, context);
  if (r.ok) {
    // @ts-expect-error Confirmation candidates are readonly.
    r.candidate.skinTone.value = 20;
  }
  const start = beginAvatarV5Draft(null);
  if (!start.ok) {
    // @ts-expect-error Invalid input provides no usable state.
    start.state;
  }
  return equipment;
}
void contracts;
