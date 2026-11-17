import React, { useEffect, useState } from 'react';
import {
  adminFetchApplications, adminFetchPolicies, adminFetchClaims,
  adminUpdateApplication, adminReviewClaim,
  adminFetchCustomerPolicies, adminFetchCustomerClaims, adminReviewCustomerClaim,
  fetchAdminStats,
} from '../api';
import StatusBadge from '../components/StatusBadge';

// ── Notification Banner ────────────────────────────────────────────
function Alert({ message, type = 'info', onClose }) {
  if (!message) return null;
  const isErr = type === 'error';
  return (
    <div className={`flex justify-between items-center px-4 py-2.5 rounded-lg mb-4 text-sm font-medium border ${
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

// ── Admin: Top Stats Overview Grid ─────────────────────────────────
function AdminStatsBar({ stats, onRefresh }) {
  if (!stats) return null;

  return (
    <div className="mb-6">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Platform Overview</h3>
        <button onClick={onRefresh} className="text-xs text-forestgreen font-semibold hover:underline">
          🔄 Refresh Metrics
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-sm">
          <p className="text-xs text-gray-500 font-semibold">Customers</p>
          <p className="text-2xl font-black text-forestgreen mt-1">{stats.total_customers}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">Registered accounts</p>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-sm">
          <p className="text-xs text-gray-500 font-semibold">Kitchen Owners</p>
          <p className="text-2xl font-black text-forestgreen mt-1">{stats.total_kitchen_owners}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">Cloud kitchens</p>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-sm">
          <p className="text-xs text-gray-500 font-semibold">Active Policies</p>
          <p className="text-2xl font-black text-forestgreen mt-1">
            {stats.active_kitchen_policies + stats.active_customer_policies}
          </p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {stats.active_kitchen_policies} kitchen | {stats.active_customer_policies} customer
          </p>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-sm">
          <p className="text-xs text-gray-500 font-semibold">Pending Applications</p>
          <p className={`text-2xl font-black mt-1 ${stats.pending_kitchen_applications > 0 ? 'text-amber-600' : 'text-gray-700'}`}>
            {stats.pending_kitchen_applications}
          </p>
          <p className="text-[11px] text-gray-400 mt-0.5">Awaiting verification</p>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-sm">
          <p className="text-xs text-gray-500 font-semibold">Pending Claims</p>
          <p className={`text-2xl font-black mt-1 ${stats.pending_kitchen_claims + stats.pending_customer_claims > 0 ? 'text-amber-600' : 'text-gray-700'}`}>
            {stats.pending_kitchen_claims + stats.pending_customer_claims}
          </p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {stats.pending_kitchen_claims} kitchen | {stats.pending_customer_claims} customer
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Admin: Policy Applications Tab ────────────────────────────────────
function ApplicationsTab({ onAction }) {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reason, setReason] = useState({});
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const load = () => {
    setLoading(true);
    adminFetchApplications()
      .then(setApps)
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const handle = async (id, status) => {
    setMsg(''); setErr('');
    try {
      await adminUpdateApplication(id, status, reason[id] || null);
      setMsg(`Application #${id} was marked as ${status}.`);
      load();
      if (onAction) onAction();
    } catch (e) {
      setErr(`Failed: ${e.message}`);
    }
  };

  if (loading) return <p className="animate-pulse text-forestgreen">Loading applications…</p>;

  return (
    <div>
      <Alert message={msg} type="success" onClose={() => setMsg('')} />
      <Alert message={err} type="error" onClose={() => setErr('')} />

      {apps.length === 0 ? <p className="text-gray-500">No applications found.</p> : (
        <div className="space-y-4">
          {apps.map((a) => (
            <div key={a.id} className="border rounded-xl p-4 bg-white shadow-sm">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-bold text-forestgreen text-base">#{a.id} — {a.kitchen_name}</p>
                  <p className="text-sm text-gray-600">Owner: <strong className="text-gray-800">{a.owner_name}</strong> | Contact: {a.contact_info}</p>
                  <p className="text-sm text-gray-600">Address: {a.address}</p>
                  <div className="flex flex-wrap gap-4 text-sm mt-1 bg-cream/60 p-2 rounded border border-gold/20">
                    <span>Food Storage: <strong>₹{a.storage_value.toLocaleString()}</strong></span>
                    <span>Requested Coverage: <strong className="text-forestgreen">₹{a.requested_coverage.toLocaleString()}</strong></span>
                    <span>Plan ID: <strong>{a.plan_id}</strong></span>
                  </div>
                  {a.refrigerator_details && <p className="text-xs text-gray-500 mt-1">Refrigerator: {a.refrigerator_details}</p>}
                  <p className="text-xs text-gray-400 mt-1">Submitted on: {new Date(a.created_at).toLocaleString()}</p>
                </div>
                <StatusBadge status={a.status} />
              </div>

              {a.admin_reason && (
                <p className="text-xs text-gray-600 bg-gray-50 p-2 rounded border mb-2">
                  <strong>Decision Reason:</strong> {a.admin_reason}
                </p>
              )}

              {a.status === 'Pending' && (
                <div className="flex flex-col sm:flex-row gap-2 mt-3 pt-3 border-t border-gray-100">
                  <input placeholder="Reason / notes (optional)"
                    value={reason[a.id] || ''}
                    onChange={(e) => setReason({ ...reason, [a.id]: e.target.value })}
                    className="flex-1 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-forestgreen" />
                  <button onClick={() => handle(a.id, 'Approved')}
                    className="px-4 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-semibold transition shadow-sm">
                    ✓ Approve & Activate Policy
                  </button>
                  <button onClick={() => handle(a.id, 'Rejected')}
                    className="px-4 py-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm font-semibold transition shadow-sm">
                    ✕ Reject Application
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Admin: Active Kitchen Policies Tab ────────────────────────────────
function PoliciesTab() {
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminFetchPolicies().then(setPolicies).finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="animate-pulse text-forestgreen">Loading policies…</p>;

  return (
    <div>
      <p className="text-xs text-gray-500 mb-3">All approved cloud kitchen parametric insurance policies.</p>
      {policies.length === 0 ? <p className="text-gray-500">No policies activated yet.</p> : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-forestgreen text-white">
              <tr>
                {['Policy #', 'Kitchen Name', 'Coverage Amount', 'Monthly Premium', 'Start Date', 'Expiry Date', 'Status'].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {policies.map((p, i) => (
                <tr key={p.id} className={i % 2 === 0 ? 'bg-white' : 'bg-cream'}>
                  <td className="px-3 py-2 font-mono text-xs font-bold text-forestgreen">#{p.id}</td>
                  <td className="px-3 py-2 font-medium">{p.kitchen_name}</td>
                  <td className="px-3 py-2 font-bold text-forestgreen">₹{p.coverage_amount.toLocaleString()}</td>
                  <td className="px-3 py-2 font-semibold">₹{p.monthly_premium}/mo</td>
                  <td className="px-3 py-2 text-xs text-gray-600">{new Date(p.start_date).toLocaleDateString()}</td>
                  <td className="px-3 py-2 text-xs text-gray-600 font-semibold">{new Date(p.expiry_date).toLocaleDateString()}</td>
                  <td className="px-3 py-2"><StatusBadge status={p.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Admin: Kitchen Claims Review Tab ──────────────────────────────────
function ClaimsTab({ onAction }) {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [review, setReview] = useState({});
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const load = () => {
    setLoading(true);
    adminFetchClaims()
      .then(setClaims)
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const handle = async (id, status) => {
    setMsg(''); setErr('');
    const r = review[id] || {};
    try {
      await adminReviewClaim(id, status, r.reason || null, r.approved ? parseFloat(r.approved) : null);
      setMsg(`Claim #${id} status updated to ${status}.`);
      load();
      if (onAction) onAction();
    } catch (e) {
      setErr(`Failed: ${e.message}`);
    }
  };

  if (loading) return <p className="animate-pulse text-forestgreen">Loading claims…</p>;

  const set = (id, field, val) => setReview(prev => ({ ...prev, [id]: { ...prev[id], [field]: val } }));

  return (
    <div>
      <Alert message={msg} type="success" onClose={() => setMsg('')} />
      <Alert message={err} type="error" onClose={() => setErr('')} />

      {claims.length === 0 ? <p className="text-gray-500">No kitchen claims filed.</p> : (
        <div className="space-y-4">
          {claims.map((c) => {
            let payoutLabel = '⏳ Pending Review';
            let payoutClass = 'text-yellow-700 bg-yellow-50 border-yellow-200';
            if (c.status === 'Paid') {
              payoutLabel = '💰 Simulated Paid to Kitchen';
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
                    <p className="font-bold text-forestgreen text-base">Claim #{c.id}</p>
                    <p className="text-xs text-gray-600">Incident: #{c.incident_id} | Policy: {c.policy_id ? `#${c.policy_id}` : 'Auto-parametric trigger'}</p>
                    {c.spoilage_category && (
                      <p className="text-xs text-gray-700 mt-1">
                        Category: <strong>{c.spoilage_category}</strong> | Estimated Loss: ₹{c.estimated_loss?.toLocaleString()}
                      </p>
                    )}
                  </div>
                  <StatusBadge status={c.status} />
                </div>

                {/* Requested vs Approved Compensation Display */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2 mb-2 text-sm">
                  <div className="bg-cream p-2.5 rounded-lg border border-gold/30">
                    <p className="text-xs text-gray-500 font-semibold">Requested Compensation</p>
                    <p className="font-bold text-gray-800">₹{c.requested_compensation?.toLocaleString() || '—'}</p>
                  </div>
                  <div className="bg-cream p-2.5 rounded-lg border border-gold/30">
                    <p className="text-xs text-gray-500 font-semibold">Approved Compensation</p>
                    <p className={`font-bold ${c.approved_compensation != null ? 'text-green-700' : 'text-gray-400'}`}>
                      {c.approved_compensation != null ? `₹${c.approved_compensation.toLocaleString()}` : '—'}
                    </p>
                  </div>
                  <div className={`p-2.5 rounded-lg border ${payoutClass}`}>
                    <p className="text-xs font-semibold">Simulated Payout Status</p>
                    <p className="font-bold text-xs">{payoutLabel}</p>
                  </div>
                </div>

                {c.evidence_path && (
                  <div className="mt-1">
                    <a href={c.evidence_path} target="_blank" rel="noreferrer"
                      className="text-xs text-blue-600 hover:underline">📎 View Kitchen Photographic Evidence</a>
                  </div>
                )}
                <p className="text-xs text-gray-400 mt-1">Submitted: {new Date(c.created_at).toLocaleString()}</p>
                {c.admin_reason && (
                  <div className="text-xs bg-gray-50 rounded p-2 text-gray-700 border mt-2">
                    <strong>Admin Note:</strong> {c.admin_reason}
                  </div>
                )}

                {/* Claim Review Action Buttons */}
                {['Pending', 'Under Review'].includes(c.status) && (
                  <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input placeholder="Review remarks / explanation"
                        value={review[c.id]?.reason || ''}
                        onChange={(e) => set(c.id, 'reason', e.target.value)}
                        className="flex-1 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-forestgreen" />
                      <input type="number" placeholder="Approved amount (₹)"
                        value={review[c.id]?.approved || ''}
                        onChange={(e) => set(c.id, 'approved', e.target.value)}
                        className="w-44 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-forestgreen" />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => handle(c.id, 'Under Review')}
                        className="px-3 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-xs font-semibold transition">
                        Mark Under Review
                      </button>
                      <button onClick={() => handle(c.id, 'Approved')}
                        className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-xs font-semibold transition shadow-sm">
                        Approve Claim
                      </button>
                      <button onClick={() => handle(c.id, 'Rejected')}
                        className="px-3 py-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 text-xs font-semibold transition shadow-sm">
                        Reject Claim
                      </button>
                    </div>
                  </div>
                )}

                {c.status === 'Approved' && (
                  <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-3">
                    <span className="text-xs text-gray-600">Compensation verified. Disburse simulated payout:</span>
                    <button onClick={() => handle(c.id, 'Paid')}
                      className="px-4 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-xs font-bold transition shadow-sm">
                      💰 Mark as Simulated Paid
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Admin: Customer Policies Tab ──────────────────────────────────────
function CustomerPoliciesTab() {
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminFetchCustomerPolicies().then(setPolicies).finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="animate-pulse text-forestgreen">Loading customer policies…</p>;

  return (
    <div>
      <p className="text-xs text-gray-500 mb-3">Per-order delivery food protection policies purchased by customers.</p>
      {policies.length === 0 ? <p className="text-gray-500">No customer policies registered yet.</p> : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-forestgreen text-white">
              <tr>
                {['Policy #', 'Customer ID', 'Order ID', 'Premium Paid', 'Max Coverage Limit', 'Status', 'Effective Date'].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {policies.map((p, i) => (
                <tr key={p.id} className={i % 2 === 0 ? 'bg-white' : 'bg-cream'}>
                  <td className="px-3 py-2 font-mono text-xs font-bold text-forestgreen">{p.policy_number}</td>
                  <td className="px-3 py-2">Customer #{p.customer_id}</td>
                  <td className="px-3 py-2 font-mono text-xs">Order #{p.order_id}</td>
                  <td className="px-3 py-2 font-semibold">₹{p.premium_paid}</td>
                  <td className="px-3 py-2 font-bold text-forestgreen">₹{p.max_coverage.toLocaleString()}</td>
                  <td className="px-3 py-2"><StatusBadge status={p.status} /></td>
                  <td className="px-3 py-2 text-xs text-gray-600">{new Date(p.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Admin: Customer Claims Review Tab ─────────────────────────────────
function CustomerClaimsTab({ onAction }) {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [review, setReview] = useState({});
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const load = () => {
    setLoading(true);
    adminFetchCustomerClaims()
      .then(setClaims)
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const handle = async (id, status) => {
    setMsg(''); setErr('');
    const r = review[id] || {};
    try {
      await adminReviewCustomerClaim(id, status, r.reason || null, r.approved ? parseFloat(r.approved) : null);
      setMsg(`Customer claim #${id} status updated to ${status}.`);
      load();
      if (onAction) onAction();
    } catch (e) {
      setErr(`Failed: ${e.message}`);
    }
  };

  if (loading) return <p className="animate-pulse text-forestgreen">Loading customer claims…</p>;

  const set = (id, field, val) => setReview(prev => ({ ...prev, [id]: { ...prev[id], [field]: val } }));

  return (
    <div>
      <Alert message={msg} type="success" onClose={() => setMsg('')} />
      <Alert message={err} type="error" onClose={() => setErr('')} />

      {claims.length === 0 ? <p className="text-gray-500">No customer protection claims filed.</p> : (
        <div className="space-y-4">
          {claims.map((c) => {
            let payoutLabel = '⏳ Pending Review';
            let payoutClass = 'text-yellow-700 bg-yellow-50 border-yellow-200';
            if (c.status === 'Paid') {
              payoutLabel = '💰 Simulated Payout Disbursed';
              payoutClass = 'text-purple-700 bg-purple-50 border-purple-200';
            } else if (c.status === 'Approved') {
              payoutLabel = '✅ Approved for Disbursement';
              payoutClass = 'text-green-700 bg-green-50 border-green-200';
            } else if (c.status === 'Rejected') {
              payoutLabel = '❌ Claim Rejected';
              payoutClass = 'text-red-700 bg-red-50 border-red-200';
            } else if (c.status === 'Under Review') {
              payoutLabel = '🔍 Under Investigation';
              payoutClass = 'text-blue-700 bg-blue-50 border-blue-200';
            }

            return (
              <div key={c.id} className="border rounded-xl p-4 bg-white shadow-sm">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-bold text-forestgreen text-base">{c.claim_number}</p>
                    <p className="text-xs text-gray-600">Customer #{c.customer_id} | Order #{c.order_id} | Policy #{c.policy_id}</p>
                    <p className="text-xs text-gray-700 mt-1">Reason: <strong className="text-forestgreen">{c.claim_reason}</strong></p>
                    {c.description && <p className="text-xs text-gray-600 mt-0.5 italic">"{c.description}"</p>}
                  </div>
                  <StatusBadge status={c.status} />
                </div>

                {/* Requested vs Approved Breakdown */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2 mb-2 text-sm">
                  <div className="bg-cream p-2.5 rounded-lg border border-gold/30">
                    <p className="text-xs text-gray-500 font-semibold">Requested Compensation</p>
                    <p className="font-bold text-gray-800">₹{c.requested_amount.toLocaleString()}</p>
                  </div>
                  <div className="bg-cream p-2.5 rounded-lg border border-gold/30">
                    <p className="text-xs text-gray-500 font-semibold">Approved Compensation</p>
                    <p className={`font-bold ${c.approved_amount > 0 ? 'text-green-700' : 'text-gray-400'}`}>
                      {c.approved_amount > 0 ? `₹${c.approved_amount.toLocaleString()}` : '—'}
                    </p>
                  </div>
                  <div className={`p-2.5 rounded-lg border ${payoutClass}`}>
                    <p className="text-xs font-semibold">Simulated Payout Status</p>
                    <p className="font-bold text-xs">{payoutLabel}</p>
                  </div>
                </div>

                {c.evidence_path && (
                  <div className="mt-1">
                    <a href={c.evidence_path} target="_blank" rel="noreferrer"
                      className="text-xs text-blue-600 hover:underline">📎 View Customer Photo Evidence</a>
                  </div>
                )}
                <p className="text-xs text-gray-400 mt-1">Submitted on: {new Date(c.created_at).toLocaleString()}</p>
                {c.admin_reason && (
                  <div className="text-xs bg-gray-50 rounded p-2 text-gray-700 border mt-2">
                    <strong>Admin Reason:</strong> {c.admin_reason}
                  </div>
                )}

                {/* Action controls */}
                {['Pending', 'Under Review'].includes(c.status) && (
                  <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input placeholder="Admin review notes"
                        value={review[c.id]?.reason || ''}
                        onChange={(e) => set(c.id, 'reason', e.target.value)}
                        className="flex-1 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-forestgreen" />
                      <input type="number" placeholder="Approved compensation (₹)"
                        value={review[c.id]?.approved || ''}
                        onChange={(e) => set(c.id, 'approved', e.target.value)}
                        className="w-48 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-forestgreen" />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => handle(c.id, 'Under Review')}
                        className="px-3 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-xs font-semibold transition">
                        Mark Under Review
                      </button>
                      <button onClick={() => handle(c.id, 'Approved')}
                        className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-xs font-semibold transition shadow-sm">
                        Approve Compensation
                      </button>
                      <button onClick={() => handle(c.id, 'Rejected')}
                        className="px-3 py-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 text-xs font-semibold transition shadow-sm">
                        Reject Claim
                      </button>
                    </div>
                  </div>
                )}

                {c.status === 'Approved' && (
                  <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-3">
                    <span className="text-xs text-gray-600">Claim approved. Execute simulated customer refund:</span>
                    <button onClick={() => handle(c.id, 'Paid')}
                      className="px-4 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-xs font-bold transition shadow-sm">
                      💰 Mark as Simulated Refund Paid
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Admin Dashboard Component (Unified) ──────────────────────────────
export default function AdminDashboard() {
  const [tab, setTab] = useState('applications');
  const [stats, setStats] = useState(null);

  const loadStats = () => {
    fetchAdminStats().then(setStats).catch(() => {});
  };

  useEffect(() => {
    loadStats();
  }, []);

  const tabs = [
    { id: 'applications', label: '📋 Policy Applications' },
    { id: 'policies', label: '🛡 Kitchen Policies' },
    { id: 'claims', label: '💰 Kitchen Claims' },
    { id: 'customer-policies', label: '👤 Customer Policies' },
    { id: 'customer-claims', label: '📦 Customer Claims' },
  ];

  return (
    <div className="max-w-5xl mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-2xl font-bold text-forestgreen">⚙️ Insurance Administration Dashboard</h2>
          <p className="text-xs text-gray-500">Review applications, oversee parametric triggers, and manage compensation payouts</p>
        </div>
      </div>

      {/* Top Stats Overview */}
      <AdminStatsBar stats={stats} onRefresh={loadStats} />

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-1 mb-6 border-b border-gray-200">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition ${
              tab === t.id
                ? 'bg-forestgreen text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-100'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'applications' && <ApplicationsTab onAction={loadStats} />}
      {tab === 'policies' && <PoliciesTab />}
      {tab === 'claims' && <ClaimsTab onAction={loadStats} />}
      {tab === 'customer-policies' && <CustomerPoliciesTab />}
      {tab === 'customer-claims' && <CustomerClaimsTab onAction={loadStats} />}
    </div>
  );
}
