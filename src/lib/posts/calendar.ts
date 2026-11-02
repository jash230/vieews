import { addDays, endOfMonth, endOfWeek, format, isSameMonth, isValid, parse, startOfMonth, startOfWeek } from "date-fns";

// Month-grid math for the posts calendar. Days are local days, so bucket posts in the viewer's browser:
// on the server, "local" is the server's time zone (UTC on Vercel), not the user's.

export type WeekStart = 0 | 1;

export interface CalendarDay {
  /** `yyyy-MM-dd`, the key `bucketByDay` uses. */
  key: string;
  date: Date;
  inMonth: boolean;
}

type Dated = { scheduled_for: string | null; created_at: string };

/** `?month=2026-11` → the 1st of that month; anything else → the current month. */
export function parseMonth(param: string | null | undefined, now = new Date()): Date {
  const parsed = param ? parse(param, "yyyy-MM", now) : null;
  return startOfMonth(parsed && isValid(parsed) ? parsed : now);
}

/** Whole weeks covering the month: from the week holding the 1st to the week holding the last day. */
export function monthWeeks(month: Date, weekStartsOn: WeekStart = 0): CalendarDay[][] {
  const first = startOfWeek(startOfMonth(month), { weekStartsOn });
  const last = endOfWeek(endOfMonth(month), { weekStartsOn });
  const weeks: CalendarDay[][] = [];
  for (let day = first; day <= last; day = addDays(day, 1)) {
    if (weeks.length === 0 || weeks[weeks.length - 1].length === 7) weeks.push([]);
    weeks[weeks.length - 1].push({ key: format(day, "yyyy-MM-dd"), date: day, inMonth: isSameMonth(day, month) });
  }
  return weeks;
}

/**
 * The span to query for a month's grid, padded a day each side so a server in another time zone
 * still fetches every post the viewer's local grid shows.
 */
export function monthRange(month: Date, weekStartsOn: WeekStart = 0): { from: string; to: string } {
  const weeks = monthWeeks(month, weekStartsOn);
  const first = weeks[0][0].date;
  const last = weeks[weeks.length - 1][6].date;
  return { from: addDays(first, -1).toISOString(), to: addDays(last, 2).toISOString() };
}

/** When a post sits on the calendar: its scheduled time, or when it was made if it went out right away. */
export function postTime(post: Dated): Date {
  return new Date(post.scheduled_for ?? post.created_at);
}

/** Posts grouped by local day (`yyyy-MM-dd`), earliest first within each day. */
export function bucketByDay<T extends Dated>(posts: T[]): Map<string, T[]> {
  const days = new Map<string, T[]>();
  const sorted = [...posts].sort((a, b) => postTime(a).getTime() - postTime(b).getTime());
  for (const post of sorted) {
    const key = format(postTime(post), "yyyy-MM-dd");
    days.set(key, [...(days.get(key) ?? []), post]);
  }
  return days;
}
