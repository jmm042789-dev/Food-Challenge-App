# Fire Feast Documentation

This directory contains the maintained documentation for Fire Feast.

- `legal/` contains privacy, terms, and other legal documents for the game.
- `release/` contains release plans, checklists, validation records, and store-readiness material.
- `architecture/` contains technical architecture, system-design, and data-flow documentation.
- `assets/` contains asset inventories, provenance records, licensing notes, and optimization guidance.

Documentation should describe the behavior that exists in the repository. Planned features should be clearly identified as plans rather than current functionality.

## Legal document synchronization

Files in `legal/` are the canonical source for player-facing legal text. The current Expo build does not import raw Markdown directly, so the app uses a generated TypeScript snapshot. After changing a legal Markdown file, run the following command from `frontend/` and commit the generated update:

```text
node scripts/sync-legal-docs.js
```
