import React, { useState, useEffect } from 'react';
import StatusBadge from '../components/StatusBadge';
import {
  loginKitchenOwner, registerKitchenOwner,
  getKitchenApplications, getKitchenPolicies, getKitchenClaims,
  fetchPlans, applyPolicy,
} from '../api';

function Field({ label, type = 'text', value, onChange, placeholder, required, min, max }) {
  return (
    <div className="mb-3">
      <label className="block text-sm font-semibold text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        min={min}
        max={max}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forestgreen"
      />
    </div>
  );
}

function Alert({ message, type = 'info', onClose }) {
  if (!message) return null;
  const isErr = type === 'error';
  return (
    <div className={`flex justify-between items-center px-4 py-3 rounded-xl mb-4 text-sm font-medium border ${
      isErr
        ? 'bg-red-50 border-red-300 text-red-700'
        : 'bg-green-50 border-green-300 text-green-800'
    }`}>
      <span>{message}</span>
      {onClose && (
        <button onClick={onClose} className="ml-3 text-gray-500 hover:text-gray-800 font-bold">✕</button>
      )}
    </div>
  );
}

// ── Kitchen Owner Login / Register Tab ─────────────────────────────
function KitchenAuthTab({ onLogin }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', phone: '', kitchen_name: '', address: '', password: '' });
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setMsg('');
    try {
      const owner = mode === 'login'
        ? await loginKitchenOwner({ email: form.email, password: form.password })
        : await registerKitchenOwner(form);
      onLogin(owner);
    } catch (err) {
      setMsg(err.message || 'Operation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto">
      <div className="bg-white rounded-2xl shadow p-6 border border-gray-100">
        <div className="flex gap-2 mb-6">
          {['login', 'register'].map((m) => (
            <button key={m} onClick={() => { setMode(m); setMsg(''); }}
              className={`flex-1 py-2 rounded-lg font-semibold text-sm transition ${
                mode === m ? 'bg-forestgreen text-white shadow' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>
              {m === 'login' ? '👨‍🍳 Kitchen Login' : '📝 Register Kitchen'}
            </button>
          ))}
        </div>

        <Alert message={msg} type="error" onClose={() => setMsg('')} />

        <form onSubmit={handleSubmit}>
          {mode === 'register' && (
            <>
              <Field label="Owner Name" value={form.name} onChange={set('name')} placeholder="Chef Amit Verma" required />
              <Field label="Kitchen / Brand Name" value={form.kitchen_name} onChange={set('kitchen_name')} placeholder="SpiceCraft Cloud Kitchen" required />
              <Field label="Phone Number" value={form.phone} onChange={set('phone')} placeholder="9123456780" />
              <Field label="Kitchen Address" value={form.address} onChange={set('address')} placeholder="Sector 18, Commercial Hub, Noida" />
            </>
          )}
          <Field label="Email Address" type="email" value={form.email} onChange={set('email')} placeholder="amit@cloudkitchen.com" required />
          <Field label="Password" type="password" value={form.password} onChange={set('password')} placeholder="••••••••" required />

          <button type="submit" disabled={loading}
            className="w-full py-2.5 mt-2 bg-forestgreen text-white rounded-lg font-semibold hover:bg-green-700 transition disabled:opacity-50 shadow">
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign In to Kitchen Dashboard' : 'Register Kitchen'}
          </button>
        </form>

        <div className="mt-5 p-3 bg-cream border border-gold/30 rounded-lg text-xs text-gray-600">
          <p className="font-semibold text-forestgreen mb-1">🎯 Demo Kitchen Credentials:</p>
          <p>Email: <span className="font-mono font-bold text-gray-800">amit@cloudkitchen.com</span></p>
          <p>Password: <span className="font-mono font-bold text-gray-800">demo</span></p>
        </div>
      </div>
    </div>
  );
}

// ── Kitchen Overview Tab ───────────────────────────────────────────
function KitchenOverviewTab({ owner, onGoTab }) {
  const [apps, setApps] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getKitchenApplications(owner.id).catch(() => []),
      getKitchenPolicies(owner.id).catch(() => []),
      getKitchenClaims(owner.id).catch(() => []),
    ]).then(([a, p, c]) => {
      setApps(a); setPolicies(p); setClaims(c);
    }).finally(() => setLoading(false));
  }, [owner.id]);

  if (loading) return <p className="animate-pulse text-forestgreen">Loading overview…</p>;

  return (
    <div className="space-y-6">
      {/* Welcome Card */}
      <div className="bg-gradient-to-r from-forestgreen to-green-800 text-white p-6 rounded-2xl shadow-sm">
        <h3 className="text-xl font-bold">{owner.kitchen_name}</h3>
        <p className="text-sm text-green-100 mt-1">Managed by {owner.name} • {owner.email}</p>
        {owner.address && <p className="text-xs text-green-200 mt-0.5">📍 {owner.address}</p>}
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div onClick={() => onGoTab('applications')} className="cursor-pointer bg-white p-4 rounded-xl border border-gray-200 hover:shadow transition">
          <p className="text-xs text-gray-500 font-semibold uppercase">Policy Applications</p>
          <p className="text-2xl font-black text-forestgreen mt-1">{apps.length}</p>
          <p className="text-xs text-gray-400 mt-1">View status & verification</p>
        </div>
        <div onClick={() => onGoTab('policies')} className="cursor-pointer bg-white p-4 rounded-xl border border-gray-200 hover:shadow transition">
          <p className="text-xs text-gray-500 font-semibold uppercase">Active Policies</p>
          <p className="text-2xl font-black text-forestgreen mt-1">{policies.length}</p>
          <p className="text-xs text-gray-400 mt-1">Coverage & validity periods</p>
        </div>
        <div onClick={() => onGoTab('claims')} className="cursor-pointer bg-white p-4 rounded-xl border border-gray-200 hover:shadow transition">
          <p className="text-xs text-gray-500 font-semibold uppercase">Submitted Claims</p>
          <p className="text-2xl font-black text-gold mt-1">{claims.length}</p>
          <p className="text-xs text-gray-400 mt-1">Compensation & payout history</p>
        </div>
      </div>

      {/* Quick Action */}
      <div className="bg-cream border border-gold/40 rounded-xl p-4 flex flex-wrap justify-between items-center gap-3">
        <div>
          <h4 className="font-bold text-forestgreen text-sm">Need Additional Protection?</h4>
          <p className="text-xs text-gray-600">Apply for flexible duration parametric refrigeration coverage anytime.</p>
        </div>
        <button onClick={() => onGoTab('apply')}
          className="px-4 py-2 bg-forestgreen text-white rounded-lg text-xs font-semibold hover:bg-green-700 transition shadow">
          + New Policy Application
        </button>
      </div>
    </div>
  );
}

// ── Kitchen Applications Tab ───────────────────────────────────────
function KitchenApplicationsTab({ owner }) {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getKitchenApplications(owner.id).then(setApps).finally(() => setLoading(false));
  }, [owner.id]);

  if (loading) return <p className="animate-pulse text-forestgreen">Loading applications…</p>;
  if (apps.length === 0) return <p className="text-gray-500">No applications submitted yet.</p>;

  return (
    <div>
      <h3 className="text-lg font-bold text-forestgreen mb-3">Kitchen Policy Applications</h3>
      <div className="space-y-3">
        {apps.map((a) => (
          <div key={a.id} className="border rounded-xl p-4 bg-white shadow-sm">
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="font-bold text-forestgreen text-sm">Application #{a.id} — Plan ID: {a.plan_id}</p>
                <p className="text-xs text-gray-600 mt-0.5">
                  Storage Value: ₹{a.storage_value.toLocaleString()} | Requested Coverage: <strong>₹{a.requested_coverage.toLocaleString()}</strong>
                </p>
                <p className="text-xs text-gray-600 mt-0.5">
                  Duration: <strong className="text-forestgreen">{a.duration_days || 30} days</strong> |
                  Calculated Premium: <strong className="text-gold font-bold">₹{a.calculated_premium != null ? a.calculated_premium.toFixed(2) : '—'}</strong>
                </p>
                {a.refrigerator_details && <p className="text-xs text-gray-500">Fridge Setup: {a.refrigerator_details}</p>}
                <p className="text-xs text-gray-400 mt-1">
                  Submitted: {new Date(a.created_at).toLocaleString()} • Terms Version: {a.terms_version || 'v1.0'}
                </p>
              </div>
              <StatusBadge status={a.status} />
            </div>
            {a.admin_reason && (
              <div className="text-xs bg-cream p-2 rounded border border-gold/30 mt-2 text-gray-700">
                <strong>Admin Feedback:</strong> {a.admin_reason}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Kitchen Active Policies Tab ────────────────────────────────────
function KitchenPoliciesTab({ owner }) {
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getKitchenPolicies(owner.id).then(setPolicies).finally(() => setLoading(false));
  }, [owner.id]);

  if (loading) return <p className="animate-pulse text-forestgreen">Loading policies…</p>;
  if (policies.length === 0) return <p className="text-gray-500">No active policies yet. Awaiting admin approval on submitted applications.</p>;

  return (
    <div>
      <h3 className="text-lg font-bold text-forestgreen mb-3">Active Policies & Coverage Details</h3>
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-forestgreen text-white">
            <tr>
              {['Policy #', 'Kitchen Name', 'Coverage Amount', 'Duration', 'Total Premium', 'Start Date', 'Expiry Date', 'Status'].map(h => (
                <th key={h} className="px-3 py-2.5 text-left whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {policies.map((p, i) => (
              <tr key={p.id} className={i % 2 === 0 ? 'bg-white' : 'bg-cream'}>
                <td className="px-3 py-2.5 font-mono text-xs font-bold text-forestgreen">#{p.id}</td>
                <td className="px-3 py-2.5 font-medium">{p.kitchen_name}</td>
                <td className="px-3 py-2.5 font-bold text-forestgreen">₹{p.coverage_amount.toLocaleString()}</td>
                <td className="px-3 py-2.5 text-xs font-semibold text-gray-700">{p.duration_days || 30} days</td>
                <td className="px-3 py-2.5 font-bold text-gold">₹{(p.total_premium || p.monthly_premium).toLocaleString()}</td>
                <td className="px-3 py-2.5 text-xs text-gray-600">{new Date(p.start_date).toLocaleDateString()}</td>
                <td className="px-3 py-2.5 text-xs text-gray-600 font-semibold">{new Date(p.expiry_date).toLocaleDateString()}</td>
                <td className="px-3 py-2.5"><StatusBadge status={p.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Kitchen Claims Tab ─────────────────────────────────────────────
function KitchenClaimsTab({ owner }) {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getKitchenClaims(owner.id).then(setClaims).finally(() => setLoading(false));
  }, [owner.id]);

  if (loading) return <p className="animate-pulse text-forestgreen">Loading claims…</p>;
  if (claims.length === 0) return <p className="text-gray-500">No spoilage claims filed for this kitchen.</p>;

  return (
    <div>
      <h3 className="text-lg font-bold text-forestgreen mb-3">Spoilage Claims & Compensation History</h3>
      <div className="space-y-4">
        {claims.map((c) => {
          let payoutLabel = '⏳ Pending Review';
          let payoutClass = 'text-yellow-700 bg-yellow-50 border-yellow-200';
          if (c.status === 'Paid') {
            payoutLabel = '💰 Simulated Paid to Account';
            payoutClass = 'text-purple-700 bg-purple-50 border-purple-200';
          } else if (c.status === 'Approved') {
            payoutLabel = '✅ Approved for Disbursement';
            payoutClass = 'text-green-700 bg-green-50 border-green-200';
          } else if (c.status === 'Rejected') {
            payoutLabel = '❌ Ineligible / Rejected';
            payoutClass = 'text-red-700 bg-red-50 border-red-200';
          } else if (c.status === 'Under Review') {
            payoutLabel = '🔍 Under Technical Review';
            payoutClass = 'text-blue-700 bg-blue-50 border-blue-200';
          }

          return (
            <div key={c.id} className="border rounded-xl p-4 bg-white shadow-sm">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-bold text-forestgreen">Claim #{c.id}</p>
                  <p className="text-xs text-gray-600">Incident Ref #{c.incident_id} | Policy #{c.policy_id || 'Auto'}</p>
                  {c.spoilage_category && <p className="text-xs text-gray-700 mt-1">Category: <strong>{c.spoilage_category}</strong> | Estimated Loss: ₹{c.estimated_loss?.toLocaleString()}</p>}
                </div>
                <StatusBadge status={c.status} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3 text-sm">
                <div className="bg-cream rounded-lg p-2.5 border border-gold/30">
                  <p className="text-xs text-gray-500">Requested Compensation</p>
                  <p className="font-semibold text-gray-800">₹{c.requested_compensation?.toLocaleString() || '—'}</p>
                </div>
                <div className="bg-cream rounded-lg p-2.5 border border-gold/30">
                  <p className="text-xs text-gray-500">Approved Compensation</p>
                  <p className={`font-semibold ${c.approved_compensation > 0 ? 'text-green-700 font-bold' : 'text-gray-400'}`}>
                    {c.approved_compensation != null ? `₹${c.approved_compensation.toLocaleString()}` : '—'}
                  </p>
                </div>
                <div className={`rounded-lg p-2.5 border ${payoutClass}`}>
                  <p className="text-xs font-semibold">Simulated Payout</p>
                  <p className="font-bold text-xs">{payoutLabel}</p>
                </div>
              </div>

              {c.admin_reason && (
                <div className="mt-2 text-xs bg-gray-50 rounded p-2 text-gray-700 border">
                  <strong>Admin Remarks:</strong> {c.admin_reason}
                </div>
              )}
              {c.evidence_path && (
                <a href={c.evidence_path} target="_blank" rel="noreferrer"
                  className="text-xs text-blue-600 hover:underline mt-2 inline-block">📎 View Evidence Photo</a>
              )}
              <p className="text-xs text-gray-400 mt-2">Submitted on: {new Date(c.created_at).toLocaleString()}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Kitchen Apply for Policy Tab ───────────────────────────────────
function KitchenApplyTab({ owner, onSuccess }) {
  const [plans, setPlans] = useState([]);
  const [durationDays, setDurationDays] = useState(30);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [form, setForm] = useState({
    storage_value: '',
    plan_id: '',
    requested_coverage: '',
    refrigerator_details: '',
  });
  const [msg, setMsg] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchPlans().then(setPlans).catch(() => {});
  }, []);

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const calculatePremium = (monthlyPremium, days) => {
    return Math.round(((monthlyPremium / 30.0) * days) * 100) / 100;
  };

  const selectedPlan = plans.find(p => p.id === parseInt(form.plan_id));
  const calculatedPrem = selectedPlan ? calculatePremium(selectedPlan.monthly_premium, durationDays) : null;
  const coverageEndDate = new Date(Date.now() + (durationDays * 24 * 60 * 60 * 1000));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.plan_id) {
      setMsg('Please select an insurance plan');
      return;
    }
    if (!termsAccepted) {
      setMsg('You must agree to the Policy Terms and Conditions before submitting.');
      return;
    }
    if (selectedPlan && parseFloat(form.requested_coverage) > selectedPlan.coverage_amount) {
      setMsg(`Requested coverage exceeds plan max limit of ₹${selectedPlan.coverage_amount.toLocaleString()}`);
      return;
    }

    setLoading(true); setMsg(''); setSuccess('');
    try {
      const days = parseInt(durationDays) || 30;
      const payload = {
        kitchen_name: owner.kitchen_name,
        owner_name: owner.name,
        contact_info: owner.email,
        address: owner.address || 'Cloud Kitchen Facility',
        storage_value: parseFloat(form.storage_value),
        plan_id: parseInt(form.plan_id),
        requested_coverage: parseFloat(form.requested_coverage),
        refrigerator_details: form.refrigerator_details,
        duration_days: days,
        terms_accepted: true,
        terms_version: 'v1.0',
      };
      const res = await applyPolicy(payload);
      setSuccess(`✅ Application #${res.id} submitted! Status: ${res.status}. Calculated Premium: ₹${res.calculated_premium} for ${days} days.`);
      setForm({ storage_value: '', plan_id: '', requested_coverage: '', refrigerator_details: '' });
      setTermsAccepted(false);
      setDurationDays(30);
      if (onSuccess) setTimeout(onSuccess, 1500);
    } catch (err) {
      setMsg(err.message || 'Failed to submit application');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto">
      <div className="bg-white rounded-2xl shadow p-6 border border-gray-100">
        <h3 className="text-lg font-bold text-forestgreen mb-1">📝 Apply for Parametric Policy</h3>
        <p className="text-xs text-gray-500 mb-4">Protecting: <strong className="text-forestgreen">{owner.kitchen_name}</strong></p>

        <Alert message={msg} type="error" onClose={() => setMsg('')} />
        <Alert message={success} type="success" onClose={() => setSuccess('')} />

        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="block text-sm font-semibold text-gray-700 mb-1">Select Insurance Plan</label>
            <select value={form.plan_id} onChange={(e) => set('plan_id')(e.target.value)} required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forestgreen">
              <option value="">— Select Plan —</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — Coverage up to ₹{p.coverage_amount.toLocaleString()} (₹{p.monthly_premium}/30 days)
                </option>
              ))}
            </select>
          </div>

          {/* Coverage Duration Field */}
          <div className="mb-3">
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Coverage Duration (Days): <span className="font-bold text-forestgreen">{durationDays} days</span>
            </label>
            <input
              type="number"
              min="1"
              max="365"
              value={durationDays}
              onChange={(e) => setDurationDays(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forestgreen"
              required
            />
            <p className="text-[11px] text-gray-500 mt-1">Choose custom duration from 1 to 365 days. Premiums are pro-rated daily.</p>
          </div>

          {/* Live Calculated Premium Card */}
          {selectedPlan && (
            <div className="bg-cream border border-gold/40 rounded-xl p-3.5 mb-4 text-xs space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-gray-600 font-medium">Pro-Rated Total Premium:</span>
                <span className="text-lg font-black text-forestgreen">₹{calculatedPrem?.toFixed(2)}</span>
              </div>
              <p className="text-gray-500 text-[11px]">
                Formula: (₹{selectedPlan.monthly_premium} / 30) × {durationDays} days
              </p>
              <div className="flex justify-between text-gray-600 pt-1 border-t border-gold/20 text-[11px]">
                <span>Starts: <strong>Today</strong></span>
                <span>Valid Until: <strong>{coverageEndDate.toLocaleDateString()}</strong></span>
              </div>
            </div>
          )}

          <Field label="Food Storage Value (₹)" type="number" min="1" value={form.storage_value}
            onChange={set('storage_value')} placeholder="25000" required />

          <Field label="Requested Coverage Amount (₹)" type="number" min="1" value={form.requested_coverage}
            onChange={set('requested_coverage')} placeholder="10000" required />

          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-1">Refrigerator / Chiller Details</label>
            <input type="text" value={form.refrigerator_details} onChange={(e) => set('refrigerator_details')(e.target.value)}
              placeholder="e.g. 500L Deep Freezer, Model BlueStar-2024"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forestgreen" />
          </div>

          {/* Terms and Conditions Accordion / Trigger */}
          <div className="mb-4 p-3 bg-gray-50 rounded-xl border border-gray-200">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-gray-700">📜 Policy Terms & Eligibility</span>
              <button
                type="button"
                onClick={() => setShowTermsModal(true)}
                className="text-xs font-semibold text-forestgreen hover:underline">
                View Full Terms
              </button>
            </div>
            <ul className="text-[11px] text-gray-600 space-y-1 list-disc pl-4 mb-3">
              <li>Automatic trigger: continuous temperature excursion &gt; 2 hours or verified power outage.</li>
              <li>Claims must be filed within <strong>48 hours</strong> of the incident.</li>
              <li>IoT temperature sensor logs and photographic evidence are mandatory.</li>
              <li>Intentional shutoffs and routine maintenance without notice are strictly excluded.</li>
            </ul>

            <label className="flex items-start gap-2 cursor-pointer pt-2 border-t border-gray-200">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="mt-0.5 rounded text-forestgreen focus:ring-forestgreen h-4 w-4"
              />
              <span className="text-xs text-gray-800 font-medium">
                I have read and agree to the <strong className="text-forestgreen">Kitchen Policy Terms &amp; Conditions (v1.0)</strong>.
              </span>
            </label>
          </div>

          <button type="submit" disabled={loading || !termsAccepted}
            className="w-full py-2.5 bg-forestgreen text-white rounded-lg font-semibold hover:bg-green-700 transition disabled:opacity-50 shadow">
            {loading ? 'Submitting…' : 'Submit Policy Application'}
          </button>
        </form>
      </div>

      {/* Terms Modal */}
      {showTermsModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4 border-b pb-3">
              <h4 className="text-lg font-bold text-forestgreen">📜 Kitchen Parametric Policy Terms (v1.0)</h4>
              <button onClick={() => setShowTermsModal(false)} className="text-gray-400 hover:text-gray-700 font-bold text-xl">✕</button>
            </div>

            <div className="space-y-3 text-xs text-gray-700 leading-relaxed">
              <div className="bg-cream p-3 rounded-lg border border-gold/40">
                <p className="font-bold text-forestgreen text-sm">Parametric Insurance Policy Schedule</p>
                <p className="mt-1">
                  Covers cloud kitchen refrigeration inventory against spoilage caused by continuous temperature excursions or unannounced electrical outages.
                </p>
              </div>

              <div>
                <h5 className="font-bold text-gray-800">1. Coverage Period &amp; Duration</h5>
                <p>Coverage activates upon admin review and activation. Valid for the exact selected duration (1 to 365 days). No retroactive coverage is provided for incidents occurring prior to policy start.</p>
              </div>

              <div>
                <h5 className="font-bold text-gray-800">2. Covered Parametric Incidents</h5>
                <p>• Cold room or refrigerator temperature exceeding critical threshold continuously for &gt; 2 hours.<br/>
                • Unplanned power failure or cooling equipment breakdown causing spoilage of perishable ingredients.</p>
              </div>

              <div>
                <h5 className="font-bold text-gray-800">3. Excluded Incidents</h5>
                <p>• Planned maintenance or manual disconnection of cooling appliances.<br/>
                • Temperature sensor tampering or false manual telemetry.<br/>
                • Claims submitted after the 48-hour deadline.</p>
              </div>

              <div>
                <h5 className="font-bold text-gray-800">4. Claim Submission Deadline</h5>
                <p>Claims must be submitted within <strong>48 hours</strong> of the temperature incident detection. Claims submitted after 48 hours are automatically rejected.</p>
              </div>

              <div>
                <h5 className="font-bold text-gray-800">5. Required Evidence</h5>
                <p>• IoT temperature sensor logs or telemetry readings confirming threshold breach.<br/>
                • Photographic evidence of affected perishable inventory.</p>
              </div>

              <div>
                <h5 className="font-bold text-gray-800">6. Academic Demonstration Notice</h5>
                <p className="text-gray-500 italic">This application is part of an academic demonstration project (FoodShieldAI). All policies, premiums, and claim payouts are simulated demonstration values.</p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3 pt-3 border-t">
              <button
                onClick={() => { setTermsAccepted(true); setShowTermsModal(false); }}
                className="px-4 py-2 bg-forestgreen text-white rounded-lg text-xs font-semibold hover:bg-green-700">
                Agree &amp; Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main KitchenPortal Component ───────────────────────────────────
export default function KitchenPortal() {
  const [owner, setOwner] = useState(() => {
    try {
      const saved = localStorage.getItem('foodshield_kitchen_owner');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  const [tab, setTab] = useState(() => {
    try {
      const saved = localStorage.getItem('foodshield_kitchen_owner');
      return saved ? 'overview' : 'auth';
    } catch (e) {
      return 'auth';
    }
  });

  const handleLogin = (o) => {
    setOwner(o);
    try {
      localStorage.setItem('foodshield_kitchen_owner', JSON.stringify(o));
    } catch (e) {}
    setTab('overview');
  };

  const handleLogout = () => {
    setOwner(null);
    try {
      localStorage.removeItem('foodshield_kitchen_owner');
    } catch (e) {}
    setTab('auth');
  };

  const TABS = [
    { id: 'auth', label: '🔑 Kitchen Login', alwaysShow: true },
    { id: 'overview', label: '📊 Overview', requiresAuth: true },
    { id: 'applications', label: '📋 My Applications', requiresAuth: true },
    { id: 'policies', label: '🛡 Active Policies', requiresAuth: true },
    { id: 'claims', label: '💰 My Claims', requiresAuth: true },
    { id: 'apply', label: '➕ New Application', requiresAuth: true },
  ];

  const visibleTabs = TABS.filter((t) => t.alwaysShow || owner);

  return (
    <div className="max-w-5xl mx-auto">
      {/* Academic Demonstration Disclaimer Banner */}
      <div className="bg-cream border-l-4 border-gold p-3.5 rounded-r-xl mb-4 text-xs text-gray-700 shadow-sm">
        <p className="font-bold text-forestgreen flex items-center gap-1.5">
          <span>🎓</span> Academic Demonstration Notice
        </p>
        <p className="mt-0.5">
          FoodShieldAI is an academic demonstration project. Insurance plans, eligibility decisions and payouts displayed in this application are simulated and do not represent real insurance coverage.
        </p>
      </div>

      {/* Header with Kitchen info & logout */}
      <div className="flex flex-wrap justify-between items-center mb-4 gap-2 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-forestgreen">👨‍🍳 Kitchen Owner Portal</h2>
          <p className="text-xs text-gray-500">Manage parametric coverage, active policies, and claim payouts for your cloud kitchen</p>
        </div>
        {owner && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">Logged in as <strong className="text-forestgreen">{owner.name}</strong> ({owner.kitchen_name})</span>
            <button onClick={handleLogout}
              className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-red-50 hover:text-red-700 text-gray-700 border border-gray-300 rounded-lg transition font-semibold">
              Logout
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 mb-6 border-b border-gray-200">
        {visibleTabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition ${
              tab === t.id
                ? 'bg-forestgreen text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-100'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {tab === 'auth' && !owner && <KitchenAuthTab onLogin={handleLogin} />}
        {tab === 'auth' && owner && (
          <div className="text-center py-8 text-gray-500 bg-white rounded-xl p-6 border shadow-sm">
            <p className="text-lg">✅ Signed in to <strong className="text-forestgreen">{owner.kitchen_name}</strong></p>
            <p className="text-sm mt-1">Use the tabs above to manage your kitchen's policies, applications, and claims.</p>
            <button onClick={handleLogout} className="mt-4 px-4 py-2 text-xs bg-red-100 text-red-700 rounded-lg font-semibold hover:bg-red-200">
              Sign Out
            </button>
          </div>
        )}
        {tab === 'overview' && owner && <KitchenOverviewTab owner={owner} onGoTab={setTab} />}
        {tab === 'applications' && owner && <KitchenApplicationsTab owner={owner} />}
        {tab === 'policies' && owner && <KitchenPoliciesTab owner={owner} />}
        {tab === 'claims' && owner && <KitchenClaimsTab owner={owner} />}
        {tab === 'apply' && owner && <KitchenApplyTab owner={owner} onSuccess={() => setTab('applications')} />}

        {!owner && tab !== 'auth' && (
          <div className="text-center py-12 bg-white rounded-xl shadow-sm border">
            <p className="text-4xl mb-3">🔒</p>
            <p className="text-lg font-semibold text-gray-700">Please sign in as a kitchen owner</p>
            <button onClick={() => setTab('auth')}
              className="mt-3 px-5 py-2 bg-forestgreen text-white rounded-lg hover:bg-green-700 transition font-semibold text-sm shadow">
              Go to Kitchen Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
