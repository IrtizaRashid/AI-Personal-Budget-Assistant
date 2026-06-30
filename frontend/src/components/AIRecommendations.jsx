// AI Recommendations card for the dashboard.
// Purely presentational — the Dashboard owns the data + loading/error state.
//
// Props:
//   recommendations : { title, detail, category, priority, type }[]
//   loading         : boolean
//   error           : boolean

const PRIORITY_STYLES = {
  critical: 'border-red-500/40 bg-red-500/10',
  high:     'border-orange-500/40 bg-orange-500/10',
  medium:   'border-yellow-500/40 bg-yellow-500/10',
  low:      'border-emerald-500/40 bg-emerald-500/10',
};

const PRIORITY_DOT = {
  critical: 'bg-red-500',
  high:     'bg-orange-400',
  medium:   'bg-yellow-400',
  low:      'bg-emerald-400',
};

const PRIORITY_LABEL = {
  critical: 'text-red-400',
  high:     'text-orange-400',
  medium:   'text-yellow-400',
  low:      'text-emerald-400',
};

const TYPE_ICON = {
  warning: '⚠️',
  tip:     '💡',
  praise:  '✅',
  insight: '📊',
};

export default function AIRecommendations({
  recommendations = [],
  loading = false,
  error = false,
  healthScore = 82,
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-fuchsia-500 via-pink-500 to-purple-600 p-[1.5px] shadow-[0_0_30px_-8px_rgba(217,70,239,0.5)]">
      <div className="rounded-[15px] bg-[#130d1d] p-6">
        <div className="mb-4 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-fuchsia-500 to-pink-600 text-base shadow">
            🤖
          </span>
          <h2 className="bg-gradient-to-r from-fuchsia-400 to-pink-400 bg-clip-text text-lg font-bold text-transparent">
            Personalized financial guidance
          </h2>
        </div>

        {/* Financial Health Score */}
        <div className="mb-6 rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-300">Financial Health Score</span>
            <span className="text-2xl font-bold text-emerald-400">{healthScore}/100</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-green-400 transition-all duration-500"
              style={{ width: `${healthScore}%` }}
            />
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center gap-3 py-4 text-slate-400">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/10 border-t-fuchsia-500" />
            <span className="text-sm">Analysing your spending…</span>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <p className="py-2 text-sm text-slate-500">
            AI recommendations are temporarily unavailable.
          </p>
        )}

        {/* Empty */}
        {!loading && !error && recommendations.length === 0 && (
          <p className="py-2 text-sm text-slate-500">
            Add a few expenses to get personalised advice.
          </p>
        )}

        {/* Rich recommendation cards */}
        {!loading && !error && recommendations.length > 0 && (
          <ul className="space-y-3">
            {recommendations.map((rec, i) => {
              // Support both old string format and new object format
              if (typeof rec === 'string') {
                return (
                  <li key={i} className="flex gap-2 text-sm text-slate-300">
                    <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-fuchsia-500" />
                    <span>{rec}</span>
                  </li>
                );
              }

              const priority = rec.priority || 'medium';
              const type = rec.type || 'insight';

              return (
                <li
                  key={i}
                  className={`rounded-xl border p-3 ${PRIORITY_STYLES[priority] || PRIORITY_STYLES.medium}`}
                >
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-sm">{TYPE_ICON[type] || '📊'}</span>
                    <span className="flex-1 text-sm font-semibold text-white">
                      {rec.title}
                    </span>
                    <span className="flex items-center gap-1">
                      <span
                        className={`inline-block h-1.5 w-1.5 rounded-full ${PRIORITY_DOT[priority] || 'bg-yellow-400'}`}
                      />
                      <span className={`text-xs font-medium uppercase tracking-wide ${PRIORITY_LABEL[priority] || 'text-yellow-400'}`}>
                        {priority}
                      </span>
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-slate-400">{rec.detail}</p>
                  {rec.category && (
                    <span className="mt-1.5 inline-block rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-slate-400">
                      {rec.category}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
