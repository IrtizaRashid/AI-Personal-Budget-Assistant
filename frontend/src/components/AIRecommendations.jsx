// AI Recommendations card for the dashboard.
// Purely presentational — the Dashboard owns the data + loading/error state
// and re-fetches whenever an expense changes.
//
// Props:
//   recommendations : string[]
//   loading         : boolean
//   error           : boolean (true => show the unavailable message)
export default function AIRecommendations({
  recommendations = [],
  loading = false,
  error = false,
}) {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
      <div className="mb-4 flex items-center gap-2">
        <span className="text-lg">🤖</span>
        <h2 className="text-lg font-semibold text-slate-800">
          AI Recommendations
        </h2>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-3 py-4 text-slate-500">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-500" />
          <span className="text-sm">Analysing your spending…</span>
        </div>
      )}

      {/* Error / unavailable */}
      {!loading && error && (
        <p className="py-2 text-sm text-slate-400">
          AI recommendations are temporarily unavailable.
        </p>
      )}

      {/* Empty */}
      {!loading && !error && recommendations.length === 0 && (
        <p className="py-2 text-sm text-slate-400">
          Add a few expenses to get personalised advice.
        </p>
      )}

      {/* Recommendations as bullet points */}
      {!loading && !error && recommendations.length > 0 && (
        <ul className="space-y-2">
          {recommendations.map((rec, i) => (
            <li key={i} className="flex gap-2 text-sm text-slate-700">
              <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-indigo-500" />
              <span>{rec}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
