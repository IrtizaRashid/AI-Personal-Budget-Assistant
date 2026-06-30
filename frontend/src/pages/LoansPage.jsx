import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { getLoans, markLoanPaid, deleteLoan } from '../services/api.js';
import { formatPKR } from '../utils/format.js';
import NavBar from '../components/NavBar.jsx';

const TABS = ['given', 'taken'];

const STATUS_BADGE = {
  active: 'bg-amber-500/15 text-amber-300',
  paid:   'bg-emerald-500/15 text-emerald-300',
};

const formatDate = (raw) => {
  if (!raw) return '—';
  return new Date(raw).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });
};

function SummaryCard({ label, value, icon, color }) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-sm`}>
      <div className="flex items-center gap-3">
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl text-lg ${color}`}>{icon}</span>
        <div>
          <p className="text-xs text-slate-400">{label}</p>
          <p className="text-lg font-bold text-white">{value}</p>
        </div>
      </div>
    </div>
  );
}

function LoanRow({ loan, onChanged }) {
  const [busy, setBusy] = useState(false);

  const handlePaid = async () => {
    if (!window.confirm(`Mark this loan as paid?`)) return;
    setBusy(true);
    try { await markLoanPaid(loan.id); onChanged(); } catch { alert('Could not update loan.'); } finally { setBusy(false); }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this loan record?')) return;
    setBusy(true);
    try { await deleteLoan(loan.id); onChanged(); } catch { alert('Could not delete loan.'); } finally { setBusy(false); }
  };

  return (
    <tr className="border-t border-white/5 transition hover:bg-white/[0.025]">
      <td className="px-4 py-3">
        <p className="font-medium text-white capitalize">{loan.person_name}</p>
      </td>
      <td className="px-4 py-3">
        <p className={`text-sm font-semibold ${loan.type === 'given' ? 'text-fuchsia-300' : 'text-rose-300'}`}>
          {formatPKR(loan.amount)}
        </p>
        {loan.status === 'paid' && (
          <p className="text-xs text-slate-500">was {formatPKR(loan.original_amount)}</p>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-slate-300">
        {loan.description || '—'}
      </td>
      <td className="px-4 py-3 text-sm text-slate-400">{formatDate(loan.loan_date)}</td>
      <td className="px-4 py-3 text-sm text-slate-400">{loan.paid_date ? formatDate(loan.paid_date) : '—'}</td>
      <td className="px-4 py-3">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE[loan.status]}`}>
          {loan.status}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {loan.status === 'active' && (
            <button onClick={handlePaid} disabled={busy}
              title="Mark as paid"
              className="rounded-lg bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-400 transition hover:bg-emerald-500/25 disabled:opacity-50">
              ✓ Paid
            </button>
          )}
          <button onClick={handleDelete} disabled={busy}
            title="Delete"
            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-red-500/10 hover:text-red-400 disabled:opacity-40">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function LoansPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState('given');
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getLoans(user.id);
      setLoans(Array.isArray(data) ? data : []);
    } catch { setLoans([]); } finally { setLoading(false); }
  }, [user.id]);

  useEffect(() => { load(); }, [load]);

  const tabLoans = loans.filter((l) => l.type === tab);
  const filtered = tabLoans
    .filter((l) => statusFilter === 'all' || l.status === statusFilter)
    .filter((l) => !search || l.person_name.toLowerCase().includes(search.toLowerCase()) || (l.description || '').toLowerCase().includes(search.toLowerCase()));

  const active = tabLoans.filter((l) => l.status === 'active');
  const paid   = tabLoans.filter((l) => l.status === 'paid');
  const outstanding = active.reduce((s, l) => s + Number(l.amount), 0);
  const totalEver   = tabLoans.reduce((s, l) => s + Number(l.original_amount), 0);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0b0712]">
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-fuchsia-600/20 blur-[120px]" />
      <div className="pointer-events-none absolute right-0 top-40 h-96 w-96 rounded-full bg-purple-600/20 blur-[120px]" />

      <div className="relative mx-auto max-w-6xl px-4 py-10">
        <NavBar />

        {/* Page title */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">🤝 Loans</h2>
            <p className="text-sm text-slate-400">Track money you lent and borrowed</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-2">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`rounded-xl px-5 py-2 text-sm font-semibold capitalize transition ${
                tab === t
                  ? 'bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white shadow shadow-fuchsia-500/20'
                  : 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
              }`}>
              {t === 'given' ? '🤝 Loans Given' : '💸 Loans Taken'}
            </button>
          ))}
        </div>

        {/* Summary cards */}
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <SummaryCard
            label="Outstanding"
            value={formatPKR(outstanding)}
            icon={tab === 'given' ? '📤' : '📥'}
            color="bg-fuchsia-500/15"
          />
          <SummaryCard label="Active Loans" value={active.length} icon="⏳" color="bg-amber-500/15" />
          <SummaryCard label="Paid Loans"   value={paid.length}   icon="✅" color="bg-emerald-500/15" />
          <SummaryCard label="Total Ever"   value={formatPKR(totalEver)} icon="📊" color="bg-purple-500/15" />
        </div>

        {/* Search + filter */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by person or description…"
            className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-fuchsia-500 focus:outline-none focus:ring-1 focus:ring-fuchsia-500"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-fuchsia-500 focus:outline-none focus:ring-1 focus:ring-fuchsia-500"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="paid">Paid</option>
          </select>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-sm">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-7 w-7 animate-spin rounded-full border-4 border-white/10 border-t-fuchsia-500" />
              <span className="ml-3 text-slate-400 text-sm">Loading…</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-500">
              <span className="text-4xl">{tab === 'given' ? '🤝' : '💸'}</span>
              <p className="text-sm">
                {search || statusFilter !== 'all' ? 'No loans match your filter.' : `No ${tab} loans yet.`}
              </p>
              {!search && statusFilter === 'all' && (
                <p className="text-xs text-slate-600">
                  {tab === 'given'
                    ? 'Say "Ali owes me 500" in the AI chat.'
                    : 'Say "I owe Ahmed 200" in the AI chat.'}
                </p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-xs text-slate-400">
                    <th className="px-4 py-3 font-medium">Person</th>
                    <th className="px-4 py-3 font-medium">Amount</th>
                    <th className="px-4 py-3 font-medium">Description</th>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Paid On</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((loan) => (
                    <LoanRow key={loan.id} loan={loan} onChanged={load} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
