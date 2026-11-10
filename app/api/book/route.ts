import { NextRequest, NextResponse } from "next/server";
import {
  getCalendarEnv,
  getCalendarAccessToken,
  getBusyRanges,
  rangesOverlap,
} from "../../lib/google-calendar";
import { BOOKING_DURATION_MINUTES } from "../../content";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  if (!body) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { name, contact, service, date, time, notes } = body as Record<string, unknown>;

  if (
    typeof name !== "string" || !name.trim() ||
    typeof contact !== "string" || !contact.trim() ||
    typeof service !== "string" || !service.trim() ||
    typeof date !== "string" || !date.trim() ||
    typeof time !== "string" || !time.trim()
  ) {
    return NextResponse.json({ error: "Please fill in all required fields." }, { status: 400 });
  }

  const env = getCalendarEnv();
  if (!env) {
    console.error("Booking received but Google Calendar isn't configured:", {
      name,
      contact,
      service,
      date,
      time,
      notes,
    });
    return NextResponse.json(
      { error: "Booking isn't wired up to the calendar yet. Please call us instead." },
      { status: 503 }
    );
  }

  const start = new Date(`${date}T${time}:00`);
  if (Number.isNaN(start.getTime())) {
    return NextResponse.json({ error: "Invalid date or time." }, { status: 400 });
  }
  const end = new Date(start.getTime() + BOOKING_DURATION_MINUTES * 60 * 1000);

  try {
    const token = await getCalendarAccessToken(env);

    // Conflict check right before creating the event — the UI's slot picker
    // is just a hint, this is the real guard against double-booking.
    const busy = await getBusyRanges(env, token, start.toISOString(), end.toISOString());
    const conflict = busy.some((b) => rangesOverlap(start, end, new Date(b.start), new Date(b.end)));
    if (conflict) {
      return NextResponse.json(
        { error: "That slot was just taken — please pick another." },
        { status: 409 }
      );
    }

    // No attendees/sendUpdates here: a bare service account without
    // Domain-Wide Delegation (Workspace-only) gets rejected by Google when
    // inviting attendees — confirmed live against a real calendar. The
    // "+ Add to Google Calendar" link on the success message covers this
    // for the customer instead.
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(env.calendarId)}/events`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          summary: `${service} — ${name}`,
          description: [`Contact: ${contact}`, notes ? `Notes: ${notes}` : null]
            .filter(Boolean)
            .join("\n"),
          start: { dateTime: start.toISOString() },
          end: { dateTime: end.toISOString() },
        }),
      }
    );

    if (!res.ok) {
      console.error("Google Calendar error:", await res.text());
      return NextResponse.json(
        { error: "Failed to add booking to the calendar. Please call us instead." },
        { status: 502 }
      );
    }
  } catch (err) {
    console.error("Google Calendar request failed:", err);
    return NextResponse.json(
      { error: "Failed to add booking to the calendar. Please call us instead." },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
