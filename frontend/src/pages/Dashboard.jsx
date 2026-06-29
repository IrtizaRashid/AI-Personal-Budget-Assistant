import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import {
  getDashboard,
  getCategories,
  getExpenses,
  getStatistics,
  getRecommendations,
  resetMonth,
} from '../services/api.js';
import SummaryCard from '../components/SummaryCard.jsx';
import CategoryTable from '../components/CategoryTable.jsx';
import ChatBox from '../components/ChatBox.jsx';
import ExpenseHistory from '../components/ExpenseHistory.jsx';
import RecentExpenses from '../components/RecentExpenses.jsx';
import WarningToast from '../components/WarningToast.jsx';
import AIRecommendations from '../components/AIRecommendations.jsx';
import MonthlyLimitModal from '../components/MonthlyLimitModal.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import ChartCard from '../components/charts/ChartCard.jsx';
import PieChart from '../components/charts/PieChart.jsx';
import BarChart from '../components/charts/BarChart.jsx';
import { formatPKR } from '../utils/format.js';

// Vibrant neon palette so each category looks the same across all charts.
const CATEGORY_COLORS = [
  '#d946ef', // fuchsia
  '#ec4899', // pink
  '#a855f7', // purple
  '#8b5cf6', // violet
  '#22d3ee', // cyan
  '#f59e0b', // amber
];

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const userId = user?.id;

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const [summary, setSummary] = useState(null); // { monthlyBudget, totalSpent, remainingBudget }
  const [categories, setCategories] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [stats, setStats] = useState(null); // { allocated[], spent[], remaining[], expenseCount }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Load all endpoints in parallel.
  // `silent = true` refreshes data WITHOUT toggling the full-page spinner,
  // so the ChatBox stays mounted (chat history is preserved) after an
  // expense is added or deleted. This is what keeps the CHARTS auto-updating.
  const loadData = useCallback(
    async (silent = false) => {
      try {
        if (!silent) setLoading(true);
        setError('');
        const [dash, cats, exps, statistics] = await Promise.all([
          getDashboard(userId),
          getCategories(userId),
          getExpenses(userId),
          getStatistics(userId),
        ]);
        setSummary(dash);
        setCategories(cats);
        setExpenses(exps);
        setStats(statistics);
      } catch (err) {
        setError(
          err.response?.data?.error ||
            'Failed to load dashboard data. Is the backend running?'
        );
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [userId]
  );

  // --- AI recommendations (independent of the main data load) ---
  // Kept separate so the slower AI call doesn't block the dashboard, and so
  // its own loading/error states can be shown inside the card.
  const [recommendations, setRecommendations] = useState([]);
  const [recLoading, setRecLoading] = useState(true);
  const [recError, setRecError] = useState(false);

  const loadRecommendations = useCallback(async () => {
    try {
      setRecLoading(true);
      setRecError(false);
      const data = await getRecommendations(userId);
      setRecommendations(data.recommendations || []);
    } catch {
      setRecError(true); // card shows "temporarily unavailable"
    } finally {
      setRecLoading(false);
    }
  }, [userId]);

  // Silent refresh used by chat + delete + transfer actions (no spinner, keeps
  // chat). Also re-fetches AI recommendations so advice stays current.
  const refresh = useCallback(() => {
    loadData(true);
    loadRecommendations();
  }, [loadData, loadRecommendations]);

  // --- Budget warning toasts ---
  // Auto-dismissing cards shown when a category gets low/exceeded after an
  // expense. They never block insertion — they just inform.
  const [warnings, setWarnings] = useState([]); // [{ id, level, message }]

  const dismissWarning = useCallback((id) => {
    setWarnings((prev) => prev.filter((w) => w.id !== id));
  }, []);

  const pushWarning = useCallback(
    (w) => {
      if (!w || !w.warning) return; // null means "no warning"
      const id = Date.now() + Math.random();
      setWarnings((prev) => [...prev, { id, level: w.level, message: w.message }]);
      // Disappear automatically after a few seconds.
      setTimeout(() => dismissWarning(id), 6000);
    },
    [dismissWarning]
  );

  // --- Monthly budget limit modal + "start new month" ---
  const [limitData, setLimitData] = useState(null); // monthly_budget_exceeded payload
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);

  // True when the monthly budget is fully used → lock expense input.
  const budgetFull = !!summary && Number(summary.remainingBudget) <= 0;

  const handleStartNewMonth = async () => {
    try {
      setResetting(true);
      await resetMonth(userId);
      setShowResetConfirm(false);
      refresh(); // reload cards/charts/history (now empty)
    } catch {
      // keep the dialog open on failure
    } finally {
      setResetting(false);
    }
  };

  // Fetch automatically when the dashboard opens.
  useEffect(() => {
    loadData();
    loadRecommendations();
  }, [loadData, loadRecommendations]);

  // --- Prepare chart data from the statistics payload ---
  const catLabels = stats ? stats.allocated.map((a) => a.category) : [];
  const allocatedData = stats ? stats.allocated.map((a) => a.amount) : [];
  const spentData = stats ? stats.spent.map((s) => s.amount) : [];
  const remainingData = stats ? stats.remaining.map((r) => r.amount) : [];
  const totalSpentSum = spentData.reduce((sum, n) => sum + n, 0);

  // Grouped bars: Allocated vs Spent vs Remaining per category.
  const barDatasets = [
    { label: 'Allocated', data: allocatedData, backgroundColor: '#6366f1' },
    { label: 'Spent', data: spentData, backgroundColor: '#f59e0b' },
    { label: 'Remaining', data: remainingData, backgroundColor: '#10b981' },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0b0712]">
      {/* Decorative neon background blobs */}
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-fuchsia-600/25 blur-[120px] animate-blob" />
      <div className="pointer-events-none absolute right-0 top-40 h-96 w-96 rounded-full bg-purple-600/25 blur-[120px] animate-blob delay-200" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 h-96 w-96 rounded-full bg-pink-600/20 blur-[120px] animate-blob delay-300" />

      {/* Budget warning toasts (fixed, top-right, auto-dismiss) */}
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

      {/* Monthly budget limit modal (blocks a rejected over-limit expense) */}
      <MonthlyLimitModal
        open={!!limitData}
        data={limitData}
        onClose={() => setLimitData(null)}
      />

      {/* "Start new month" confirmation */}
      <ConfirmDialog
        open={showResetConfirm}
        title="Start a new month?"
        message="This clears all expenses and resets category spending to zero. Your budget and category allocations are kept. This cannot be undone."
        confirmText="Start New Month"
        loading={resetting}
        onConfirm={handleStartNewMonth}
        onCancel={() => setShowResetConfirm(false)}
      />

      <div className="relative mx-auto max-w-6xl px-4 py-10">
        {/* Header */}
        <header className="mb-8 animate-fade-in-up">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-500 to-pink-600 text-xl shadow-lg shadow-fuchsia-500/40">
                💸
              </span>
              <div>
                <h1 className="bg-gradient-to-r from-fuchsia-400 via-pink-400 to-purple-400 bg-clip-text text-2xl font-extrabold tracking-tight text-transparent text-glow sm:text-3xl">
                  Your Budget Dashboard
                </h1>
                <p className="text-sm text-slate-400">
                  {user?.name ? `Welcome, ${user.name} · ` : ''}Track, manage, and get smart advice on your spending.
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="shrink-0 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-300"
            >
              Logout
            </button>
          </div>
        </header>

        {/* ---- Loading state ---- */}
        {loading && (
          <div className="flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] py-20 backdrop-blur-sm">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/10 border-t-fuchsia-500" />
            <span className="ml-3 text-slate-400">Loading your dashboard…</span>
          </div>
        )}

        {/* ---- Error state ---- */}
        {!loading && error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center backdrop-blur-sm">
            <p className="text-red-300">{error}</p>
            <div className="mt-4 flex justify-center gap-3">
              <button
                onClick={() => loadData()}
                className="rounded-lg bg-gradient-to-r from-fuchsia-600 to-pink-600 px-4 py-2 text-sm font-semibold text-white transition hover:from-fuchsia-500 hover:to-pink-500"
              >
                Retry
              </button>
              {/* If the user has no budget yet, send them to setup. */}
              <button
                onClick={() => navigate('/')}
                className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:bg-white/10"
              >
                Go to Budget Setup
              </button>
            </div>
          </div>
        )}

        {/* ---- Loaded content ---- */}
        {!loading && !error && summary && (
          <>
            {/* Summary cards: stacked on mobile, 2-up on tablet, 4-up on desktop */}
            <section className="grid animate-fade-in-up grid-cols-1 gap-5 delay-100 sm:grid-cols-2 lg:grid-cols-4">
              <SummaryCard
                label="Monthly Budget"
                value={formatPKR(summary.monthlyBudget)}
                icon="💰"
                gradient="from-fuchsia-500 to-purple-600"
              />
              <SummaryCard
                label="Total Spent"
                value={formatPKR(summary.totalSpent)}
                icon="💸"
                gradient="from-pink-500 to-rose-600"
              />
              <SummaryCard
                label="Remaining Budget"
                value={formatPKR(summary.remainingBudget)}
                icon="🏦"
                gradient="from-violet-500 to-fuchsia-600"
              />
              <SummaryCard
                label="Total Expenses"
                value={stats ? stats.expenseCount : 0}
                icon="📊"
                gradient="from-cyan-500 to-blue-600"
              />
            </section>

            {/* Monthly budget fully-utilized banner + start new month */}
            {budgetFull && (
              <div className="mt-6 flex flex-col items-center justify-between gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-6 py-4 sm:flex-row">
                <p className="font-semibold text-amber-300">
                  ✅ Monthly budget fully utilized.
                  <span className="ml-1 font-normal text-amber-200/80">
                    Adding expenses is disabled. You can still view, edit, or
                    delete expenses.
                  </span>
                </p>
                <button
                  onClick={() => setShowResetConfirm(true)}
                  className="shrink-0 rounded-xl bg-gradient-to-r from-fuchsia-600 to-pink-600 px-4 py-2 text-sm font-semibold text-white transition hover:from-fuchsia-500 hover:to-pink-500"
                >
                  Start New Month
                </button>
              </div>
            )}

            {/* AI Recommendations (auto-refreshes when expenses change) */}
            <section className="mt-8 animate-fade-in-up delay-200">
              <AIRecommendations
                recommendations={recommendations}
                loading={recLoading}
                error={recError}
              />
            </section>

            {/* Charts */}
            <section className="mt-8 grid animate-fade-in-up grid-cols-1 gap-8 delay-300 lg:grid-cols-2">
              <ChartCard
                title="Budget Allocation"
                isEmpty={catLabels.length === 0}
                emptyMessage="No budget set up yet."
              >
                <PieChart
                  labels={catLabels}
                  data={allocatedData}
                  colors={CATEGORY_COLORS}
                />
              </ChartCard>

              <ChartCard
                title="Spending by Category"
                isEmpty={totalSpentSum === 0}
                emptyMessage="No spending recorded yet."
              >
                <PieChart
                  labels={catLabels}
                  data={spentData}
                  colors={CATEGORY_COLORS}
                />
              </ChartCard>

              {/* Bar chart spans the full width on desktop */}
              <div className="lg:col-span-2">
                <ChartCard
                  title="Allocated vs Spent vs Remaining"
                  isEmpty={catLabels.length === 0}
                  emptyMessage="No budget set up yet."
                >
                  <BarChart labels={catLabels} datasets={barDatasets} />
                </ChartCard>
              </div>
            </section>

            {/* Recent expenses (latest 5) below the charts */}
            <section className="mt-8">
              <RecentExpenses expenses={expenses} />
            </section>

            {/* Category table + AI chat side by side on desktop, stacked on mobile */}
            <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
              <section className="lg:col-span-2">
                <CategoryTable categories={categories} />
              </section>

              <section className="lg:col-span-1">
                {/* Silent refresh after chat add/delete — no page reload,
                    chat history preserved. */}
                <ChatBox
                  userId={userId}
                  categories={categories}
                  onDataChanged={refresh}
                  onWarning={pushWarning}
                  onMonthlyLimit={setLimitData}
                  budgetFull={budgetFull}
                />
              </section>
            </div>

            {/* Expense history (full width below) */}
            <section className="mt-8">
              <ExpenseHistory expenses={expenses} onChanged={refresh} />
            </section>
          </>
        )}
      </div>
    </div>
  );
}
