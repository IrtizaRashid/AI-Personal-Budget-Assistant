import { useState } from 'react';
import { formatPKR } from '../utils/format.js';
import { markLoanPaid, deleteLoan } from '../services/api.js';

const formatDate = (d) => {
  if (!d) return '—';
  const date = new Date(d);
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

const formatTime = (t) => {
  if (!t) return null;
  // t is HH:mm:ss — display as HH:mm
  return String(t).slice(0, 5);
};

export default function LoanHistory({ loans = [], onChanged }) {
  const [busyId, setBusyId] = useState(null);

  const given = loans.filter((l) => l.type === 'given');
  const taken = loans.filter((l) => l.type === 'taken');

  const totalOwedToMe = given.filter((l) => l.status === 'active').reduce((s, l) => s + Number(l.amount), 0);
  const totalIOwe = taken.filter((l) => l.status === 'active').reduce((s, l) => s + Number(l.amount), 0);

  const handleMarkPaid = async (id) => {
    setBusyId(id);
    try {
      await markLoanPaid(id);
      onChanged?.();
    } catch {
      alert('Could not update loan. Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this loan record?')) return;
    setBusyId(id);
    try {
      await deleteLoan(id);
      onChanged?.();
    } catch {
      alert('Could not delete loan. Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  const LoanRow = ({ loan }) => {
    const isGiven = loan.type === 'given';
    const isPaid = loan.status === 'paid';
    const time = formatTime(loan.loan_time);

    return (
      <div className={`flex items-center gap-3 px-4 py-3 transition hover:bg-white/[0.03] ${isPaid ? 'opacity-50' : ''}`}>
        {/* Type icon */}
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base ${
            isGiven ? 'bg-emerald-500/15' : 'bg-red-500/15'
          }`}
        >
          {isGiven ? '💰' : '💸'}
        </span>

        {/* Name + description + date */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-white" title={loan.person_name}>{loan.person_name}</p>
            {isPaid && (
              <span className="shrink-0 rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">
                settled
              </span>
            )}
          </div>
          <p className="text-[10px] text-slate-500">
            {loan.description ? `${loan.description} · ` : ''}{formatDate(loan.loan_date)}{time ? ` · ${time}` : ''}
          </p>
        </div>

        {/* Amount — show remaining / original when partially repaid */}
        <div className="shrink-0 text-right">
          <span
            className={`text-sm font-semibold ${
              isPaid ? 'line-through text-slate-500' : isGiven ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {isGiven ? '+' : '-'}{formatPKR(loan.amount)}
          </span>
          {!isPaid && Number(loan.original_amount) !== Number(loan.amount) && (
            <p className="text-[10px] text-slate-500">
              of {formatPKR(loan.original_amount)}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex shrink-0 gap-1">
          {!isPaid && (
            <button
              onClick={() => handleMarkPaid(loan.id)}
              disabled={busyId === loan.id}
              title="Mark as settled"
              className="rounded-lg px-2 py-1 text-[10px] font-semibold text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/10 transition disabled:opacity-40"
            >
              {busyId === loan.id ? '…' : 'Settled'}
            </button>
          )}
          <button
            onClick={() => handleDelete(loan.id)}
            disabled={busyId === loan.id}
            title="Delete record"
            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-red-500/10 hover:text-red-400 disabled:opacity-40"
          >
            ✕
          </button>
        </div>
      </div>
    );
  };

  const Section = ({ title, icon, items, totalLabel, totalValue, totalClass }) => (
    <div>
      <div className={`border-b border-white/10 px-4 py-3 flex items-center justify-between`}>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
          <span>{icon}</span> {title}
        </h3>
        {totalValue > 0 && (
          <span className={`text-sm font-bold ${totalClass}`}>{totalLabel}: {formatPKR(totalValue)}</span>
        )}
      </div>
      {items.length === 0 ? (
        <p className="px-4 py-3 text-xs text-slate-500">No {title.toLowerCase()} recorded yet.</p>
      ) : (
        <div className="divide-y divide-white/5">
          {items.map((l) => <LoanRow key={l.id} loan={l} />)}
        </div>
      )}
    </div>
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-sm">
      {/* Header */}
      <div className="border-b border-white/10 bg-gradient-to-r from-violet-600/30 to-fuchsia-600/30 px-6 py-4">
        <h2 className="flex items-center gap-2 text-base font-semibold text-white">
          🤝 Loan Tracker
        </h2>
        <p className="mt-0.5 text-xs text-slate-400">
          Tell the AI "I lent Ali 5000" or "Ali returned 500" to manage loans
        </p>
      </div>

      {loans.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
          <span className="text-3xl">🤝</span>
          <p className="text-sm font-medium text-slate-400">No loans recorded yet</p>
          <p className="text-xs text-slate-500">
            Try: "I lent Ali 5000 for lunch" or "Ahmed borrowed 3000 from me"
          </p>
        </div>
      ) : (
        <>
          <Section
            title="Loans Given"
            icon="💰"
            items={given}
            totalLabel="Outstanding"
            totalValue={totalOwedToMe}
            totalClass="text-emerald-400"
          />
          <Section
            title="Loans Taken"
            icon="💸"
            items={taken}
            totalLabel="Outstanding"
            totalValue={totalIOwe}
            totalClass="text-red-400"
          />
        </>
      )}
    </div>
  );
}
