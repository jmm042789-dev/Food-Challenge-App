import { AVATAR_V5_UNASSIGNED, type AvatarV5Appearance, type AvatarV5PaletteSelection } from "./loadout";
import { freezeAppearanceDiagnostics, isAppearanceId, ownAppearanceValue, type AppearanceDiagnostic } from "./appearanceValidation";
export type AvatarV5PaletteStop = Readonly<{ value: number; color: string }>;
export type AvatarV5PaletteDefinitions = Readonly<{
  skin: Readonly<Record<string, readonly AvatarV5PaletteStop[]>>;
  hair: Readonly<Record<string, readonly AvatarV5PaletteStop[]>>;
  eyes: Readonly<Record<string, string>>;
}>;
export type PaletteResult<T> = Readonly<{ ok: true; value: T; diagnostics: readonly AppearanceDiagnostic[] } | { ok: false; diagnostics: readonly AppearanceDiagnostic[] }>;
const colorPattern = /^#[0-9a-fA-F]{6}$/;
const error = <T>(path: string, code: string): PaletteResult<T> => Object.freeze({ ok: false,
  diagnostics: freezeAppearanceDiagnostics([{ path, code, severity: "error" }]) });
export function resolveAvatarV5Palette(selection: AvatarV5PaletteSelection, definitions: Readonly<Record<string, readonly AvatarV5PaletteStop[]>>, path = "palette"): PaletteResult<string> {
  if (!selection || !isAppearanceId(selection.paletteId) || selection.paletteId === AVATAR_V5_UNASSIGNED) return error(path, "invalid-palette-id");
  if (!Number.isFinite(selection.value) || selection.value < 0 || selection.value > 100) return error(`${path}.value`, "invalid-palette-value");
  const stops = ownAppearanceValue(definitions, selection.paletteId);
  if (!stops) return error(`${path}.paletteId`, "unknown-palette");
  if (!Array.isArray(stops) || stops.length < 2 || stops[0]?.value !== 0 || stops[stops.length - 1]?.value !== 100
    || Array.from(stops).some((stop, i) => !stop || !Number.isFinite(stop.value) || stop.value < 0 || stop.value > 100
      || typeof stop.color !== "string" || (stop.color.length !== 7 || !colorPattern.test(stop.color)) || (i > 0 && stop.value <= stops[i - 1].value))) return error(path, "invalid-palette-definition");
  let right = 1;
  while (right < stops.length - 1 && selection.value > stops[right].value) right++;
  const a = stops[right - 1], b = stops[right], t = (selection.value - a.value) / (b.value - a.value);
  const value = "#" + [1, 3, 5].map((offset) => {
    const start = parseInt(a.color.slice(offset, offset + 2), 16), end = parseInt(b.color.slice(offset, offset + 2), 16);
    return Math.round(start + (end - start) * t).toString(16).padStart(2, "0");
  }).join("").toUpperCase();
  return Object.freeze({ ok: true, value, diagnostics: Object.freeze([]) });
}
export function resolveAvatarV5TintColors(appearance: AvatarV5Appearance, definitions: AvatarV5PaletteDefinitions): PaletteResult<Readonly<{ skin: string; hair: string; eye: string }>> {
  const skin = resolveAvatarV5Palette(appearance.skinTone, definitions.skin, "skinTone");
  const hair = resolveAvatarV5Palette(appearance.hairColor, definitions.hair, "hairColor");
  const eye = ownAppearanceValue(definitions.eyes, appearance.eyeColorId);
  const diagnostics = [...skin.diagnostics, ...hair.diagnostics];
  if (eye === undefined) diagnostics.push({ path: "eyeColorId", code: "unknown-eye-color", severity: "error" });
  else if (typeof eye !== "string" || (eye.length !== 7 || !colorPattern.test(eye))) diagnostics.push({ path: "eyeColorId", code: "invalid-eye-color-definition", severity: "error" });
  if (!skin.ok || !hair.ok || diagnostics.length) return Object.freeze({ ok: false, diagnostics: freezeAppearanceDiagnostics(diagnostics) });
  return Object.freeze({ ok: true, value: Object.freeze({ skin: skin.value, hair: hair.value, eye: eye!.toUpperCase() }), diagnostics: Object.freeze([]) });
}
