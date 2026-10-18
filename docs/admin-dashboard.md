# Admin dashboard

Address: `https://finderskeeperssafaris.com/admin` (signs in at `/admin/login`). It is only part of the server version of the site (Hostinger
Node.js). The static zip has no server, so it has no dashboard.

## What it does (round 2 additions are marked *)
- *Log an enquiry by hand* (button on the Enquiries page) for leads that come by phone, WhatsApp, email or in person, with a **channel** label.
- *Assign* each enquiry or request to a person, and set a *follow-up date*. The Overview lists follow-ups that are due or overdue, and the
  lists can be filtered by channel, by who it is assigned to, and by "follow-up due".
- *History* on every record: who changed the status, notes, assignment or follow-up, and when. History cannot be edited or deleted from the dashboard.
- *Roles:* **Owner** can do everything. **Staff** can read, edit and log enquiries but cannot delete anything or manage the team.
- *Two-factor login* (authenticator app) under **Security**. Once on, signing in needs a 6-digit code after the password.
- *Team page:* see who has access; owners can rename people, change roles and remove access.

### Money: clients, bookings and payments
- **Clients:** one record per traveller or family (name, email, phone, country, notes). Duplicate emails are refused. An owner can delete a client only while they have no bookings.
- **Bookings:** reference `FK-0001`, `FK-0002`... Journey, travellers, departure/return dates, status (Provisional, Confirmed, Completed, Cancelled), currency
  (**USD or KES**), total price, deposit % (default 30%), deposit due date and balance due date (default **60 days before departure**, as the website promises).
  Open an enquiry and press **Convert to booking** to create the client and booking in one click. Filters: status, leaving in the next 60 days, balance overdue.
  **Departure calendar** shows who travels when. **Print summary** gives a one-page summary (with the company and bank details from Settings) to print or save as PDF.
- **Payments:** recorded inside a booking (deposit, instalment, balance, refund; M-Pesa, bank transfer, card, cash, other; date; reference). The **Payments** page lists them all.
- **Settings (owners):** legal name, contact details, KRA PIN, bank details, VAT (not registered yet). Staff can see them on printed summaries but only owners can change them.
- **Overview** shows what is still to collect, overdue balances, payments waiting for confirmation and departures in the next 30 days.

Money rules, enforced by the database itself:
- Amounts are kept per currency. USD and KES are **never added together**; every total is shown per currency.
- A payment always uses its booking's currency. A booking's currency cannot be changed once it has payments.
- **Staff** record payments as *waiting for confirmation*. Only an **owner** can confirm that the money really arrived (or mark it failed / entered by mistake).
  Only confirmed payments count as paid. Refunds subtract.
- Payments can never be deleted (a wrong entry is marked failed, so there is always a trail). A booking with payments cannot be deleted; mark it Cancelled instead.
- Changes to clients, bookings and payments appear in each record's History.
- CSV downloads exist for clients, bookings and payments (`/admin/export/clients`, `/bookings`, `/payments`).

### Quotations, invoices, receipts and documents
- **Quotations** (`QT-0001`...): line items (description, quantity, unit price; a negative price is a discount), currency (USD or KES), valid-until date, a message and
  terms. Create one from an enquiry (**Create quotation** on the enquiry, which finds or creates the client) or from **+ New quotation**. **Email to client** sends
  it from your Hostinger mailbox (reply-to is your business email); **Print / save as PDF** gives a clean page. When the client says yes, **Accept and create booking**
  opens a booking with the same title, currency and total. A sent quotation past its valid-until date shows as Expired.
- **Invoices** (`INV-0001`...): created from a booking with **Invoice the deposit / the balance / the full amount** (it opens a draft you can adjust). Only an **owner**
  can **issue** it. Issuing gives the invoice its permanent number (drafts have none, so deleting a draft never leaves a gap) and locks the lines. After that only
  the due date and the private note can change; a mistake is fixed by **voiding** (owner, with a reason) and making a new one. Numbers are never reused.
  Record a payment on the booking and pick the invoice under **Against invoice**: the invoice then shows paid, outstanding, and goes **Paid** or **Overdue** by itself.
  **Email to client** sends the invoice with your bank details.
- **Receipts** (`RC-0001`...): the database gives a payment its receipt number the moment an owner confirms it. Open it from the Receipt column on a booking, the
  Payments page or an invoice. Refunds do not get receipts; a payment later marked failed shows a VOID receipt.
