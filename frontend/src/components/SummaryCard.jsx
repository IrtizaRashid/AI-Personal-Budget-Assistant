// Reusable summary card for the dashboard's top row (dark neon theme).
// Props:
//   label    : card title (e.g. "Monthly Budget")
//   value    : pre-formatted string/number to display
//   icon     : emoji/text shown in the gradient badge
//   gradient : Tailwind gradient classes for the badge (e.g. "from-fuchsia-500 to-pink-500")
//   tag      : optional tag text (e.g. "Healthy", "June", "-12%")
//   tagColor : optional tag color (e.g. "text-emerald-400", "text-rose-400")
//   subtitle : optional subtitle/description below the value
export default function SummaryCard({
  label,
  value,
  icon = '💰',
  gradient = 'from-fuchsia-500 to-pink-500',
  tag = null,
  tagColor = 'text-slate-400',
  subtitle = null,
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-sm transition duration-300 hover:-translate-y-1 hover:border-fuchsia-500/40 hover:shadow-[0_0_30px_-5px_rgba(217,70,239,0.4)]">
      {/* Neon glow that intensifies on hover */}
      <div
        className={`pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br ${gradient} opacity-20 blur-2xl transition-opacity duration-300 group-hover:opacity-50`}
      />

      <div className="relative flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-slate-400">{label}</p>
            {tag && (
              <span className={`text-xs font-medium ${tagColor}`}>{tag}</span>
            )}
          </div>
          <p className="mt-2 text-3xl font-bold tracking-tight text-white">
            {value}
          </p>
          {subtitle && (
            <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
          )}
        </div>

        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} text-xl shadow-lg`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}
