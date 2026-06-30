import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { getIncome, createIncome, deleteIncomeRecord } from '../services/api.js';
import { formatPKR, formatDate } from '../utils/format.js';

export default function IncomePage() {
  const { user } = useAuth();
  const userId = user?.id;
  const [incomeRecords, setIncomeRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({ source: '', amount: '', date: '' });

  // Search + filter
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');

  const loadIncome = async () => {
    try {
      setLoading(true);
      const data = await getIncome(userId);
      setIncomeRecords(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load income:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIncome();
  }, [userId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await createIncome({
        user_id: userId,
        source: formData.source,
        amount: parseFloat(formData.amount),
        date: formData.date || new Date().toISOString().split('T')[0],
      });
      setShowAddForm(false);
      setFormData({ source: '', amount: '', date: '' });
      loadIncome();
    } catch (error) {
      console.error('Failed to add income:', error);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteIncomeRecord(id);
      loadIncome();
    } catch (error) {
      console.error('Failed to delete income:', error);
    }
  };

  // Distinct sources for the filter dropdown.
  const sourceNames = useMemo(() => {
    const names = new Set();
    incomeRecords.forEach((r) => r.source && names.add(r.source));
    return [...names].sort();
  }, [incomeRecords]);

  // Apply search + source filter.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return incomeRecords.filter((r) => {
      if (sourceFilter !== 'all' && r.source !== sourceFilter) return false;
      if (!q) return true;
      return (r.source || '').toLowerCase().includes(q);
    });
  }, [incomeRecords, search, sourceFilter]);

  const totalIncome = filtered.reduce((sum, record) => sum + parseFloat(record.amount || 0), 0);

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Income</h1>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-pink-600 px-4 py-2 text-sm font-medium text-white hover:from-fuchsia-500 hover:to-pink-500 transition-all"
        >
          <span>+</span>
          <span>Add Income</span>
        </button>
      </div>

      {/* Summary Card */}
      <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 text-xl">
            💰
          </div>
          <div>
            <p className="text-sm font-medium text-slate-400">
              {sourceFilter === 'all' && !search ? 'Total Income' : 'Filtered Total'}
            </p>
            <p className="text-2xl font-bold text-white">{formatPKR(totalIncome)}</p>
          </div>
        </div>
      </div>

      {/* Add Income Form */}
      {showAddForm && (
        <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-sm">
          <h3 className="mb-4 text-lg font-semibold text-white">Add New Income</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">Source</label>
              <input
                type="text"
                value={formData.source}
                onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                placeholder="e.g., Salary, Freelance"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white placeholder-slate-500 focus:border-fuchsia-500 focus:outline-none focus:ring-1 focus:ring-fuchsia-500"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">Amount</label>
              <input
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="0.00"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white placeholder-slate-500 focus:border-fuchsia-500 focus:outline-none focus:ring-1 focus:ring-fuchsia-500"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">Date</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white placeholder-slate-500 focus:border-fuchsia-500 focus:outline-none focus:ring-1 focus:ring-fuchsia-500"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 rounded-xl bg-gradient-to-r from-fuchsia-600 to-pink-600 px-4 py-2 text-sm font-medium text-white hover:from-fuchsia-500 hover:to-pink-500 transition-all"
              >
                Add Income
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/10 transition-all"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search + Filter toolbar */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by source…"
            className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-white placeholder-slate-500 focus:border-fuchsia-500 focus:outline-none focus:ring-1 focus:ring-fuchsia-500"
          />
          <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-fuchsia-500 focus:outline-none focus:ring-1 focus:ring-fuchsia-500 sm:w-56"
        >
          <option value="all" className="bg-slate-900">All sources</option>
          {sourceNames.map((name) => (
            <option key={name} value={name} className="bg-slate-900">{name}</option>
          ))}
        </select>
      </div>

      {/* Income List */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-sm">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <h2 className="text-lg font-semibold text-white">Income Records</h2>
          <span className="text-xs text-slate-500">{filtered.length} shown</span>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/10 border-t-fuchsia-500" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="px-6 py-10 text-center text-slate-500">
            {incomeRecords.length === 0 ? 'No income records yet.' : 'No income matches your filters.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/5 text-slate-400">
                <tr>
                  <th className="px-6 py-3 font-medium">Source</th>
                  <th className="px-6 py-3 font-medium">Amount</th>
                  <th className="px-6 py-3 font-medium">Date</th>
                  <th className="px-6 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map((record) => (
                  <tr key={record.id} className="transition hover:bg-white/5">
                    <td className="px-6 py-4 font-medium text-slate-200">{record.source}</td>
                    <td className="px-6 py-4 font-semibold text-emerald-400">+{formatPKR(record.amount)}</td>
                    <td className="px-6 py-4 text-slate-400">{formatDate(record.date)}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleDelete(record.id)}
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
    </div>
  );
}
