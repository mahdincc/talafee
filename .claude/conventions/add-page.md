# Adding a new HTML page

> Use when adding a new top-level page (e.g. `wallet.html`, `compare.html`). For tweaks to existing pages just edit them. Read [`../../CLAUDE.md`](../../CLAUDE.md) and [`commit.md`](commit.md) first.

## House style for pages

Existing pages (`index.html`, `login.html`, `user-panel.html`, `admin-panel.html`, `guide.html`, `trust.html`) follow a single-file pattern. **New pages must match.**

- **Self-contained:** all page-specific CSS in `<style>` in `<head>`, all page-specific JS in `<script>` at the end of `<body>`. No per-page external files; the duplication is intentional.
- **Shared JS** goes through the existing global modules:
  - `assets/js/api-client.js` → `TalafeeAPI` (prices, history, health, trust)
  - `assets/js/trust-client.js` → `TalafeeTrustAPI` (reviews, badges)
- **Design tokens** live in `assets/css/design-tokens.css` for the *global* tokens, but most pages re-declare the tokens inline in `<style>` for self-containment. Match the surrounding page's style — don't introduce a new pattern.
- **RTL Persian first.** `<html lang="fa" dir="rtl">`. English appears as a secondary label only.
- **Fonts** — preconnect to `fonts.googleapis.com`/`gstatic.com` and load `Outfit`, `Work Sans`, `Geist Mono`, `Vazirmatn`. Match the existing `<link>` block at the top of `index.html`.
- **Icons** — Lucide via `<script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"></script>`. Call `lucide.createIcons()` after dynamic DOM updates.

## Skeleton

Copy `guide.html` if you need static content, or `trust.html` if you need API-driven content. Don't start from `index.html` — it's the largest and most opinionated.

Minimum structure:

```html
<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>طلاین | <page name></title>
  <!-- preconnect, fonts, lucide as in index.html -->
  <style>
    :root { /* tokens — copy from a sibling page */ }
    /* page-specific rules below */
  </style>
</head>
<body>
  <header>...</header>
  <main>...</main>
  <footer>...</footer>

  <script src="/assets/js/api-client.js"></script>
  <!-- include trust-client.js only if the page uses it -->
  <script>
    // page-specific logic
    lucide.createIcons();
  </script>
</body>
</html>
```

## Wiring the API

Don't hardcode `http://localhost:3001/api/v1` or `http://<VPS_IP>/api/v1`. `TalafeeAPI` resolves the base URL automatically per environment:

```js
TalafeeAPI.init();   // optional — defaults are fine
const prices = await TalafeeAPI.getAllPrices();
```

If you really need a custom base URL (rare), pass it via `TalafeeAPI.init({ baseUrl: '...' })`, **never** by editing `api-client.js`.

## Navigation

Existing pages link to each other via plain `<a href="/foo.html">`. nginx serves the static site, so absolute paths work both locally and in production. Add a link to the new page in the relevant menu (usually the header in `index.html`).

## Verification

1. Open the new page in a browser via `npm run dev` (live-server on port 3000). It must render with no console errors.
2. If it consumes the API, watch the Network tab — requests should go to `http://localhost:3001/api/v1/...` in dev, and the response JSON should have `success: true`.
3. Resize the window to mobile width and check the layout doesn't break.
4. Verify RTL behaviour: numbers, punctuation, alignment.

## Don't

- Don't add a JS framework (React, Vue, etc.). Vanilla is a deliberate choice.
- Don't add a CSS framework that isn't already there. Tailwind preset exists in `config/tailwind.preset.js` but isn't applied to the static pages.
- Don't add a build step (webpack, vite, esbuild). The frontend ships raw HTML/CSS/JS.
- Don't fetch from a hardcoded production URL during dev — use `TalafeeAPI`.
- Don't write multi-paragraph comment blocks at the top of files explaining what they do. Names + small inline comments only when the *why* isn't obvious.

## Commit + handoff

```
feat(frontend): add <page>.html (<one-line purpose>)
```

Then the standard handoff line for the deploy chat (see [`commit.md`](commit.md) §6).
