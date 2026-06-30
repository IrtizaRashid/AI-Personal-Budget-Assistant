import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import BudgetSetup from './pages/BudgetSetup.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import AppLayout from './layouts/AppLayout.jsx';
import IncomePage from './pages/IncomePage.jsx';
import ExpensesPage from './pages/ExpensesPage.jsx';
import BudgetPage from './pages/BudgetPage.jsx';
import SavingsPage from './pages/SavingsPage.jsx';
import LoansPage from './pages/LoansPage.jsx';
import InvestmentsPage from './pages/InvestmentsPage.jsx';
import TransactionsPage from './pages/TransactionsPage.jsx';
import AnalyticsPage from './pages/AnalyticsPage.jsx';
import AIAssistantPage from './pages/AIAssistantPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';

function AuthedLayout({ children }) {
  return (
    <ProtectedRoute>
      <AppLayout>{children}</AppLayout>
    </ProtectedRoute>
  );
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0d0d1a]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/10 border-t-fuchsia-500" />
      </div>
    );
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login"    element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to="/dashboard" replace /> : <Register />} />

      {/* Budget setup — protected but not in sidebar layout */}
      <Route path="/setup" element={<ProtectedRoute><BudgetSetup /></ProtectedRoute>} />

      {/* App routes wrapped in sidebar layout */}
      <Route path="/dashboard"    element={<AuthedLayout><Dashboard /></AuthedLayout>} />
      <Route path="/income"       element={<AuthedLayout><IncomePage /></AuthedLayout>} />
      <Route path="/expenses"     element={<AuthedLayout><ExpensesPage /></AuthedLayout>} />
      <Route path="/budget"       element={<AuthedLayout><BudgetPage /></AuthedLayout>} />
      <Route path="/savings"      element={<AuthedLayout><SavingsPage /></AuthedLayout>} />
      <Route path="/loans"        element={<AuthedLayout><LoansPage /></AuthedLayout>} />
      <Route path="/investments"  element={<AuthedLayout><InvestmentsPage /></AuthedLayout>} />
      <Route path="/transactions" element={<AuthedLayout><TransactionsPage /></AuthedLayout>} />
      <Route path="/analytics"    element={<AuthedLayout><AnalyticsPage /></AuthedLayout>} />
      <Route path="/ai"           element={<AuthedLayout><AIAssistantPage /></AuthedLayout>} />
      <Route path="/settings"     element={<AuthedLayout><SettingsPage /></AuthedLayout>} />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to={user ? '/dashboard' : '/login'} replace />} />
    </Routes>
  );
}
