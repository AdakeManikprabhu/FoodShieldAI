import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

export default function TemperatureChart({ data }) {
  // Transform data for Recharts
  // Backend returns {temperature, timestamp, event_type}
  // We display time on X-axis and temperature on Y-axis
  const chartData = data.map((d) => {
    // Handle both Date objects (Phase 1) and ISO strings (Phase 2 backend)
    const t = d.timestamp ? new Date(d.timestamp) : (d.time instanceof Date ? d.time : new Date());
    return {
      time: t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      temp: d.temperature !== undefined ? d.temperature : d.temp,
    };
  });

  if (chartData.length === 0) {
    return (
      <div className="text-center text-gray-400 my-6 py-12 border border-dashed border-gray-300 rounded">
        No temperature readings yet. Click a simulation button to begin.
      </div>
    );
  }

  return (
    <div className="my-6">
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="time" />
          <YAxis domain={[0, 40]} tickFormatter={(v) => `${v}°C`} />
          <Tooltip
            labelFormatter={(v) => `Time: ${v}`}
            formatter={(value) => [`${value}°C`, 'Temp']}
          />
          <Line type="monotone" dataKey="temp" stroke="#2F6B2E" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
