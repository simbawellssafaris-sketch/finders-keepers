# Finders & Keepers Safaris — website (Next.js)

All 642 pages of the site on Next.js 16. It builds two ways:
- **Static version** (`npm run build:static`) — plain files in `out/` that work on ANY hosting. Upload these today.
- **Server version** (`npm run build` + `npm start`) — for hosts that run Node.js; needed once you add enquiry saving, booking, payments, an admin page.

## Everyday commands
| Command | What it does |
|---|---|
| `npm install` | One-time: installs the tools (needs Node.js 20+). |
| `npm run dev` | Live editing at http://localhost:3000 (the .bat files use 3010) — changes show instantly. |
| `npm run build:static` | Builds the upload-anywhere version into `out/` (see docs/deploy-static-hostinger.md). |
| `npm run build` / `npm start` | Builds / runs the server version at http://localhost:3000 (the .bat files use 3010); on a host it uses the PORT the host provides. |
| `BUILD_DIR=out node scripts/verify-final.mjs` | After `build:static`: checks every page, SEO tag, picture and the sitemap. (Without `BUILD_DIR`, it checks the server build.) |
| `node scripts/audit.mjs` | Reports missing SEO tags, dead "#" links, forms, external hosts on the static build. |

Double-click `Start Next.js Dev.bat` (editing) or `Build and Preview.bat` (build + run).

## Where things live
- `content/pages/*.html` — one file per page: only that page's own content, plus `<!--@include name-->` markers for shared pieces. Each is served at `/<name>.html`; the home page is `finders-safaris-homepage.html`, also served at `/`.
- `content/shared/*.html` — the shared menu, footers, pop-ups, the site search and helper scripts. Edit once, every page updates. See `content/shared/README.md`.
- `lib/site.mjs` — business name, phone, e-mail, hours, domain, tagline used everywhere.
- `lib/seo.mjs` — **fills in what pages lack automatically**: description, canonical link, share-preview tags and image, alt text for pictures, shorter titles. A page's own tags always win.
- `lib/search-index.mjs` + `app/search-index.json/` — the list behind the site search (rebuilt every build).
- `app/sitemap.js`, `app/robots.js` — `sitemap.xml` and `robots.txt`, generated on every build (never out of date).
- `app/global-not-found.jsx` — the branded "page not found" screen.
- `public/` — images, videos, PDFs, icons. `public/assets/img/og-default.jpg` is the share image used when a page has no photo of its own.
- `.env.example` — keys you will need later. `docs/` — deployment and server notes.
- `.backup/pages` — reference copy used by `verify-final.mjs`. After you deliberately change page content run `node scripts/refresh-baseline.mjs`.

## The site search
The "Find Your Journey" button in every header opens a search box (also press `/`). It looks through all pages: destinations, journeys, stays, experiences. Nothing to maintain: new pages appear in it after the next build.

## Good to know
- The domain/email is the placeholder `findersandkeepers.com` until the real one is bought (`lib/site.mjs`; page files use `{{domain}}`). Share previews and the sitemap use it.
- Adding a page: put a new `.html` file in `content/pages/` and rebuild — it gets SEO tags, search and sitemap entries automatically.
