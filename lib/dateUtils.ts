// Centralized Thai-timezone date helpers.
//
// NOTE: `new Date().toLocaleDateString('th-TH')` only sets the LOCALE (Buddhist
// era, formatting) — it does NOT set the timezone, so on a UTC server (Vercel)
// it returns the UTC date. Between 00:00–07:00 Thai time the UTC date is still
// "yesterday", producing dates that are off by one day and inconsistent with
// the DocId (which is pinned to Asia/Bangkok).
//
// `getThaiDateString` reproduces the exact same format as the old call
// (e.g. "30/6/2569", Buddhist year, no leading zeros) but pinned to Bangkok,
// so existing sheet data stays compatible — only the off-by-one bug is fixed.

export function getThaiDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok' }).format(date);
}
