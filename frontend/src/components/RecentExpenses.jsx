import { formatPKR, formatDate } from '../utils/format.js';

// Read-only table of the latest 5 expenses (shown below the charts).
// Expenses arrive already sorted newest-first from the backend.
//
// Props:
//   expenses : [{ id, category, amount, description, expense_date }]
export default function RecentExpenses({ expenses = [] }) {
  const recent = expenses.slice(0, 5);

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-sm">
      <div className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Recent Transactions</h2>
        <button className="text-sm text-slate-400 hover:text-white transition-colors">
          Export
        </button>
      </div>

      {recent.length === 0 ? (
        <p className="px-6 py-10 text-center text-slate-500">
          No transactions yet.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-white/5 text-slate-400">
              <tr>
                <th className="px-6 py-3 font-medium">Description</th>
                <th className="px-6 py-3 font-medium">Category</th>
                <th className="px-6 py-3 font-medium">Date</th>
                <th className="px-6 py-3 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {recent.map((e) => (
                <tr key={e.id} className="transition hover:bg-white/5">
                  <td className="px-6 py-4 font-medium text-slate-200">
                    {e.description || '—'}
                  </td>
                  <td className="px-6 py-4">
                    <span className="rounded-full bg-fuchsia-500/15 px-2.5 py-1 text-xs font-medium text-fuchsia-300">
                      {e.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-400">
                    {formatDate(e.expense_date)}
                  </td>
                  <td className="px-6 py-4 text-right font-semibold text-slate-100">
                    -{formatPKR(e.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
