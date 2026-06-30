import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { getExpenses, deleteExpense, getCategories } from '../services/api.js';
import { formatPKR, formatDate } from '../utils/format.js';

export default function ExpensesPage() {
  const { user } = useAuth();
  const userId = user?.id;
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search + filter
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const loadExpenses = async () => {
    try {
      setLoading(true);
      const [exps, cats] = await Promise.all([
        getExpenses(userId),
        getCategories(userId).catch(() => []),
      ]);
      setExpenses(Array.isArray(exps) ? exps : []);
      setCategories(Array.isArray(cats) ? cats : []);
    } catch (error) {
      console.error('Failed to load expenses:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExpenses();
  }, [userId]);

  const handleDelete = async (id) => {
    try {
      await deleteExpense(id);
      loadExpenses();
    } catch (error) {
      console.error('Failed to delete expense:', error);
    }
  };

  // Distinct category names for the filter dropdown (from both budget + records).
  const categoryNames = useMemo(() => {
    const names = new Set();
    categories.forEach((c) => c.category_name && names.add(c.category_name));
    expenses.forEach((e) => e.category && names.add(e.category));
    return [...names].sort();
  }, [categories, expenses]);

  // Apply search + category filter.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return expenses.filter((e) => {
      if (categoryFilter !== 'all' && e.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        (e.description || '').toLowerCase().includes(q) ||
        (e.category || '').toLowerCase().includes(q)
      );
    });
  }, [expenses, search, categoryFilter]);

  const totalExpenses = filtered.reduce((sum, expense) => sum + parseFloat(expense.amount || 0), 0);

  // Group filtered expenses by category for the breakdown.
  const expensesByCategory = filtered.reduce((acc, expense) => {
    const category = expense.category || 'Uncategorized';
    if (!acc[category]) acc[category] = [];
    acc[category].push(expense);
    return acc;
  }, {});

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Expenses</h1>
      </div>

      {/* Summary Card */}
      <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 text-xl">
            💸
          </div>
          <div>
            <p className="text-sm font-medium text-slate-400">
              {categoryFilter === 'all' && !search ? 'Total Expenses' : 'Filtered Total'}
            </p>
            <p className="text-2xl font-bold text-white">{formatPKR(totalExpenses)}</p>
          </div>
        </div>
      </div>

      {/* Search + Filter toolbar */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by description or category…"
            className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-white placeholder-slate-500 focus:border-fuchsia-500 focus:outline-none focus:ring-1 focus:ring-fuchsia-500"
          />
          <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-fuchsia-500 focus:outline-none focus:ring-1 focus:ring-fuchsia-500 sm:w-56"
        >
          <option value="all" className="bg-slate-900">All categories</option>
          {categoryNames.map((name) => (
            <option key={name} value={name} className="bg-slate-900">{name}</option>
          ))}
        </select>
      </div>

      {/* Expenses List */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-sm">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <h2 className="text-lg font-semibold text-white">Expense Records</h2>
          <span className="text-xs text-slate-500">{filtered.length} shown</span>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/10 border-t-fuchsia-500" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="px-6 py-10 text-center text-slate-500">
            {expenses.length === 0 ? 'No expenses recorded yet.' : 'No expenses match your filters.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/5 text-slate-400">
                <tr>
                  <th className="px-6 py-3 font-medium">Description</th>
                  <th className="px-6 py-3 font-medium">Category</th>
                  <th className="px-6 py-3 font-medium">Amount</th>
                  <th className="px-6 py-3 font-medium">Date</th>
                  <th className="px-6 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map((expense) => (
                  <tr key={expense.id} className="transition hover:bg-white/5">
                    <td className="px-6 py-4 font-medium text-slate-200">{expense.description || '—'}</td>
                    <td className="px-6 py-4">
                      <span className="rounded-full bg-fuchsia-500/15 px-2.5 py-1 text-xs font-medium text-fuchsia-300">
                        {expense.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-semibold text-rose-400">-{formatPKR(expense.amount)}</td>
                    <td className="px-6 py-4 text-slate-400">{formatDate(expense.expense_date)}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleDelete(expense.id)}
                        className="text-slate-400 hover:text-red-400 transition-colors"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Category Breakdown */}
      {Object.keys(expensesByCategory).length > 0 && (
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-sm">
          <h2 className="mb-4 text-lg font-semibold text-white">Expenses by Category</h2>
          <div className="space-y-3">
            {Object.entries(expensesByCategory).map(([category, categoryExpenses]) => {
              const categoryTotal = categoryExpenses.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
              const percentage = totalExpenses > 0 ? (categoryTotal / totalExpenses) * 100 : 0;
              return (
                <div key={category}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-300">{category}</span>
                    <span className="text-sm font-semibold text-white">{formatPKR(categoryTotal)}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-pink-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{percentage.toFixed(1)}% of total</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
