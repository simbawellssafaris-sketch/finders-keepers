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
- The domain/email is the placeholder `finderskeeperssafaris.com` until the real one is bought (`lib/site.mjs`; page files use `{{domain}}`). Share previews and the sitemap use it.
- Adding a page: put a new `.html` file in `content/pages/` and rebuild — it gets SEO tags, search and sitemap entries automatically.

## Database (Supabase)

Website forms are saved to Supabase (project `finders&keepers`). There is no login: visitors can submit forms and nothing else.

| Form | Table |
|---|---|
| "Let's Plan Your Journey" enquiry pop-up (also on The 1923) | `enquiries` |
| Private jets, layover safaris, flight arrangements, city tour, airport fast-track | `service_requests` (`service` says which; the form-specific answers are in `details`) |
| Newsletter / journal sign-ups (footer, pop-up, homepage) | `newsletter_subscribers` |

- Row Level Security is on for every table. The public (`anon`) role can only **insert**: it cannot read, change or delete rows, so one visitor can never see another's details. Read submissions in the Supabase dashboard (Table Editor).
- The save happens in the browser (`app/[[...page]]/supabase-forms.jsx` + `lib/forms.js`), so it works for both the server build and the static export. The pages' own thank-you messages and WhatsApp / email buttons are unchanged. If a visitor is offline, the submission is kept in their browser and sent next time.
- `.env` holds `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (see `.env.example`). These are baked in when the site is **built**, so on a host such as Hostinger add both as environment variables before building. The publishable key is meant to be public; never put the service-role key in a `NEXT_PUBLIC_` variable.
- `lib/supabase/server.js` is a ready-made server client for the later admin page; no page uses it yet.
- Windows note: if the project folder name contains `&` (e.g. `nders&keepers`), `npm run ...` fails; use the two `.bat` files, which call Node directly.

## Email notifications (Supabase Edge Function)

When a form row is saved, a database trigger calls the `notify-submission` Edge Function (`supabase/functions/notify-submission/index.ts`),
which emails the details to the business mailbox through Hostinger SMTP. Each row is marked `notified_at` once, so it can only ever send one email.
The sender is the mailbox itself and `Reply-To` is the customer, so replying answers the customer directly.

The mailbox login is stored as **secrets in Supabase** (dashboard > Edge Functions > Secrets), not in this repo or in `.env`:

| Secret | Value |
|---|---|
| `SMTP_USER` | `bookings@finderskeeperssafaris.com` |
| `SMTP_PASS` | that mailbox's password |
| `NOTIFY_TO` | optional, where notifications go (defaults to `SMTP_USER`) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_FROM_NAME` | optional; default `smtp.hostinger.com` / `465` / `Finders & Keepers Website` |

Until `SMTP_USER` and `SMTP_PASS` are set the function answers 503 and rows stay un-notified. Opening
`https://<project>.supabase.co/functions/v1/notify-submission` in a browser tests the connection to the mail server.
