import React from 'react';

/** Colored status badge */
export default function StatusBadge({ status }) {
  const map = {
    Pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    'Under Review': 'bg-blue-100 text-blue-800 border-blue-300',
    Approved: 'bg-green-100 text-green-800 border-green-300',
    Active: 'bg-green-100 text-green-800 border-green-300',
    Rejected: 'bg-red-100 text-red-800 border-red-300',
    Expired: 'bg-gray-100 text-gray-800 border-gray-300',
    Cancelled: 'bg-gray-100 text-gray-800 border-gray-300',
    Paid: 'bg-purple-100 text-purple-800 border-purple-300',
  };
  const cls = map[status] || 'bg-gray-100 text-gray-700 border-gray-300';
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${cls}`}>
      {status}
    </span>
  );
}
