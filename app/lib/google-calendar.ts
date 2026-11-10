import { JWT } from "google-auth-library";

// Two scopes are required, not one: calendar.events alone gets a 403
// "insufficient authentication scopes" on freeBusy.query specifically —
// confirmed by live-testing against a real calendar, not a guess.
const CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
];

export type CalendarEnv = {
  clientEmail: string;
  privateKey: string;
  calendarId: string;
};

export function getCalendarEnv(): CalendarEnv | null {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKeyRaw = process.env.GOOGLE_PRIVATE_KEY;
  const calendarId = process.env.GOOGLE_CALENDAR_ID;

  if (!clientEmail || !privateKeyRaw || !calendarId) {
    return null;
  }

  return {
    clientEmail,
    privateKey: privateKeyRaw.replace(/\\n/g, "\n"),
    calendarId,
  };
}

export async function getCalendarAccessToken(env: CalendarEnv): Promise<string> {
  const jwtClient = new JWT({
    email: env.clientEmail,
    key: env.privateKey,
    scopes: CALENDAR_SCOPES,
  });
  const { token } = await jwtClient.getAccessToken();
  if (!token) {
    throw new Error("Failed to obtain a Google Calendar access token.");
  }
  return token;
}

export type BusyRange = { start: string; end: string };

export async function getBusyRanges(
  env: CalendarEnv,
  token: string,
  timeMin: string,
  timeMax: string
): Promise<BusyRange[]> {
  const res = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      timeMin,
      timeMax,
      items: [{ id: env.calendarId }],
    }),
  });

  if (!res.ok) {
    throw new Error(`freeBusy query failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  return data.calendars?.[env.calendarId]?.busy ?? [];
}

export function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}
