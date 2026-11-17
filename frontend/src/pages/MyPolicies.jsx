import React, { useEffect, useState } from 'react';
import { fetchMyApplications, fetchActivePolicies } from '../api';
import StatusBadge from '../components/StatusBadge';

export default function MyPolicies() {
  const [applications, setApplications] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([fetchMyApplications(), fetchActivePolicies()])
      .then(([apps, pols]) => { setApplications(apps); setPolicies(pols); })
      .catch(() => setError('Failed to load data'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center p-8 text-forestgreen animate-pulse">Loading…</div>;
  if (error) return <div className="text-red-600 p-4">{error}</div>;

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-8">
      {/* Active Policies */}
      <section>
        <h2 className="text-2xl font-bold text-forestgreen mb-4">Active Policies</h2>
        {policies.length === 0 ? (
          <p className="text-gray-500">No active policies yet. Apply for a plan to get started.</p>
        ) : (
          <div className="space-y-3">
            {policies.map((p) => (
              <div key={p.id} className="border border-forestgreen rounded-xl p-4 bg-cream">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-bold text-forestgreen">Policy #{p.id} — {p.kitchen_name}</h3>
                  <StatusBadge status={p.status} />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div><p className="text-gray-500">Coverage</p><p className="font-semibold">₹{p.coverage_amount.toLocaleString()}</p></div>
                  <div><p className="text-gray-500">Premium</p><p className="font-semibold">₹{p.monthly_premium}/month</p></div>
                  <div><p className="text-gray-500">Start Date</p><p className="font-semibold">{new Date(p.start_date).toLocaleDateString()}</p></div>
                  <div><p className="text-gray-500">Expiry Date</p><p className="font-semibold">{new Date(p.expiry_date).toLocaleDateString()}</p></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* All Applications */}
      <section>
        <h2 className="text-2xl font-bold text-forestgreen mb-4">My Applications</h2>
        {applications.length === 0 ? (
          <p className="text-gray-500">No applications submitted yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-forestgreen text-white">
                <tr>
                  {['ID', 'Kitchen', 'Owner', 'Plan ID', 'Coverage Req.', 'Status', 'Reason', 'Applied On'].map(h => (
                    <th key={h} className="px-3 py-2 text-left whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {applications.map((a, i) => (
                  <tr key={a.id} className={i % 2 === 0 ? 'bg-white' : 'bg-cream'}>
                    <td className="px-3 py-2 font-mono">#{a.id}</td>
                    <td className="px-3 py-2">{a.kitchen_name}</td>
                    <td className="px-3 py-2">{a.owner_name}</td>
                    <td className="px-3 py-2">{a.plan_id}</td>
                    <td className="px-3 py-2">₹{a.requested_coverage.toLocaleString()}</td>
                    <td className="px-3 py-2"><StatusBadge status={a.status} /></td>
                    <td className="px-3 py-2 text-gray-500">{a.admin_reason || '—'}</td>
                    <td className="px-3 py-2 text-gray-500">{new Date(a.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
