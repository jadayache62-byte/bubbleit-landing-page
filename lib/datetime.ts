// Booking selections are Qatar wall-clock; the API contract carries an
// explicit offset and returns canonical UTC instants. Rendering always targets
// Asia/Qatar, independent of the browser/device timezone.

export const QATAR_UTC_OFFSET = "+03:00";

const QATAR_OFFSET_MS = 3 * 60 * 60 * 1000;
const NAIVE_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/;

/**
 * Serialize a Qatar wall-clock booking slot for the customer API. The API
 * contract is RFC 3339 with Qatar's explicit UTC+03:00 offset.
 */
export function serializeQatarBookingDateTime(date: string, time: string): string {
  return `${date}T${time}:00${QATAR_UTC_OFFSET}`;
}

/**
 * Offset-less values are supported only as a temporary read compatibility
 * path and are interpreted as Qatar wall-clock.
 */
export function formatQatarDateTime(
  iso: string,
  locale: string,
  options: Intl.DateTimeFormatOptions,
): string {
  const normalized = iso.trim().replace(" ", "T");
  const date = new Date(
    NAIVE_DATETIME.test(normalized)
      ? `${normalized}${QATAR_UTC_OFFSET}`
      : normalized,
  );
  return date.toLocaleString(locale, { ...options, timeZone: "Asia/Qatar" });
}

/**
 * Epoch ms of a Qatar wall-clock slot ("YYYY-MM-DD" + "HH:MM"), for comparing
 * against Date.now() to detect slots that have already started.
 */
export function qatarSlotMs(date: string, start: string): number {
  return new Date(`${date}T${start}:00${QATAR_UTC_OFFSET}`).getTime();
}

/** Qatar calendar date (YYYY-MM-DD) for an RFC 3339 instant. */
export function qatarServiceDate(iso: string): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Qatar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso));
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
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
