import { useState, useMemo } from 'react';
import { formatPKR, formatDateCompact } from '../utils/format.js';

const TYPE_META = {
  // Core
  expense:              { label: 'Expense',              icon: '💸', color: 'text-red-400',      bg: 'bg-red-500/10',       sign: '-', group: 'expense'     },
  income:               { label: 'Income',               icon: '💵', color: 'text-emerald-400',  bg: 'bg-emerald-500/10',   sign: '+', group: 'income'      },
  // Loans
  loan_given:           { label: 'Loan Given',           icon: '🤝', color: 'text-amber-400',    bg: 'bg-amber-500/10',     sign: '-', group: 'loan'        },
  loan_taken:           { label: 'Loan Taken',           icon: '💰', color: 'text-blue-400',     bg: 'bg-blue-500/10',      sign: '+', group: 'loan'        },
  repayment_received:   { label: 'Repayment Received',   icon: '✅', color: 'text-emerald-400',  bg: 'bg-emerald-500/10',   sign: '+', group: 'repayment'   },
  repayment_made:       { label: 'Repayment Made',       icon: '📤', color: 'text-orange-400',   bg: 'bg-orange-500/10',    sign: '-', group: 'repayment'   },
  // Shared
  shared_expense:       { label: 'Shared Expense',       icon: '🤝', color: 'text-pink-400',     bg: 'bg-pink-500/10',      sign: '-', group: 'expense'     },
  // Investments
  investment_buy:       { label: 'Investment Buy',       icon: '📈', color: 'text-teal-400',     bg: 'bg-teal-500/10',      sign: '-', group: 'investment'  },
  investment_sell:      { label: 'Investment Sale',      icon: '📉', color: 'text-cyan-400',     bg: 'bg-cyan-500/10',      sign: '+', group: 'investment'  },
  investment_dividend:  { label: 'Dividend',             icon: '💹', color: 'text-emerald-400',  bg: 'bg-emerald-500/10',   sign: '+', group: 'investment'  },
  investment_interest:  { label: 'Interest',             icon: '💹', color: 'text-emerald-400',  bg: 'bg-emerald-500/10',   sign: '+', group: 'investment'  },
  investment_gain:      { label: 'Capital Gain',         icon: '🟢', color: 'text-emerald-400',  bg: 'bg-emerald-500/10',   sign: '+', group: 'investment'  },
  investment_loss:      { label: 'Capital Loss',         icon: '🔴', color: 'text-red-400',      bg: 'bg-red-500/10',       sign: '-', group: 'investment'  },
  // Budget / category
  budget_transfer:      { label: 'Budget Transfer',      icon: '🔄', color: 'text-violet-400',   bg: 'bg-violet-500/10',    sign: '',  group: 'budget'      },
  savings_transfer:     { label: 'Savings Transfer',     icon: '🏦', color: 'text-indigo-400',   bg: 'bg-indigo-500/10',    sign: '',  group: 'budget'      },
  category_adjustment:  { label: 'Category Adjustment',  icon: '⚙️', color: 'text-slate-400',    bg: 'bg-slate-500/10',     sign: '',  group: 'budget'      },
  // Misc
  refund:               { label: 'Refund',               icon: '↩️', color: 'text-emerald-400',  bg: 'bg-emerald-500/10',   sign: '+', group: 'expense'     },
  reimbursement:        { label: 'Reimbursement',        icon: '💱', color: 'text-emerald-400',  bg: 'bg-emerald-500/10',   sign: '+', group: 'expense'     },
};

const FILTERS = [
  { label: 'All',                groups: null },
  { label: 'Income',             groups: ['income']      },
  { label: 'Expense',            groups: ['expense']     },
  { label: 'Investment',         groups: ['investment']  },
  { label: 'Loan',               groups: ['loan']        },
  { label: 'Repayment',          groups: ['repayment']   },
  { label: 'Budget',             groups: ['budget']      },
];

function matchesFilter(t, groups) {
  if (!groups) return true;
  const meta = TYPE_META[t.type];
  return meta ? groups.includes(meta.group) : false;
}

// Build the primary display line for a transaction row
function primaryLabel(t) {
  if (t.description && t.description !== t.category) return t.description;
  if (t.investment_name) return t.investment_name;
  if (t.category) return t.category;
  return TYPE_META[t.type]?.label ?? t.type;
}

