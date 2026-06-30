import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: '🏠' },
];

export default function NavBar() {
  const { pathname } = useLocation();
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login', { replace: true }); };

  return (
    <header className="mb-8 animate-fade-in-up">
      <div className="flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-500 to-pink-600 text-xl shadow-lg shadow-fuchsia-500/40">
            💸
          </span>
          <div>
            <h1 className="bg-gradient-to-r from-fuchsia-400 via-pink-400 to-purple-400 bg-clip-text text-2xl font-extrabold tracking-tight text-transparent sm:text-3xl">
              Budget AI
            </h1>
            <p className="text-xs text-slate-400">Smart personal finance</p>
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex items-center gap-1">
          {NAV_ITEMS.map(({ to, label, icon }) => {
            const active = pathname === to || pathname.startsWith(to + '/');
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  active
                    ? 'bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white shadow shadow-fuchsia-500/30'
                    : 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span>{icon}</span>
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}

          <button
            onClick={handleLogout}
            className="ml-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-300"
          >
            Logout
          </button>
        </nav>
      </div>
    </header>
  );
}
