export function PageShell({ title, eyebrow, description, actions, children }) {
  return (
    <div className="min-h-full bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            {eyebrow && (
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">
                {eyebrow}
              </p>
            )}
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
              {title}
            </h1>
            {description && (
              <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
                {description}
              </p>
            )}
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
        {children}
      </div>
    </div>
  );
}

export function Panel({ title, description, action, children, className = '' }) {
  return (
    <section className={`rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 ${className}`}>
      {(title || description || action) && (
        <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
          <div>
            {title && <h2 className="text-sm font-semibold text-slate-950 dark:text-white">{title}</h2>}
            {description && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{description}</p>}
          </div>
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function MetricCard({ label, value, detail, tone = 'blue' }) {
  const tones = {
    blue: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300',
    green: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
    rose: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300',
    slate: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
      <div className={`mb-4 inline-flex rounded-md px-2.5 py-1 text-xs font-semibold ${tones[tone] || tones.blue}`}>
        {label}
      </div>
      <p className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">{value}</p>
      {detail && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{detail}</p>}
    </div>
  );
}

export function Toolbar({ search, onSearch, placeholder = 'Search...', children }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <input
        value={search}
        onChange={(event) => onSearch?.(event.target.value)}
        placeholder={placeholder}
        className="min-h-10 flex-1 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
      />
      {children}
    </div>
  );
}

export function EmptyState({ title, description, action }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center dark:border-slate-700 dark:bg-slate-950">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
      {description && <p className="mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function PrimaryButton({ children, className = '', ...props }) {
  return (
    <button
      className={`min-h-10 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({ children, className = '', ...props }) {
  return (
    <button
      className={`min-h-10 rounded-md border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
