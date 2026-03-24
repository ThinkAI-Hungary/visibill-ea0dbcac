/**
 * Returns the first and last day of the month preceding the given date,
 * formatted as ISO date strings (YYYY-MM-DD).
 */
export function getPreviousMonthRange(date: Date): { from: string; to: string } {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-indexed: Jan = 0

  // Previous month: month - 1 (Date handles year rollover automatically)
  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month, 0); // Day 0 of current month = last day of previous month

  return {
    from: formatISO(from),
    to: formatISO(to),
  };
}

function formatISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
