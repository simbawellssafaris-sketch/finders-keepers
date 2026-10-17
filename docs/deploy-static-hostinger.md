# Deploying today (static upload to Hostinger)

This works on any Hostinger plan, no Node.js needed. When you later add the backend, you switch to the server version (see `server-plan.md`).

## Steps
1. Build (or use the ready-made zip): `npm run build:static` → everything is in the `out` folder.
2. hPanel → **Websites** → your site → **File Manager** → open `public_html`.
3. Delete the default files Hostinger put there (e.g. `default.php`, an empty `index.html`).
4. Upload the zip (`finders-keepers-site-for-hostinger.zip`), right-click → **Extract** so that `index.html`, `.htaccess`, `assets/`, `_next/` sit **directly inside** `public_html` (not in a sub-folder). Then delete the zip.
   - The zip is ~520 MB. If the File Manager upload is slow or stalls, use FTP instead (hPanel → Files → FTP Accounts, then FileZilla): upload the contents of `out`, with `.htaccess` included.
5. Open the temporary preview address Hostinger gives you and click around: home page, a destination, a package, a lodge, a PDF, the video, the "Speak To Us" pop-up.

## Before you point a real domain at it
- Replace the placeholder domain `finderskeeperssafaris.com` once you own one (`lib/site.mjs` and the page files; ask Claude to swap it in one pass), and rebuild.
- Turn on HTTPS (SSL) in hPanel.
- Remember: the enquiry pop-up still opens WhatsApp/email only. Saving enquiries needs the server version.

## Updating the live site later
Edit the files in `content/`, run `npm run build:static`, zip `out`, upload and extract again (replace existing files).
