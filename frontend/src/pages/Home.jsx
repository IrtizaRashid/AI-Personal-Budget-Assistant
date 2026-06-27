import { useState } from 'react';
import { checkHealth } from '../services/api.js';
import StatusBadge from '../components/StatusBadge.jsx';

// Homepage / landing screen.
// Shows the app title, the backend status, and a button that calls
// GET /api/health and displays the result.
export default function Home() {
  const [status, setStatus] = useState('idle'); // idle | loading | success | error

  const handleCheckServer = async () => {
    setStatus('loading');
    try {
      const data = await checkHealth();
      // Backend returns { status: "Server Running" }
      setStatus(data.status === 'Server Running' ? 'success' : 'error');
    } catch (error) {
      console.error('Health check failed:', error.message);
      setStatus('error');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
        <h1 className="text-center text-2xl font-bold text-slate-800">
          AI Personal Budget Assistant
        </h1>

        <div className="mt-8 space-y-3 text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Backend Status
          </p>
          <StatusBadge status={status} />
        </div>

        <button
          onClick={handleCheckServer}
          disabled={status === 'loading'}
          className="mt-8 w-full rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === 'loading' ? 'Checking…' : 'Check Server'}
        </button>
      </div>
    </div>
  );
}
