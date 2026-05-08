// Bangladesh / Dhaka timezone helpers (UTC+6)
// Single source of truth for all date/time handling in the app.
// Always use these helpers — never use raw toISOString().slice(0,10) or
// toLocaleString without timezone, otherwise BD users will see wrong dates.

export const BD_TZ = "Asia/Dhaka";
export const BD_LOCALE_BN = "bn-BD";
export const BD_LOCALE_EN = "en-GB"; // DD/MM/YYYY style — not US

const pad = (n: number) => String(n).padStart(2, "0");

/** Returns the date represented by `d` in Dhaka timezone, broken into parts. */
function partsBD(d: Date) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: BD_TZ,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  });
  const parts: any = {};
  for (const p of fmt.formatToParts(d)) {
    if (p.type !== "literal") parts[p.type] = p.value;
  }
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour === "24" ? "00" : parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

/** "YYYY-MM-DD" of today in Dhaka tz. Use this everywhere instead of `new Date().toISOString().slice(0,10)`. */
export const todayBD = (): string => toBDDate(new Date());

/** Convert any Date (or ISO string) → "YYYY-MM-DD" in Dhaka tz. */
export const toBDDate = (d: Date | string): string => {
  const date = typeof d === "string" ? new Date(d) : d;
  const p = partsBD(date);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
};

/**
 * Build a "YYYY-MM-DD" string from BD-local components by adding months
 * to today and (optionally) pinning the day-of-month.
 * Used for installment schedules.
 */
export const bdDateAddMonths = (monthsToAdd: number, dayOfMonth?: number): string => {
  const t = partsBD(new Date());
  const targetMonthIndex = (t.month - 1) + monthsToAdd; // 0-based
  const year = t.year + Math.floor(targetMonthIndex / 12);
  const month = ((targetMonthIndex % 12) + 12) % 12; // 0-based
  // If no specific day given, keep today's day; clamp to month length.
  const baseDay = dayOfMonth ?? t.day;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const day = Math.min(baseDay, daysInMonth);
  return `${year}-${pad(month + 1)}-${pad(day)}`;
};

/** Format a date as a localized BD date string (no time). */
export const fmtDateBD = (d: Date | string | null | undefined, lang: "bn" | "en" = "bn"): string => {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(lang === "bn" ? BD_LOCALE_BN : BD_LOCALE_EN, {
    timeZone: BD_TZ, day: "2-digit", month: "2-digit", year: "numeric",
  }).format(date);
};

/** Format a date+time as a localized BD string. */
export const fmtDateTimeBD = (d: Date | string | null | undefined, lang: "bn" | "en" = "bn"): string => {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(lang === "bn" ? BD_LOCALE_BN : BD_LOCALE_EN, {
    timeZone: BD_TZ, day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  }).format(date);
};

/** Long form date e.g. "০৮ মে ২০২৬" / "08 May 2026" — used in receipts/reports. */
export const fmtDateLongBD = (d: Date | string, lang: "bn" | "en" = "bn"): string => {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat(lang === "bn" ? BD_LOCALE_BN : BD_LOCALE_EN, {
    timeZone: BD_TZ, day: "2-digit", month: "long", year: "numeric",
  }).format(date);
};
