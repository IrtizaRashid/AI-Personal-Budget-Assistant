// Query Analyzer — rule-based module detection from natural language.
// No AI call needed here; fast keyword matching determines what data to load.

const today = () => new Date();

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const endOfDay   = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

// ─── Date Range Detection ─────────────────────────────────────────────────────

export const detectDateRange = (q) => {
  const now = today();

  if (/\byesterday\b/i.test(q)) {
    const d = new Date(now); d.setDate(d.getDate() - 1);
    return { label: 'yesterday', from: startOfDay(d), to: endOfDay(d) };
  }
  if (/\btoday\b/i.test(q)) {
    return { label: 'today', from: startOfDay(now), to: endOfDay(now) };
  }
  if (/\bthis\s+week\b/i.test(q)) {
    const from = new Date(now); from.setDate(now.getDate() - now.getDay());
    return { label: 'this week', from: startOfDay(from), to: endOfDay(now) };
  }
  if (/\blast\s+week\b/i.test(q)) {
    const from = new Date(now); from.setDate(now.getDate() - now.getDay() - 7);
    const to   = new Date(now); to.setDate(now.getDate() - now.getDay() - 1);
    return { label: 'last week', from: startOfDay(from), to: endOfDay(to) };
  }
  if (/\bthis\s+month\b/i.test(q)) {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    return { label: 'this month', from, to: endOfDay(now) };
  }
  if (/\blast\s+month\b/i.test(q)) {
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const to   = new Date(now.getFullYear(), now.getMonth(), 0);
    return { label: 'last month', from, to: endOfDay(to) };
  }
  if (/\bthis\s+year\b/i.test(q)) {
    const from = new Date(now.getFullYear(), 0, 1);
    return { label: 'this year', from, to: endOfDay(now) };
  }
  if (/\blast\s+year\b/i.test(q)) {
    const from = new Date(now.getFullYear() - 1, 0, 1);
    const to   = new Date(now.getFullYear() - 1, 11, 31);
    return { label: 'last year', from, to: endOfDay(to) };
  }

  // Named month — "in June", "last June", "June 2025"
  const MONTHS = ['january','february','march','april','may','june','july','august','september','october','november','december'];
  for (let m = 0; m < 12; m++) {
    const rx = new RegExp(`\\b(in\\s+)?${MONTHS[m]}(\\s+\\d{4})?\\b`, 'i');
    const match = q.match(rx);
    if (match) {
      const yearMatch = match[0].match(/\d{4}/);
      const year = yearMatch ? parseInt(yearMatch[0]) : now.getFullYear();
      const from = new Date(year, m, 1);
      const to   = new Date(year, m + 1, 0);
      return { label: MONTHS[m], from, to: endOfDay(to) };
    }
  }

  // Specific day — "on 10 June", "June 10"
  const dayMatch = q.match(/\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*/i)
    || q.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+(\d{1,2})\b/i);
  if (dayMatch) {
    const monthStr = dayMatch[0].replace(/\d/g, '').trim().toLowerCase().slice(0, 3);
    const dayStr   = dayMatch[0].match(/\d{1,2}/)?.[0];
    const monthIdx = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(monthStr);
    if (monthIdx >= 0 && dayStr) {
      const d = new Date(now.getFullYear(), monthIdx, parseInt(dayStr));
      return { label: `${dayStr} ${monthStr}`, from: startOfDay(d), to: endOfDay(d) };
    }
  }

  return null; // no date range detected
};

// ─── Person Detection ─────────────────────────────────────────────────────────

// Common question/grammar words that must never be treated as person names
const STOP_WORDS = new Set([
  'Who','What','Where','When','How','Which','Why','My','Me','I','We','You',
  'He','She','They','It','This','That','The','A','An','Is','Are','Was',
  'Have','Has','Had','Do','Does','Did','Will','Would','Can','Could','Should',
  'Money','Month','Year','Week','Day','Today','Yesterday','Much','Many',
  'Last','This','Next','All','Any','Some','More','Less','Best','Worst',
]);

