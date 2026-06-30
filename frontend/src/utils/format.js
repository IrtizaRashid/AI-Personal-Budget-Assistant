// ── Currency preference ────────────────────────────────────────────────────
// The app shows a single display currency chosen by the user on the Settings
// page. We persist the choice in localStorage and read it lazily so every
// money string stays consistent across the app. NOTE: this changes the symbol
// only — amounts are not FX-converted.

export const CURRENCIES = {
  PKR: { code: 'PKR', label: 'Pakistani Rupee', symbol: 'PKR' },
  USD: { code: 'USD', label: 'US Dollar', symbol: '$' },
  EUR: { code: 'EUR', label: 'Euro', symbol: '€' },
  GBP: { code: 'GBP', label: 'British Pound', symbol: '£' },
  INR: { code: 'INR', label: 'Indian Rupee', symbol: '₹' },
  AED: { code: 'AED', label: 'UAE Dirham', symbol: 'AED' },
};

export const getCurrency = () => {
  const code =
    (typeof localStorage !== 'undefined' && localStorage.getItem('currency')) ||
    'PKR';
  return CURRENCIES[code] || CURRENCIES.PKR;
};

export const setCurrency = (code) => {
  if (CURRENCIES[code]) localStorage.setItem('currency', code);
};

// Formats a number using the user's chosen currency, e.g. 50000 -> "PKR 50,000"
// or "$50,000". Alphabetic symbols (PKR, AED) get a trailing space; glyph
// symbols ($, €, £, ₹) hug the number. The name is kept as `formatPKR` for
// backwards compatibility with existing imports across the app.
export const formatPKR = (value) => {
  const { symbol } = getCurrency();
  const amount = Number(value || 0).toLocaleString('en-US', {
    maximumFractionDigits: 0,
  });
  return /^[A-Za-z]/.test(symbol) ? `${symbol} ${amount}` : `${symbol}${amount}`;
};

// Alias with a currency-neutral name for new code.
export const formatMoney = formatPKR;

// Formats a date/datetime string into a short readable date+time,
// e.g. "28 Jun 2026, 6:14 PM".
export const formatDate = (value) => {
  if (!value) return '';
  return new Date(value).toLocaleString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

// Compact date — "30 Jun 26" — used in dense table rows.
export const formatDateCompact = (value) => {
  if (!value) return '';
  const d = new Date(value);
  const day = d.getDate();
  const month = d.toLocaleString('en-US', { month: 'short' });
  const year = String(d.getFullYear()).slice(2);
  return `${day} ${month} '${year}`;
};
