import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export const CAIRO_TZ = "Africa/Cairo";

/** Instant at Cairo local midnight for the Cairo calendar day containing `d`. */
export function cairoStartOfDayUtc(d: Date = new Date()): Date {
  const ymd = formatInTimeZone(d, CAIRO_TZ, "yyyy-MM-dd");
  return fromZonedTime(`${ymd}T00:00:00`, CAIRO_TZ);
}

/** Instant at end of the Cairo calendar day containing `d`. */
export function cairoEndOfDayUtc(d: Date = new Date()): Date {
  const ymd = formatInTimeZone(d, CAIRO_TZ, "yyyy-MM-dd");
  return fromZonedTime(`${ymd}T23:59:59.999`, CAIRO_TZ);
}

/** Parse `yyyy-MM-dd` as Cairo day boundaries. Returns undefined if invalid. */
export function cairoDayStart(val?: string): Date | undefined {
  if (!val) return undefined;
  const t = val.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    const d = new Date(val);
    return isNaN(d.getTime()) ? undefined : d;
  }
  return fromZonedTime(`${t}T00:00:00`, CAIRO_TZ);
}

export function cairoDayEnd(val?: string): Date | undefined {
  if (!val) return undefined;
  const t = val.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    const d = new Date(val);
    return isNaN(d.getTime()) ? undefined : d;
  }
  return fromZonedTime(`${t}T23:59:59.999`, CAIRO_TZ);
}

/**
 * Cairo week-start key (`yyyy-MM-dd` of Sunday in Africa/Cairo) for an instant.
 * Calendar math runs on the Cairo wall date extracted via formatInTimeZone —
 * avoids the toZonedTime/setDate/getDay server-TZ bug (BE-002).
 */
export function cairoWeekStartKey(instant: Date): string {
  const ymd = formatInTimeZone(instant, CAIRO_TZ, "yyyy-MM-dd");
  const [y, m, d] = ymd.split("-").map(Number);
  // Noon UTC on the calendar date: getUTCDay is pure calendar, no TZ shift.
  const noon = new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0));
  const dow = noon.getUTCDay(); // 0=Sunday
  noon.setUTCDate(noon.getUTCDate() - dow);
  const yy = noon.getUTCFullYear();
  const mm = String(noon.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(noon.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}
