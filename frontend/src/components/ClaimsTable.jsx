import React from 'react';

export default function ClaimsTable({ claims }) {
  return (
    <div className="overflow-x-auto mt-6">
      <h2 className="text-lg font-medium mb-2 text-forestgreen">Claims History (Demo)</h2>
      <table className="min-w-full border border-forestgreen rounded">
        <thead className="bg-forestgreen text-white">
          <tr>
            <th className="p-2 text-left">ID</th>
            <th className="p-2 text-left">Incident</th>
            <th className="p-2 text-left">Eligible</th>
            <th className="p-2 text-left">Payout</th>
            <th className="p-2 text-left">Status</th>
          </tr>
        </thead>
        <tbody>
          {claims.length === 0 ? (
            <tr>
              <td colSpan="5" className="p-4 text-center text-gray-400">
                No claims yet — simulate events to generate demo claims.
              </td>
            </tr>
          ) : (
            claims.map((c) => (
              <tr key={c.id} className="border-t border-forestgreen/30">
                <td className="p-2">{c.id}</td>
                <td className="p-2">{c.incident || `Incident #${c.incident_id}`}</td>
                <td className="p-2">{c.eligible}</td>
                <td className="p-2">${c.payout_amount !== undefined ? c.payout_amount : c.payout}</td>
                <td className="p-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    c.status === 'Approved' ? 'bg-forestgreen/20 text-forestgreen' :
                    c.status === 'Rejected' ? 'bg-red-100 text-red-700' :
                    'bg-gold/20 text-gold'
                  }`}>
                    {c.status}
                  </span>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
