import { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';

const NAV_ITEMS = [
  { to: '/dashboard',    icon: '🏠', label: 'Dashboard'    },
  { to: '/income',       icon: '💵', label: 'Income'       },
  { to: '/expenses',     icon: '💸', label: 'Expenses'     },
  { to: '/budget',       icon: '📋', label: 'Budget'       },
  { to: '/savings',      icon: '🏦', label: 'Savings'      },
  { to: '/loans',        icon: '🤝', label: 'Loans'        },
  { to: '/investments',  icon: '📈', label: 'Investments'  },
  { to: '/transactions', icon: '🧾', label: 'Transactions' },
  { to: '/analytics',    icon: '📊', label: 'Analytics'    },
  { to: '/ai',           icon: '🤖', label: 'AI Assistant' },
  { to: '/settings',     icon: '⚙️', label: 'Settings'     },
];

const PAGE_TITLES = {
  '/dashboard':    'Dashboard',
  '/income':       'Income',
  '/expenses':     'Expenses',
  '/budget':       'Budget',
  '/savings':      'Savings',
  '/loans':        'Loans',
  '/investments':  'Investments',
  '/transactions': 'Transactions',
  '/analytics':    'Analytics',
  '/ai':           'AI Assistant',
  '/settings':     'Settings',
};

export default function AppLayout({ children }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Close mobile drawer on wide viewport
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const handler = (e) => { if (e.matches) setMobileOpen(false); };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const pageTitle = PAGE_TITLES[pathname] ?? 'Budget AI';

  const initials = user?.name
    ? user.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  // Sidebar inner content (shared between desktop + mobile drawer)
  const SidebarContent = ({ mobile = false }) => (
    <div className={`flex h-full flex-col ${mobile ? '' : ''}`}>
      {/* Brand + collapse toggle */}
      <div className="flex items-center justify-between px-4 py-5 border-b border-white/10">
        {(!collapsed || mobile) && (
          <div className="flex items-center gap-2 min-w-0">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-pink-600 text-lg shadow-lg shadow-fuchsia-500/30">
              BA
            </span>
            <div className="min-w-0">
              <h1 className="bg-gradient-to-r from-fuchsia-400 via-pink-400 to-purple-400 bg-clip-text text-base font-extrabold tracking-tight text-transparent leading-none truncate">
                Budget AI
              </h1>
              <p className="text-[10px] text-slate-500 leading-none mt-0.5">Financial management</p>
            </div>
          </div>
        )}
        {collapsed && !mobile && (
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-pink-600 text-lg mx-auto">
            BA
          </span>
        )}
        {!mobile && (
          <button
            onClick={() => setCollapsed((v) => !v)}
            className={`flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/10 hover:text-white ${collapsed ? 'mx-auto' : ''}`}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? '→' : '←'}
          </button>
        )}
        {mobile && (
          <button
            onClick={() => setMobileOpen(false)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-white"
          >
            ✕
          </button>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto py-4 space-y-0.5 px-2">
        {NAV_ITEMS.map(({ to, icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-gradient-to-r from-fuchsia-600/30 to-pink-600/20 text-fuchsia-300 border border-fuchsia-500/30'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white border border-transparent'
              } ${collapsed && !mobile ? 'justify-center px-2' : ''}`
            }
            title={collapsed && !mobile ? label : undefined}
          >
            <span className="text-base shrink-0">{icon}</span>
            {(!collapsed || mobile) && <span className="truncate">{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* User section at bottom */}
      <div className="border-t border-white/10 p-3">
        <div
          className={`flex items-center gap-3 rounded-xl px-3 py-2 transition-all ${
            collapsed && !mobile ? 'justify-center' : ''
          }`}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-pink-600 text-xs font-bold text-white">
            {initials}
          </span>
          {(!collapsed || mobile) && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{user?.name || 'User'}</p>
              <p className="text-[10px] text-slate-500">Personal workspace</p>
            </div>
          )}
        </div>
        <button
          onClick={handleLogout}
          className={`mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-400 transition hover:bg-red-500/10 hover:text-red-400 ${
            collapsed && !mobile ? 'justify-center' : ''
          }`}
          title="Logout"
        >
          <span className="text-base shrink-0">🚪</span>
          {(!collapsed || mobile) && <span>Logout</span>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[#0d0d1a] dark:bg-[#0d0d1a] text-slate-100">
      {/* ── Desktop sidebar ── */}
      <aside
        className={`hidden md:flex flex-col bg-[#0a0a1f] border-r border-white/[0.06] flex-shrink-0 transition-[width] duration-250 ease-in-out ${
          collapsed ? 'w-16' : 'w-60'
        }`}
        style={{ transition: 'width 0.25s ease' }}
      >
        <SidebarContent />
      </aside>

      {/* ── Mobile sidebar overlay ── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          {/* Drawer */}
          <aside className="relative z-10 flex w-64 flex-col bg-[#0a0a1f] border-r border-white/[0.06]">
            <SidebarContent mobile />
          </aside>
        </div>
      )}

      {/* ── Main area ── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top header bar */}
        <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-white/[0.06] bg-[#0a0a1f]/80 px-4 backdrop-blur-sm">
          {/* Left: hamburger (mobile) + search bar */}
          <div className="flex items-center gap-3 flex-1">
            <button
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white md:hidden"
              onClick={() => setMobileOpen(true)}
            >
              ☰
            </button>
            <div className="relative flex-1 max-w-md hidden md:block">
              <input
                type="text"
                placeholder="Search transactions, categories, loans..."
                className="w-full h-9 pl-10 pr-4 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-fuchsia-500/50 focus:ring-1 focus:ring-fuchsia-500/50 transition-all"
              />
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          {/* Right: theme toggle + user avatar */}
          <div className="flex items-center gap-2">
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/10 hover:text-white"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>

            {/* User avatar + name */}
            <NavLink to="/settings" className="flex items-center gap-2 rounded-lg px-2 py-1 transition hover:bg-white/10">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-pink-600 text-xs font-bold text-white">
                {initials}
              </span>
              <span className="hidden text-sm font-medium text-slate-300 sm:inline">
                {user?.name || 'User'}
              </span>
            </NavLink>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
