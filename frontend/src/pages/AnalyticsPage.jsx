import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { getStatistics, getExpenses, getIncome } from '../services/api.js';
import { formatPKR } from '../utils/format.js';

export default function AnalyticsPage() {
  const { user } = useAuth();
  const userId = user?.id;
  const [stats, setStats] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [income, setIncome] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const [statsData, expensesData, incomeData] = await Promise.all([
        getStatistics(userId).catch(() => null),
        getExpenses(userId).catch(() => []),
        getIncome(userId).catch(() => []),
      ]);
      setStats(statsData);
      setExpenses(Array.isArray(expensesData) ? expensesData : []);
      setIncome(Array.isArray(incomeData) ? incomeData : []);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [userId]);

  const totalExpenses = expenses.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
  const totalIncome = income.reduce((sum, i) => sum + parseFloat(i.amount || 0), 0);
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome * 100).toFixed(1) : 0;

  // Group expenses by category
  const expensesByCategory = expenses.reduce((acc, e) => {
    const cat = e.category || 'Uncategorized';
    acc[cat] = (acc[cat] || 0) + parseFloat(e.amount || 0);
    return acc;
  }, {});

  const categoryData = Object.entries(expensesByCategory).map(([category, amount]) => ({
    category,
    amount,
    percentage: totalExpenses > 0 ? (amount / totalExpenses * 100).toFixed(1) : 0,
  })).sort((a, b) => b.amount - a.amount);

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Analytics</h1>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/10 border-t-fuchsia-500" />
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-sm">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 text-xl">
                  💰
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-400">Total Income</p>
                  <p className="text-2xl font-bold text-emerald-400">{formatPKR(totalIncome)}</p>
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
                  <p className="text-2xl font-bold text-rose-400">{formatPKR(totalExpenses)}</p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-sm">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-purple-600 text-xl">
                  📊
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-400">Savings Rate</p>
                  <p className="text-2xl font-bold text-white">{savingsRate}%</p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-sm">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-xl">
                  📈
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-400">Net Savings</p>
                  <p className={`text-2xl font-bold ${totalIncome - totalExpenses >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {formatPKR(totalIncome - totalExpenses)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Spending by Category */}
          <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-sm">
            <h2 className="mb-4 text-lg font-semibold text-white">Spending by Category</h2>
            {categoryData.length === 0 ? (
              <p className="text-slate-500">No expense data available.</p>
            ) : (
              <div className="space-y-4">
                {categoryData.map((item) => (
                  <div key={item.category}>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-300">{item.category}</span>
                      <div className="text-right">
                        <span className="text-sm font-semibold text-white">{formatPKR(item.amount)}</span>
                        <span className="ml-2 text-xs text-slate-500">{item.percentage}%</span>
                      </div>
                    </div>
                    <div className="h-3 w-full overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-pink-500 transition-all"
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Budget vs Actual */}
          {stats && stats.allocated && stats.spent && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-sm">
              <h2 className="mb-4 text-lg font-semibold text-white">Budget vs Actual Spending</h2>
              <div className="space-y-4">
                {stats.allocated.map((alloc, i) => {
                  const spent = stats.spent[i] || { amount: 0, category: alloc.category };
                  const remaining = alloc.amount - spent.amount;
                  const percentage = alloc.amount > 0 ? (spent.amount / alloc.amount * 100) : 0;
                  const isOverBudget = spent.amount > alloc.amount;

                  return (
                    <div key={alloc.category}>
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-300">{alloc.category}</span>
                        <div className="text-right">
                          <span className="text-sm font-semibold text-white">{formatPKR(spent.amount)}</span>
                          <span className="ml-2 text-xs text-slate-500">/ {formatPKR(alloc.amount)}</span>
                        </div>
                      </div>
                      <div className="h-3 w-full overflow-hidden rounded-full bg-white/10">
                        <div
                          className={`h-full rounded-full transition-all ${
                            isOverBudget
                              ? 'bg-gradient-to-r from-red-500 to-rose-500'
                              : 'bg-gradient-to-r from-fuchsia-500 to-pink-500'
                          }`}
                          style={{ width: `${Math.min(percentage, 100)}%` }}
                        />
                      </div>
                      <p className={`mt-1 text-xs ${isOverBudget ? 'text-red-400' : 'text-emerald-400'}`}>
                        {isOverBudget
                          ? `Over budget by ${formatPKR(Math.abs(remaining))}`
                          : `${formatPKR(remaining)} remaining (${percentage.toFixed(1)}% used)`
                        }
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
