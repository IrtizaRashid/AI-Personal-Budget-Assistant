// Time-parsing utility.
// Converts any natural-language or absolute time string to HH:mm:ss (24-hour).
// Never depends on external libraries. Uses the server's local clock for
// relative expressions ("now", "this morning", etc.).

// ── Helpers ───────────────────────────────────────────────────────────────────

const pad = (n) => String(Math.floor(n)).padStart(2, '0');

// Format h, m, s integers as HH:mm:ss.
const fmt = (h, m = 0, s = 0) => `${pad(h)}:${pad(m)}:${pad(s)}`;

// Current local time as HH:mm:ss.
const nowTime = () => {
  const d = new Date();
  return fmt(d.getHours(), d.getMinutes(), d.getSeconds());
};

// Convert h (0-23), m (0-59) to HH:mm:ss, or return null if invalid.
const safe = (h, m = 0, s = 0) => {
  if (h < 0 || h > 23 || m < 0 || m > 59 || s < 0 || s > 59) return null;
  return fmt(h, m, s);
};

// Apply AM/PM to a 12-hour clock value. Returns null for impossible input.
const apply12 = (h, m, meridiem) => {
  if (h < 1 || h > 12 || m < 0 || m > 59) return null;
  if (meridiem === 'am') return safe(h === 12 ? 0 : h, m);
  if (meridiem === 'pm') return safe(h === 12 ? 12 : h + 12, m);
  return null;
};

// Spoken number words → integer (for "five thirty", "eight fifteen", etc.)
const WORD_HOUR = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
};
const WORD_MINUTE = {
  oh: 0, zero: 0, five: 5, ten: 10, fifteen: 15, twenty: 20,
  'twenty-five': 25, twentyfive: 25, thirty: 30, 'thirty-five': 35,
  thirtyfive: 35, forty: 40, 'forty-five': 45, fortyfive: 45, fifty: 50,
  'fifty-five': 55, fiftyfive: 55,
};

// ── Named / relative time expressions ────────────────────────────────────────
// Returns HH:mm:ss or null.

const NAMED = {
  'now':               () => nowTime(),
  'right now':         () => nowTime(),
  'just now':          () => nowTime(),
  'midnight':          () => '00:00:00',
  'noon':              () => '12:00:00',
  'midday':            () => '12:00:00',
  // "morning" band 06:00–11:59
  'this morning':      () => '08:00:00',
  'yesterday morning': () => '08:00:00',
  'tomorrow morning':  () => '08:00:00',
  'early morning':     () => '06:00:00',
  'late morning':      () => '10:30:00',
  // "afternoon" band 12:00–16:59
  'this afternoon':    () => '14:00:00',
  'yesterday afternoon':() => '14:00:00',
  'tomorrow afternoon':() => '14:00:00',
  'early afternoon':   () => '12:30:00',
  'late afternoon':    () => '16:00:00',
  // "evening" band 17:00–20:59
  'this evening':      () => '18:00:00',
  'yesterday evening': () => '18:00:00',
  'tomorrow evening':  () => '18:00:00',
  'early evening':     () => '17:00:00',
  'late evening':      () => '20:00:00',
  // "night"
  'tonight':           () => '20:00:00',
  'last night':        () => '21:00:00',
  'late night':        () => '23:00:00',
};

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * parseTime(raw) → "HH:mm:ss" | null
 *
 * Returns null when no time expression is recognised.
 * Returns the server's current time for "now" / "right now" / "just now".
 * Never throws.
 */
