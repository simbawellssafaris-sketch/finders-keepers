# Production readiness: what is set up, and what you still do

Written after the pre-launch audit. Plain language first; technical notes where useful.

## Environment variables (Hostinger > your site > Environment variables)

| Name | Needed for | Value |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | saving forms | `https://xlwlhzuegfrosbcnliko.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | saving forms | the publishable key from Supabase > Project Settings > API Keys |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` | email | `smtp.hostinger.com` / `465` / `true` |
| `SMTP_USER` / `SMTP_PASS` | email | the `bookings@finderskeeperssafaris.com` mailbox and its password |
| `MAIL_FROM` / `MAIL_TO` | email | `Finders & Keepers Website <bookings@finderskeeperssafaris.com>` / `bookings@finderskeeperssafaris.com` |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | CAPTCHA (optional, recommended) | the Site key from Cloudflare Turnstile |
| `TURNSTILE_SECRET_KEY` | CAPTCHA (optional, recommended) | the Secret key from Cloudflare Turnstile |

`NEXT_PUBLIC_` values are built into the site, so redeploy after changing them. The others are read when the server runs. Never put a Supabase
"secret" / "service role" key in a `NEXT_PUBLIC_` variable.

## Backups of the enquiry database (Supabase)

What is stored: three small tables (`enquiries`, `service_requests`, `newsletter_subscribers`).

- **A second copy already exists:** every enquiry is also emailed to the bookings mailbox, so the mailbox is a backup of the details.
- **Automatic backups depend on your Supabase plan.** The free plan does not include scheduled daily backups; paid plans do. Check
  Supabase dashboard > Database > Backups to see what your plan includes. If you want automatic daily backups, upgrade the project's plan.
- **Free, manual routine (recommended at least monthly):** Supabase dashboard > Table Editor > pick a table > the export button (CSV). Do this for each of
  the three tables and keep the files somewhere safe outside this computer (for example a private cloud folder).
- **Restoring:**
  - With a paid plan: Database > Backups > choose a day > Restore.
  - From your CSV files: Table Editor > pick the table > Insert > Import data from CSV. The column names in the files match the tables, so
    they import as they are.
  - If the whole project were deleted: create a new project, run the SQL in your Supabase migration history (Database > Migrations) to rebuild
    the tables and security rules, import the CSV files, then update the two `NEXT_PUBLIC_SUPABASE_*` variables on Hostinger and redeploy.

## Search engines (one-time manual setup)

1. **Google Search Console** (search.google.com/search-console): add a **Domain** property for `finderskeeperssafaris.com`. Google shows a
   TXT record; add it in Hostinger hPanel > Domains > DNS / Nameservers > DNS records, then click Verify (can take a few minutes).
2. In Search Console > **Sitemaps**, submit `https://finderskeeperssafaris.com/sitemap.xml`.
3. **Bing Webmaster Tools** (bing.com/webmasters): sign in and choose **Import from Google Search Console** (quickest), or add the site and verify
   the same way. Submit the same sitemap address.
4. A few days later, open Search Console > Pages to see which pages are indexed and fix anything it reports.

## Security headers

Set in `next.config.mjs` (server build) and in `docs/htaccess-for-static-hosting.txt` (static zip): Content-Security-Policy, Strict-Transport-Security,
X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy. If a new outside service is ever added (analytics, maps, a video host,
a payment provider), it must be allowed in the Content-Security-Policy list in both files, otherwise browsers will block it.
HTTPS and the www / non-www redirect are handled by Hostinger and the domain settings, not by the website's code.

## Not set up on purpose

- **Analytics and cookie banner:** no analytics tool has been chosen, and the site sets no analytics or advertising cookies, so no banner is needed
  yet. When you pick one (Google Analytics, Plausible, ...), it needs an account, a CSP update, and for some tools a consent banner.
- **Admin dashboard:** none exists yet, so there are no admin routes to protect. Reading submissions is done in the Supabase dashboard.
- **Payments:** none exist yet.
