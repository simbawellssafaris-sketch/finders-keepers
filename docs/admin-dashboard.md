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
