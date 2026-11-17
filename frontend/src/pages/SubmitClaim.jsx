import React, { useEffect, useState } from 'react';
import { fetchIncidents, fetchActivePolicies, submitClaim } from '../api';
import StatusBadge from '../components/StatusBadge';

export default function SubmitClaim() {
  const [incidents, setIncidents] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [form, setForm] = useState({
    incident_id: '', policy_id: '', spoilage_category: '',
    estimated_loss: '', requested_compensation: '',
  });
  const [evidence, setEvidence] = useState(null);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchIncidents().then(setIncidents).catch(console.error);
    fetchActivePolicies().then(setPolicies).catch(console.error);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setMsg(''); setError('');
    try {
      const fd = new FormData();
      fd.append('incident_id', form.incident_id);
      fd.append('policy_id', form.policy_id);
      fd.append('spoilage_category', form.spoilage_category);
      fd.append('estimated_loss', form.estimated_loss);
      fd.append('requested_compensation', form.requested_compensation);
      if (evidence) fd.append('evidence', evidence);

      const res = await submitClaim(fd);
      setMsg(`✅ Claim submitted! Claim ID: #${res.id} — Status: ${res.status}`);
      setForm({ incident_id: '', policy_id: '', spoilage_category: '', estimated_loss: '', requested_compensation: '' });
      setEvidence(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h2 className="text-2xl font-bold text-forestgreen mb-2">Submit Spoilage Claim</h2>
      <p className="text-sm text-gray-500 mb-6">
        Select an incident and an active policy to file a compensation claim.
      </p>

      {msg && <div className="bg-green-50 border border-green-400 text-green-800 p-3 rounded mb-4">{msg}</div>}
      {error && <div className="bg-red-50 border border-red-400 text-red-700 p-3 rounded mb-4">{error}</div>}

      {policies.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-400 text-yellow-800 p-3 rounded mb-4">
          ⚠️ You have no active policies. Please apply for a plan first.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 bg-cream rounded-xl p-5 border border-forestgreen/30">
        {/* Incident Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Select Incident *</label>
          <select required value={form.incident_id} onChange={(e) => setForm({ ...form, incident_id: e.target.value })}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forestgreen">
            <option value="">— Choose an incident —</option>
            {incidents.map((inc) => (
              <option key={inc.id} value={inc.id}>
                #{inc.id} | {inc.event_type} | {inc.temperature}°C | {new Date(inc.timestamp).toLocaleString()}
              </option>
            ))}
          </select>
        </div>

        {/* Policy Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Select Active Policy *</label>
          <select required value={form.policy_id} onChange={(e) => setForm({ ...form, policy_id: e.target.value })}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forestgreen">
            <option value="">— Choose a policy —</option>
            {policies.map((p) => (
              <option key={p.id} value={p.id}>
                Policy #{p.id} — {p.kitchen_name} | Coverage: ₹{p.coverage_amount.toLocaleString()}
              </option>
            ))}
          </select>
        </div>

        {/* Spoilage Category */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Spoiled Food Category *</label>
          <select required value={form.spoilage_category} onChange={(e) => setForm({ ...form, spoilage_category: e.target.value })}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forestgreen">
            <option value="">— Select category —</option>
            {['Vegetables', 'Dairy', 'Meat & Poultry', 'Seafood', 'Beverages', 'Fruits', 'Prepared Food', 'Other'].map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Estimated Loss */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Financial Loss (₹) *</label>
          <input type="number" required min="1" value={form.estimated_loss}
            onChange={(e) => setForm({ ...form, estimated_loss: e.target.value })}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forestgreen"
            placeholder="e.g. 5000" />
        </div>

        {/* Requested Compensation */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Requested Compensation (₹) *</label>
          <input type="number" required min="1" value={form.requested_compensation}
            onChange={(e) => setForm({ ...form, requested_compensation: e.target.value })}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forestgreen"
            placeholder="Cannot exceed policy coverage limit" />
        </div>

        {/* Evidence Upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Supporting Evidence (photo/invoice, optional)</label>
          <input type="file" accept="image/*,.pdf"
            onChange={(e) => setEvidence(e.target.files[0])}
            className="w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-forestgreen file:text-white file:cursor-pointer" />
          {evidence && <p className="text-xs text-gray-500 mt-1">Selected: {evidence.name}</p>}
        </div>

        <button type="submit" disabled={loading || policies.length === 0}
          className="w-full bg-forestgreen text-white py-2.5 rounded-lg font-semibold hover:bg-green-800 disabled:opacity-60 transition">
          {loading ? 'Submitting…' : 'Submit Claim'}
        </button>
      </form>
    </div>
  );
}
