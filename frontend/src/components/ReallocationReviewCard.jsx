import { useState } from 'react';
import { formatPKR } from '../utils/format.js';
import { updateBudgetAllocation, createIncome } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function ReallocationReviewCard({ reallocation, onSaved, onCancelled }) {
  const { user } = useAuth();
  const [rows, setRows] = useState(
    reallocation.rows.map((r) => ({ ...r, editAmount: String(r.amount) }))
  );
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState(null);

  const total = reallocation.newTotalIncome;

  const allocated = rows.reduce((sum, r) => sum + (parseFloat(r.editAmount) || 0), 0);
  const diff = Math.round((total - allocated) * 100) / 100;
  const balanced = Math.abs(diff) < 0.02;

  const handleChange = (idx, val) => {
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, editAmount: val } : r))
    );
  };

  const handleSave = async () => {
    if (!balanced) return;
    setBusy(true);
    setOutcome(null);
    try {
      // Round each amount to 2 dp; give any rounding remainder to the last row
      const amounts = rows.map((r) =>
        Math.round((parseFloat(r.editAmount) || 0) * 100) / 100
      );
      const sumRounded = amounts.reduce((s, a) => s + a, 0);
      const remainder = Math.round((total - sumRounded) * 100) / 100;
      if (remainder !== 0) amounts[amounts.length - 1] += remainder;

      // Save both in parallel: budget allocation + income record
      await Promise.all([
        updateBudgetAllocation({
          monthlyBudget: total,
          categories: rows.map((r, i) => ({
            category: r.category,
            allocatedAmount: amounts[i],
          })),
        }),
        user?.id
          ? createIncome({
              userId: user.id,
              amount: reallocation.addedIncome,
              source: reallocation.source || null,
              description: reallocation.description || (reallocation.source ? `${reallocation.source} income` : 'Income received'),
              recurring: reallocation.recurring || false,
              receivedDate: reallocation.receivedDate || null,
              receivedTime: reallocation.receivedTime || null,
            })
          : Promise.resolve(),
      ]);

      setOutcome({ text: 'Income saved and budget updated!' });
      onSaved?.();
    } catch (err) {
      const msg =
        err?.response?.data?.error || err.message || 'Failed to save. Please try again.';
      setOutcome({ error: msg });
    } finally {
      setBusy(false);
    }
  };

  if (outcome?.text) {
    return <p className="text-green-300 text-sm">✅ {outcome.text}</p>;
  }

  return (
    <div className="space-y-3 text-sm">
      {/* Income summary */}
      <div className="rounded-lg bg-white/5 p-3 space-y-1">
        <div className="flex justify-between">
          <span className="text-slate-400">Previous Budget</span>
          <span className="text-white">{formatPKR(reallocation.currentIncome)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-green-400">Income Added</span>
          <span className="text-green-300">+{formatPKR(reallocation.addedIncome)}</span>
        </div>
        <div className="flex justify-between font-semibold border-t border-white/10 pt-1">
          <span className="text-slate-300">New Total</span>
          <span className="text-fuchsia-300">{formatPKR(total)}</span>
        </div>
      </div>

      {/* Editable category rows */}
      <p className="text-xs text-slate-400 font-medium">
        Adjust allocations — must total {formatPKR(total)}
      </p>
      <div className="space-y-1">
        {rows.map((row, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <span className="flex-1 truncate text-slate-300 text-xs">{row.category}</span>
            <input
              type="number"
              min="0"
              step="any"
              value={row.editAmount}
              onChange={(e) => handleChange(idx, e.target.value)}
              className="w-28 rounded-md border border-white/15 bg-white/5 px-2 py-1 text-right text-xs text-white focus:border-fuchsia-500 focus:outline-none focus:ring-1 focus:ring-fuchsia-500"
            />
          </div>
        ))}
      </div>

      {/* Running total / balance indicator */}
      <div
        className={`flex justify-between rounded px-2 py-1 text-xs font-semibold ${
          balanced ? 'bg-green-500/10 text-green-300' : 'bg-red-500/10 text-red-300'
        }`}
      >
        <span>Allocated</span>
        <span>
          {formatPKR(allocated)}
          {!balanced && (
            <span className="ml-1">
              ({diff > 0 ? `Rs ${diff} short` : `Rs ${Math.abs(diff)} over`})
            </span>
          )}
        </span>
      </div>

      {outcome?.error && <p className="text-red-300 text-xs">{outcome.error}</p>}

      <div className="flex gap-2 pt-1">
        <button
          onClick={handleSave}
          disabled={busy || !balanced}
          className="flex-1 rounded-lg bg-gradient-to-r from-fuchsia-600 to-pink-600 py-2 px-3 text-xs font-semibold text-white transition hover:from-fuchsia-500 hover:to-pink-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Save Changes'}
        </button>
        <button
          onClick={onCancelled}
          disabled={busy}
          className="flex-1 rounded-lg border border-white/20 py-2 px-3 text-xs font-semibold text-slate-300 transition hover:bg-white/10 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
