import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import {
  getDashboard,
  getCategories,
  getExpenses,
  getStatistics,
  getRecommendations,
} from '../services/api.js';
import SummaryCard from '../components/SummaryCard.jsx';
import WarningToast from '../components/WarningToast.jsx';
import { formatPKR } from '../utils/format.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function SpendingBar({ category, spent, allocated, color }) {
  const pct = allocated > 0 ? Math.min((spent / allocated) * 100, 100) : 0;
  const over = allocated > 0 && spent > allocated;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-medium text-slate-300 truncate max-w-[120px]">{category}</span>
        <span className={`font-semibold tabular-nums ${over ? 'text-red-400' : 'text-slate-400'}`}>
          {formatPKR(spent)} / {formatPKR(allocated)}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full transition-all duration-500 ${over ? 'bg-red-500' : ''}`}
          style={{
            width: `${pct}%`,
            background: over ? undefined : color,
          }}
        />
      </div>
    </div>
  );
}

const CATEGORY_COLORS = [
  '#d946ef',
  '#ec4899',
  '#a855f7',
  '#8b5cf6',
  '#22d3ee',
  '#f59e0b',
];

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { user } = useAuth();
  const userId = user?.id;
  const navigate = useNavigate();

  const [summary, setSummary] = useState(null);
  const [categories, setCategories] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [stats, setStats] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [recLoading, setRecLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [warnings, setWarnings] = useState([]);

  const dismissWarning = useCallback((id) => {
    setWarnings((prev) => prev.filter((w) => w.id !== id));
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [dash, cats, exps, statistics] = await Promise.all([
        getDashboard(userId),
        getCategories(userId),
        getExpenses(userId),
        getStatistics(userId),
      ]);
      setSummary(dash);
      setCategories(cats);
      setExpenses(Array.isArray(exps) ? exps : []);
      setStats(statistics);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Respect the "Show recommendations" preference set on the Settings page.
  const aiRecsEnabled = (() => {
    try {
      const v = localStorage.getItem('ai_recommendations');
      return v === null ? true : JSON.parse(v);
    } catch {
      return true;
    }
  })();

  const loadRecommendations = useCallback(async () => {
    if (!aiRecsEnabled) {
      setRecommendations([]);
      setRecLoading(false);
      return;
    }
    try {
      setRecLoading(true);
      const data = await getRecommendations(userId);
      setRecommendations(data.recommendations || []);
    } catch {
      // silently fail — card shows placeholder
    } finally {
      setRecLoading(false);
    }
  }, [userId, aiRecsEnabled]);

  useEffect(() => {
    loadData();
    loadRecommendations();
  }, [loadData, loadRecommendations]);

  // Derived values
  const budgetUsedPct =
    summary && summary.monthlyBudget > 0
      ? Math.round((summary.totalSpent / summary.monthlyBudget) * 100)
      : 0;

  const recentExpenses = expenses.slice(0, 5);

  const catRows = stats
    ? stats.allocated.map((a, i) => ({
        category: a.category,
        allocated: a.amount,
        spent: stats.spent[i]?.amount ?? 0,
        color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
      }))
    : [];

  // Quick actions definition
  const QUICK_ACTIONS = [
    { icon: '💰', label: 'Income', to: '/income', color: 'from-emerald-500 to-teal-600' },
    { icon: '💸', label: 'Expenses', to: '/expenses', color: 'from-rose-500 to-pink-600' },
    { icon: '📊', label: 'Budget', to: '/budget', color: 'from-fuchsia-500 to-purple-600' },
    { icon: '🤝', label: 'Loans', to: '/loans', color: 'from-amber-500 to-orange-600' },
    { icon: '📈', label: 'Investments', to: '/investments', color: 'from-cyan-500 to-blue-600' },
    { icon: '🤖', label: 'AI Assistant', to: '/ai', color: 'from-violet-500 to-indigo-600' },
  ];

  // Greeting
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="relative min-h-screen bg-[#0b0712]">
      {/* Ambient background blobs */}
      <div className="pointer-events-none fixed -left-32 -top-32 h-[500px] w-[500px] rounded-full bg-fuchsia-600/20 blur-[140px]" />
      <div className="pointer-events-none fixed right-0 top-40 h-[400px] w-[400px] rounded-full bg-purple-600/20 blur-[140px]" />

      {/* Warning toasts */}
      <div className="fixed right-4 top-4 z-50 w-80 max-w-[90vw] space-y-2">
        {warnings.map((w) => (
          <WarningToast
            key={w.id}
            level={w.level}
            message={w.message}
            onClose={() => dismissWarning(w.id)}
          />
        ))}
      </div>

      <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

        {/* ── Page header ── */}
        <div className="mb-8">
          <p className="text-sm font-medium text-fuchsia-400/80 uppercase tracking-widest mb-1">
            Overview
          </p>
          <h1 className="text-3xl font-bold text-white">
            {greeting}{user?.name ? `, ${user.name.split(' ')[0]}` : ''} 👋
          </h1>
          <p className="mt-1 text-slate-400 text-sm">
            Here's your financial snapshot for today.
          </p>
        </div>

        {/* ── Loading ── */}
        {loading && (
          <div className="flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] py-24 backdrop-blur-sm">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/10 border-t-fuchsia-500" />
            <span className="ml-3 text-slate-400 text-sm">Loading your dashboard…</span>
          </div>
        )}

        {/* ── Error ── */}
        {!loading && error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-8 text-center backdrop-blur-sm">
            <p className="text-red-300 mb-4">{error}</p>
            <button
              onClick={loadData}
              className="rounded-xl bg-gradient-to-r from-fuchsia-600 to-pink-600 px-5 py-2.5 text-sm font-semibold text-white hover:from-fuchsia-500 hover:to-pink-500 transition"
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && summary && (
          <div className="space-y-8">

            {/* ── KPI Cards ── */}
            <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4 animate-fade-in-up">
              <SummaryCard
                label="Available Balance"
                value={formatPKR(summary.remainingBudget)}
                icon="💰"
                gradient="from-fuchsia-500 to-purple-600"
                tag={budgetUsedPct < 80 ? '✦ Healthy' : budgetUsedPct < 100 ? '⚠ Tight' : '🔴 Exceeded'}
                tagColor={budgetUsedPct < 80 ? 'text-emerald-400' : budgetUsedPct < 100 ? 'text-amber-400' : 'text-red-400'}
                subtitle={`${100 - budgetUsedPct}% of monthly budget remaining`}
              />
              <SummaryCard
                label="Monthly Income"
                value={formatPKR(summary.monthlyBudget)}
                icon="💵"
                gradient="from-emerald-500 to-teal-600"
                tag="This month"
                tagColor="text-slate-400"
                subtitle="Total income recorded"
              />
              <SummaryCard
                label="Total Expenses"
                value={formatPKR(summary.totalSpent)}
                icon="💸"
                gradient="from-rose-500 to-pink-600"
                tag={`${budgetUsedPct}% used`}
                tagColor={budgetUsedPct > 90 ? 'text-red-400' : 'text-slate-400'}
                subtitle="Across all categories"
              />
              <SummaryCard
                label="Net Savings"
                value={formatPKR(Math.max(summary.remainingBudget, 0))}
                icon="🏦"
                gradient="from-cyan-500 to-blue-600"
                tag="Available"
                tagColor="text-cyan-400"
                subtitle="Money not yet spent"
              />
            </section>

            {/* ── Budget utilization bar ── */}
            <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-sm animate-fade-in-up">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-white">Monthly Budget Utilization</span>
                <span className="text-sm font-bold tabular-nums text-fuchsia-400">{budgetUsedPct}%</span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    budgetUsedPct >= 100
                      ? 'bg-gradient-to-r from-red-500 to-rose-600'
                      : budgetUsedPct >= 80
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500'
                      : 'bg-gradient-to-r from-fuchsia-500 to-pink-500'
                  }`}
                  style={{ width: `${Math.min(budgetUsedPct, 100)}%` }}
                />
              </div>
              <div className="mt-2 flex justify-between text-xs text-slate-500">
                <span>{formatPKR(summary.totalSpent)} spent</span>
                <span>{formatPKR(summary.monthlyBudget)} total</span>
              </div>
            </section>

            {/* ── Quick Actions ── */}
            <section className="animate-fade-in-up">
              <h2 className="mb-4 text-base font-semibold text-white">Quick Actions</h2>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                {QUICK_ACTIONS.map((action) => (
                  <button
                    key={action.to}
                    onClick={() => navigate(action.to)}
                    className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-center backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-fuchsia-500/40 hover:shadow-[0_0_24px_-4px_rgba(217,70,239,0.5)]"
                  >
                    <div className={`pointer-events-none absolute -right-4 -top-4 h-16 w-16 rounded-full bg-gradient-to-br ${action.color} opacity-20 blur-2xl transition-opacity group-hover:opacity-60`} />
                    <div className="relative flex flex-col items-center gap-2">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${action.color} text-lg shadow-lg`}>
                        {action.icon}
                      </div>
                      <span className="text-[11px] font-medium text-slate-300 leading-tight">{action.label}</span>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            {/* ── Main content grid: Spending + Sidebar ── */}
            <div className="grid grid-cols-1 gap-8 xl:grid-cols-3">

              {/* Left col (2/3): Spending by Category + Recent Activity */}
              <div className="space-y-8 xl:col-span-2">

                {/* Category spending progress */}
                {catRows.length > 0 && (
                  <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-sm animate-fade-in-up">
                    <div className="mb-5 flex items-center justify-between">
                      <div>
                        <h2 className="text-base font-semibold text-white">Spending by Category</h2>
                        <p className="text-xs text-slate-500 mt-0.5">Budget allocation vs actual spend</p>
                      </div>
                      <button
                        onClick={() => navigate('/analytics')}
                        className="text-xs font-medium text-fuchsia-400 hover:text-fuchsia-300 transition"
                      >
                        Full analytics →
                      </button>
                    </div>
                    <div className="space-y-4">
                      {catRows.map((row) => (
                        <SpendingBar key={row.category} {...row} />
                      ))}
                    </div>
                  </section>
                )}

                {/* Recent transactions */}
                <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-sm animate-fade-in-up">
                  <div className="mb-5 flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-semibold text-white">Recent Transactions</h2>
                      <p className="text-xs text-slate-500 mt-0.5">Your last 5 expenses</p>
                    </div>
                    <button
                      onClick={() => navigate('/transactions')}
                      className="text-xs font-medium text-fuchsia-400 hover:text-fuchsia-300 transition"
                    >
                      View all →
                    </button>
                  </div>

                  {recentExpenses.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-slate-500">
                      <span className="text-4xl mb-3">🧾</span>
                      <p className="text-sm">No expenses recorded yet.</p>
                      <button
                        onClick={() => navigate('/expenses')}
                        className="mt-3 text-xs text-fuchsia-400 hover:text-fuchsia-300 transition"
                      >
                        Add your first expense →
                      </button>
                    </div>
                  ) : (
                    <ul className="divide-y divide-white/[0.05]">
                      {recentExpenses.map((exp, i) => (
                        <li
                          key={exp.id ?? i}
                          className="flex items-center justify-between py-3 group"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/5 text-base">
                              💸
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-white truncate">
                                {exp.description || exp.category}
                              </p>
                              <p className="text-xs text-slate-500">
                                {exp.category}
                                {exp.created_at ? ` · ${timeAgo(exp.created_at)}` : ''}
                              </p>
                            </div>
                          </div>
                          <span className="ml-4 shrink-0 text-sm font-semibold text-rose-400 tabular-nums">
                            -{formatPKR(exp.amount)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>

              {/* Right col (1/3): AI Insights + Quick Stats */}
              <div className="space-y-8">

                {/* AI Insights */}
                <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-sm animate-fade-in-up">
                  <div className="mb-5 flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-semibold text-white">AI Insights</h2>
                      <p className="text-xs text-slate-500 mt-0.5">Personalized recommendations</p>
                    </div>
                    <button
                      onClick={() => navigate('/ai')}
                      className="text-xs font-medium text-fuchsia-400 hover:text-fuchsia-300 transition"
                    >
                      Open AI →
                    </button>
                  </div>

                  {!aiRecsEnabled ? (
                    <div className="flex flex-col items-center justify-center py-8 text-slate-500">
                      <span className="text-3xl mb-2">🔕</span>
                      <p className="text-xs text-center">
                        AI recommendations are turned off. Enable them in Settings.
                      </p>
                    </div>
                  ) : recLoading ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((n) => (
                        <div key={n} className="h-14 animate-pulse rounded-xl bg-white/5" />
                      ))}
                    </div>
                  ) : recommendations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-slate-500">
                      <span className="text-3xl mb-2">🤖</span>
                      <p className="text-xs text-center">No recommendations yet. Add some expenses to get AI insights.</p>
                    </div>
                  ) : (
                    <ul className="space-y-3">
                      {recommendations.slice(0, 3).map((rec, i) => (
                        <li
                          key={i}
                          className="group flex gap-3 rounded-xl border border-white/5 bg-white/[0.03] p-3 transition hover:border-fuchsia-500/20 hover:bg-fuchsia-500/5"
                        >
                          <span className="shrink-0 text-base mt-0.5">
                            {i === 0 ? '💡' : i === 1 ? '📉' : '🎯'}
                          </span>
                          <p className="text-xs leading-relaxed text-slate-300">{rec}</p>
                        </li>
                      ))}
                    </ul>
                  )}

                  {recommendations.length > 3 && (
                    <button
                      onClick={() => navigate('/ai')}
                      className="mt-4 w-full rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/5 py-2 text-xs font-medium text-fuchsia-400 transition hover:bg-fuchsia-500/10"
                    >
                      See {recommendations.length - 3} more insights
                    </button>
                  )}
                </section>

                {/* Quick stats: Loans & Investments overview */}
                <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-sm animate-fade-in-up">
                  <h2 className="mb-4 text-base font-semibold text-white">Financial Overview</h2>
                  <div className="space-y-3">

                    {/* Owed to me */}
                    <button
                      onClick={() => navigate('/loans')}
                      className="group w-full flex items-center justify-between rounded-xl border border-emerald-500/15 bg-emerald-500/5 px-4 py-3 text-left transition hover:border-emerald-500/30 hover:bg-emerald-500/10"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-sm">💰</span>
                        <span className="text-xs font-medium text-emerald-300/80">Owed to me</span>
                      </div>
                      <span className="text-sm font-bold text-emerald-300 tabular-nums">
                        {formatPKR(summary.owedToMe ?? 0)}
                      </span>
                    </button>

                    {/* I owe */}
                    <button
                      onClick={() => navigate('/loans')}
                      className="group w-full flex items-center justify-between rounded-xl border border-red-500/15 bg-red-500/5 px-4 py-3 text-left transition hover:border-red-500/30 hover:bg-red-500/10"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/15 text-sm">💸</span>
                        <span className="text-xs font-medium text-red-300/80">I owe</span>
                      </div>
                      <span className="text-sm font-bold text-red-300 tabular-nums">
                        {formatPKR(summary.iOwe ?? 0)}
                      </span>
                    </button>

                    {/* Investments */}
                    <button
                      onClick={() => navigate('/investments')}
                      className="group w-full flex items-center justify-between rounded-xl border border-cyan-500/15 bg-cyan-500/5 px-4 py-3 text-left transition hover:border-cyan-500/30 hover:bg-cyan-500/10"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/15 text-sm">📈</span>
                        <span className="text-xs font-medium text-cyan-300/80">Investments</span>
                      </div>
                      <span className="text-xs font-medium text-cyan-400 group-hover:text-cyan-300 transition">
                        View →
                      </span>
                    </button>

                    {/* Analytics */}
                    <button
                      onClick={() => navigate('/analytics')}
                      className="group w-full flex items-center justify-between rounded-xl border border-purple-500/15 bg-purple-500/5 px-4 py-3 text-left transition hover:border-purple-500/30 hover:bg-purple-500/10"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/15 text-sm">📊</span>
                        <span className="text-xs font-medium text-purple-300/80">Analytics & Charts</span>
                      </div>
                      <span className="text-xs font-medium text-purple-400 group-hover:text-purple-300 transition">
                        View →
                      </span>
                    </button>

                  </div>
                </section>

              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
