import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { getTransactions } from '../services/api.js';
import { formatPKR, formatDate } from '../utils/format.js';

export default function TransactionsPage() {
  const { user } = useAuth();
  const userId = user?.id;
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const loadTransactions = async () => {
    try {
      setLoading(true);
      const data = await getTransactions(userId);
      setTransactions(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, [userId]);

  const filteredTransactions = transactions.filter((t) => {
    if (filter === 'all') return true;
    if (filter === 'income') return t.type === 'income';
    if (filter === 'expense') return t.type === 'expense';
    return true;
  });

  const totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
  const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
  const netBalance = totalIncome - totalExpenses;

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Transactions</h1>
      </div>

      {/* Summary Cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 text-xl">
              💰
            </div>
            <div>
              <p className="text-sm font-medium text-slate-400">Total Income</p>
              <p className="text-2xl font-bold text-emerald-400">+{formatPKR(totalIncome)}</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 text-xl">
              💸
            </div>
            <div>
              <p className="text-sm font-medium text-slate-400">Total Expenses</p>
              <p className="text-2xl font-bold text-rose-400">-{formatPKR(totalExpenses)}</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-purple-600 text-xl">
              🏦
            </div>
            <div>
              <p className="text-sm font-medium text-slate-400">Net Balance</p>
              <p className={`text-2xl font-bold ${netBalance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {netBalance >= 0 ? '+' : ''}{formatPKR(netBalance)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="mb-4">
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              filter === 'all'
                ? 'bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white'
                : 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('income')}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              filter === 'income'
                ? 'bg-gradient-to-r from-emerald-600 to-green-600 text-white'
                : 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            Income
          </button>
          <button
            onClick={() => setFilter('expense')}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              filter === 'expense'
                ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white'
                : 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            Expenses
          </button>
        </div>
      </div>

      {/* Transactions List */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-sm">
        <div className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Transaction History</h2>
          <button className="text-sm text-slate-400 hover:text-white transition-colors">
            Export
          </button>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/10 border-t-fuchsia-500" />
          </div>
        ) : filteredTransactions.length === 0 ? (
          <p className="px-6 py-10 text-center text-slate-500">No transactions found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/5 text-slate-400">
                <tr>
                  <th className="px-6 py-3 font-medium">Description</th>
                  <th className="px-6 py-3 font-medium">Category</th>
                  <th className="px-6 py-3 font-medium">Type</th>
                  <th className="px-6 py-3 font-medium">Date</th>
                  <th className="px-6 py-3 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredTransactions.map((transaction) => (
                  <tr key={transaction.id} className="transition hover:bg-white/5">
                    <td className="px-6 py-4 font-medium text-slate-200">{transaction.description || '—'}</td>
                    <td className="px-6 py-4">
                      <span className="rounded-full bg-fuchsia-500/15 px-2.5 py-1 text-xs font-medium text-fuchsia-300">
                        {transaction.category || '—'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        transaction.type === 'income' 
                          ? 'bg-emerald-500/15 text-emerald-400' 
                          : 'bg-pink-500/15 text-pink-400'
                      }`}>
                        {transaction.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-400">{formatDate(transaction.date)}</td>
                    <td className={`px-6 py-4 text-right font-semibold ${
                      transaction.type === 'income' ? 'text-emerald-400' : 'text-rose-400'
                    }`}>
                      {transaction.type === 'income' ? '+' : '-'}{formatPKR(transaction.amount)}
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
