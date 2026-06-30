import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { getPortfolio, getInvestmentSummary } from '../services/api.js';
import { formatPKR } from '../utils/format.js';

export default function InvestmentsPage() {
  const { user } = useAuth();
  const userId = user?.id;
  const [portfolio, setPortfolio] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);

  const loadInvestments = async () => {
    try {
      setLoading(true);
      const [portfolioData, summaryData] = await Promise.all([
        getPortfolio(userId).catch(() => []),
        getInvestmentSummary(userId).catch(() => ({})),
      ]);
      setPortfolio(Array.isArray(portfolioData) ? portfolioData : []);
      setSummary(summaryData || {});
    } catch (error) {
      console.error('Failed to load investments:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvestments();
  }, [userId]);

  const totalInvested = summary.total_invested || 0;
  const currentValue = summary.current_value || 0;
  const totalReturn = currentValue - totalInvested;
  const returnPercentage = totalInvested > 0 ? ((totalReturn / totalInvested) * 100).toFixed(2) : 0;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Investments</h1>
      </div>

      {/* Summary Cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-purple-600 text-xl">
              💰
            </div>
            <div>
              <p className="text-sm font-medium text-slate-400">Total Invested</p>
              <p className="text-2xl font-bold text-white">{formatPKR(totalInvested)}</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-xl">
              📊
            </div>
            <div>
              <p className="text-sm font-medium text-slate-400">Current Value</p>
              <p className="text-2xl font-bold text-white">{formatPKR(currentValue)}</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 text-xl">
              📈
            </div>
            <div>
              <p className="text-sm font-medium text-slate-400">Total Return</p>
              <p className={`text-2xl font-bold ${totalReturn >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {totalReturn >= 0 ? '+' : ''}{formatPKR(totalReturn)}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-xl">
              %
            </div>
            <div>
              <p className="text-sm font-medium text-slate-400">Return %</p>
              <p className={`text-2xl font-bold ${totalReturn >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {totalReturn >= 0 ? '+' : ''}{returnPercentage}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Portfolio List */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-sm">
        <div className="border-b border-white/10 px-6 py-4">
          <h2 className="text-lg font-semibold text-white">Portfolio</h2>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/10 border-t-fuchsia-500" />
          </div>
        ) : portfolio.length === 0 ? (
          <p className="px-6 py-10 text-center text-slate-500">No investments yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/5 text-slate-400">
                <tr>
                  <th className="px-6 py-3 font-medium">Symbol</th>
                  <th className="px-6 py-3 font-medium">Quantity</th>
                  <th className="px-6 py-3 font-medium">Avg Cost</th>
                  <th className="px-6 py-3 font-medium">Current Price</th>
                  <th className="px-6 py-3 font-medium">Value</th>
                  <th className="px-6 py-3 font-medium">Return</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {portfolio.map((investment) => {
                  const value = investment.quantity * investment.current_price;
                  const cost = investment.quantity * investment.avg_cost;
                  const returnVal = value - cost;
                  const returnPct = cost > 0 ? ((returnVal / cost) * 100).toFixed(2) : 0;
                  
                  return (
                    <tr key={investment.id} className="transition hover:bg-white/5">
                      <td className="px-6 py-4 font-medium text-white">{investment.symbol}</td>
                      <td className="px-6 py-4 text-slate-300">{investment.quantity}</td>
                      <td className="px-6 py-4 text-slate-400">{formatPKR(investment.avg_cost)}</td>
                      <td className="px-6 py-4 text-slate-400">{formatPKR(investment.current_price)}</td>
                      <td className="px-6 py-4 font-semibold text-white">{formatPKR(value)}</td>
                      <td className={`px-6 py-4 font-semibold ${returnVal >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {returnVal >= 0 ? '+' : ''}{formatPKR(returnVal)} ({returnPct}%)
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
