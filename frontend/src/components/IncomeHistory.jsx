import { useState } from 'react';
import { formatPKR } from '../utils/format.js';
import { deleteIncomeRecord } from '../services/api.js';

const SOURCE_ICONS = {
  salary: '💼',
  bonus: '🎁',
  freelance: '💻',
  business: '🏢',
  payment: '💳',
  investment: '📈',
  rental: '🏠',
  gift: '🎀',
};

const sourceIcon = (src) =>
  SOURCE_ICONS[String(src || '').toLowerCase()] ?? '💵';

const formatDate = (raw) => {
  if (!raw) return '—';
  const d = new Date(raw);
  return d.toLocaleDateString('en-PK', { day: 'numeric', month: 'short' });
};

export default function IncomeHistory({ income = [], onChanged }) {
  const [deletingId, setDeletingId] = useState(null);

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this income record? Your budget allocation will not change.')) return;
    setDeletingId(id);
    try {
      await deleteIncomeRecord(id);
      onChanged?.();
    } catch {
      alert('Could not delete income record. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-sm">
      {/* Header */}
      <div className="border-b border-white/10 bg-gradient-to-r from-emerald-600/30 to-teal-600/30 px-4 py-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-white">
          💵 Income History
        </h2>
        <p className="mt-0.5 text-xs text-slate-400">
          Every income entry recorded via AI chat
        </p>
      </div>

      {income.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-12 text-slate-500">
          <span className="text-3xl">💰</span>
          <p className="text-sm">No income recorded yet.</p>
          <p className="text-xs">
            Say <span className="text-slate-300">"I received my salary of 50000"</span> in the AI chat.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-white/5">
          {income.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center gap-2 px-4 py-2.5 transition hover:bg-white/[0.03]"
            >
              {/* Icon */}
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-base">
                {sourceIcon(entry.source)}
              </span>

              {/* Source + description */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="text-sm font-medium capitalize text-white">
                    {entry.source || 'Income'}
                  </p>
                  {entry.recurring ? (
                    <span className="shrink-0 rounded-full bg-fuchsia-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-fuchsia-300">
                      recurring
                    </span>
                  ) : null}
                </div>
                {entry.description && entry.description !== `${entry.source} income` && (
                  <p className="truncate text-xs text-slate-400">{entry.description}</p>
                )}
              </div>

              {/* Date + time */}
              <div className="shrink-0 text-right">
                <p className="text-xs text-slate-400">{formatDate(entry.received_date)}</p>
                {entry.received_time && (
                  <p className="text-[10px] text-slate-500">
                    {entry.received_time.slice(0, 5)}
                  </p>
                )}
              </div>

              {/* Amount */}
              <span className="shrink-0 text-xs font-semibold text-emerald-400">
                +{formatPKR(entry.amount)}
              </span>

              {/* Delete */}
              <button
                onClick={() => handleDelete(entry.id)}
                disabled={deletingId === entry.id}
                title="Remove record"
                className="shrink-0 rounded-lg p-1.5 text-slate-500 transition hover:bg-red-500/10 hover:text-red-400 disabled:opacity-40"
              >
                {deletingId === entry.id ? (
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-500 border-t-transparent" />
                ) : (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                )}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Total row */}
      {income.length > 0 && (
        <div className="border-t border-white/10 bg-emerald-500/5 px-4 py-2 flex justify-between items-center">
          <span className="text-xs font-medium text-slate-400">
            {income.length} income {income.length === 1 ? 'entry' : 'entries'}
          </span>
          <span className="text-sm font-bold text-emerald-300">
            Total: {formatPKR(income.reduce((s, e) => s + Number(e.amount), 0))}
          </span>
        </div>
      )}
    </div>
  );
}
