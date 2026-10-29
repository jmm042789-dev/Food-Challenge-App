# Fire Feast Avatar V5 foundation / artwork contract

## Status and safety boundary

V5 is isolated infrastructure. V4 remains production-active. No renderer, user migration,
storage writes, public-profile synchronization, purchases or screen integration is enabled.
The catalog is empty. Chef Shannon and Golden Apron mappings explicitly await artwork.
The `__unassigned__` sentinel is not a real item or palette and must never be published.

## Locked human direction

Normal-proportioned cartoon humans representing average everyday adults, friendly and
approachable, with polished mobile-game illustration and Fire Feast warm/colorful finish.
No muscular hero physiques, athletic/superhero shoulders, bodybuilding arms, chibi heads,
giant hands or fantasy anatomy. Do not create programmer-art characters.

Body/garment fit IDs are `standard` and `broad`. Standard is an average everyday build.
Broad is a naturally broader/heavier everyday person: wider torso/waist/hips and fuller
limbs, NOT a muscular or athletic body. Both share height, pose, head location and anchors.
Presentation is `male | female | non_binary`; every geometry, hairstyle, facial hair,
garment, accessory and color is available regardless of presentation. Compatibility uses
geometry variants, never presentation. V4 `base` means face shape, never V5 body geometry.

## Canvas, pose and alignment

- Transparent PNG masters: **1024 x 1024**, top-left origin, runtime `x=0, y=0`.
- Common scale and centerline x=512. Never tightly crop wearable masters.
- Ordinary-content safe region: x=160-864, y=48-960; head-clearance begins at y=48.
- Head: x=456-568, y=112-232; eye line approximately y=166.
- Chin (512,232), neck (512,250), shoulders (406,270)/(618,270).
- Torso y=270-480; waist (512,480); hips/pelvis y=480-575.
- Elbows (382,405)/(642,405); wrists (370,525)/(654,525).
- Knees (462,735)/(562,735); ankles (458,900)/(566,900).
- Sole/foot baseline y=952. Left/right are viewer-relative.
- These are initial guides, not final anatomical drawings. Approve an exact tracing
  template with the proof artwork before independently producing garments.
- Front-facing neutral pose: upright, balanced weight, level shoulders, arms slightly
  separated from torso, relaxed hands with fixed orientation, legs slightly apart.
  Both geometries use identical foot angles. No item-specific pose changes initially.
- No runtime stretching of fitted garments or per-screen alignment corrections.

Executable guides and adjustable crop rectangles live in `src/avatar-v5/alignment.ts`.
FULL_BODY=(0,0,1024,1024), PROFILE=(300,48,424,424), COMPACT=(364,48,296,296),
TINY=(404,48,216,216). Full body serves creator/Shop/Locker; profile shows upper torso;
compact shows head/neck/shoulders; tiny focuses on the head. Validate with real artwork.

## Canonical appearance and equipment

`AvatarV5Appearance` uses schemaVersion 5, presentation, bodyId, skinTone/hairColor
(paletteId + 0-100 value), faceId, eyeColorId, hairId, facialHairId, wardrobe,
itemColorways, effectId, backgroundId and gearVisibility (hat/apron/outfit).
Wardrobe contains top/bottom/shoes/socks/apron/headwear/eyewear/neck/wrist/misc selections.
Palette ranges are a future validated persistence boundary; this task adds no user parser.
The infrastructure loadout is not a renderable starter or a storage payload.

Performance equipment is separate read-only visual input: equippedGear,
equippedGearSlots (hat/apron/outfit), equippedCosmetic. It contains NO gameplay effects.
Explicit mappings reserve shannon_hat, shannon_apron, shannon_outfit and gold_apron,
with visualItemId=null until real catalog artwork exists. Golden Apron keeps its existing
entitlement. Do not create another entitlement or infer mappings from substrings.

Visual precedence: saved wardrobe, visible performance gear, explicit cosmetics.
Hiding gear affects visuals ONLY. Never unequip it or change backend IDs, modifiers,
match snapshots, scoring, rewards or equip requests. Missing gear art leaves wardrobe
visible and gear functional. Visual candidates are not a render plan: resolve compatible
art before suppressing anything underneath. Outfit gear may contribute multiple parts.

## Named multipart rendering

The sole ordering authority is `src/avatar-v5/layers.ts`, back to front:

