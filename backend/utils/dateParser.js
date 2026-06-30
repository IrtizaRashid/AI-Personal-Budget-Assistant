// Centralized date + time parsing utilities.
// Converts natural-language date/time strings to normalized MySQL values.
// Uses the server's local timezone throughout — no external dependencies.
import { parseTime } from './timeParser.js';

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const MONTH_MAP = {
  january: 1, jan: 1,
  february: 2, feb: 2,
  march: 3, mar: 3,
  april: 4, apr: 4,
  may: 5,
  june: 6, jun: 6,
  july: 7, jul: 7,
  august: 8, aug: 8,
  september: 9, sep: 9, sept: 9,
  october: 10, oct: 10,
  november: 11, nov: 11,
  december: 12, dec: 12,
};

const WORD_NUM = {
  a: 1, an: 1, one: 1,
  two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const localToday = () => {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
};

const fmt = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const addDays = (base, n) =>
  new Date(base.getFullYear(), base.getMonth(), base.getDate() + n);

const addMonths = (base, n) =>
  new Date(base.getFullYear(), base.getMonth() + n, 1);

const addYears = (base, n) =>
  new Date(base.getFullYear() + n, base.getMonth(), base.getDate());

const isValidDate = (y, m, d) => {
  const check = new Date(y, m - 1, d);
  return check.getFullYear() === y && check.getMonth() === m - 1 && check.getDate() === d;
};

// Most recent past occurrence of a day-of-week (0=Sun … 6=Sat).
// If today is already that DOW, goes back a full week.
const lastDOW = (dow, base) => {
  const diff = ((base.getDay() - dow + 7) % 7) || 7;
  return addDays(base, -diff);
};

// DOW within the current Mon–Sun week.
const thisDOW = (dow, base) => {
  const mondayOffset = (base.getDay() + 6) % 7;
  const monday = addDays(base, -mondayOffset);
  const targetOffset = (dow + 6) % 7; // Mon=0 … Sun=6
  return addDays(monday, targetOffset);
};

// Next future occurrence of a DOW.
// If today is already that DOW, goes forward a full week.
const nextDOW = (dow, base) => {
  const diff = ((dow - base.getDay() + 7) % 7) || 7;
  return addDays(base, diff);
};

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * parseDate(raw) → "YYYY-MM-DD"
 *
 * Accepts any natural-language or absolute date string.
 * Falls back to today's date if the input is null/undefined/unrecognised.
 * Never throws — always returns a valid YYYY-MM-DD string.
 */
export const parseDate = (raw) => {
  if (!raw || typeof raw !== 'string') return fmt(localToday());

  const today = localToday();
  // Normalise: lowercase, strip leading/trailing spaces and punctuation.
  const s = raw.trim().toLowerCase().replace(/[,.']/g, '').replace(/\s+/g, ' ');

  // ── Exact relative keywords ───────────────────────────────────────────────

  if (/^(today|this morning|this afternoon|this evening|tonight)$/.test(s))
    return fmt(today);

  if (/^(yesterday|last night|yesterday morning|yesterday evening|yesterday afternoon)$/.test(s))
    return fmt(addDays(today, -1));

  if (/^(tomorrow|tomorrow morning|tomorrow evening|tomorrow afternoon)$/.test(s))
    return fmt(addDays(today, 1));

  if (s === 'day before yesterday') return fmt(addDays(today, -2));
  if (s === 'day after tomorrow')  return fmt(addDays(today, 2));

  if (s === 'last week')  return fmt(addDays(today, -7));
  if (s === 'last month') return fmt(addMonths(today, -1));
  if (s === 'last year')  return fmt(addYears(today, -1));

  // Weekends
  if (s === 'this weekend') return fmt(thisDOW(6, today));      // Saturday
  if (s === 'last weekend') return fmt(addDays(thisDOW(6, today), -7));
  if (s === 'next weekend') return fmt(addDays(thisDOW(6, today), 7));

  // ── "Last / This / Next <weekday>" ───────────────────────────────────────

  const dowRe = `(${DAY_NAMES.join('|')})`;

  const lastDowM = s.match(new RegExp(`^last ${dowRe}$`));
  if (lastDowM) return fmt(lastDOW(DAY_NAMES.indexOf(lastDowM[1]), today));

  const thisDowM = s.match(new RegExp(`^this ${dowRe}$`));
  if (thisDowM) return fmt(thisDOW(DAY_NAMES.indexOf(thisDowM[1]), today));

  const nextDowM = s.match(new RegExp(`^next ${dowRe}$`));
  if (nextDowM) return fmt(nextDOW(DAY_NAMES.indexOf(nextDowM[1]), today));

  // ── "N <unit> ago" — numeric ─────────────────────────────────────────────

  const numAgo = s.match(/^(\d+)\s+(days?|weeks?|months?|years?)\s+ago$/);
  if (numAgo) {
    const n = parseInt(numAgo[1], 10);
    const unit = numAgo[2];
    if (/^days?$/.test(unit))   return fmt(addDays(today, -n));
    if (/^weeks?$/.test(unit))  return fmt(addDays(today, -n * 7));
    if (/^months?$/.test(unit)) return fmt(addMonths(today, -n));
    if (/^years?$/.test(unit))  return fmt(addYears(today, -n));
  }

  // ── "N <unit> ago" — written words ───────────────────────────────────────

  const wordNums = Object.keys(WORD_NUM).join('|');
  const wordAgo = s.match(new RegExp(`^(${wordNums})\\s+(days?|weeks?|months?|years?)\\s+ago$`));
  if (wordAgo) {
    const n = WORD_NUM[wordAgo[1]];
    const unit = wordAgo[2];
    if (/^days?$/.test(unit))   return fmt(addDays(today, -n));
    if (/^weeks?$/.test(unit))  return fmt(addDays(today, -n * 7));
    if (/^months?$/.test(unit)) return fmt(addMonths(today, -n));
    if (/^years?$/.test(unit))  return fmt(addYears(today, -n));
  }

  // ── Absolute: ISO — 2026-06-05 ───────────────────────────────────────────

  const isoM = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoM) {
    const [, y, m, d] = isoM.map(Number);
    if (isValidDate(y, m, d))
      return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  }

  // ── Absolute: DD/MM/YYYY or MM/DD/YYYY ───────────────────────────────────

  const slashM = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashM) {
    const [, a, b, y] = slashM.map(Number);
    // Prefer DD/MM/YYYY (common in Pakistan)
    if (isValidDate(y, b, a)) return `${y}-${String(b).padStart(2,'0')}-${String(a).padStart(2,'0')}`;
    if (isValidDate(y, a, b)) return `${y}-${String(a).padStart(2,'0')}-${String(b).padStart(2,'0')}`;
  }

  // ── Absolute: named month ─────────────────────────────────────────────────
  // Patterns handled: "5 June", "June 5", "5th June", "June 5th",
  //                   "5 June 2026", "June 5 2026", "5 Jun 2026", "5 Jun"

  const monthNames = Object.keys(MONTH_MAP).join('|');
  const ordSuffix = '(?:st|nd|rd|th)?';

  // D Month [YYYY]
  const dMonthM = s.match(
    new RegExp(`^(\\d{1,2})${ordSuffix}\\s+(${monthNames})(?:\\s+(\\d{4}))?$`)
  );
  if (dMonthM) {
    const day = parseInt(dMonthM[1], 10);
    const month = MONTH_MAP[dMonthM[2]];
    const year = dMonthM[3] ? parseInt(dMonthM[3], 10) : today.getFullYear();
    if (month && isValidDate(year, month, day))
      return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  }

  // Month D [YYYY]
  const monthDM = s.match(
    new RegExp(`^(${monthNames})\\s+(\\d{1,2})${ordSuffix}(?:\\s+(\\d{4}))?$`)
  );
  if (monthDM) {
    const month = MONTH_MAP[monthDM[1]];
    const day = parseInt(monthDM[2], 10);
    const year = monthDM[3] ? parseInt(monthDM[3], 10) : today.getFullYear();
    if (month && isValidDate(year, month, day))
      return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  }

  // ── Nothing matched — default to today ───────────────────────────────────
  return fmt(today);
};

/**
 * resolveExpenseDate(aiDate)
 * Returns YYYY-MM-DD. Falls back to today if aiDate is null/unrecognised.
 */
export const resolveExpenseDate = (aiDate) => {
  if (!aiDate) return fmt(localToday());
  return parseDate(aiDate);
};

// Current server time as HH:mm:ss.
const currentTime = () => {
  const n = new Date();
  return `${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}:${String(n.getSeconds()).padStart(2,'0')}`;
};

/**
 * resolveExpenseDateTime(dateStr, timeStr)
 *
 * Combines a (possibly relative) date string and a (possibly relative) time
 * string into "YYYY-MM-DD HH:mm:ss" for MySQL DATETIME.
 *
 * Fallback rules (professional behaviour):
 *   - date given, time given     → parsed date + parsed time
 *   - date given, time missing   → parsed date + 00:00:00  (midnight — start of that day)
 *   - date missing, time given   → today        + parsed time
 *   - date missing, time missing → today        + current server time
 *
 * Anchoring to midnight when a date is named but no time is given prevents
 * timestamps like "yesterday at 14:37" when the user just said "yesterday".
 */
export const resolveExpenseDateTime = (dateStr, timeStr) => {
  const datePart = resolveExpenseDate(dateStr);
  const resolvedTime = timeStr ? parseTime(timeStr) : null;
  const timePart = resolvedTime ?? (dateStr ? '00:00:00' : currentTime());
  return `${datePart} ${timePart}`;
};
