# Server plan: Hostinger + Supabase

## 1. Hosting — check this first
Server features need a host that **runs Node.js**. In Hostinger's hPanel look for **Websites → Add website → Node.js Web App**
(available on their Business/Cloud and VPS plans; plain "Premium/Business" shared hosting without that option can only serve static files).
- If Node.js Web App is available: connect the project (GitHub import or ZIP upload), set the build command `npm run build`, start command `npm start`, Node 20+, and add the environment variables from `.env.example`.
- If it is not available on the "unlimited" plan: either upgrade to a Node-capable Hostinger plan, or host this app on Vercel (free tier) and keep the domain at Hostinger. Do not try to run it as static files once APIs are added.
- The site is ~500 MB of images/video. If the host's disk or memory is tight, move `public/assets` (images, videos, PDFs) to Supabase Storage or another CDN later; the pages only need their web addresses changed.

## 2. Supabase (database, admin login, file storage)
1. Create a Supabase project; copy the URL, `anon` key and `service_role` key into `.env.local` (and the host's environment settings).
2. Tables to create: `enquiries` (name, email, phone, message, source page, created_at, status), `bookings` (guest details, package/lodge, dates, party size, price, status, payment status), `payments`, `subscribers`.
3. Turn on Row Level Security; only the server (service role) writes enquiries/bookings; the admin signs in with Supabase Auth.

## 3. Build order (suggested)
1. **Enquiry form** → `POST /api/enquiries` saves to Supabase and e-mails you + the guest (Resend or Hostinger SMTP). The existing "Speak To Us" pop-up (`content/shared/enquiry-modal.html`) is where the form lives.
2. **Admin page** `/admin` (Supabase login): list/search enquiries, mark status, notes.
3. **WhatsApp / Instagram**: click-to-chat links work today; automatic replies need the WhatsApp Business Cloud API (token in `.env.local`). Instagram: link or feed embed first.
4. **Online booking**: availability/price per package, booking form, saves to `bookings`.
5. **Payments**: pick a provider (Stripe, Pesapal, or M-Pesa/Daraja for Kenya), create a checkout session in an API route, confirm via webhook `/api/payments/webhook`, update the booking.

## 4. Before going live
- Buy the domain; replace the placeholder `finderskeeperssafaris.com`.
- Turn on HTTPS, set all environment variables on the host, test a real enquiry end to end.
