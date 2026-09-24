import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import {
  CAIRO_TZ,
  cairoStartOfDayUtc,
  cairoEndOfDayUtc,
  cairoDayStart,
  cairoDayEnd,
  cairoWeekStartKey,
} from "./cairo-time";

/** Cairo midnight for a calendar date, computed via date-fns-tz (handles DST). */
function expectedStart(ymd: string): string {
  return fromZonedTime(`${ymd}T00:00:00`, CAIRO_TZ).toISOString();
}

function expectedEnd(ymd: string): string {
  return fromZonedTime(`${ymd}T23:59:59.999`, CAIRO_TZ).toISOString();
}

describe("cairo-time (BE-002/003/004)", () => {
  it("exports Africa/Cairo", () => {
    expect(CAIRO_TZ).toBe("Africa/Cairo");
  });

  it("start of day is Cairo midnight as UTC instant", () => {
    // Instant mid-day Cairo on 2026-06-15
    const d = fromZonedTime("2026-06-15T12:00:00", CAIRO_TZ);
    expect(cairoStartOfDayUtc(d).toISOString()).toBe(expectedStart("2026-06-15"));
  });

  it("end of day is just before next Cairo midnight", () => {
    const d = fromZonedTime("2026-06-15T12:00:00", CAIRO_TZ);
    expect(cairoEndOfDayUtc(d).toISOString()).toBe(expectedEnd("2026-06-15"));
  });

  it("handles early-morning UTC that may still be same Cairo day", () => {
    // 01:00 UTC on 15th is still 15th in Cairo (UTC+2/3) → start is 15th midnight
    const d = new Date("2026-06-15T01:00:00.000Z");
    const ymd = formatInTimeZone(d, CAIRO_TZ, "yyyy-MM-dd");
    expect(ymd).toBe("2026-06-15");
    expect(cairoStartOfDayUtc(d).toISOString()).toBe(expectedStart("2026-06-15"));
  });

  it("instant late in UTC evening may be next Cairo day", () => {
    // 23:00 UTC on 14th = 01:00/02:00 Cairo on 15th → start is 15th
    const d = new Date("2026-06-14T23:00:00.000Z");
    const ymd = formatInTimeZone(d, CAIRO_TZ, "yyyy-MM-dd");
    expect(ymd).toBe("2026-06-15");
    expect(cairoStartOfDayUtc(d).toISOString()).toBe(expectedStart("2026-06-15"));
  });

  it("cairoDayStart parses yyyy-MM-dd", () => {
    expect(cairoDayStart("2026-06-15")?.toISOString()).toBe(expectedStart("2026-06-15"));
  });

  it("cairoDayEnd parses yyyy-MM-dd", () => {
    expect(cairoDayEnd("2026-06-15")?.toISOString()).toBe(expectedEnd("2026-06-15"));
  });

  it("invalid date string falls back to Date parse or undefined", () => {
    expect(cairoDayStart(undefined)).toBeUndefined();
    expect(cairoDayStart("not-a-date")).toBeUndefined();
  });

  it("start <= end for same calendar day", () => {
    const s = cairoDayStart("2026-06-15")!;
    const e = cairoDayEnd("2026-06-15")!;
    expect(s.getTime()).toBeLessThan(e.getTime());
  });

  describe("cairoWeekStartKey", () => {
    it("Sunday maps to itself", () => {
      // 2026-06-14 is a Sunday — noon Cairo
      const sunday = fromZonedTime("2026-06-14T12:00:00", CAIRO_TZ);
      expect(cairoWeekStartKey(sunday)).toBe("2026-06-14");
    });

    it("Wednesday maps back to Sunday of that week", () => {
      // 2026-06-17 is a Wednesday
      const wed = fromZonedTime("2026-06-17T12:00:00", CAIRO_TZ);
      expect(cairoWeekStartKey(wed)).toBe("2026-06-14");
    });

    it("Saturday maps back to Sunday of that week", () => {
      // 2026-06-20 is a Saturday
      const sat = fromZonedTime("2026-06-20T12:00:00", CAIRO_TZ);
      expect(cairoWeekStartKey(sat)).toBe("2026-06-14");
    });

    it("instant near Cairo midnight still uses Cairo calendar date", () => {
      // 01:00 UTC 15th = early morning Cairo Monday 15th → week start Sun 14th
      const early = new Date("2026-06-15T01:00:00.000Z");
      expect(cairoWeekStartKey(early)).toBe("2026-06-14");
    });

    it("does not depend on server local timezone", () => {
      // 23:30Z on 17th is early morning Cairo 18th (Wed) → week start 14th
      const instant = new Date("2026-06-17T23:30:00.000Z");
      expect(cairoWeekStartKey(instant)).toBe("2026-06-14");
    });

    it("matches date-fns-tz calendar day for same instant", () => {
      const inst = fromZonedTime("2026-06-19T18:45:00", CAIRO_TZ); // Friday
      expect(cairoWeekStartKey(inst)).toBe("2026-06-14");
      expect(formatInTimeZone(inst, CAIRO_TZ, "yyyy-MM-dd")).toBe("2026-06-19");
    });
  });
});
