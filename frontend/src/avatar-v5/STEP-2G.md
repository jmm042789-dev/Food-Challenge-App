# Step 2G: isolated appearance editing foundation

This is pure TypeScript logic, not a production avatar editor. No new catalog IDs,
ownership records, palette content, artwork, persistence, network calls, equipment
writes, React components, or production integration are supplied. The flattened proof
and unfinished 14-pass artwork retain their existing meaning and contracts.

## Public contracts

- `validateAvatarV5Appearance(unknown, { allowIncomplete? })`: checks structure and
  returns a detached deeply frozen appearance or deterministic field-addressed errors.
- `assessAvatarV5Selections(appearance, context)`: accepts a structurally validated
  appearance and trusted readonly catalog, availability and body-item mappings.
  Returns selection errors and artwork warnings without substitutions.
- `resolveAvatarV5Palette(selection, definitions, path?)`: resolves one explicit palette.
- `resolveAvatarV5TintColors(appearance, definitions)`: returns separate skin/hair/eye
  colors, never an updated appearance.
- `beginAvatarV5Draft(unknown)`: independent deeply frozen saved and draft snapshots.
- `editAvatarV5Draft(state, action)`: typed whitelisted field, wardrobe, visibility or
  colorway action. Invalid actions return the identical prior state with diagnostics.
- `resetAvatarV5Draft(state, unknown)`: explicit supplied reset appearance only;
  preserves saved baseline. It never invents a starter.
- `cancelAvatarV5Draft(state)`: a separate immutable copy of the original saved baseline.
- `confirmAvatarV5Draft(state, context)`: rechecks current draft against current
  supplied context and returns a separate immutable candidate or the unchanged state
  with errors. It does not change the saved baseline or perform a save.

A future caller must explicitly begin a new session from an accepted candidate.
The word saved denotes a caller-supplied baseline, not evidence of durable persistence.
Inputs to draft operations are states produced by these functions. Catalog/palette
contexts are caller-owned readonly inputs; no server authentication is performed here.

## Structural validation and diagnostics

Schema version is exactly 5. All declared fields are required, including nullable
optional slots. Presentation and standard/broad geometry use existing enums. No
presentation restricts clothing or geometry. Gear visibility accepts booleans only.
Palette values are finite numbers in [0,100], including fractions. No clamping,
rounding, case conversion, ID normalization or replacement is applied to appearances.

IDs are 1-128 ASCII letters/digits/underscore/hyphen, beginning with a letter or digit;
`__unassigned__` is the sole special infrastructure token. Prototype-sensitive names
`__proto__`, `prototype`, and `constructor` are prohibited. Objects must be plain or
null-prototype records with enumerable data properties. Unknown fields, symbol keys,
accessors, unsafe keys and inherited custom prototypes are rejected. This is a data
boundary, not a sandbox for hostile JavaScript Proxy objects.

Diagnostics contain path, code and severity, in fixed traversal order with sorted
map keys. Codes distinguish invalid structure, unknown-item, wrong-slot,
locked-selection, unknown-availability, missing-geometry-variant, missing-artwork,
invalid-colorway, incompatible-selection and missing body mapping. Structural validity
does not imply permission, compatibility, usable artwork, decoding or renderability.

Begin/edit/reset explicitly allow incomplete sentinels. Structural validation defaults
to rejecting them, and confirmation always rejects them, including palette IDs and
colorway preferences. Well-formed unknown IDs remain unchanged for diagnostics.

## Availability and compatibility

Catalog and availability are injected, never imported from production state.
`available` or `owned` permits a selection; `lockedPreview` blocks confirmation.
Absent, inherited or unsupported availability is unknown and blocks confirmation.
Neither acquisition category nor item/backend naming confers ownership.

Body geometry uses an explicit body-item mapping, not a fabricated catalog ID.
Changing body geometry retains requested wardrobe IDs. Reassessment reports missing
variants; no clothing is substituted. Incompatibility metadata is checked in both
directions. Colorways must be declared in the selected geometry (including its authored
headwear alternatives); uncolored parts may retain original artwork. Dormant preferences
are retained but their item, availability and geometry/colorway must still validate.

Missing pass sources or empty artwork lists produce warnings. Missing artwork alone
does not prohibit an otherwise known, permitted and compatible requested selection.
Confirmation is intentionally not renderability certification. Existing render planning
remains responsible for coverage, modesty, ordering and headwear behavior; native image
loading remains responsible for decoding. No parallel wardrobe-resolution engine exists.

## Palette math

Caller-supplied skin/hair maps contain ordered stops spanning exactly 0 to 100, with
strictly increasing finite positions and strict #RRGGBB colors. Eye colors use an explicit
ID-to-#RRGGBB map. Only selected definitions are evaluated. No production palettes exist
in this phase. Definitions are approved input, not ownership or entitlement records.

Interpolate linearly between adjacent encoded RGB channel values, then Math.round each
channel and emit uppercase #RRGGBB. This is deterministic RGB interpolation, not a
perceptually uniform or linear-light color-space conversion. Fractional selection values
remain intact. Unknown definitions and malformed stops are errors, never default colors.
Palette validation is required on confirmation even if hair/eye tint is not currently
visible, so stored selections remain meaningful independently of the current composition.

## Draft, fallback and authority boundaries

Snapshots clone and freeze every appearance container. Caller objects are never frozen
or mutated in place. Failed edits/reset/confirmation preserve state identity. Successful
edits update only draft; cancel and reset do not write anything. Confirmation rechecks
availability and compatibility every time, with no cached authorization result.

Fallback resolved IDs, omitted items, default colorways and visual equipment overlays
are never inputs to editing/confirmation. Render-plan objects fail appearance validation.
There is no reverse mapping from rendered composition to saved selections, and no
persistence adapter. Explicit user-selected IDs are the only editing values.

Gear visibility affects visual preference only. Equipped IDs, slots, ownership, rewards,
match snapshots and modifiers are external authority. No Step 2G operation receives or
changes equipment calculations. Future server-side validation remains mandatory.

## Limitations and future integration

No grandfathering of unknown or locked saved selections: they are retained but fail
confirmation until explicitly corrected or a later approved policy is introduced.
No migration, editor UI, backend sync, purchases, real palette catalog or production
export is added. Standard and Broad logic is tested with synthetic metadata; production
fit still requires approved authored variants. Artwork safety and 14-pass completeness
are separate gates. The empty production catalog cannot produce a confirmable starter.

Validation: targeted Step 2G tests; existing V5/proof tests; scoped no-emit TypeScript
including tests/avatar-v5-appearance-contract.ts; full repository suite. Test fixtures
alone use synthetic IDs, palettes and bundled-image tokens. Existing source stays intact.
