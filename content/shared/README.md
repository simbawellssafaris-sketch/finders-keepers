# Shared pieces (menu, footer, popups…)

Each file here is one chunk of page that used to be copied into many pages. Pages now contain a one-line
marker such as `<!--@include footer-site-->` and the build drops the file's content in at that spot.
**Edit a file here once and every page that includes it is updated on the next build.**

Business details (name, phone, e-mail, hours, tagline…) are not typed into these files any more: they appear as
`{{brand}}`, `{{phone}}`, `{{email}}`… and come from `lib/site.mjs`. Change them there.

## The ones you will touch most
| File | What it is | Pages |
|---|---|---|
| `topbar-menu-pages.html` | Top red strip (phone, Subscribe, Brochures) on the menu-style pages | 89 |
| `nav-menu-pages.html` | Main navigation bar on the menu-style pages | 90 |
| `mega-menu-panels.html` | The sliding Destinations / Journeys / Accommodations menu panels | 90 |
| `mega-menu-script*.html` | The code that powers those menu panels (REGION_DATA lists every country) | 83 (+ a few per-page versions) |
| `footer-site*.html` | Full site footer (links, newsletter, contact) on the menu-style pages | 87 |
| `footer-newsletter*.html` | Newsletter-style footer on package pages | 123 |
| `footer-brand-line.html` | One-line brand footer on lodge and experience pages | 137 |
| `topbar-detail-pages*.html`, `nav-detail-pages*.html` | Top strip and navigation on the package (itinerary) pages | 111 / 119 |
| `quicknav.html` (+ `quicknav-styles`, `quicknav-script`) | The small floating Back / Home bar at the top of lodge and experience pages | 423 |
| `enquiry-modal.html` | The "Speak to us" enquiry pop-up (WhatsApp / e-mail form) | 641 |
| `subscribe-modal.html` | The "Subscribe" pop-up | 641 |

Everything else (`lodge-tabbar*`, `package-tabnav*`, `elevation-divider*`, `*-script*`, `print-styles*`…) are
smaller helpers repeated across many pages. Numbered suffixes (`-2`, `-3`) are versions of the same piece that differ
in some detail (wording, spacing, a link). Matching is exact, so no page was changed by even a space.

## Wording is now consistent
The top strip reads "SPEAK TO US | phone" and the navigation reads "Our Journeys / Find Your Journey" on every page; "Speak To Us" is used for the enquiry buttons and links.
Still slightly different by design: menu pages, package pages and lodge pages have their own header/footer layouts (the `-menu-pages`, `-detail-pages` and `quicknav` pieces).

## Adding a new shared piece
1. Save the HTML as `content/shared/my-piece.html`.
2. In any page, write `<!--@include my-piece-->` where it should appear.

`scripts/extract-shared.mjs` is the one-off tool that created these files from the original pages (originals are kept in `.backup/pages`).
Do not run it again unless you want to start over from the backup: it rewrites `content/pages` and `content/shared`.
