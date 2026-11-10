// Integration/smoke test for the booking -> Google Calendar flow, including
// the conflict-check and availability-endpoint behavior.
//
// NOT a unit test: it makes real calls to the Google Calendar API, creates
// real events, and deletes them again. Needs real credentials in .env.local
// to run at all, and isn't wired into any CI (this repo doesn't have one) —
// run it manually whenever you want to confirm the calendar integration
// still works, e.g. after rotating the service account key or any Google
// Cloud changes.
//
// Usage:
//   npm run test:calendar
//   TEST_URL=https://kvitka-centrum-salon-aldb.vercel.app npm run test:calendar

import { JWT } from "google-auth-library";
import { readFileSync, existsSync } from "fs";

const TEST_URL = process.env.TEST_URL || "http://localhost:3000";

function loadEnvLocal() {
  if (!existsSync(".env.local")) {
    return {};
  }
  return Object.fromEntries(
    readFileSync(".env.local", "utf8")
      .split("\n")
      .filter((l) => l.includes("=") && !l.startsWith("#"))
      .map((l) => {
        const idx = l.indexOf("=");
        const key = l.slice(0, idx);
        let val = l.slice(idx + 1);
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        return [key, val];
      })
  );
}

const createdEventIds = [];

async function cleanup(token, calendarId) {
  if (createdEventIds.length === 0) return;
  console.log(`\nCleaning up ${createdEventIds.length} test event(s)...`);
  for (const id of createdEventIds) {
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${id}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
    );
    console.log(`  ${res.status === 204 ? "✓" : "✗"} deleted ${id} (status ${res.status})`);
  }
}

function fail(message, token, calendarId) {
  console.error(`✗ ${message}`);
  if (token && calendarId) {
    cleanup(token, calendarId).finally(() => process.exit(1));
  } else {
    process.exit(1);
  }
}

const envFile = loadEnvLocal();
const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || envFile.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const privateKeyRaw = process.env.GOOGLE_PRIVATE_KEY || envFile.GOOGLE_PRIVATE_KEY;
const calendarId = process.env.GOOGLE_CALENDAR_ID || envFile.GOOGLE_CALENDAR_ID;

if (!clientEmail || !privateKeyRaw || !calendarId) {
  fail(
    "Missing GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY / GOOGLE_CALENDAR_ID.\n" +
      "  Set them in .env.local (see README.md's \"One-time Google Calendar setup\")."
  );
}
const privateKey = privateKeyRaw.replace(/\\n/g, "\n");

const jwtClient = new JWT({
  email: clientEmail,
  key: privateKey,
  scopes: [
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/calendar.readonly",
  ],
});
const { token } = await jwtClient.getAccessToken();

// Tomorrow, so it never collides with a real past/present booking.
const testDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
const dateStr = testDate.toISOString().slice(0, 10);
const testTimes = ["15:00", "16:00", "17:00"];
const controlTime = "09:00"; // left untouched, should stay available
const testName = "[Automated Test] verify-calendar-booking.mjs";

console.log(`Target: ${TEST_URL}`);
console.log(`Date: ${dateStr}\n`);

async function bookSlot(time) {
  const res = await fetch(`${TEST_URL}/api/book`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: testName,
      contact: calendarId,
      service: "Lash Extensions",
      date: dateStr,
      time,
      notes: "Created by verify-calendar-booking.mjs — safe to delete.",
    }),
  });
  const body = await res.json().catch(() => ({}));
  return { res, body };
}

async function findEvent(time) {
  const dayStart = new Date(`${dateStr}T00:00:00Z`).toISOString();
  const dayEnd = new Date(new Date(dayStart).getTime() + 24 * 60 * 60 * 1000).toISOString();
  const listRes = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events` +
      `?timeMin=${encodeURIComponent(dayStart)}&timeMax=${encodeURIComponent(dayEnd)}` +
      `&q=${encodeURIComponent("Automated Test")}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!listRes.ok) {
    fail(`Calendar API list request failed: ${listRes.status} ${await listRes.text()}`, token, calendarId);
  }
  const listBody = await listRes.json();
  return listBody.items?.find(
    (ev) => ev.summary?.includes(testName) && ev.start?.dateTime?.startsWith(`${dateStr}T${time}`)
  );
}

// 1. Book a single slot, confirm it lands as a real event.
console.log(`1. Booking a single slot (${testTimes[0]})...`);
{
  const { res, body } = await bookSlot(testTimes[0]);
  if (!res.ok || !body.ok) {
    fail(`/api/book returned ${res.status}: ${JSON.stringify(body)}`, token, calendarId);
  }
  const event = await findEvent(testTimes[0]);
  if (!event) {
    fail("Booking API said success, but no matching event was found on the calendar.", token, calendarId);
  }
  createdEventIds.push(event.id);
  console.log(`   ✓ Found event "${event.summary}" at ${event.start?.dateTime}\n`);
}

// 2. Book two more slots, confirm each lands separately.
console.log(`2. Booking two more slots (${testTimes[1]}, ${testTimes[2]})...`);
for (const time of testTimes.slice(1)) {
  const { res, body } = await bookSlot(time);
  if (!res.ok || !body.ok) {
    fail(`/api/book for ${time} returned ${res.status}: ${JSON.stringify(body)}`, token, calendarId);
  }
  const event = await findEvent(time);
  if (!event) {
    fail(`No matching event found on the calendar for ${time}.`, token, calendarId);
  }
  createdEventIds.push(event.id);
  console.log(`   ✓ Found event "${event.summary}" at ${event.start?.dateTime}`);
}
console.log();

// 3. Check /api/availability reports the booked slots as unavailable and
//    the untouched control slot as still available.
console.log("3. Checking /api/availability reflects the bookings...");
{
  const availRes = await fetch(`${TEST_URL}/api/availability?date=${dateStr}`);
  if (!availRes.ok) {
    fail(`/api/availability returned ${availRes.status}`, token, calendarId);
  }
  const { slots } = await availRes.json();

  for (const time of testTimes) {
    const slot = slots.find((s) => s.time === time);
    if (!slot) {
      fail(`/api/availability didn't return a slot for ${time} at all.`, token, calendarId);
    }
    if (slot.available !== false) {
      fail(`Expected ${time} to be unavailable (booked), got available=${slot.available}.`, token, calendarId);
    }
    console.log(`   ✓ ${time} correctly reported as booked`);
  }

  const control = slots.find((s) => s.time === controlTime);
  if (!control) {
    fail(`/api/availability didn't return the control slot ${controlTime}.`, token, calendarId);
  }
  if (control.available !== true) {
    fail(`Expected control slot ${controlTime} to still be available, got available=${control.available}.`, token, calendarId);
  }
  console.log(`   ✓ Control slot ${controlTime} correctly still available\n`);
}

// 4. Clean up.
await cleanup(token, calendarId);

console.log("\nPASS — booking, conflict detection, and availability all work end to end.");
