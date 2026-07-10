// Bubble It operates only in Doha, Qatar (UTC+3, no DST). Booking times are
// Qatar wall-clock everywhere: API responses may label the wall-clock digits
// with `+00:00`, while the local mock returns them without an offset. Neither
// representation should be converted to the viewer's browser time zone.

export const QATAR_UTC_OFFSET = "+03:00";

const QATAR_OFFSET_MS = 3 * 60 * 60 * 1000;
const NAIVE_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/;

/**
 * Serialize a Qatar wall-clock booking slot for the customer API. The API
 * contract intentionally uses a timezone-naive string: YYYY-MM-DDTHH:mm:ss.
 */
export function serializeQatarBookingDateTime(date: string, time: string): string {
  return `${date}T${time}:00`;
}

/**
 * Format a booking datetime from the API as Qatar wall-clock, regardless of
 * the viewer's time zone. The API normally labels Qatar wall-clock digits as
 * +00:00, while the local mock returns the same digits without an offset. A
 * naive value is therefore anchored to UTC before rendering so its digits are
 * preserved instead of being interpreted in the viewer's local time zone.
 */
export function formatQatarDateTime(
  iso: string,
  locale: string,
  options: Intl.DateTimeFormatOptions,
): string {
  const normalized = iso.trim().replace(" ", "T");
  const date = new Date(
    NAIVE_DATETIME.test(normalized) ? `${normalized}Z` : normalized,
  );
  return date.toLocaleString(locale, { ...options, timeZone: "UTC" });
}

/**
 * Epoch ms of a Qatar wall-clock slot ("YYYY-MM-DD" + "HH:MM"), for comparing
 * against Date.now() to detect slots that have already started.
 */
export function qatarSlotMs(date: string, start: string): number {
  return new Date(`${date}T${start}:00${QATAR_UTC_OFFSET}`).getTime();
}

/**
 * The next `count` calendar days in Qatar, starting from Qatar's today.
 * `date` is YYYY-MM-DD; `label`/`weekday` are formatted for the Qatar date.
 */
export function nextQatarDays(
  count: number,
): { date: string; label: string; weekday: string; monthDay: string }[] {
  const qatarNow = new Date(Date.now() + QATAR_OFFSET_MS);
  const days = [];
  for (let i = 0; i < count; i++) {
    // Anchor at UTC noon so toLocaleDateString(timeZone: "UTC") is unambiguous.
    const d = new Date(
      Date.UTC(
        qatarNow.getUTCFullYear(),
        qatarNow.getUTCMonth(),
        qatarNow.getUTCDate() + i,
        12,
      ),
    );
    const monthDay = d.toLocaleDateString("en", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
    days.push({
      date: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`,
      label: i === 0 ? "Today" : i === 1 ? "Tomorrow" : monthDay,
      weekday: d.toLocaleDateString("en", {
        weekday: "short",
        timeZone: "UTC",
      }),
      monthDay,
    });
  }
  return days;
}
