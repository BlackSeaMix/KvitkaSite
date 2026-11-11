# Shop landing page template

A single-page Next.js landing page for pitching small local businesses (barbershop, salon, etc.) a simple website, plus a basic booking form. No database, no auth — just a fast, deployable site with one serverless function for bookings.

## Editing content for a shop

Everything shop-specific (name, tagline, phone, address, services/prices, gallery images, hours, reviews) lives in `app/content.ts`. Edit that one file.

The accent colors (currently blue/yellow, a Ukrainian-flag theme) are set via Tailwind class names directly in `app/page.tsx` — Tailwind can't resolve dynamically-interpolated class names at build time, so they aren't in `content.ts`. To re-theme, find-replace the `blue-*`/`yellow-*` classes in `app/page.tsx` for other Tailwind colors.

### Gallery images

Drop image files into `public/gallery/` and set the matching `src` (e.g. `"/gallery/lashes-1.jpg"`) on the corresponding entry in `GALLERY_ITEMS` in `app/content.ts`. Entries with `src: null` render as a placeholder tile instead.

## Booking form

The "Book Now" section posts to `app/api/book/route.ts`, which creates an event directly on the shop's Google Calendar (via a service account, so no interactive login is needed). Copy `.env.example` to `.env.local` and fill in:

- `GOOGLE_SERVICE_ACCOUNT_EMAIL` / `GOOGLE_PRIVATE_KEY` — from a Google Cloud service account JSON key
- `GOOGLE_CALENDAR_ID` — the calendar to write events to (the shop's Google account email for their primary calendar, or a specific calendar's ID from its settings page)

Without these set, the form still works but bookings are only logged server-side (no calendar event created), and the visitor sees a "call us instead" message.

### Availability and conflict checking

`/api/availability?date=YYYY-MM-DD` generates candidate slots from `BOOKING_HOURS_BY_DAY`/`BOOKING_SLOT_MINUTES`/`BOOKING_DURATION_MINUTES` (all in `app/content.ts`) and checks each against the calendar's `freeBusy` data, so the booking form's time dropdown shows already-booked slots as disabled. This is only a UI hint — if Calendar isn't configured, or the `freeBusy` call fails, it fails open (shows everything as available) rather than blocking the form.

The real guard is in `app/api/book/route.ts`: right before creating the event, it re-checks `freeBusy` for the exact requested slot and returns `409` ("that slot was just taken") instead of creating a duplicate if two people try to book the same time at once.

Note the `freeBusy` endpoint needs **two scopes**, not one — `calendar.events` alone gets a 403 on `freeBusy.query` specifically. `app/lib/google-calendar.ts` requests both `calendar.events` and `calendar.readonly`.

### No attendee invites

Bookings don't add the customer as a Calendar attendee (no invite email). A bare service account without **Domain-Wide Delegation** (a Google Workspace-only feature) is rejected by Google when trying to invite attendees — not available for a personal Gmail-based calendar like this one. Instead, the booking confirmation includes a client-side-built "+ Add to Google Calendar" link (`calendar.google.com/calendar/render`) so the customer can add it to their own calendar themselves.

### Spam protection (reCAPTCHA)

The booking form is a public, unauthenticated endpoint — without any
protection, a script could submit it repeatedly and fill the calendar with
junk bookings. Google reCAPTCHA v2 (the "I'm not a robot" checkbox) guards
against that. Copy `.env.example` to `.env.local` and fill in:

- `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` — public, used client-side to render the
  checkbox widget
- `RECAPTCHA_SECRET_KEY` — server-only, used to verify the token before a
  booking is created

Without these set, the form works exactly as before with no captcha —
spam protection is off, not broken.

#### One-time reCAPTCHA setup

1. Go to [google.com/recaptcha/admin](https://www.google.com/recaptcha/admin)
   and register a new site.
2. Choose **reCAPTCHA v2 → "I'm not a robot" Checkbox**.
3. Add the domain(s) the site runs on. `localhost` doesn't need to be
   added — Google allow-lists it automatically for any v2 key.
4. Copy the **Site Key** into `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` and the
   **Secret Key** into `RECAPTCHA_SECRET_KEY`.

### One-time Google Calendar setup

1. In [Google Cloud Console](https://console.cloud.google.com/), create a project (or reuse one) and enable the **Google Calendar API**.
2. Create a **Service Account** (IAM & Admin → Service Accounts), then create a JSON key for it and download it.
3. From that JSON file: `client_email` → `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `private_key` → `GOOGLE_PRIVATE_KEY` (keep the `\n` line breaks as-is, the app un-escapes them).
4. On the Google account whose calendar should receive bookings, open Google Calendar → Settings → pick the calendar → **Share with specific people** → add the service account's email with **"Make changes to events"** permission.
5. `GOOGLE_CALENDAR_ID` is that calendar's address, found under Settings → "Integrate calendar" (for a primary calendar, it's just the Google account's email address).

### Verifying it works

```bash
npm run test:calendar
```

Submits a real test booking to `/api/book`, confirms the event actually landed on the calendar via the Calendar API, then deletes it again. Needs `.env.local` set up per above — targets `http://localhost:3000` by default (run `npm run dev` in another terminal first), or point it elsewhere with `TEST_URL=https://your-deployment.vercel.app npm run test:calendar`.

This is an integration test, not a unit test — it makes real network calls and needs real credentials, so it's not wired into any CI. Run it manually after setup, after rotating the service account key, or whenever you want to confirm the calendar integration specifically still works.

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy

```bash
npm run deploy
```

Builds locally, deploys to Vercel production, and checks the live URL returns 200.

## Starting the next shop

1. Copy this directory: `cp -r Kvitka <new-shop-name>`
2. Inside the copy, remove `.vercel/`, `node_modules/`, and `.next/` so it starts as its own fresh project instead of redeploying over this one
3. Edit `app/content.ts` with the new shop's details
4. `npm install`
5. `npm run deploy`
