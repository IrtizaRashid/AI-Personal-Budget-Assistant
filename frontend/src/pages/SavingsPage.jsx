import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { getDashboard } from '../services/api.js';
import { formatPKR } from '../utils/format.js';

export default function SavingsPage() {
  const { user } = useAuth();
  const userId = user?.id;
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingsGoal, setSavingsGoal] = useState(30000);
  const [showGoalInput, setShowGoalInput] = useState(false);

  const loadSummary = async () => {
    try {
      setLoading(true);
      const data = await getDashboard(userId);
      setSummary(data);
    } catch (error) {
      console.error('Failed to load summary:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSummary();
  }, [userId]);

  const currentSavings = summary ? summary.remainingBudget * 0.3 : 0;
  const progress = savingsGoal > 0 ? (currentSavings / savingsGoal) * 100 : 0;
  const remaining = savingsGoal - currentSavings;

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Savings</h1>
        <button
          onClick={() => setShowGoalInput(!showGoalInput)}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-pink-600 px-4 py-2 text-sm font-medium text-white hover:from-fuchsia-500 hover:to-pink-500 transition-all"
        >
          <span>⚙️</span>
          <span>Set Goal</span>
        </button>
      </div>

      {/* Goal Input */}
      {showGoalInput && (
        <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-sm">
          <h3 className="mb-4 text-lg font-semibold text-white">Set Savings Goal</h3>
          <div className="flex gap-2">
            <input
              type="number"
              value={savingsGoal}
              onChange={(e) => setSavingsGoal(parseFloat(e.target.value))}
              placeholder="Enter goal amount"
              className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white placeholder-slate-500 focus:border-fuchsia-500 focus:outline-none focus:ring-1 focus:ring-fuchsia-500"
            />
            <button
              onClick={() => setShowGoalInput(false)}
              className="rounded-xl bg-gradient-to-r from-fuchsia-600 to-pink-600 px-4 py-2 text-sm font-medium text-white hover:from-fuchsia-500 hover:to-pink-500 transition-all"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {/* Main Savings Card */}
      <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-sm">
        <div className="mb-4 flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 text-3xl">
            🏦
          </div>
          <div>
            <p className="text-sm font-medium text-slate-400">Current Savings</p>
            <p className="text-3xl font-bold text-white">{formatPKR(currentSavings)}</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-2">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-300">Goal Progress</span>
            <span className="text-sm font-semibold text-white">{progress.toFixed(1)}%</span>
          </div>
          <div className="h-4 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500">Goal</p>
            <p className="text-lg font-semibold text-white">{formatPKR(savingsGoal)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500">Remaining</p>
            <p className={`text-lg font-semibold ${remaining > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {remaining > 0 ? formatPKR(remaining) : 'Goal reached!'}
            </p>
          </div>
        </div>
      </div>

      {/* Savings Tips */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-sm">
        <h2 className="mb-4 text-lg font-semibold text-white">Savings Tips</h2>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-xs text-emerald-400">
              ✓
            </span>
            <p className="text-sm text-slate-300">
              Set aside 20% of your income for savings each month
            </p>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-xs text-emerald-400">
              ✓
            </span>
            <p className="text-sm text-slate-300">
              Build an emergency fund with 3-6 months of expenses
            </p>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-xs text-emerald-400">
              ✓
            </span>
            <p className="text-sm text-slate-300">
              Automate your savings by setting up automatic transfers
            </p>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-xs text-emerald-400">
              ✓
            </span>
            <p className="text-sm text-slate-300">
              Review and adjust your budget regularly to find more savings opportunities
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
