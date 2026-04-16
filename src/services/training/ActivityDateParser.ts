const EN_MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

const EN_DATE_RE = /^(\d{1,2})\s+([A-Za-z]{3})\w*\s+(\d{4}),?\s+(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)?$/i;

function applyMeridiem(hours: number, ampm: string | undefined): number {
  if (!ampm) return hours;
  if (ampm === 'PM' && hours < 12) return hours + 12;
  if (ampm === 'AM' && hours === 12) return 0;
  return hours;
}

export class ActivityDateParser {
  parse(raw: string): Date {
    if (!raw) return new Date(NaN);
    const m = EN_DATE_RE.exec(raw.trim());
    if (!m) return new Date(raw.trim());

    const day = Number.parseInt(m[1], 10);
    const month = EN_MONTHS[m[2].toLowerCase()];
    const year = Number.parseInt(m[3], 10);
    const hours = applyMeridiem(Number.parseInt(m[4], 10), m[7]?.toUpperCase());
    const minutes = Number.parseInt(m[5], 10);
    const seconds = Number.parseInt(m[6], 10);
    if (month === undefined) return new Date(NaN);
    return new Date(year, month, day, hours, minutes, seconds);
  }
}
