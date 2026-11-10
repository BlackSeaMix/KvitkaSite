import { NextRequest, NextResponse } from "next/server";
import {
  getCalendarEnv,
  getCalendarAccessToken,
  getBusyRanges,
  rangesOverlap,
} from "../../lib/google-calendar";
import { BOOKING_HOURS_BY_DAY, BOOKING_SLOT_MINUTES, BOOKING_DURATION_MINUTES } from "../../content";

function generateCandidateTimes(date: string): string[] {
  const weekday = new Date(`${date}T00:00:00`).toLocaleDateString("en-US", { weekday: "long" });
  const hours = BOOKING_HOURS_BY_DAY[weekday];
  if (!hours) return [];

  const times: string[] = [];
  const dayStart = new Date(`2000-01-01T${hours.start}:00`);
  const dayEnd = new Date(`2000-01-01T${hours.end}:00`);

  let cursor = dayStart;
  while (cursor.getTime() + BOOKING_DURATION_MINUTES * 60 * 1000 <= dayEnd.getTime()) {
    const h = String(cursor.getHours()).padStart(2, "0");
    const m = String(cursor.getMinutes()).padStart(2, "0");
    times.push(`${h}:${m}`);
    cursor = new Date(cursor.getTime() + BOOKING_SLOT_MINUTES * 60 * 1000);
  }
  return times;
}

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date");
  if (!date || Number.isNaN(new Date(`${date}T00:00:00`).getTime())) {
    return NextResponse.json({ error: "Missing or invalid ?date=YYYY-MM-DD" }, { status: 400 });
  }

  const now = new Date();
  const candidates = generateCandidateTimes(date)
    .map((time) => ({
      time,
      start: new Date(`${date}T${time}:00`),
    }))
    .filter(({ start }) => start.getTime() > now.getTime())
    .map(({ time, start }) => ({
      time,
      start,
      end: new Date(start.getTime() + BOOKING_DURATION_MINUTES * 60 * 1000),
    }));

  const env = getCalendarEnv();
  if (!env) {
    // Not configured — fail open. This endpoint is only a UI hint; the real
    // guard is the conflict check in app/api/book/route.ts.
    return NextResponse.json({ slots: candidates.map(({ time }) => ({ time, available: true })) });
  }

  try {
    const token = await getCalendarAccessToken(env);
    const dayStart = new Date(`${date}T00:00:00`);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    const busy = await getBusyRanges(env, token, dayStart.toISOString(), dayEnd.toISOString());

    const slots = candidates.map(({ time, start, end }) => ({
      time,
      available: !busy.some((b) => rangesOverlap(start, end, new Date(b.start), new Date(b.end))),
    }));

    return NextResponse.json({ slots });
  } catch (err) {
    console.error("Availability check failed, failing open:", err);
    return NextResponse.json({ slots: candidates.map(({ time }) => ({ time, available: true })) });
  }
}