1. background
2. rearEffects
3. rearGarmentAccessory
4. rearHair
5. bodySkin
6. modestyUnderlayer
7. socks
8. bottoms
9. shoes
10. topsSleeves
11. rearApronWaist
12. outerGarmentFront
13. apronFront
14. rearNeckAccessory
15. longHairFront
16. faceSkinDetail
17. facialFeatures
18. facialHair
19. frontHair
20. eyewearRear
21. headwear
22. eyewearFront
23. exposedHandsForearms
24. wristAccessory
25. foregroundNeckMisc
26. heldAccessoryFront
27. foregroundEffects

No arbitrary catalog z-index. Same-layer parts sort by stable part ID; passes sort
fill, shading, highlight, detail, then ID. IDs must be unique within an item variant.
Long hair, coats, scarves, aprons, held items and effects may require back/front parts.
Clothing uses explicit geometry variants. All body variants must include bodySkin and
permanent neutral modestyUnderlayer parts. A future renderer must display neither skin
nor partial clothing if the body/modesty asset fails; use the complete fallback instead.

## Color, face, hair and wardrobe

Skin/hair/facial hair: tintable fill plus untinted shadows, highlights, texture/outline.
All hair parts share the hair channel unless fixed. Only fill passes may have tint metadata.
Use authored colorways for patterned/multicolor/material-specific garments and gear.
No shader system. Test light/deep skin and dark/light/saturated hair with normal alpha
compositing. Unknown colorways use the item's default artwork without changing selection.

Faces are coordinated presets (eyes/brows/nose/mouth/shaping), fixed shared anchors,
optional eye-color fill; no arbitrary movable facial anatomy.
Hair supports rear, shoulder/front, fringe/crown and detail parts. Headwear fit classes:
open-band, brimmed-cap, full-cover. Alternatives replace the whole hairstyle part list,
not append to it. Full-cover suppresses hair without an approved alternative. Ordinary
hats cover crown artwork; use shared under-cap variants rather than a redraw per hat.

Tops, bottoms, shoes, socks and aprons are separate categories. Tops normally cover the
waistband; special tuck/outerwear behavior needs authored parts. Aprons overlay garments.
Coverage/incompatibility metadata is descriptive; future composition must apply it only
after compatible replacement artwork resolves. No global runtime wardrobe engine yet.

Starter direction: standard everyday adult, simple Fire Feast T-shirt, dark casual pants,
ordinary sneakers, basic apron, neutral face/hair. No required facial hair, glasses,
headwear or accessories. Register actual starter IDs only when approved art exists.

## Registration and ownership

- Registry uses literal require("...png") imports; never dynamic asset paths.
- Empty legacy presentation directories are scaffolding only, not compatibility rules.
  Future body/garment assets use geometry fit locations, not gender restrictions.
- Naming: `{category}_{permanent_id}_{fit}_{part}_{pass}.png`, lowercase ASCII snake case.
  Fit is standard/broad/shared only after alignment approval. IDs do not encode prices.
- Catalog entries declare slot, acquisition, geometry variants, named parts, tint passes,
  authored colorways, compatibility and contentRevision. No gameplay-stat definitions.
- Acquisition distinguishes starter, purchasedCosmetic, earnedCosmetic and
  performanceGearVisual. Selection state distinguishes available/owned/lockedPreview.
  Preview grants no ownership; backend entitlement validation remains future work.
- Keep briefs/references out of the runtime catalog. Do not extract fake layers from a
  concept sheet, generate placeholder PNG people or create empty fake production assets.

## Fallback and performance contract

Resolution is pure and bounded: selected art -> one explicit compatible starter ->
omit optional item or useExistingAvatar for required body/face/top/bottom/shoes.
Unknown legacy/new-server IDs follow the same path. Preserve requested IDs; never persist
fallback substitutions automatically. No retries, network or storage in resolution.
A missing optional hair/accessory is omitted. Intentional null stays absent.
A decode failure must be handled once by the eventual renderer; metadata resolution cannot
prove image decoding. Until complete starter/fallback art exists, retain the V4 renderer.

Use aligned 512/256/128 derivatives; crop portraits before downsampling. Do not assume
small view dimensions reduce 1024 PNG decode memory (~4 MiB/pass). One live full-body
editor, lazy list images, bounded image passes; later composite caching is separate work.
No automatic composition/export pipeline is introduced here.

## Release boundary

Do not import this foundation into production screens until separate artwork, renderer,
backend versioned storage/sync and migration tasks are approved and tested. V4 records,
public avatars, Shop and equipment stay unchanged. Do not touch gameplay timestamps,
input evidence/logging, burnout, score, result payloads/retries or backend validation.