// Build the secondary info line
function secondaryLabel(t) {
  const meta = TYPE_META[t.type];
  const parts = [meta?.label ?? t.type];
  if (t.person) parts.push(t.person);
  if (t.investment_name && t.description !== t.investment_name) parts.push(t.investment_name);
  if (t.category && !['income', 'loan_given', 'loan_taken', 'repayment_received', 'repayment_made'].includes(t.type)) {
    if (t.category !== t.description) parts.push(t.category);
  }
  return parts.join(' · ');
}

export default function TransactionHistory({ transactions = [] }) {
  const [query, setQuery]   = useState('');
  const [filter, setFilter] = useState('All');

  const filtered = useMemo(() => {
    const activeFilter = FILTERS.find(f => f.label === filter);
    let list = transactions.filter(t => matchesFilter(t, activeFilter?.groups ?? null));

    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(t =>
        (t.description      || '').toLowerCase().includes(q) ||
        (t.category         || '').toLowerCase().includes(q) ||
        (t.person           || '').toLowerCase().includes(q) ||
        (t.investment_name  || '').toLowerCase().includes(q) ||
        (t.type             || '').toLowerCase().includes(q) ||
        String(t.amount).includes(q) ||
        (t.date ? formatDateCompact(t.date).toLowerCase().includes(q) : false)
      );
    }
    return list;
  }, [transactions, filter, query]);

  // Count per filter for badges
  const counts = useMemo(() => {
    const c = {};
    for (const f of FILTERS) {
      c[f.label] = f.groups
        ? transactions.filter(t => matchesFilter(t, f.groups)).length
        : transactions.length;
    }
    return c;
  }, [transactions]);

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-sm">
      {/* Header */}
      <div className="border-b border-white/10 bg-gradient-to-r from-indigo-600/30 to-purple-600/30 px-6 py-4">
        <h2 className="flex items-center gap-2 text-base font-semibold text-white">
          📋 Transaction History
        </h2>
        <p className="mt-0.5 text-xs text-slate-400">Every financial movement in one place</p>
      </div>

      {/* Filters + search */}
      <div className="border-b border-white/10 px-4 py-3 space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map(f => (
            <button
              key={f.label}
              onClick={() => setFilter(f.label)}
              className={`flex items-center gap-1 rounded-full px-3 py-0.5 text-xs font-semibold transition ${
                filter === f.label
                  ? 'bg-fuchsia-600 text-white'
                  : 'border border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              {f.label}
              {counts[f.label] > 0 && (
                <span className={`rounded-full px-1 text-[10px] ${filter === f.label ? 'bg-white/20' : 'bg-white/10'}`}>
                  {counts[f.label]}
                </span>
              )}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by name, category, person, amount…"
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-fuchsia-500 focus:outline-none focus:ring-1 focus:ring-fuchsia-500"
        />
      </div>

      {/* List */}
      <div className="max-h-[520px] overflow-y-auto divide-y divide-white/5">
        {filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">
            {query ? `No results for "${query}"` : 'No transactions yet.'}
          </p>
        ) : (
          filtered.map((t, i) => {
            const meta = TYPE_META[t.type] ?? { label: t.type, icon: '•', color: 'text-slate-400', bg: 'bg-white/5', sign: '' };
            const signColor = meta.sign === '+' ? 'text-emerald-400' : meta.sign === '-' ? 'text-red-400' : meta.color;
            return (
              <div
                key={`${t.type}-${t.id}-${i}`}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.03] transition"
              >
                {/* Icon */}
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-sm ${meta.bg}`}>
                  {meta.icon}
                </span>

                {/* Description + meta */}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white truncate">
                    {primaryLabel(t)}
                  </p>
                  <p className="text-[10px] text-slate-500 truncate">
                    {secondaryLabel(t)}
                  </p>
                </div>

                {/* Date */}
                <p className="shrink-0 text-[10px] text-slate-500 text-right">
                  {t.date ? formatDateCompact(t.date) : '—'}
                </p>

                {/* Amount */}
                <span className={`shrink-0 text-sm font-semibold ${signColor}`}>
                  {meta.sign}{formatPKR(t.amount)}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      {transactions.length > 0 && (
        <div className="border-t border-white/10 px-4 py-2 flex items-center justify-between text-xs text-slate-500">
          <span>{filtered.length} of {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}</span>
          {filter !== 'All' && filtered.length !== counts[filter] && (
            <button onClick={() => setQuery('')} className="text-fuchsia-400 hover:underline">
              Clear search
            </button>
          )}
        </div>
      )}
    </div>
  );
}
