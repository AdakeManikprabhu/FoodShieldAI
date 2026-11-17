import React, { useEffect, useState } from 'react';
import { fetchPlans, applyPolicy } from '../api';

const BENEFITS = {
  Basic: ['Coverage for temperature excursions > 30°C', 'Up to ₹10,000 payout', 'Standard IoT automated verification'],
  Standard: ['Covers excursions & verified power outages', 'Up to ₹25,000 payout', 'Priority claim processing'],
  Premium: ['Full coverage for spoilage & severe equipment failures', 'Up to ₹50,000 payout', 'Highest coverage tier'],
};

export default function InsurancePlans() {
  const [plans, setPlans] = useState([]);
  const [selected, setSelected] = useState(null); // plan to apply for
  const [termsModalPlan, setTermsModalPlan] = useState(null); // plan to inspect terms
  const [durationDays, setDurationDays] = useState(30);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [form, setForm] = useState({
    kitchen_name: '', owner_name: '', contact_info: '',
    address: '', storage_value: '', requested_coverage: '', refrigerator_details: '',
  });
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchPlans().then(setPlans).catch(() => setError('Failed to load plans'));
  }, []);

  const calculatePremium = (monthlyPremium, days) => {
    return Math.round(((monthlyPremium / 30.0) * days) * 100) / 100;
  };

  const handleApply = async (e) => {
    e.preventDefault();
    if (!termsAccepted) {
      setError('You must read and agree to the Policy Terms and Conditions before applying.');
      return;
    }
    setLoading(true); setMsg(''); setError('');
    try {
      const days = parseInt(durationDays) || 30;
      const res = await applyPolicy({
        ...form,
        plan_id: selected.id,
        duration_days: days,
        storage_value: parseFloat(form.storage_value),
        requested_coverage: parseFloat(form.requested_coverage),
        terms_accepted: true,
        terms_version: 'v1.0',
      });
      setMsg(`✅ Application submitted! Application ID is #${res.id}. Status: ${res.status}. Calculated Premium: ₹${res.calculated_premium || calculatePremium(selected.monthly_premium, days)} for ${days} days.`);
      setSelected(null);
      setTermsAccepted(false);
      setDurationDays(30);
      setForm({ kitchen_name: '', owner_name: '', contact_info: '', address: '', storage_value: '', requested_coverage: '', refrigerator_details: '' });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const calculatedPrem = selected ? calculatePremium(selected.monthly_premium, durationDays) : 0;
  const startDate = new Date();
  const endDate = new Date(Date.now() + (durationDays * 24 * 60 * 60 * 1000));

  return (
    <div className="max-w-5xl mx-auto p-4">
      {/* Academic Demonstration Disclaimer */}
      <div className="bg-cream border-l-4 border-gold p-3.5 rounded-r-xl mb-6 text-xs text-gray-700 shadow-sm">
        <p className="font-bold text-forestgreen flex items-center gap-1.5">
          <span>🎓</span> Academic Demonstration Notice
        </p>
        <p className="mt-0.5">
          FoodShieldAI is an academic demonstration project. Insurance plans, eligibility decisions and payouts displayed in this application are simulated and do not represent real insurance coverage.
        </p>
      </div>

      <div className="flex flex-wrap justify-between items-center mb-6 gap-2">
        <div>
          <h2 className="text-2xl font-bold text-forestgreen">🛡 Kitchen Parametric Insurance Plans</h2>
          <p className="text-sm text-gray-500">
            Fictional demonstration plans for cloud kitchen refrigeration and cold storage protection.
          </p>
        </div>
      </div>

      {msg && <div className="bg-green-50 border border-green-400 text-green-800 p-3 rounded-xl mb-4 text-sm font-medium">{msg}</div>}
      {error && <div className="bg-red-50 border border-red-400 text-red-700 p-3 rounded-xl mb-4 text-sm font-medium">{error}</div>}

      {/* Plan Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {plans.map((plan) => (
          <div key={plan.id} className="border-2 border-forestgreen/60 rounded-2xl p-5 bg-white shadow-sm hover:shadow-md transition flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-1">
                <h3 className="text-xl font-bold text-forestgreen">{plan.name} Plan</h3>
                <span className="text-[11px] bg-green-100 text-green-800 font-bold px-2 py-0.5 rounded-full">Cloud Kitchen</span>
              </div>
              <p className="text-3xl font-black text-gold mb-1">₹{plan.monthly_premium.toLocaleString()}<span className="text-sm font-normal text-gray-500">/30 days</span></p>
              <p className="text-sm font-semibold text-gray-700 mb-3">Coverage Limit: <span className="text-forestgreen font-bold">₹{plan.coverage_amount.toLocaleString()}</span></p>

              <div className="mb-3 text-xs bg-cream p-2.5 rounded-lg border border-gold/30">
                <p className="font-semibold text-gray-700">Flexible Duration Available:</p>
                <p className="text-gray-600">Full-month or partial days: <span className="font-mono">₹{(plan.monthly_premium / 30).toFixed(2)}/day</span></p>
                <p className="text-gray-500 mt-0.5">(e.g. 10 days = ₹{calculatePremium(plan.monthly_premium, 10)})</p>
              </div>

              <ul className="text-xs text-gray-700 mb-3 space-y-1.5">
                {(BENEFITS[plan.name] || []).map((b, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-green-600 font-bold">✓</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              {plan.exclusions && (
                <p className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-200 mb-3">
                  <strong>❌ Excludes:</strong> {plan.exclusions}
                </p>
              )}
            </div>

            <div className="space-y-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setTermsModalPlan(plan)}
                className="w-full text-xs text-forestgreen font-bold hover:underline py-1"
              >
                📜 View Terms & Conditions
              </button>
              <button
                type="button"
                onClick={() => { setSelected(plan); setDurationDays(30); setTermsAccepted(false); setError(''); setMsg(''); }}
                className="w-full bg-forestgreen text-white py-2 rounded-xl font-semibold hover:bg-green-800 transition shadow"
              >
                Apply for Coverage
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Terms & Conditions Modal */}
      {termsModalPlan && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 border border-gray-200">
            <div className="flex justify-between items-start mb-3 border-b pb-2">
              <div>
                <h3 className="text-lg font-bold text-forestgreen">📜 Policy Terms and Conditions</h3>
                <p className="text-xs text-gray-500">{termsModalPlan.name} Plan • Cloud Kitchen Parametric Coverage</p>
              </div>
              <button onClick={() => setTermsModalPlan(null)} className="text-gray-400 hover:text-gray-700 font-bold text-lg">✕</button>
            </div>

            <div className="space-y-3 text-xs text-gray-700">
              <div className="bg-cream p-3 rounded-lg border border-gold/30">
                <p><strong>1. Premium & Duration:</strong> ₹{termsModalPlan.monthly_premium}/30 days. Shorter durations pro-rated at (₹{termsModalPlan.monthly_premium} / 30) × covered days (e.g. 10 days = ₹{calculatePremium(termsModalPlan.monthly_premium, 10)}).</p>
                <p className="mt-1"><strong>2. Maximum Compensation:</strong> Up to ₹{termsModalPlan.coverage_amount.toLocaleString()} per approved claim within policy limit.</p>
              </div>

              <div>
                <h4 className="font-bold text-gray-800">3. Covered Incidents:</h4>
                <p>Verified refrigeration temperature excursions exceeding 30°C for at least 2 consecutive telemetry intervals, and sustained power outages logged by IoT monitoring.</p>
              </div>

              <div>
                <h4 className="font-bold text-gray-800">4. Excluded Incidents:</h4>
                <p>Intentional power disconnection, deliberate refrigerator door opening, pre-existing equipment failure prior to coverage start, and unreported incidents.</p>
              </div>

              <div>
                <h4 className="font-bold text-gray-800">5. Coverage Start & Expiry:</h4>
                <p>Coverage begins ONLY after insurance administrator review and approval. No retrospective coverage is allowed. The policy strictly expires on the specified expiry timestamp.</p>
              </div>

              <div>
                <h4 className="font-bold text-gray-800">6. Claim Deadline & Evidence:</h4>
                <p>Claims must be submitted within <strong>48 hours</strong> of the incident. Kitchen owners must provide spoilage category, loss estimate, and photographic or sensor evidence.</p>
              </div>

              <div>
                <h4 className="font-bold text-gray-800">7. Renewal Policy:</h4>
                <p>Policies do not automatically renew. A fresh application is required upon policy expiration.</p>
              </div>

              <div className="p-2.5 bg-yellow-50 border border-yellow-300 rounded text-yellow-800 font-semibold">
                ⚠️ Academic Disclaimer: FoodShieldAI is an academic demonstration project. Insurance plans, eligibility decisions and payouts displayed in this application are simulated and do not represent real insurance coverage.
              </div>
            </div>

            <div className="mt-5 pt-3 border-t flex justify-end">
              <button
                onClick={() => setTermsModalPlan(null)}
                className="px-4 py-2 bg-forestgreen text-white rounded-lg text-xs font-semibold hover:bg-green-700"
              >
                Close Terms
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Application Form Modal with Duration Selector & Terms Acceptance */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 border border-gray-200">
            <div className="flex justify-between items-start mb-3 border-b pb-2">
              <div>
                <h3 className="text-xl font-bold text-forestgreen">Apply for {selected.name} Plan</h3>
                <p className="text-xs text-gray-500">Maximum Coverage: ₹{selected.coverage_amount.toLocaleString()}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-700 font-bold text-lg">✕</button>
            </div>

            <form onSubmit={handleApply} className="space-y-3">
              {/* Coverage Duration and Pro-Rated Premium Calculation */}
              <div className="bg-cream p-3 rounded-xl border border-gold/30 space-y-2">
                <label className="block text-xs font-bold text-forestgreen uppercase">Coverage Duration & Pro-Rated Premium</label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-gray-600 block mb-1">Covered Days</label>
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={durationDays}
                      onChange={(e) => setDurationDays(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full border rounded px-2.5 py-1.5 text-xs bg-white font-bold text-gray-800 focus:outline-none focus:ring-1 focus:ring-forestgreen"
                    />
                  </div>
                  <div>
                    <label className="text-gray-600 block mb-1">Calculated Premium</label>
                    <div className="bg-white px-2.5 py-1.5 border rounded font-mono font-bold text-forestgreen text-sm">
                      ₹{calculatedPrem}
                    </div>
                  </div>
                </div>
                <div className="text-[11px] text-gray-600">
                  <span>Period: <strong>{startDate.toLocaleDateString()}</strong> to <strong>{endDate.toLocaleDateString()}</strong> ({durationDays} days)</span>
                  <p className="text-[10px] text-gray-500 mt-0.5">Formula: (₹{selected.monthly_premium} / 30) × {durationDays} = ₹{calculatedPrem}</p>
                </div>
              </div>

              {[
                { key: 'kitchen_name', label: 'Kitchen / Brand Name', type: 'text', placeholder: 'SpiceCraft Cloud Kitchen' },
                { key: 'owner_name', label: 'Owner / Head Chef Name', type: 'text', placeholder: 'Chef Amit Verma' },
                { key: 'contact_info', label: 'Contact Email or Phone', type: 'text', placeholder: 'amit@cloudkitchen.com' },
                { key: 'address', label: 'Kitchen Facility Address', type: 'text', placeholder: 'Sector 18, Commercial Hub, Noida' },
                { key: 'storage_value', label: 'Food Inventory Value (₹)', type: 'number', placeholder: '25000' },
                { key: 'requested_coverage', label: `Requested Coverage Amount (max ₹${selected.coverage_amount.toLocaleString()})`, type: 'number', placeholder: '10000' },
                { key: 'refrigerator_details', label: 'Refrigerator / Chiller Specs (optional)', type: 'text', placeholder: '500L Deep Freezer, Voltas' },
              ].map(({ key, label, type, placeholder }) => (
                <div key={key}>
                  <label className="block text-xs font-semibold text-gray-700 mb-0.5">{label}</label>
                  <input
                    type={type}
                    required={key !== 'refrigerator_details'}
                    placeholder={placeholder}
                    value={form[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-forestgreen"
                  />
                </div>
              ))}

              {/* Mandatory Terms Acceptance Checkbox */}
              <div className="pt-2 border-t border-gray-100">
                <label className="flex items-start gap-2 cursor-pointer bg-gray-50 p-2.5 rounded-lg border border-gray-200">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    className="mt-0.5 h-4 w-4 text-forestgreen rounded border-gray-300 focus:ring-forestgreen"
                  />
                  <span className="text-xs text-gray-700">
                    I have read and agree to the{' '}
                    <button
                      type="button"
                      onClick={() => setTermsModalPlan(selected)}
                      className="text-forestgreen font-bold underline inline"
                    >
                      Policy Terms and Conditions
                    </button>
                    . I understand coverage begins only upon admin approval, expires on the end date, and payouts are simulated.
                  </span>
                </label>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg font-semibold text-xs hover:bg-gray-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !termsAccepted}
                  className="flex-1 bg-forestgreen text-white py-2 rounded-lg font-semibold text-xs hover:bg-green-800 transition disabled:opacity-50 shadow"
                >
                  {loading ? 'Submitting…' : `Submit Application (₹${calculatedPrem})`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
