import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { setupBudget } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import BudgetTable from '../components/BudgetTable.jsx';
import Alert from '../components/Alert.jsx';

const DEFAULT_ALLOCATIONS = [
  { category: 'Food', percentage: 30 },
  { category: 'Transport', percentage: 15 },
  { category: 'Bills', percentage: 20 },
  { category: 'Entertainment', percentage: 10 },
  { category: 'Savings', percentage: 20 },
  { category: 'Miscellaneous', percentage: 5 },
];

const buildRecommendations = (budget) => {
  let allocated = 0;
  return DEFAULT_ALLOCATIONS.map((item, index) => {
    const isLast = index === DEFAULT_ALLOCATIONS.length - 1;
    const amount = isLast
      ? budget - allocated
      : Math.round((budget * item.percentage) / 100);
    allocated += amount;
    return { ...item, amount };
  });
};

export default function BudgetSetup() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [step, setStep] = useState('input');
  const [budget, setBudget] = useState('');
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const budgetNumber = Number(budget);

  const total = useMemo(
    () => rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0),
    [rows]
  );

  const handleContinue = () => {
    setError('');
    if (isNaN(budgetNumber) || budgetNumber <= 0) {
      setError('Monthly budget must be greater than zero.');
      return;
    }
    setRows(buildRecommendations(budgetNumber));
    setStep('recommend');
  };

  const handleAmountChange = (index, value) => {
    setRows((prev) =>
      prev.map((row, i) =>
        i === index ? { ...row, amount: value === '' ? '' : Number(value) } : row
      )
    );
  };

  const handleAccept = async () => {
    setError('');

    if (rows.some((r) => Number(r.amount) < 0)) {
      setError('Category amounts cannot be negative.');
      return;
    }

    if (Math.abs(total - budgetNumber) > 0.01) {
      setError(
        `Category amounts add up to ${total.toLocaleString()}, but your budget is ${budgetNumber.toLocaleString()}. They must match.`
      );
      return;
    }

    const payload = {
      monthlyBudget: budgetNumber,
      categories: rows.map((r) => ({
        category: r.category,
        allocatedAmount: Number(r.amount),
      })),
    };

    try {
      setLoading(true);
      await setupBudget(payload);
      setSuccess('Budget setup completed successfully.');
      setTimeout(() => navigate('/dashboard'), 1500);
    } catch (err) {
      setError(
        err.response?.data?.error ||
          'Something went wrong while saving. Please try again.'
      );
      setLoading(false);
    }
  };

  const handleBack = () => {
    setError('');
    setStep('input');
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0b0712] px-4 py-10">
      <div className="pointer-events-none absolute -left-24 top-0 h-96 w-96 rounded-full bg-fuchsia-600/25 blur-[120px] animate-blob" />
      <div className="pointer-events-none absolute -right-24 bottom-0 h-96 w-96 rounded-full bg-purple-600/25 blur-[120px] animate-blob delay-200" />

      <div className="relative w-full max-w-xl animate-fade-in-up rounded-3xl border border-white/10 bg-white/[0.04] p-8 shadow-2xl backdrop-blur-xl">
        <div className="mb-3 flex justify-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-500 to-pink-600 text-2xl shadow-lg shadow-fuchsia-500/40">
            💸
          </span>
        </div>
        <h1 className="bg-gradient-to-r from-fuchsia-400 via-pink-400 to-purple-400 bg-clip-text text-center text-2xl font-extrabold tracking-tight text-transparent text-glow">
          AI Personal Budget Assistant
        </h1>
        <p className="mt-2 text-center text-slate-400">
          {user?.name ? `Welcome, ${user.name}! ` : ''}Let&apos;s set up your monthly budget.
        </p>

        <div className="mt-6 space-y-4">
          {error && <Alert type="error">{error}</Alert>}
          {success && <Alert type="success">{success}</Alert>}

          {step === 'input' && (
            <>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-300">
                  Monthly Budget (PKR)
                </label>
                <input
                  type="number"
                  min="1"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder="e.g. 50000"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white placeholder-slate-500 focus:border-fuchsia-500 focus:outline-none focus:ring-1 focus:ring-fuchsia-500"
                />
              </div>

              <button
                onClick={handleContinue}
                className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 font-semibold text-white shadow-md transition hover:from-indigo-700 hover:to-violet-700 hover:shadow-lg active:scale-[0.99]"
              >
                Continue →
              </button>
            </>
          )}

          {step === 'recommend' && (
            <>
              <p className="text-sm text-slate-400">
                Here&apos;s a recommended split for{' '}
                <span className="font-semibold text-fuchsia-300">
                  {budgetNumber.toLocaleString()} PKR
                </span>
                . You can edit any amount before saving.
              </p>

              <BudgetTable
                rows={rows}
                onAmountChange={handleAmountChange}
                total={total}
                budget={budgetNumber}
              />

              <div className="flex gap-3">
                <button
                  onClick={handleBack}
                  disabled={loading}
                  className="flex-1 rounded-xl border border-white/15 px-4 py-3 font-semibold text-slate-300 transition hover:bg-white/10 disabled:opacity-60"
                >
                  Back
                </button>
                <button
                  onClick={handleAccept}
                  disabled={loading}
                  className="flex-1 rounded-xl bg-gradient-to-r from-fuchsia-600 to-pink-600 px-4 py-3 font-semibold text-white shadow-lg shadow-fuchsia-500/30 transition hover:from-fuchsia-500 hover:to-pink-500 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? 'Saving…' : 'Accept Budget ✓'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
