import { useState, useMemo } from 'react';
import { deleteExpense } from '../services/api.js';
import { formatPKR, formatDateCompact } from '../utils/format.js';
import ConfirmDialog from './ConfirmDialog.jsx';

// Expense history table with search + delete.
//
// Props:
//   expenses  : [{ id, category, amount, description, expense_date }]
//   onChanged : called after a successful delete so the parent can
//               silently refresh dashboard + categories + this list.
export default function ExpenseHistory({ expenses = [], onChanged }) {
  const [query, setQuery] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null); // expense or null
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState('');

  // Client-side search across category, description, amount and date.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return expenses;
    return expenses.filter((e) => {
      const date = formatDateCompact(e.expense_date).toLowerCase();
      return (
        e.category.toLowerCase().includes(q) ||
        (e.description || '').toLowerCase().includes(q) ||
        String(e.amount).includes(q) ||
        date.includes(q)
      );
    });
  }, [expenses, query]);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      setDeleting(true);
      await deleteExpense(pendingDelete.id);
      setMessage('Expense deleted successfully.');
      setPendingDelete(null);
      // Tell the parent to refresh everything (no page reload).
      if (typeof onChanged === 'function') onChanged();
      // Auto-hide the success message.
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage(
        err.response?.data?.error || 'Failed to delete the expense.'
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-sm">
      {/* Header + search */}
      <div className="flex flex-col gap-3 border-b border-white/10 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold text-white">Expense History</h2>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by category, description, date, amount…"
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-fuchsia-500 focus:outline-none focus:ring-1 focus:ring-fuchsia-500 sm:w-80"
        />
      </div>

      {/* Success / error banner */}
      {message && (
        <div className="border-b border-white/10 bg-emerald-500/10 px-6 py-2 text-sm text-emerald-300">
          {message}
        </div>
      )}

      {/* Table — scrollable vertically so it stays tall without pushing other panels */}
      <div className="overflow-auto max-h-[680px]">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="sticky top-0 z-10 bg-[#100a1a] text-slate-400">
            <tr>
              <th className="px-4 py-2.5 font-medium">Date</th>
              <th className="px-4 py-2.5 font-medium">Description</th>
              <th className="px-4 py-2.5 font-medium">Category</th>
              <th className="px-4 py-2.5 text-right font-medium">Amount</th>
              <th className="px-4 py-2.5 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filtered.map((e) => (
              <tr key={e.id} className="transition hover:bg-white/5">
                <td className="px-4 py-2.5 text-xs text-slate-400 whitespace-nowrap">
                  {formatDateCompact(e.expense_date)}
                </td>
                <td className="px-4 py-2.5 font-medium text-slate-200">
                  {e.description || '—'}
                </td>
                <td className="px-4 py-2.5">
                  <span className="rounded-full bg-fuchsia-500/15 px-2.5 py-0.5 text-xs font-medium text-fuchsia-300">
                    {e.category}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right font-semibold text-slate-100">
                  {formatPKR(e.amount)}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    onClick={() => setPendingDelete(e)}
                    className="rounded-lg px-3 py-1 text-xs font-semibold text-red-400 transition hover:bg-red-500/10"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Empty states */}
      {expenses.length === 0 && (
        <p className="px-6 py-10 text-center text-slate-500">
          No expenses yet. Add one using the AI Assistant.
        </p>
      )}
      {expenses.length > 0 && filtered.length === 0 && (
        <p className="px-6 py-10 text-center text-slate-500">
          No expenses match “{query}”.
        </p>
      )}

      {/* Delete confirmation modal */}
      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete expense?"
        message={
          pendingDelete
            ? `Delete "${pendingDelete.description || pendingDelete.category}" (${formatPKR(
                pendingDelete.amount
              )})? This will update your budget.`
            : ''
        }
        confirmText="Delete"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