export const parseTime = (raw) => {
  if (!raw || typeof raw !== 'string') return null;

  // Normalise: lowercase, collapse whitespace, strip trailing dots/commas.
  const s = raw.trim().toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.,]+$/, '')
    .replace(/o'clock/g, '')   // "7 o'clock" → "7 "
    .trim();

  // ── Named / relative ─────────────────────────────────────────────────────
  if (NAMED[s]) return NAMED[s]();

  // ── "N in the morning / afternoon / evening" ─────────────────────────────
  // e.g. "10 in the morning", "5 in the evening"
  const inThe = s.match(/^(\d{1,2})(?::(\d{2}))?\s+in\s+the\s+(morning|afternoon|evening)$/);
  if (inThe) {
    const h = parseInt(inThe[1], 10);
    const m = inThe[2] ? parseInt(inThe[2], 10) : 0;
    const period = inThe[3];
    if (period === 'morning')   return safe(h, m);          // treat as 24h (morning = AM)
    if (period === 'afternoon') return apply12(h, m, 'pm'); // afternoon → PM
    if (period === 'evening')   return apply12(h, m, 'pm'); // evening → PM
  }

  // ── "Quarter past H", "Half past H", "Quarter to H" ──────────────────────
  const quarterPast = s.match(/^quarter\s+past\s+(\w+|\d+)$/);
  if (quarterPast) {
    const h = parseInt(quarterPast[1]) || WORD_HOUR[quarterPast[1]];
    if (h >= 1 && h <= 12) return safe(h % 12 === 0 ? 12 : h, 15);
  }

  const halfPast = s.match(/^half\s+past\s+(\w+|\d+)$/);
  if (halfPast) {
    const h = parseInt(halfPast[1]) || WORD_HOUR[halfPast[1]];
    if (h >= 1 && h <= 12) return safe(h, 30);
  }

  const quarterTo = s.match(/^quarter\s+to\s+(\w+|\d+)$/);
  if (quarterTo) {
    const h = parseInt(quarterTo[1]) || WORD_HOUR[quarterTo[1]];
    if (h >= 1 && h <= 12) {
      const prev = h === 1 ? 12 : h - 1;
      return safe(prev, 45);
    }
  }

  // ── Spoken form: "five thirty", "eight fifteen" ───────────────────────────
  const spoken = s.match(/^([a-z]+)\s+([a-z-]+)(?:\s+(am|pm))?$/);
  if (spoken && WORD_HOUR[spoken[1]] && WORD_MINUTE[spoken[2]] !== undefined) {
    const h = WORD_HOUR[spoken[1]];
    const m = WORD_MINUTE[spoken[2]];
    const mer = spoken[3];
    if (mer) return apply12(h, m, mer);
    // No meridiem — assume 24h (small hours stay as-is)
    return safe(h, m);
  }

  // ── 24-hour formats: 15:30, 08:15, 23:59, 00:00 ──────────────────────────
  const h24 = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (h24) {
    const h = parseInt(h24[1], 10);
    const m = parseInt(h24[2], 10);
    const sec = h24[3] ? parseInt(h24[3], 10) : 0;
    return safe(h, m, sec);
  }

  // ── Decimal separator variant: 8.15 PM ────────────────────────────────────
  const dotTime = s.match(/^(\d{1,2})\.(\d{2})\s*(am|pm)$/);
  if (dotTime) {
    return apply12(parseInt(dotTime[1], 10), parseInt(dotTime[2], 10), dotTime[3]);
  }

  // ── 12-hour with colon: 3:30 pm, 03:30 PM, 12:00 AM ─────────────────────
  const h12colon = s.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/);
  if (h12colon) {
    return apply12(parseInt(h12colon[1], 10), parseInt(h12colon[2], 10), h12colon[3]);
  }

  // ── 12-hour bare: 3pm, 3 pm, 3PM, 7am ───────────────────────────────────
  const h12bare = s.match(/^(\d{1,2})\s*(am|pm)$/);
  if (h12bare) {
    return apply12(parseInt(h12bare[1], 10), 0, h12bare[2]);
  }

  // ── Bare 24-hour integer: "15", "23" (only if > 12 to avoid ambiguity) ───
  const bareH = s.match(/^(\d{2})$/);
  if (bareH) {
    const h = parseInt(bareH[1], 10);
    if (h >= 0 && h <= 23) return safe(h, 0);
  }

  return null; // unrecognised
};

