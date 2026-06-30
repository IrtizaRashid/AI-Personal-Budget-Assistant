import { useState } from 'react';
import { formatPKR } from '../utils/format.js';
import { createSplitExpense } from '../services/api.js';

export default function SharedSplitCard({ expense, userId, onSaved, onCancelled }) {
  const { total, category, description, paidBy, people = [] } = expense;
  const iAmPayer = !paidBy || paidBy === 'me';
  const allParticipants = iAmPayer ? ['You', ...people] : [paidBy, 'You', ...people.filter(p => p !== paidBy)];
  const count = allParticipants.length;
  const equalShare = Math.round((total / count) * 100) / 100;

  const [mode, setMode] = useState(null); // null | 'equal' | 'custom' | 'pct'
  const [customAmounts, setCustomAmounts] = useState(
    Object.fromEntries(people.map((p) => [p, String(equalShare)]))
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const sumOthers = people.reduce((s, p) => s + (parseFloat(customAmounts[p]) || 0), 0);
  const myCustomShare = Math.round((total - sumOthers) * 100) / 100;

  const buildSplits = () => {
    if (mode === 'equal') {
      // Give rounding remainder to the last person
      const splits = people.map((p, i) => {
        const isLast = i === people.length - 1;
        const amt = isLast
          ? Math.round((total - equalShare * (count - 1)) * 100) / 100
          : equalShare;
        return { person: p, amount: amt };
      });
      return { splits, myShare: Math.round((total - splits.reduce((s, sp) => s + sp.amount, 0)) * 100) / 100 };
    }
    const splits = people.map((p) => ({ person: p, amount: parseFloat(customAmounts[p]) || 0 }));
    return { splits, myShare: myCustomShare };
  };

  const handleConfirm = async () => {
    if (!mode) return;
    const { splits, myShare } = buildSplits();
    const splitsTotal = splits.reduce((s, sp) => s + sp.amount, 0);

    if (mode !== 'equal' && Math.abs(splitsTotal + myShare - total) > 0.02) {
      setError(`Amounts must add up to ${formatPKR(total)}. Currently: ${formatPKR(splitsTotal + myShare)}.`);
      return;
    }

    setBusy(true);
    setError('');
    try {
      const result = await createSplitExpense({
        userId, total, category, description, paidBy,
        splits: iAmPayer ? splits : [{ person: 'me', amount: myShare }],
      });
      onSaved?.(result);
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to save. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 text-sm">
      {/* Summary */}
      <div className="rounded-lg bg-white/5 p-3 space-y-1">
        <div className="flex justify-between">
          <span className="text-slate-400">Total Bill</span>
          <span className="font-semibold text-white">{formatPKR(total)}</span>
        </div>
        {category && (
          <div className="flex justify-between">
            <span className="text-slate-400">Category</span>
            <span className="text-slate-300">{category}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-slate-400">Paid by</span>
          <span className="text-slate-300">{iAmPayer ? 'You' : paidBy}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Participants</span>
          <span className="text-slate-300">{allParticipants.join(', ')}</span>
        </div>
      </div>

      {/* Split type picker */}
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">How to split?</p>
      <div className="flex gap-2">
        {[
          { key: 'equal', label: `Equal (${formatPKR(equalShare)} each)` },
          { key: 'custom', label: 'Custom amounts' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setMode(key)}
            className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
              mode === key
                ? 'border-fuchsia-500 bg-fuchsia-500/20 text-fuchsia-300'
                : 'border-white/15 bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Custom amount inputs */}
      {mode === 'custom' && (
        <div className="space-y-2">
          {people.map((person) => (
            <div key={person} className="flex items-center gap-2">
              <span className="flex-1 text-xs text-slate-300">{person} owes</span>
              <input
                type="number"
                min="0"
                step="any"
                value={customAmounts[person]}
                onChange={(e) =>
                  setCustomAmounts((prev) => ({ ...prev, [person]: e.target.value }))
                }
                className="w-28 rounded-md border border-white/15 bg-white/5 px-2 py-1 text-right text-xs text-white focus:border-fuchsia-500 focus:outline-none focus:ring-1 focus:ring-fuchsia-500"
              />
            </div>
          ))}
          <div className="flex justify-between rounded-md bg-white/5 px-2 py-1 text-xs">
            <span className="text-slate-400">Your share</span>
            <span className={myCustomShare < 0 ? 'text-red-300' : 'text-fuchsia-300 font-semibold'}>
              {formatPKR(Math.max(0, myCustomShare))}
            </span>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-300">{error}</p>}

      <div className="flex gap-2 pt-1">
        <button
          onClick={handleConfirm}
          disabled={busy || !mode}
          className="flex-1 rounded-lg bg-gradient-to-r from-fuchsia-600 to-pink-600 py-2 px-3 text-xs font-semibold text-white transition hover:from-fuchsia-500 hover:to-pink-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Confirm Split'}
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
