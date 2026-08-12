/**
 * Convert civil wall-clock date/time in an IANA timezone to a UTC Date.
 * Matches year/month/day/hour/minute (not just hour/minute) so London/BST
 * schedules cannot drift onto the next calendar day.
 */
export function zonedDateTimeToUtc(
  dateStr: string,
  timeStr: string,
  timeZone: string
): Date {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(timeStr.trim());
  if (!dateMatch || !timeMatch) {
    throw new Error(`Invalid date/time: ${dateStr} ${timeStr}`);
  }

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hours = Number(timeMatch[1]);
  const minutes = Number(timeMatch[2]);

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const partsOf = (instant: Date) => {
    const parts = formatter.formatToParts(instant);
    const get = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((p) => p.type === type)?.value ?? "0";
    let hour = parseInt(get("hour"), 10);
    // Some engines emit "24" for midnight
    if (hour === 24) hour = 0;
    return {
      year: parseInt(get("year"), 10),
      month: parseInt(get("month"), 10),
      day: parseInt(get("day"), 10),
      hour,
      minute: parseInt(get("minute"), 10),
    };
  };

  // Initial guess: treat the wall time as if it were UTC, then refine.
  let utcMs = Date.UTC(year, month - 1, day, hours, minutes, 0, 0);

  for (let i = 0; i < 14; i++) {
    const p = partsOf(new Date(utcMs));
    if (
      p.year === year &&
      p.month === month &&
      p.day === day &&
      p.hour === hours &&
      p.minute === minutes
    ) {
      return new Date(utcMs);
    }

    // Compare full civil datetimes so day shifts are corrected, not only HH:mm.
    const desiredMin = Date.UTC(year, month - 1, day, hours, minutes) / 60000;
    const actualMin = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) / 60000;
    const diffMin = desiredMin - actualMin;
    if (diffMin === 0) break;
    // Move the UTC instant in the same direction as the wall-clock error.
    utcMs += diffMin * 60 * 1000;
  }

  const finalParts = partsOf(new Date(utcMs));
  if (
    finalParts.year !== year ||
    finalParts.month !== month ||
    finalParts.day !== day ||
    finalParts.hour !== hours ||
    finalParts.minute !== minutes
  ) {
    throw new Error(
      `Could not resolve ${dateStr} ${timeStr} in ${timeZone} (got ${finalParts.year}-${finalParts.month}-${finalParts.day} ${finalParts.hour}:${finalParts.minute})`
    );
  }

  return new Date(utcMs);
}

/** Local calendar day of a Date as yyyy-MM-dd (for date pickers). */
export function calendarDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Calendar day in `timeZone` for an instant, as a Date at local midnight. */
export function calendarDateFromInstantInTimeZone(instant: Date, timeZone: string): Date {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
    }).formatToParts(instant);
    const y = parseInt(parts.find((p) => p.type === "year")?.value ?? "0", 10);
    const mo = parseInt(parts.find((p) => p.type === "month")?.value ?? "1", 10);
    const d = parseInt(parts.find((p) => p.type === "day")?.value ?? "1", 10);
    if (!y) return new Date(instant);
    return new Date(y, mo - 1, d);
  } catch {
    return new Date(instant);
  }
}

/** Today's civil date string in an IANA zone. */
export function todayDateStringInTimeZone(timeZone: string, now = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
    const y = parts.find((p) => p.type === "year")?.value ?? "1970";
    const m = parts.find((p) => p.type === "month")?.value ?? "01";
    const d = parts.find((p) => p.type === "day")?.value ?? "01";
    return `${y}-${m}-${d}`;
  } catch {
    return calendarDateString(now);
  }
}

/** Format an instant in a timezone for UI (defaults to Europe/London). */
export function formatInTimeZone(
  date: Date | string,
  timeZone = "Europe/London",
  options: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZoneName: "short",
  }
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", { ...options, timeZone }).format(d);
}
