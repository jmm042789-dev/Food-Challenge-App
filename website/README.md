# Fire Feast Marketing Website

Production static marketing and legal website for [firefeastgame.com](https://firefeastgame.com). It uses a dependency-free Node.js build so the generated site can be hosted directly on Cloudflare Pages.

## Development

Requirements: Node.js 20 or newer and npm.

From `website/`, run `npm run build`. The generated site is written to `dist/`. To preview it, use any static HTTP server pointed at `dist/`; clean route fallback behavior should map routes such as `/privacy` to `/privacy/index.html`.

Source layout:

- `scripts/build.mjs` generates page HTML, metadata, and deployment files.
- `src/styles.css` contains the responsive site styles.
- `tests/website.test.mjs` contains the production validation suite.
- `../docs/legal/` remains the authoritative source for all legal content.

## Build

```text
npm run build
```

Build command: `npm run build`

Output folder: `website/dist` when configured from the repository root, or `dist` when the Cloudflare Pages root directory is `website`.

No dependency installation is required because the build uses only Node.js built-in modules.

## Deployment

The site is designed for static hosting. A deployment should publish only the generated `dist/` directory. Do not deploy repository source, mobile application files, backend files, credentials, or environment files.

After deployment, verify all six routes, responsive layouts, navigation, HTTPS, the favicon, `robots.txt`, `sitemap.xml`, and social sharing metadata on the production domain.

## Cloudflare Pages

Create a Pages project connected to the repository and current production branch, then use:

- Framework preset: `None`
- Root directory: `website`
- Build command: `npm run build`
- Build output directory: `dist`
- Node version: `20` or newer
- Environment variables: none required

In the Pages project, open **Custom domains**, add `firefeastgame.com`, and follow Cloudflare's DNS prompts. If `www.firefeastgame.com` is also added, configure a permanent redirect to the canonical apex domain so search engines see only one version.

Wait until Cloudflare reports the custom domain as active and the edge certificate as issued. Then verify that `https://firefeastgame.com` loads without certificate warnings, HTTP redirects to HTTPS, all internal links stay on HTTPS, and the certificate covers each configured hostname. Keep the Cloudflare **Always Use HTTPS** setting enabled.

## Updating legal documents

Edit only the authoritative Markdown files in `docs/legal/` after legal review. Do not place a separate legal copy in the website. The build reads those files directly and renders them into the corresponding routes. Run the complete validation suite afterward; the legal synchronization test ensures the rendered page contains the authoritative text in order.

## Testing

```text
npm test
npm run lint
npm run typecheck
```

Tests require a completed build. They verify required routes, legal synchronization, production contact values, SEO and accessibility basics, and the absence of placeholder text, task markers, localhost URLs, and private LAN addresses.

## Validation

Run the complete website validation from `website/`:

```text
npm run validate
```

Before committing, also run the repository-required frontend type check from `frontend/`:

```text
npx.cmd tsc --noEmit
```

Finally, from the repository root run `git diff --check` and `git status --short`, review the complete diff, and confirm that only intended website files changed.
