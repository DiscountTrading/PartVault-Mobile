# PartVault Field App

Phone-first PWA for capturing parts in the yard: photograph a part, let AI fill
the details, file it under a SKU, and hand it to the admin app for listing.
Live at https://app.partvault.app (Cloudflare Pages deploys `main` on push).

## Stack

- React + Vite, inline styles driven by the shared design tokens
  (`src/index.css` `:root` block + the `C` object in `src/lib/constants.js` —
  identical values to the marketing site).
- Supabase (shared project with the admin app). Auth session lives in a chunked
  cookie on `.partvault.app` so one sign-in covers admin + field app — keep
  `src/lib/supabase.js` identical to the admin's copy.
- Service worker (`public/sw.js`) with the PWA update kit: versioned cache,
  eager update checks, auto-reload on new versions.

## Development

```bash
npm install
npm run dev     # http://localhost:5173
npm run build   # runs scripts/check-version.mjs first — fails on version drift
```

## Releasing

Bump BOTH `APP_VERSION` in `src/lib/constants.js` AND `VERSION` in
`public/sw.js` (the build fails if they differ), then push to `main`.
The service worker only updates phones when its bytes change.
