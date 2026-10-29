# Step 2E Standard Body proof intake

Artwork is not installed yet. This directory is isolated proof material, not production
AVATAR_V5_CATALOG registration. No runtime imports, preview host or V4 integration.
Do not create placeholders. The canonical master stays on C:, unchanged:

`C:\FireFeast-Recovery\Step2E-Master\fire-feast-avatar-v5-standard-master-1024.png`

SHA-256: `2403C7FDC6952E47020C1BEB87F5B1302BE601B89A7EB0B3A06CB84D6AB918FA`

Every pass must be 1024x1024, 8-bit RGBA PNG, with genuine transparent background
pixels and nonempty artwork. Retain the complete canvas and origin (0,0). Never trim,
resize, squeeze, reposition or stretch individual layers. No watch or accessories.

Approved front-facing Standard master: average everyday adult; alpha bounds approximately
X [126,897), Y [112,952), crown Y=112, sole boundary Y=952 (last occupied row 951).
Preserve that approved width. Proof-specific horizontal guidance is X [96,928), leaving
96 pixels of canvas margin on either side. This guidance is not a runtime clipping mask
or an alpha-bounds requirement for every individual pass. Existing alignment.ts stays unchanged.

Permanent modesty artwork is a plain white tank top and plain white fitted shorts,
without logos or orange trim, underneath outer clothing. Never require a nude base asset:
skin passes need only support exposed skin and concealed seam overlap; do not author
nude anatomical detail. Modesty coverage must remain complete and opaque in protected regions.
Outer clothing: white Fire Feast T-shirt, dark charcoal cargo pants, black/white/orange
Fire Feast sneakers, dark apron with orange trim/tie and Fire Feast branding.

## Exact inventory

Place exactly these 14 real PNGs directly in this directory, without subdirectories:

1. body_proof_standard_skin_fill.png
2. body_proof_standard_skin_shading.png
3. body_proof_standard_skin_highlight.png
4. body_proof_standard_skin_detail.png
5. body_proof_standard_modesty_detail.png
6. face_proof_standard_features_detail.png
7. hair_proof_standard_front_fill.png
8. hair_proof_standard_front_shading.png
9. hair_proof_standard_front_highlight.png
10. hair_proof_standard_front_detail.png
11. top_proof_standard_shirt_detail.png
12. bottom_proof_standard_pants_detail.png
13. shoes_proof_standard_sneakers_detail.png
14. apron_proof_standard_front_detail.png

Skin/hair fills alone are tinted. Other passes preserve authored colors. Apron straps,
bib, skirt and visible waist tie share apronFront and visually overlay complete clothing.
The list is inventory order. Paint order follows layers.ts: skin passes, modesty,
pants, shoes, shirt, apron, face, then hair passes; fills precede shading/highlight/detail.

## Explicit validation and optional comparison

From the repository root, after artwork installation:

`node scripts/check-avatar-v5-proof.js`

Missing art yields HOLD with deterministic filenames. This completeness command is not
part of npm test. Normal tests check the tool using in-memory synthetic pixel fixtures,
not production artwork. Existing repository PNG integrity tests will still inspect any
real PNGs installed here, without requiring all 14 to be present.

Optional composition after validation:

`node scripts/check-avatar-v5-proof.js --compose NEW_OUTPUT.png '#RRGGBB' '#RRGGBB'`

Replace the two color arguments with approved skin and hair hex colors. Output must be
a new PNG outside this directory; existing files are never overwritten. No output is
created by validation alone. Composition uses the same full canvas and ordinary
source-over alpha blending, with explicit tint on the two fills. It is a comparison aid,
not a guarantee of identical native rendering/color management. Never target the master.

Validation checks exact inventory, signature, chunks/CRCs, decompression/decoding,
dimensions, RGBA and alpha pixels. Pixel bounds are reported from the decoded canvas.
A PNG cannot encode pixels outside its own raster; dimensions/pixel length establish that
boundary. Whether artwork was clipped before export, correctly aligned, modest, or faithful
to the approved character requires visual review. Do not mistake successful decoding for
art approval. Stop on unexpected CRC/decode errors; do not repair or regenerate files.
