import React from 'react';

export default function SimulatorButtons({ onNormal, onExcursion, onPowerOutage, disabled }) {
  return (
    <div className="flex flex-wrap justify-center gap-4 my-4">
      <button
        onClick={onNormal}
        disabled={disabled}
        className="px-4 py-2 bg-forestgreen text-white rounded hover:bg-forestgreen/80 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Simulate Normal (4°C)
      </button>
      <button
        onClick={onExcursion}
        disabled={disabled}
        className="px-4 py-2 bg-gold text-white rounded hover:bg-gold/80 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Simulate Excursion (35°C)
      </button>
      <button
        onClick={onPowerOutage}
        disabled={disabled}
        className="px-4 py-2 bg-cream text-forestgreen rounded hover:bg-cream/80 border border-forestgreen disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Power Outage
      </button>
    </div>
  );
}
