import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { setupBudget } from '../services/api.js';
import BudgetTable from '../components/BudgetTable.jsx';
import Alert from '../components/Alert.jsx';

// Default recommended allocation percentages (must total 100%).
const DEFAULT_ALLOCATIONS = [
  { category: 'Food', percentage: 30 },
  { category: 'Transport', percentage: 15 },
  { category: 'Bills', percentage: 20 },
  { category: 'Entertainment', percentage: 10 },
  { category: 'Savings', percentage: 20 },
  { category: 'Miscellaneous', percentage: 5 },
];

// Turn a monthly budget into recommended amounts.
// The LAST category absorbs any rounding remainder so the amounts
// always sum exactly to the budget (avoids instant validation errors).
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

  // 'input' = enter name + budget, 'recommend' = review/edit categories
  const [step, setStep] = useState('input');

  const [name, setName] = useState('');
  const [budget, setBudget] = useState('');
  const [rows, setRows] = useState([]);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const budgetNumber = Number(budget);

  // Live total of all (possibly edited) category amounts.
  const total = useMemo(
    () => rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0),
    [rows]
  );

  // --- Step 1: validate budget, then build recommendations ---
  const handleContinue = () => {
    setError('');

    if (!name.trim()) {
      setError('Please enter your name.');
      return;
    }
    if (isNaN(budgetNumber) || budgetNumber <= 0) {
      setError('Monthly budget must be greater than zero.');
      return;
    }

    setRows(buildRecommendations(budgetNumber));
    setStep('recommend');
  };

  // --- Edit a single category amount ---
  const handleAmountChange = (index, value) => {
    setRows((prev) =>
      prev.map((row, i) =>
        i === index ? { ...row, amount: value === '' ? '' : Number(value) } : row
      )
    );
  };

  // --- Step 2: validate edited amounts and save ---
  const handleAccept = async () => {
    setError('');

    // No negative amounts.
    if (rows.some((r) => Number(r.amount) < 0)) {
      setError('Category amounts cannot be negative.');
      return;
    }

    // Sum must equal the monthly budget.
    if (Math.abs(total - budgetNumber) > 0.01) {
      setError(
        `Category amounts add up to ${total.toLocaleString()}, but your budget is ${budgetNumber.toLocaleString()}. They must match.`
      );
      return;
    }

    // Build the API payload.
    const payload = {
      name: name.trim(),
      monthlyBudget: budgetNumber,
      categories: rows.map((r) => ({
        category: r.category,
        allocatedAmount: Number(r.amount),
      })),
    };

    try {
      setLoading(true);
      const result = await setupBudget(payload);
      // Remember which user we just created so the Dashboard can load them.
      localStorage.setItem('budgetUserId', result.userId);
      setSuccess('Budget setup completed successfully.');
      // Briefly show the success message, then go to the dashboard.
      // NOTE: we intentionally do NOT reset `loading` here — keeping the
      // buttons disabled until navigation prevents a duplicate submission
      // (a second click during the 1.5s window would create a second user).
      setTimeout(() => navigate('/dashboard'), 1500);
    } catch (err) {
      // Prefer the backend's message; fall back to a generic one.
      setError(
        err.response?.data?.error ||
          'Something went wrong while saving. Please try again.'
      );
      // Only re-enable on failure so the user can retry.
      setLoading(false);
    }
  };

  const handleBack = () => {
    setError('');
    setStep('input');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-xl rounded-2xl bg-white p-8 shadow-lg">
        {/* Header */}
        <h1 className="text-center text-2xl font-bold text-slate-800">
          AI Personal Budget Assistant
        </h1>
        <p className="mt-2 text-center text-slate-500">
          Let&apos;s set up your monthly budget.
        </p>

        <div className="mt-6 space-y-4">
          {error && <Alert type="error">{error}</Alert>}
          {success && <Alert type="success">{success}</Alert>}

          {/* ---------- STEP 1: INPUT ---------- */}
          {step === 'input' && (
            <>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-600">
                  Your Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Irtiza"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-600">
                  Monthly Budget (PKR)
                </label>
                <input
                  type="number"
                  min="1"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder="e.g. 50000"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <button
                onClick={handleContinue}
                className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white transition hover:bg-indigo-700"
              >
                Continue
              </button>
            </>
          )}

          {/* ---------- STEP 2: RECOMMENDATIONS ---------- */}
          {step === 'recommend' && (
            <>
              <p className="text-sm text-slate-500">
                Here&apos;s a recommended split for{' '}
                <span className="font-semibold text-slate-700">
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
                  className="flex-1 rounded-xl border border-slate-300 px-4 py-3 font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
                >
                  Back
                </button>
                <button
                  onClick={handleAccept}
                  disabled={loading}
                  className="flex-1 rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? 'Saving…' : 'Accept Budget'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
