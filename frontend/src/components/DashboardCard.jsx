import React from 'react';

export default function DashboardCard({ title, value, bgColor }) {
  return (
    <div className={`p-4 rounded-lg shadow ${bgColor} text-white`}>
      <h3 className="text-sm font-medium mb-2">{title}</h3>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}
