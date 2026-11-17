import React, { useState, useEffect } from 'react';
import DashboardCard from './components/DashboardCard';
import TemperatureChart from './components/TemperatureChart';
import SimulatorButtons from './components/SimulatorButtons';
import ClaimsTable from './components/ClaimsTable';
import InsurancePlans from './pages/InsurancePlans';
import MyPolicies from './pages/MyPolicies';
import SubmitClaim from './pages/SubmitClaim';
import AdminDashboard from './pages/AdminDashboard';
import CustomerPortal from './pages/CustomerPortal';
import KitchenPortal from './pages/KitchenPortal';
import {
  fetchDashboard, fetchReadings, fetchClaims,
  simulateNormal, simulateExcursion, simulatePowerOutage,
} from './api';
import './index.css';

const KITCHEN_PAGES = [
  { id: 'dashboard', label: '📊 Live Monitor' },
  { id: 'kitchen-portal', label: '👨‍🍳 Kitchen Portal' },
  { id: 'plans', label: '🛡 Insurance Plans' },
  { id: 'my-policies', label: '📄 Policies' },
  { id: 'submit-claim', label: '💰 Submit Claim' },
];

const CUSTOMER_PAGES = [
  { id: 'customer', label: '👤 Customer Portal' },
];

const ADMIN_PAGES = [
  { id: 'admin', label: '⚙️ Admin Panel' },
];

export default function App() {
  const [page, setPage] = useState('dashboard');

  // Dashboard state
  const [dashboard, setDashboard] = useState({
    current_temp: 4,
    risk_level: 'Low',
    total_incidents: 0,
    total_claims: 0,
  });
  const [readings, setReadings] = useState([]);
  const [claims, setClaims] = useState([]);
  const [statusMessage, setStatusMessage] = useState('');
  const [triggerInfo, setTriggerInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    try {
      setError(null);
      const [dash, reads, cls] = await Promise.all([
        fetchDashboard(), fetchReadings(), fetchClaims(),
      ]);
      setDashboard(dash);
      setReadings(reads);
      setClaims(cls);
    } catch {
      setError('⚠️ Could not connect to backend. Start the FastAPI server first.');
    }
  }

  async function refreshData() {
    const [reads, cls] = await Promise.all([fetchReadings(), fetchClaims()]);
    setReadings(reads);
    setClaims(cls);
  }

  async function handleSimulation(simFunc) {
    try {
      setLoading(true); setError(null);
      const res = await simFunc();
      setDashboard(res.dashboard);
      setStatusMessage(res.message);
      setTriggerInfo({ incident: res.incident || null, claim: res.claim || null, triggered: res.triggered });
      await refreshData();
    } catch {
      setError('Simulation failed – is the backend running?');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-cream font-sans">
      {/* ── Top Navigation ───────────────────────────── */}
      <nav className="bg-forestgreen text-white shadow-md">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center gap-2">
          <span className="font-bold text-lg mr-4 text-gold">🌿 FoodShieldAI</span>

          <span className="text-xs text-green-200 mr-1 hidden sm:inline">Kitchen:</span>
          {KITCHEN_PAGES.map((p) => (
            <button key={p.id} onClick={() => setPage(p.id)}
              className={`text-sm px-3 py-1 rounded-full transition ${
                page === p.id ? 'bg-gold text-forestgreen font-bold' : 'hover:bg-white/20'
              }`}>
              {p.label}
            </button>
          ))}

          <span className="text-xs text-green-200 ml-2 mr-1 hidden sm:inline">|</span>
          <span className="text-xs text-green-200 mr-1 hidden sm:inline">Customer:</span>
          {CUSTOMER_PAGES.map((p) => (
            <button key={p.id} onClick={() => setPage(p.id)}
              className={`text-sm px-3 py-1 rounded-full transition ${
                page === p.id ? 'bg-gold text-forestgreen font-bold' : 'hover:bg-white/20'
              }`}>
              {p.label}
            </button>
          ))}

          <span className="text-xs text-green-200 ml-2 mr-1 hidden sm:inline">|</span>
          {ADMIN_PAGES.map((p) => (
            <button key={p.id} onClick={() => setPage(p.id)}
              className={`text-sm px-3 py-1 rounded-full transition ${
                page === p.id ? 'bg-gold text-forestgreen font-bold' : 'hover:bg-white/20'
              }`}>
              {p.label}
            </button>
          ))}
        </div>
      </nav>

      {/* ── Page Content ─────────────────────────────── */}
      <main className="max-w-6xl mx-auto p-4">

        {/* ── DASHBOARD PAGE ────────────────────────── */}
        {page === 'dashboard' && (
          <>
            <h1 className="text-3xl font-bold text-forestgreen mb-6 text-center">
              FoodShieldAI Dashboard
            </h1>

            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded mb-4 text-center">
                {error}
              </div>
            )}

            {statusMessage && (
              <div className="bg-forestgreen/10 border border-forestgreen text-forestgreen px-4 py-2 rounded mb-4 text-center">
                {statusMessage}
              </div>
            )}

            {triggerInfo?.triggered && (
              <div className="border border-gold rounded p-4 mb-4 bg-gold/5">
                <h2 className="text-lg font-medium text-gold mb-2">⚡ Insurance Triggered</h2>
                {triggerInfo.incident && (
                  <p className="text-sm mb-1">
                    <strong>Incident:</strong> {triggerInfo.incident.description} (temp {triggerInfo.incident.temperature}°C)
                  </p>
                )}
                {triggerInfo.claim && (
                  <p className="text-sm">
                    <strong>Auto-Claim:</strong> ₹{triggerInfo.claim.payout_amount} – {triggerInfo.claim.status}
                  </p>
                )}
              </div>
            )}

            {loading && (
              <div className="text-center text-forestgreen mb-4 animate-pulse">Processing…</div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <DashboardCard title="Current Temp" value={`${dashboard.current_temp}°C`} bgColor="bg-forestgreen" />
              <DashboardCard title="Spoilage Risk" value={dashboard.risk_level} bgColor="bg-gold" />
              <DashboardCard title="Incidents" value={dashboard.total_incidents} bgColor="bg-forestgreen" />
              <DashboardCard title="Claims" value={dashboard.total_claims} bgColor="bg-gold" />
            </div>

            <TemperatureChart data={readings} />

            <SimulatorButtons
              onNormal={() => handleSimulation(simulateNormal)}
              onExcursion={() => handleSimulation(simulateExcursion)}
              onPowerOutage={() => handleSimulation(simulatePowerOutage)}
              disabled={loading}
            />

            <ClaimsTable claims={claims} />

            <p className="text-center text-xs text-gray-400 mt-8">
              All data is simulated for demo purposes only.
            </p>
          </>
        )}

        {page === 'plans' && <InsurancePlans />}
        {page === 'kitchen-portal' && <KitchenPortal />}
        {page === 'my-policies' && <MyPolicies />}
        {page === 'submit-claim' && <SubmitClaim />}
        {page === 'customer' && <CustomerPortal />}
        {page === 'admin' && <AdminDashboard />}

      </main>
    </div>
  );
}
