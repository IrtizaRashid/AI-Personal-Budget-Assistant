import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { CURRENCIES, getCurrency, setCurrency } from '../utils/format.js';
import {
  getExpenses,
  getIncome,
  getCategories,
  getLoans,
  getPortfolio,
  getTransactions,
  resetMonth,
} from '../services/api.js';

// ── Small preference helpers (localStorage-backed) ─────────────────────────
const readPref = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
};
const writePref = (key, value) => localStorage.setItem(key, JSON.stringify(value));

// ── Reusable bits ───────────────────────────────────────────────────────────
function Section({ icon, title, description, children }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-sm">
      <div className="flex items-start gap-3 border-b border-white/10 px-6 py-4">
        <span className="text-xl">{icon}</span>
        <div>
          <h2 className="text-base font-semibold text-white">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-slate-400">{description}</p>}
        </div>
      </div>
      <div className="space-y-4 p-6">{children}</div>
    </section>
  );
}

function Row({ label, hint, children }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-200">{label}</p>
        {hint && <p className="text-xs text-slate-500">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 rounded-full transition-colors ${
        checked ? 'bg-fuchsia-600' : 'bg-white/15'
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

const SELECT_CLS =
  'rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-fuchsia-500 focus:outline-none focus:ring-1 focus:ring-fuchsia-500';

// ── Page ──────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const userId = user?.id;

  const [currency, setCurrencyState] = useState(getCurrency().code);

  // AI preferences
  const [aiStyle, setAiStyle] = useState(() => readPref('ai_style', 'balanced'));
  const [aiRecs, setAiRecs] = useState(() => readPref('ai_recommendations', true));
  const [aiVoice, setAiVoice] = useState(() => readPref('ai_voice', true));

  // Notifications
  const [notifyBudget, setNotifyBudget] = useState(() => readPref('notify_budget', true));
  const [notifyWeekly, setNotifyWeekly] = useState(() => readPref('notify_weekly', false));

  const [status, setStatus] = useState('');
  const [exporting, setExporting] = useState(false);
  const [resetting, setResetting] = useState(false);

  const flash = (msg) => {
    setStatus(msg);
    setTimeout(() => setStatus(''), 2500);
  };

  const handleCurrencyChange = (code) => {
    setCurrency(code);
    setCurrencyState(code);
    // Money strings are produced by formatPKR at render time across many
    // components that don't subscribe to this change — reload so the new
    // currency applies everywhere.
    setTimeout(() => window.location.reload(), 300);
  };

  const updateAi = (setter, key, value) => {
    setter(value);
    writePref(key, value);
    flash('AI preferences saved.');
  };
  const updateNotify = (setter, key, value) => {
    setter(value);
    writePref(key, value);
    flash('Notification settings saved.');
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      const [expenses, income, categories, loans, portfolio, transactions] =
        await Promise.all([
          getExpenses(userId).catch(() => []),
          getIncome(userId).catch(() => []),
          getCategories(userId).catch(() => []),
          getLoans(userId).catch(() => []),
          getPortfolio(userId).catch(() => []),
          getTransactions(userId).catch(() => []),
        ]);
      const payload = {
        exportedAt: new Date().toISOString(),
        user: { id: user?.id, name: user?.name, email: user?.email },
        expenses,
        income,
        categories,
        loans,
        portfolio,
        transactions,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `budget-ai-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      flash('Data exported.');
    } catch {
      flash('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const handleResetMonth = async () => {
    if (
      !window.confirm(
        'Reset this month? Category spending resets to zero for a new budget cycle. This cannot be undone.'
      )
    )
      return;
    try {
      setResetting(true);
      await resetMonth(userId);
      flash('Month reset. Reloading…');
      setTimeout(() => window.location.reload(), 800);
    } catch {
      flash('Reset failed. Please try again.');
    } finally {
      setResetting(false);
    }
  };

  const initials = user?.name
    ? user.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="mt-1 text-sm text-slate-400">
            Manage your profile, appearance, AI, and data.
          </p>
        </div>
        {status && (
          <span className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300">
            {status}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Profile */}
        <Section icon="👤" title="Profile" description="Your account details">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-500 to-pink-600 text-lg font-bold text-white">
              {initials}
            </span>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-white">
                {user?.name || 'User'}
              </p>
              <p className="truncate text-sm text-slate-400">{user?.email || '—'}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full rounded-xl border border-red-500/20 bg-red-500/10 py-2.5 text-sm font-medium text-red-300 transition hover:bg-red-500/20"
          >
            Log out
          </button>
        </Section>

        {/* Appearance */}
        <Section icon="🎨" title="Appearance" description="Theme and display">
          <Row label="Theme" hint={theme === 'dark' ? 'Dark mode' : 'Light mode'}>
            <button
              onClick={toggleTheme}
              className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 transition hover:bg-white/10"
            >
              {theme === 'dark' ? '🌙 Dark' : '☀️ Light'}
            </button>
          </Row>
          <Row label="Currency" hint="Display symbol — amounts are not converted">
            <select
              value={currency}
              onChange={(e) => handleCurrencyChange(e.target.value)}
              className={SELECT_CLS}
            >
              {Object.values(CURRENCIES).map((c) => (
                <option key={c.code} value={c.code} className="bg-slate-900">
                  {c.code} — {c.label}
                </option>
              ))}
            </select>
          </Row>
        </Section>

        {/* AI Preferences */}
        <Section icon="🤖" title="AI Preferences" description="How the assistant responds">
          <Row label="Response style" hint="Tone of AI replies and tips">
            <select
              value={aiStyle}
              onChange={(e) => updateAi(setAiStyle, 'ai_style', e.target.value)}
              className={SELECT_CLS}
            >
              <option value="concise" className="bg-slate-900">Concise</option>
              <option value="balanced" className="bg-slate-900">Balanced</option>
              <option value="detailed" className="bg-slate-900">Detailed</option>
            </select>
          </Row>
          <Row label="Show recommendations" hint="AI insights on the dashboard">
            <Toggle
              checked={aiRecs}
              onChange={(v) => updateAi(setAiRecs, 'ai_recommendations', v)}
            />
          </Row>
          <Row label="Voice input" hint="Enable the mic in the AI Assistant">
            <Toggle
              checked={aiVoice}
              onChange={(v) => updateAi(setAiVoice, 'ai_voice', v)}
            />
          </Row>
        </Section>

        {/* Notifications */}
        <Section icon="🔔" title="Notifications" description="Budget alerts and summaries">
          <Row label="Budget limit alerts" hint="Warn when a category nears its limit">
            <Toggle
              checked={notifyBudget}
              onChange={(v) => updateNotify(setNotifyBudget, 'notify_budget', v)}
            />
          </Row>
          <Row label="Weekly summary" hint="A recap of your spending each week">
            <Toggle
              checked={notifyWeekly}
              onChange={(v) => updateNotify(setNotifyWeekly, 'notify_weekly', v)}
            />
          </Row>
        </Section>

        {/* Data management */}
        <Section
          icon="💾"
          title="Data Management"
          description="Export your data or start a new cycle"
        >
          <Row label="Export data" hint="Download everything as a JSON file">
            <button
              onClick={handleExport}
              disabled={exporting}
              className="rounded-lg bg-gradient-to-r from-fuchsia-600 to-pink-600 px-4 py-2 text-sm font-medium text-white transition hover:from-fuchsia-500 hover:to-pink-500 disabled:opacity-50"
            >
              {exporting ? 'Exporting…' : 'Export JSON'}
            </button>
          </Row>
          <Row label="Reset month" hint="Zero out category spending for a new cycle">
            <button
              onClick={handleResetMonth}
              disabled={resetting}
              className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-300 transition hover:bg-amber-500/20 disabled:opacity-50"
            >
              {resetting ? 'Resetting…' : 'Reset month'}
            </button>
          </Row>
        </Section>
      </div>
    </div>
  );
}