export const detectPerson = (q) => {
  // Check for a known-name pattern first
  const knownMatch = q.match(/\b(Ali|Ahmed|Bilal|Ahmad|Sara|Zara|Hassan|Usman|Fatima|Ayesha|Omar|Hamza|Tariq|Nadeem)\b/i);
  if (knownMatch) return knownMatch[1];

  // "X returned/paid/lent/gave" at start of sentence — must not be a question word
  const verbMatch = q.match(/^([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]+)?)\s+(?:owe|paid|returned|lent|gave|borrowed)/i);
  if (verbMatch) {
    const candidate = verbMatch[1].trim();
    if (!STOP_WORDS.has(candidate.split(' ')[0])) return candidate;
  }

  // "with X" / "involving X" / "related to X" — explicit relationship preposition
  const prepMatch = q.match(/(?:with|involving|related to)\s+([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]+)?)/);
  if (prepMatch) {
    const candidate = prepMatch[1].trim();
    if (!STOP_WORDS.has(candidate.split(' ')[0])) return candidate;
  }

  // "for/from X" when X is likely a person (length > 2, not a stop word)
  const forFromMatch = q.match(/(?:from|for)\s+([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]+)?)\s+(?:loan|money|borrow|lent)/i);
  if (forFromMatch) {
    const candidate = forFromMatch[1].trim();
    if (!STOP_WORDS.has(candidate.split(' ')[0])) return candidate;
  }

  return null;
};

// ─── Module Detector ──────────────────────────────────────────────────────────

export const analyzeQuery = (query) => {
  const q = query.toLowerCase();
  const modules = new Set();

  // ── Expense signals
  if (/spend|spent|expense|cost|bought|purchase|pay|paid for|food|transport|bills|medicine|petrol|grocery|shop|mall|restaurant|eat|dining/i.test(q)) {
    modules.add('expenses');
    modules.add('categories');
  }

  // ── Income signals
  if (/salary|income|earn|earning|revenue|freelance|bonus|received|profit|dividend|interest|paycheck/i.test(q)) {
    modules.add('income');
  }

  // ── Loan signals
  if (/owe|lent|borrow|loan|repay|repaid|return|settle|clear|who owes|who do i owe|outstanding|balance/i.test(q)) {
    modules.add('loans');
  }

  // ── Investment signals
  if (/invest|portfolio|stock|share|bitcoin|crypto|gold|silver|etf|mutual fund|bond|fixed deposit|real estate|dividend|return|profit|loss|gain/i.test(q)) {
    modules.add('investments');
  }

  // ── Budget signals
  if (/budget|allocation|alloc|category|remaining|left|limit|over budget|under budget|saving/i.test(q)) {
    modules.add('budget');
    modules.add('categories');
  }

  // ── Transaction / history signals
  if (/transaction|history|record|all|everything|yesterday|last|today|happened|show all/i.test(q)) {
    modules.add('transactions');
  }

  // ── Dashboard / summary / overview signals
  if (/summary|overview|financial health|position|balance|how much.*have|available|net worth|total/i.test(q)) {
    modules.add('dashboard');
    modules.add('income');
    modules.add('expenses');
    modules.add('loans');
    modules.add('investments');
  }

  // ── People-centric: load everything for cross-module search
  const person = detectPerson(query);
  if (person || /with\s+\w+|involving\s+\w+|related to\s+\w+|everything.*\w+/i.test(q)) {
    modules.add('expenses');
    modules.add('loans');
    modules.add('transactions');
  }

  // ── Analytics / comparison / trends
  if (/compare|trend|habit|pattern|increase|decrease|most|least|biggest|smallest|highest|lowest|average|report|analytic/i.test(q)) {
    modules.add('expenses');
    modules.add('income');
    modules.add('categories');
    modules.add('dashboard');
  }

  // ── Monthly / yearly report
  if (/monthly report|yearly report|annual|monthly summary/i.test(q)) {
    modules.add('income');
    modules.add('expenses');
    modules.add('loans');
    modules.add('investments');
    modules.add('dashboard');
    modules.add('categories');
  }

  // Minimum context — always load the financial snapshot
  modules.add('dashboard');

  return {
    modules: Array.from(modules),
    dateRange: detectDateRange(query),
    person: detectPerson(query),
  };
};
