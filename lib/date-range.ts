export function isValidDate(dateStr: string): boolean {
  if (!dateStr) return false;
  const [y, m, d] = dateStr.split("-").map(Number);
  return !isNaN(y) && !isNaN(m) && !isNaN(d) && y > 0 && m >= 1 && m <= 12 && d >= 1 && d <= 31;
}

// Inclusive day count between two YYYY-MM-DD dates. Returns 1 for the same
// date. Callers must have already validated both dates with isValidDate.
export function daysBetweenInclusive(startStr: string, endStr: string): number {
  const [ys, ms, ds] = startStr.split("-").map(Number);
  const [ye, me, de] = endStr.split("-").map(Number);
  const start = new Date(ys, ms - 1, ds);
  const end = new Date(ye, me - 1, de);
  const diffDays = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  return diffDays + 1;
}

// Single source of truth for "how many days does this event span". Returns 1
// (single-day) whenever endDate is null, invalid, equal to date, or before
// date — this is also how malformed ranges clamp to single-day behavior.
export function getSpanDays(date: string, endDate: string | null): number {
  if (endDate === null || !isValidDate(endDate)) return 1;
  return daysBetweenInclusive(date, endDate);
}

export function isMultiDayRange(date: string, endDate: string | null): boolean {
  return getSpanDays(date, endDate) >= 2;
}