- **Documents:** passports, visas, itineraries, vouchers, insurance and contracts can be uploaded on a client or a booking (PDF, JPG, PNG, WebP or Word, up to 10 MB;
  the file's real type is checked). They live in a **private** storage bucket: only signed-in team members can open them and every download link lasts one minute.
  Only an owner can delete a file. Clients with documents, quotations or invoices cannot be deleted.
- VAT: the business is not VAT-registered yet, so documents carry no tax line. When that changes, tax lines will need adding to quotations and invoices.
- The Overview shows quotations waiting for an answer, unpaid and overdue invoices (per currency) and draft invoices waiting to be issued.

### Forgotten password, idle sign-out, activity history and reports
- **Forgot your password?** (link on the sign-in page): enter your email and a reset link arrives (valid one hour, works once). The link opens a page with a
  **Continue** button (so an email scanner opening the link cannot use it up), then you choose a new password (12+ characters). If you have two-factor login on,
  the 6-digit code is asked for here too, so a stolen email alone cannot take over an account. Saving signs every device out. The page never says whether an
  email address has an account.
  **One-time Supabase set-up (Authentication in the Supabase dashboard):**
  1. *URL Configuration*: set **Site URL** to `https://finderskeeperssafaris.com` and add `https://finderskeeperssafaris.com/admin/reset` to **Redirect URLs**.
  2. *Email Templates > Reset Password*: change the link to `{{ .SiteURL }}/admin/reset?token_hash={{ .TokenHash }}&type=recovery` (this makes the link work on any
     device or browser, for example when the email opens in a phone's built-in browser).
  3. *SMTP Settings*: switch on **custom SMTP** with the same Hostinger mailbox details used for the website emails. Without it Supabase only emails people who
     are members of your Supabase organisation, and only a few per hour, so a colleague you add later would never receive a reset email.
- **Idle sign-out:** after 30 minutes with no mouse, keyboard or touch activity the dashboard warns two minutes before, then signs that device out and shows a
  message on the sign-in page. While you are working it quietly keeps the session alive, so a long form is never lost. The server also signs out a session that has
  been unused for 35 minutes (for example a closed laptop). To change the 30 minutes, add `ADMIN_IDLE_MINUTES` (1 to 240) in Hostinger's environment variables.
- **Activity** (owners, top bar): sign-ins (with the device and address), sign-outs, idle sign-outs, password changes, two-factor on/off, team changes, record
  deletions, CSV downloads and every time someone opens a client document, plus every edit already shown in each record's History. Filter by person, area,
  dates or text, and download it as CSV. Nobody can edit or delete these entries.
- **Reports:** pick this month, last month, this quarter, this year, last year, the last 90 days or your own dates. It shows money received (confirmed, after
  refunds) and a month-by-month chart, new bookings value, invoices issued, money still to collect and payments waiting for confirmation, received by payment
  method, best-selling journeys, how late outstanding balances and invoices are (not due, 1 to 30, 31 to 60, over 60 days), enquiries by status and by where they
  came from, quotations won and lost, and departures in the next 90 days. Every figure is per currency; USD and KES are never added together.

### Newsletters (the Journal)
- **Newsletters** in the top bar: write an issue (subject, preview line, message) with a live preview that shows exactly what subscribers will see. Formatting is
  simple: blank line = new paragraph, `# Heading`, `## Smaller heading`, `- bullets`, `**bold**`, `[link](https://...)`, `[[Button|https://...]]`,
  `![picture](https://...jpg)`, `---` divider, and `{{first_name}}` for the subscriber's first name (or "there"). Nothing typed can inject code.
- **Send me a test** emails the saved draft to the signed-in person only. **Send to N subscribers** (owners only, after a confirmation) freezes the wording and queues
  one email per currently subscribed person. Anyone who unsubscribes before their turn is skipped.
- Emails go out through the Hostinger mailbox a few at a time **while the sending page stays open**, at most **60 an hour** by default (Hostinger limits how fast a
  mailbox may send; change it with `NEWSLETTER_HOURLY_LIMIT` in Hostinger's environment variables). If the hour's allowance is used up it pauses and says when to press
  **Continue sending**; closing the page is safe, and nothing is ever sent twice. Failed addresses are listed with the mail server's reason and can be retried.
  For a list of more than a few hundred people, or sending to be left to run on its own, move to a dedicated service (Brevo, Mailchimp).
- Every email has the company name and address and an **Unsubscribe** link, plus Gmail's and Apple Mail's own one-click unsubscribe button. The link opens a page
  with an "Unsubscribe me" button (so a mail scanner opening the link cannot unsubscribe anyone), and the subscriber is then marked unsubscribed in the Subscribers list.
  Each subscriber has a private, unguessable token; it never appears in the CSV download.
- Sent issues stay on record and cannot be edited or deleted; **Copy as a new draft** starts the next issue from an old one.
- Sign-ups on the website also get a one-off welcome email, sent as "Finders & Keepers Safaris".

The original features:
- **Overview:** new enquiries, new service requests, subscribers, last 7 days, latest activity.
- **Enquiries / Service requests:** search, filter by status, open a record, see everything the customer sent, one-click Reply by email and
  Open WhatsApp, set a status (New, Contacted, Quoted, Won, Lost, Spam), keep private notes, delete permanently.
- **Subscribers:** search, unsubscribe / resubscribe, delete.
- **Download CSV:** from each list (respects the status filter). Cells that start with `= + - @` are neutralised so spreadsheets never run them.

## How it is protected (three locks)
1. `proxy.js` sends anyone who is not signed in to the login page (and keeps the session fresh).
2. Every admin page, action and download re-checks the sign-in with Supabase AND that the account is on the `admins` list (`lib/admin/auth.js`).
3. The database itself only lets accounts on the `admins` list read or change submissions (row level security). Even a signed-in account that is not on the
   list sees nothing and can change nothing. Nobody can add themselves to the list: it can only be edited from the Supabase dashboard.

Also: the session cookie is `httpOnly` (page scripts cannot read it), login attempts are limited per visitor, `/admin` is `noindex`, `Disallow`ed in
robots.txt and never cached, and wrong-password messages reveal nothing.

## Create your admin account (one-time, you do this)
1. Supabase dashboard > **Authentication > Users > Add user > Create new user**. Enter your email and a long, unique password, and tick
   **Auto Confirm User**. Keep the password in a password manager; never share it.
2. Supabase dashboard > **SQL Editor**, run (replace the email with yours):

```sql
insert into public.admins (user_id)
select id from auth.users where email = 'YOUR-EMAIL@finderskeeperssafaris.com';
```

   It should say 1 row affected. Repeat with another email for each extra staff member. To remove someone:
   `delete from public.admins where user_id = (select id from auth.users where email = '...');`
3. Recommended: **Authentication > Sign In / Providers**, turn **off** "Allow new users to sign up" so nobody can even create an account. (Strangers could not
   see any data anyway, because only accounts on the `admins` list are allowed in.)
4. Sign in at `/admin/login`.

## No extra settings needed on Hostinger
It uses the two `NEXT_PUBLIC_SUPABASE_*` variables that are already set. It does not use, and must never be given, the Supabase service-role key.

## Good to know
- Times are shown in East Africa Time.
- Deleting is permanent; use the Spam status to keep a record without cluttering the New list.
- If the database is ever restored from a backup, the `admins` table is restored with it.

## Two-factor login (everyone should switch it on)
1. Sign in, open **Security** (top right), click **Set up two-factor login**.
2. Install an authenticator app on your phone (Google Authenticator, Microsoft Authenticator or Authy), scan the QR code, type the 6-digit code.
3. From then on, signing in asks for the code after the password.
If someone loses their phone: Supabase dashboard > **Authentication > Users** > open that user > remove their factor. They can then sign in with just
their password and set up again.

## Adding a team member (owners)
1. Supabase > Authentication > Users > Add user > Create new user (their own email, strong password, tick Auto Confirm User).
2. Supabase > SQL Editor:

```sql
insert into public.admins (user_id, role, display_name)
select id, 'staff', 'Their name' from auth.users where email = 'their-email@example.com';
```

Use 'admin' instead of 'staff' for another owner. The Team page can rename people and change roles afterwards.

## One setting only you can switch on
Supabase > **Authentication > Sign In / Providers** (or Attack Protection): turn on **leaked password protection** (Pro plan). It stops people choosing
a password that appears in known data breaches.
