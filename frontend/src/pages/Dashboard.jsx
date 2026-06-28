import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getDashboard,
  getCategories,
  getExpenses,
  getStatistics,
} from '../services/api.js';
import SummaryCard from '../components/SummaryCard.jsx';
import CategoryTable from '../components/CategoryTable.jsx';
import ChatBox from '../components/ChatBox.jsx';
import ExpenseHistory from '../components/ExpenseHistory.jsx';
import RecentExpenses from '../components/RecentExpenses.jsx';
import ChartCard from '../components/charts/ChartCard.jsx';
import PieChart from '../components/charts/PieChart.jsx';
import BarChart from '../components/charts/BarChart.jsx';
import { formatPKR } from '../utils/format.js';

// Fixed colour palette so each category looks the same across all charts.
const CATEGORY_COLORS = [
  '#6366f1', // indigo
  '#f59e0b', // amber
  '#10b981', // emerald
  '#ef4444', // red
  '#8b5cf6', // violet
  '#06b6d4', // cyan
];

export default function Dashboard() {
  const navigate = useNavigate();

  // The current user's id is saved to localStorage after budget setup (Step 3).
  // Fall back to user 1 so the dashboard is testable directly.
  const userId = localStorage.getItem('budgetUserId') || 1;

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

  // Silent refresh used by chat + delete actions (no spinner, keeps chat).
  const refresh = useCallback(() => loadData(true), [loadData]);

  // Fetch automatically when the dashboard opens.
  useEffect(() => {
    loadData();
  }, [loadData]);

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
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-10">
        {/* Header */}
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-slate-800 sm:text-3xl">
            Welcome to your Budget Dashboard
          </h1>
          <p className="mt-1 text-slate-500">
            Here&apos;s an overview of your monthly budget.
          </p>
        </header>

        {/* ---- Loading state ---- */}
        {loading && (
          <div className="flex items-center justify-center rounded-2xl bg-white py-20 shadow-sm ring-1 ring-slate-200/70">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-500" />
            <span className="ml-3 text-slate-500">Loading your dashboard…</span>
          </div>
        )}

        {/* ---- Error state ---- */}
        {!loading && error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
            <p className="text-red-700">{error}</p>
            <div className="mt-4 flex justify-center gap-3">
              <button
                onClick={() => loadData()}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
              >
                Retry
              </button>
              {/* If the user has no budget yet, send them to setup. */}
              <button
                onClick={() => navigate('/')}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
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
            <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <SummaryCard
                label="Monthly Budget"
                value={formatPKR(summary.monthlyBudget)}
                accent="bg-indigo-500"
              />
              <SummaryCard
                label="Total Spent"
                value={formatPKR(summary.totalSpent)}
                accent="bg-amber-500"
              />
              <SummaryCard
                label="Remaining Budget"
                value={formatPKR(summary.remainingBudget)}
                accent="bg-emerald-500"
              />
              <SummaryCard
                label="Total Expenses"
                value={stats ? stats.expenseCount : 0}
                accent="bg-cyan-500"
              />
            </section>

            {/* Charts */}
            <section className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
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
                <ChatBox userId={userId} onDataChanged={refresh} />
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
