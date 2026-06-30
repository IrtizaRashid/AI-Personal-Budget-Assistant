import { formatPKR } from '../utils/format.js';

const STAT = ({ label, value, color = 'text-white', sub }) => (
  <div className="flex flex-col gap-0.5">
    <p className="text-[10px] text-slate-400 uppercase tracking-wide">{label}</p>
    <p className={`text-sm font-semibold ${color}`}>{value}</p>
    {sub && <p className="text-[10px] text-slate-500">{sub}</p>}
  </div>
);

const TYPE_COLORS = {
  Stocks: 'bg-blue-500/20 text-blue-300',
  'Mutual Funds': 'bg-purple-500/20 text-purple-300',
  ETFs: 'bg-cyan-500/20 text-cyan-300',
  Cryptocurrency: 'bg-amber-500/20 text-amber-300',
  Gold: 'bg-yellow-500/20 text-yellow-300',
  Silver: 'bg-slate-400/20 text-slate-300',
  'Savings Certificates': 'bg-emerald-500/20 text-emerald-300',
  'Real Estate': 'bg-orange-500/20 text-orange-300',
  'Fixed Deposits': 'bg-teal-500/20 text-teal-300',
  Bonds: 'bg-indigo-500/20 text-indigo-300',
  Other: 'bg-white/10 text-slate-300',
};

export default function InvestmentCard({ summary = {}, portfolio = [] }) {
  const {
    activeCount = 0,
    totalInvested = 0,
    totalCurrentValue = 0,
    unrealizedGL = 0,
    totalReturn = 0,
    realizedPL = 0,
    totalPL = 0,
  } = summary;

  const plColor  = totalPL  >= 0 ? 'text-emerald-400' : 'text-red-400';
  const retColor = totalReturn >= 0 ? 'text-emerald-400' : 'text-red-400';
  const plSign   = totalPL  >= 0 ? '+' : '';
  const retSign  = totalReturn >= 0 ? '+' : '';

  // Group active portfolio by type for distribution display
  const active = portfolio.filter(p => p.status === 'active');
  const typeMap = {};
  active.forEach(p => {
    typeMap[p.type] = (typeMap[p.type] || 0) + Number(p.invested_amount);
  });
  const typeEntries = Object.entries(typeMap).sort((a, b) => b[1] - a[1]);

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-sm">
      {/* Header */}
      <div className="border-b border-white/10 bg-gradient-to-r from-emerald-600/30 to-teal-600/30 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold text-white">
              📈 Investments
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">{activeCount} active position{activeCount !== 1 ? 's' : ''}</p>
          </div>
          <span className={`text-lg font-bold ${retColor}`}>
            {retSign}{totalReturn}%
          </span>
        </div>
      </div>

      {/* Summary grid */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 px-6 py-4 sm:grid-cols-3">
        <STAT label="Total Invested"       value={formatPKR(totalInvested)} />
        <STAT label="Portfolio Value"      value={formatPKR(totalCurrentValue)} />
        <STAT label="Total P&L"            value={`${plSign}${formatPKR(totalPL)}`} color={plColor} />
        <STAT label="Unrealized Gain/Loss" value={`${unrealizedGL >= 0 ? '+' : ''}${formatPKR(unrealizedGL)}`} color={unrealizedGL >= 0 ? 'text-emerald-400' : 'text-red-400'} />
        <STAT label="Realized Profit"      value={`${realizedPL >= 0 ? '+' : ''}${formatPKR(realizedPL)}`} color={realizedPL >= 0 ? 'text-emerald-400' : 'text-red-400'} />
        <STAT label="Total Return"         value={`${retSign}${totalReturn}%`} color={retColor} />
      </div>

      {/* Asset distribution */}
      {typeEntries.length > 0 && (
        <div className="border-t border-white/10 px-6 py-4">
          <p className="mb-2 text-[10px] uppercase tracking-wide text-slate-400">Asset Distribution</p>
          <div className="flex flex-wrap gap-1.5">
            {typeEntries.map(([type, amt]) => (
              <span key={type} className={`rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_COLORS[type] || 'bg-white/10 text-slate-300'}`}>
                {type} · {formatPKR(amt)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Active positions table */}
      {active.length > 0 && (
        <div className="border-t border-white/10">
          <div className="max-h-52 overflow-y-auto divide-y divide-white/5">
            {active.map(inv => {
              const pl = Number(inv.profit_loss);
              const plCol = pl >= 0 ? 'text-emerald-400' : 'text-red-400';
              return (
                <div key={inv.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.03] transition">
                  <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${TYPE_COLORS[inv.type] || 'bg-white/10 text-slate-300'}`}>
                    {inv.type}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">{inv.name}</p>
                    <p className="text-[10px] text-slate-500">
                      Invested {formatPKR(inv.invested_amount)}
                      {inv.quantity ? ` · Qty ${inv.quantity}` : ''}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-semibold ${plCol}`}>
                      {pl >= 0 ? '+' : ''}{formatPKR(pl)}
                    </p>
                    <p className={`text-[10px] ${plCol}`}>{inv.return_pct >= 0 ? '+' : ''}{inv.return_pct}%</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {active.length === 0 && (
        <div className="px-6 py-6 text-center text-sm text-slate-500">
          No active investments. Try: <span className="text-slate-300">"I invested 5000 in Apple"</span>
        </div>
      )}
    </div>
  );
}
