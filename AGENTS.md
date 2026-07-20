# Fire Feast Development Guide

## Project Goals

Fire Feast is a polished arcade food challenge game built with Expo Router,
React Native and FastAPI.

The objective is to produce a commercial-quality mobile game for Android
and iOS while keeping gameplay responsive and code maintainable.

## Development Rules

- Inspect existing code before changing it.
- Prefer small, targeted changes over rewrites.
- Reuse existing components whenever possible.
- Preserve gameplay balance unless specifically requested.
- Keep animations smooth and performance-conscious.
- Never break existing navigation.
- Avoid duplicate components.
- Maintain TypeScript strict compatibility.
- Do not rename files, routes, APIs, assets, environment variables, or database fields unless explicitly requested.
- Do not modify gameplay behavior as part of visual-only tasks.
- Do not add unnecessary dependencies.

## Code Style

- Use functional React components.
- Use TypeScript for frontend code.
- Keep components modular.
- Prefer composition over duplication.
- Match the style and patterns already used in the repository.

## UI Guidelines

Prioritize:

- responsiveness
- polish
- satisfying animations
- arcade feel
- readability
- accessibility
- mobile-safe layouts

Avoid unnecessary complexity and visual clutter.

## Backend Guidelines

- Preserve existing FastAPI routes and response formats.
- Maintain compatibility with the current MongoDB data structure.
- Do not expose secrets or commit production credentials.
- Validate client and server changes together when an API contract changes.

## Legal and Branding Guidelines

- Use the Fire Feast brand name.
- Use “Antacid” rather than trademarked medicine brand names.
- Do not add copyrighted restaurant logos, menu images, characters, music, or other protected assets without permission.
- Use fictional restaurant and food challenge content until licensed real-world content is approved.

## Validation

After every frontend task, run:

npx.cmd tsc --noEmit

Also run the most relevant existing validation command when applicable.

Do not hide, suppress, or broadly ignore errors.

If validation fails:

- identify whether the task introduced the error
- fix errors introduced by the task
- report unrelated pre-existing errors separately

## Change Safety

- Keep changes limited to the requested task.
- Do not rewrite working systems without a clear technical need.
- Do not delete files unless explicitly requested.
- Review git diff before finishing.
- Do not commit or push unless explicitly requested.

## Final Response Format

After every completed task provide:

- Files changed
- Summary of changes
- Validation commands run
- Validation results
- Any remaining risks or follow-up recommendations
