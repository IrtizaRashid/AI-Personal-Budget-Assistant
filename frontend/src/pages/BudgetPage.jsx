import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { getCategories, updateBudgetAllocation } from '../services/api.js';
import { formatPKR } from '../utils/format.js';

export default function BudgetPage() {
  const { user } = useAuth();
  const userId = user?.id;
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [editValue, setEditValue] = useState('');

  const loadCategories = async () => {
    try {
      setLoading(true);
      const data = await getCategories(userId);
      setCategories(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load categories:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, [userId]);

  const handleEdit = (category) => {
    setEditing(category.id);
    setEditValue(category.allocated_amount.toString());
  };

  const handleSave = async (categoryId) => {
    try {
      await updateBudgetAllocation({
        user_id: userId,
        category_id: categoryId,
        new_amount: parseFloat(editValue),
      });
      setEditing(null);
      setEditValue('');
      loadCategories();
    } catch (error) {
      console.error('Failed to update budget:', error);
    }
  };

  const handleCancel = () => {
    setEditing(null);
    setEditValue('');
  };

  const totalAllocated = categories.reduce((sum, cat) => sum + parseFloat(cat.allocated_amount || 0), 0);
  const totalSpent = categories.reduce((sum, cat) => sum + parseFloat(cat.spent_amount || 0), 0);
  const totalRemaining = totalAllocated - totalSpent;

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Budget</h1>
      </div>

      {/* Summary Cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-purple-600 text-xl">
              💰
            </div>
            <div>
              <p className="text-sm font-medium text-slate-400">Total Allocated</p>
              <p className="text-2xl font-bold text-white">{formatPKR(totalAllocated)}</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 text-xl">
              💸
            </div>
            <div>
              <p className="text-sm font-medium text-slate-400">Total Spent</p>
              <p className="text-2xl font-bold text-white">{formatPKR(totalSpent)}</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 text-xl">
              🏦
            </div>
            <div>
              <p className="text-sm font-medium text-slate-400">Remaining</p>
              <p className="text-2xl font-bold text-white">{formatPKR(totalRemaining)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Categories List */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-sm">
        <div className="border-b border-white/10 px-6 py-4">
          <h2 className="text-lg font-semibold text-white">Budget Categories</h2>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/10 border-t-fuchsia-500" />
          </div>
        ) : categories.length === 0 ? (
          <p className="px-6 py-10 text-center text-slate-500">No budget categories set up yet.</p>
        ) : (
          <div className="divide-y divide-white/5">
            {categories.map((category) => {
              const spent = parseFloat(category.spent_amount || 0);
              const allocated = parseFloat(category.allocated_amount || 0);
              const remaining = allocated - spent;
              const percentage = allocated > 0 ? (spent / allocated) * 100 : 0;
              const isOverBudget = spent > allocated;

              return (
                <div key={category.id} className="px-6 py-4">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="rounded-full bg-fuchsia-500/15 px-3 py-1 text-sm font-medium text-fuchsia-300">
                        {category.category_name}
                      </span>
                      {isOverBudget && (
                        <span className="text-xs font-medium text-red-400">Over budget</span>
                      )}
                    </div>
                    {editing === category.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="w-32 rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-sm text-white focus:border-fuchsia-500 focus:outline-none"
                        />
                        <button
                          onClick={() => handleSave(category.id)}
                          className="rounded-lg bg-emerald-500/20 px-2 py-1 text-xs font-medium text-emerald-400 hover:bg-emerald-500/30"
                        >
                          Save
                        </button>
                        <button
                          onClick={handleCancel}
                          className="rounded-lg bg-white/5 px-2 py-1 text-xs font-medium text-slate-400 hover:bg-white/10"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleEdit(category)}
                        className="text-sm font-semibold text-white hover:text-fuchsia-300 transition-colors"
                      >
                        {formatPKR(allocated)}
                      </button>
                    )}
                  </div>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="text-slate-400">Spent: {formatPKR(spent)}</span>
                    <span className={`font-medium ${isOverBudget ? 'text-red-400' : 'text-emerald-400'}`}>
                      {isOverBudget ? `-${formatPKR(Math.abs(remaining))}` : formatPKR(remaining)} remaining
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className={`h-full rounded-full transition-all ${
                        isOverBudget
                          ? 'bg-gradient-to-r from-red-500 to-rose-500'
                          : 'bg-gradient-to-r from-fuchsia-500 to-pink-500'
                      }`}
                      style={{ width: `${Math.min(percentage, 100)}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{percentage.toFixed(1)}% used</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
