import React, { useState, useEffect } from 'react';
import StatusBadge from '../components/StatusBadge';
import {
  registerCustomer, loginCustomer, fetchCustomerPlans,
  createCustomerOrder, getCustomerOrders, getCustomerPolicies,
  submitCustomerClaim, getCustomerClaims,
} from '../api';

// ── Helper: simple label input with validation ─────────────────────
function Field({ label, type = 'text', value, onChange, placeholder, required, min }) {
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
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forestgreen"
      />
    </div>
  );
}

// ── Notification Banner Component ──────────────────────────────────
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

// ── Customer Terms Modal Component ─────────────────────────────────
function CustomerTermsModal({ plan, onClose }) {
  if (!plan) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 border border-gray-200">
        <div className="flex justify-between items-start mb-3 border-b pb-2">
          <div>
            <h3 className="text-lg font-bold text-forestgreen">📜 Customer Protection Terms & Conditions</h3>
            <p className="text-xs text-gray-500">{plan.name} Plan • Per-Order Food Delivery Protection</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 font-bold text-lg">✕</button>
        </div>

        <div className="space-y-3 text-xs text-gray-700">
          <div className="bg-cream p-3 rounded-lg border border-gold/30">
            <p><strong>1. Premium Amount:</strong> ₹{plan.monthly_premium} per individual protected order.</p>
            <p className="mt-1"><strong>2. Coverage Period:</strong> Begins immediately upon order placement & confirmation. Terminates automatically once order is delivered or cancelled.</p>
            <p className="mt-1"><strong>3. Maximum Compensation Limit:</strong> Up to <strong>₹{plan.coverage_amount.toLocaleString()}</strong> per protected order.</p>
          </div>

          <div>
            <h4 className="font-bold text-gray-800">4. Covered Incidents:</h4>
            <ul className="list-disc ml-4 space-y-0.5 mt-0.5">
              <li><strong>Spoiled Food:</strong> Rotten, sour, unhygienic, or inedible food on arrival.</li>
              <li><strong>Damaged Food:</strong> Spilled, crushed, or tampered containers during transit.</li>
              <li><strong>Excessive Delivery Delay:</strong> Deliveries exceeding <strong>60 minutes</strong> beyond promised delivery time.</li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-gray-800">5. Excluded Incidents (Ineligible for Compensation):</h4>
            <ul className="list-disc ml-4 space-y-0.5 mt-0.5 text-red-600">
              <li>Customer address mistakes or incorrect drop-off coordinates provided by user.</li>
              <li>Change-of-mind requests or ordered-by-mistake items.</li>
              <li>Claims submitted after the 48-hour deadline.</li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-gray-800">6. Claim Submission Deadline:</h4>
            <p>Claims must be submitted within <strong>48 hours</strong> of the incident or delivery time.</p>
          </div>

          <div>
            <h4 className="font-bold text-gray-800">7. Required Evidence:</h4>
            <p>Photographic evidence is mandatory for spoiled or damaged food claims. Delay claims require delivery duration confirmation.</p>
          </div>

          <div>
            <h4 className="font-bold text-gray-800">8. Claim Approval & Compensation Formula:</h4>
            <p>Payout = <em>Minimum of verified loss and plan compensation limit</em> (Max ₹{plan.coverage_amount.toLocaleString()}).</p>
          </div>

          <div>
            <h4 className="font-bold text-gray-800">9. Cancellation & Refund Policy:</h4>
            <p>If the food order is cancelled prior to dispatch, protection coverage terminates immediately without claim entitlement.</p>
          </div>

          <div className="p-2.5 bg-yellow-50 border border-yellow-300 rounded text-yellow-800 font-semibold">
            🎓 Academic Disclaimer: FoodShieldAI is an academic demonstration project. Insurance plans, eligibility decisions and payouts displayed in this application are simulated and do not represent real insurance coverage.
          </div>
        </div>

        <div className="mt-5 pt-3 border-t flex justify-end">
          <button onClick={onClose} className="px-4 py-2 bg-forestgreen text-white rounded-lg text-xs font-semibold hover:bg-green-700">
            Close Terms
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tab 1: Login / Register ────────────────────────────────────────
function AuthTab({ onLogin }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', address: '' });
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setMsg('');
    try {
      const customer = mode === 'login'
        ? await loginCustomer({ email: form.email, password: form.password })
        : await registerCustomer(form);
      onLogin(customer);
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
              {m === 'login' ? '🔑 Customer Login' : '📝 Create Account'}
            </button>
          ))}
        </div>

        <Alert message={msg} type="error" onClose={() => setMsg('')} />

        <form onSubmit={handleSubmit}>
          {mode === 'register' && (
            <>
              <Field label="Full Name" value={form.name} onChange={set('name')} placeholder="Rahul Sharma" required />
              <Field label="Phone Number" value={form.phone} onChange={set('phone')} placeholder="9876543210" />
              <Field label="Delivery Address" value={form.address} onChange={set('address')} placeholder="Flat 101, Delhi NCR" />
            </>
          )}
          <Field label="Email Address" type="email" value={form.email} onChange={set('email')} placeholder="rahul@example.com" required />
          <Field label="Password" type="password" value={form.password} onChange={set('password')} placeholder="••••••••" required />

          <button type="submit" disabled={loading}
            className="w-full py-2.5 mt-2 bg-forestgreen text-white rounded-lg font-semibold hover:bg-green-700 transition disabled:opacity-50 shadow">
            {loading ? 'Please wait…' : mode === 'login' ? 'Login' : 'Complete Registration'}
          </button>
        </form>

        <div className="mt-5 p-3 bg-cream border border-gold/30 rounded-lg text-xs text-gray-600">
          <p className="font-semibold text-forestgreen mb-1">🎯 Demo Credentials:</p>
          <p>Email: <span className="font-mono font-bold text-gray-800">rahul@example.com</span></p>
          <p>Password: <span className="font-mono font-bold text-gray-800">demo</span></p>
        </div>
      </div>
    </div>
  );
}

// ── Tab 2: Protection Plans ────────────────────────────────────────
function PlansTab() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [termsModalPlan, setTermsModalPlan] = useState(null);

  useEffect(() => {
    fetchCustomerPlans().then(setPlans).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="animate-pulse text-forestgreen">Loading plans…</p>;

  const colors = ['bg-green-50 border-green-200', 'bg-blue-50 border-blue-200', 'bg-purple-50 border-purple-200'];
  const badges = ['🥉 Basic', '🥈 Standard', '🥇 Premium'];

  return (
    <div>
      <h3 className="text-lg font-bold text-forestgreen mb-1">Customer Food Protection Plans</h3>
      <p className="text-sm text-gray-500 mb-4">Select a plan when placing an order. Fictional demonstration values only.</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {plans.map((p, i) => (
          <div key={p.id} className={`border-2 rounded-2xl p-5 ${colors[i] || 'bg-gray-50 border-gray-200'} shadow-sm flex flex-col justify-between`}>
            <div>
              <p className="text-lg font-bold text-forestgreen mb-1">{badges[i] || p.name} Plan</p>
              <p className="text-3xl font-black text-gold mb-1">₹{p.monthly_premium}<span className="text-sm font-normal text-gray-500">/order</span></p>
              <p className="text-sm font-semibold text-gray-700 mb-3">Max Coverage: ₹{p.coverage_amount.toLocaleString()}</p>
              <div className="text-xs text-gray-600 mb-2">
                <p className="font-semibold mb-1">✅ Benefits:</p>
                <p>{p.benefits}</p>
              </div>
              <div className="text-xs text-gray-500 mb-3">
                <p className="font-semibold mb-1">❌ Exclusions:</p>
                <p>{p.exclusions}</p>
              </div>
            </div>

            <button
              onClick={() => setTermsModalPlan(p)}
              className="w-full text-xs text-forestgreen font-bold hover:underline py-1.5 border border-forestgreen/30 rounded-lg hover:bg-forestgreen/5 transition"
            >
              📜 View Terms & Conditions
            </button>
          </div>
        ))}
      </div>

      <CustomerTermsModal plan={termsModalPlan} onClose={() => setTermsModalPlan(null)} />
    </div>
  );
}

// ── Tab 3: Place Order (With Terms Acceptance & Summary) ────────────
function PlaceOrderTab({ customer }) {
  const [plans, setPlans] = useState([]);
  const [form, setForm] = useState({ restaurant_name: '', items_summary: '', order_amount: '', plan_id: '' });
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsModalPlan, setTermsModalPlan] = useState(null);
  const [msg, setMsg] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { fetchCustomerPlans().then(setPlans).catch(() => {}); }, []);

  const set = (k) => (v) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (k === 'plan_id' && !v) {
      setTermsAccepted(false);
    }
  };

  const selectedPlan = plans.find((p) => p.id === parseInt(form.plan_id));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (parseFloat(form.order_amount) <= 0) {
      setMsg('Order amount must be greater than 0');
      return;
    }
    if (form.plan_id && !termsAccepted) {
      setMsg('You must agree to the Policy Terms and Conditions before buying protection.');
      return;
    }
    setLoading(true); setMsg(''); setSuccess('');
    try {
      const payload = {
        customer_id: customer.id,
        restaurant_name: form.restaurant_name,
        items_summary: form.items_summary,
        order_amount: parseFloat(form.order_amount),
        plan_id: form.plan_id ? parseInt(form.plan_id) : null,
        terms_accepted: termsAccepted,
        terms_version: 'v1.0',
      };
      const order = await createCustomerOrder(payload);
      setSuccess(`✅ Order placed successfully! Order #: ${order.order_number}${order.has_insurance ? ' (Protected 🛡 Policy Created & Terms Recorded)' : ''}`);
      setForm({ restaurant_name: '', items_summary: '', order_amount: '', plan_id: '' });
      setTermsAccepted(false);
    } catch (err) {
      setMsg(err.message || 'Failed to place order');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto">
      <div className="bg-white rounded-2xl shadow p-6 border border-gray-100">
        <h3 className="text-lg font-bold text-forestgreen mb-1">🛒 Place a Simulated Order</h3>
        <p className="text-xs text-gray-500 mb-4">Add optional food spoilage and transit damage protection.</p>

        <Alert message={msg} type="error" onClose={() => setMsg('')} />
        <Alert message={success} type="success" onClose={() => setSuccess('')} />

        <form onSubmit={handleSubmit}>
          <Field label="Restaurant / Cloud Kitchen Name" value={form.restaurant_name} onChange={set('restaurant_name')} placeholder="SpiceCraft Cloud Kitchen" required />

          <div className="mb-3">
            <label className="block text-sm font-semibold text-gray-700 mb-1">Items Summary</label>
            <textarea value={form.items_summary} onChange={(e) => set('items_summary')(e.target.value)}
              placeholder="e.g. 2x Butter Chicken, 4x Garlic Naan, 1x Gulab Jamun"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm h-20 resize-none focus:outline-none focus:ring-2 focus:ring-forestgreen"
              required />
          </div>

          <Field label="Order Amount (₹)" type="number" min="1" value={form.order_amount} onChange={set('order_amount')} placeholder="450" required />

          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-1">Add Food Protection Plan</label>
            <select value={form.plan_id} onChange={(e) => set('plan_id')(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forestgreen">
              <option value="">No protection</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>🛡 {p.name} — ₹{p.monthly_premium}/order (Max Compensation: ₹{p.coverage_amount})</option>
              ))}
            </select>
          </div>

          {/* Pre-Purchase Terms Display & Summary */}
          {selectedPlan && (
            <div className="mb-4 p-3.5 bg-cream border border-gold/40 rounded-xl space-y-2 text-xs">
              <div className="flex justify-between items-center border-b border-gold/30 pb-1.5">
                <span className="font-bold text-forestgreen uppercase tracking-wide">🛡 Protection Summary ({selectedPlan.name} Plan)</span>
                <button
                  type="button"
                  onClick={() => setTermsModalPlan(selectedPlan)}
                  className="text-forestgreen font-bold underline hover:text-green-800"
                >
                  View Full Terms
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-700">
                <div><strong>Premium:</strong> ₹{selectedPlan.monthly_premium} (one-time for this order)</div>
                <div><strong>Max Compensation:</strong> ₹{selectedPlan.coverage_amount.toLocaleString()}</div>
                <div><strong>Coverage Period:</strong> Order Placement ➔ Delivery</div>
                <div><strong>Submission Deadline:</strong> Within 48 hours</div>
                <div className="col-span-2"><strong>Covered:</strong> Spoiled food, damaged packaging, delay &gt; 60 mins</div>
                <div className="col-span-2 text-red-700"><strong>Excluded:</strong> Customer address mistakes, change of mind</div>
              </div>

              {/* Mandatory Acceptance Checkbox */}
              <div className="pt-2 border-t border-gold/30">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    className="mt-0.5 h-4 w-4 text-forestgreen rounded border-gray-300 focus:ring-forestgreen"
                  />
                  <span className="text-gray-800 text-[11px]">
                    I have read and agree to the <strong>Policy Terms and Conditions</strong> (Version v1.0). I understand compensation is simulated and capped at ₹{selectedPlan.coverage_amount}.
                  </span>
                </label>
              </div>
            </div>
          )}

          <button type="submit" disabled={loading || (form.plan_id && !termsAccepted)}
            className="w-full py-2.5 bg-forestgreen text-white rounded-lg font-semibold hover:bg-green-700 transition disabled:opacity-50 shadow">
            {loading ? 'Placing Order…' : form.plan_id ? `Buy Protection & Place Order (+₹${selectedPlan?.monthly_premium || 0})` : 'Place Demo Order'}
          </button>
        </form>
      </div>

      <CustomerTermsModal plan={termsModalPlan} onClose={() => setTermsModalPlan(null)} />
    </div>
  );
}

// ── Tab 4: My Orders ───────────────────────────────────────────────
function MyOrdersTab({ customer }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCustomerOrders(customer.id).then(setOrders).finally(() => setLoading(false));
  }, [customer.id]);

  if (loading) return <p className="animate-pulse text-forestgreen">Loading orders…</p>;
  if (orders.length === 0) return <p className="text-gray-500">No orders yet. Place your first order!</p>;

  return (
    <div>
      <h3 className="text-lg font-bold text-forestgreen mb-4">My Orders History</h3>
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-forestgreen text-white">
            <tr>
              {['Order #', 'Restaurant', 'Items', 'Amount', 'Insurance Protection', 'Terms Accepted', 'Status', 'Date'].map(h => (
                <th key={h} className="px-3 py-2.5 text-left whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orders.map((o, i) => (
              <tr key={o.id} className={i % 2 === 0 ? 'bg-white' : 'bg-cream'}>
                <td className="px-3 py-2.5 font-mono text-xs font-bold text-forestgreen">{o.order_number}</td>
                <td className="px-3 py-2.5 font-medium">{o.restaurant_name}</td>
                <td className="px-3 py-2.5 max-w-xs truncate text-gray-600">{o.items_summary}</td>
                <td className="px-3 py-2.5 font-semibold">₹{o.order_amount.toLocaleString()}</td>
                <td className="px-3 py-2.5 text-center">
                  {o.has_insurance ? <span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full font-bold">🛡 Protected</span> : <span className="text-gray-400">—</span>}
                </td>
                <td className="px-3 py-2.5 text-xs text-center">
                  {o.terms_accepted ? <span className="text-green-700 font-semibold">✓ Yes ({o.terms_version || 'v1.0'})</span> : '—'}
                </td>
                <td className="px-3 py-2.5"><StatusBadge status={o.order_status} /></td>
                <td className="px-3 py-2.5 text-xs text-gray-500">{new Date(o.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Tab 5: My Policies (Showing Terms Version & Duration) ──────────
function MyPoliciesTab({ customer }) {
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCustomerPolicies(customer.id).then(setPolicies).finally(() => setLoading(false));
  }, [customer.id]);

  if (loading) return <p className="animate-pulse text-forestgreen">Loading policies…</p>;
  if (policies.length === 0) return <p className="text-gray-500">No active policies. Place an order with a protection plan.</p>;

  return (
    <div>
      <h3 className="text-lg font-bold text-forestgreen mb-4">My Protection Policies</h3>
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-forestgreen text-white">
            <tr>
              {['Policy #', 'Order Ref', 'Premium', 'Max Coverage', 'Terms Ver.', 'Accepted On', 'Status', 'Effective Date'].map(h => (
                <th key={h} className="px-3 py-2.5 text-left whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {policies.map((p, i) => (
              <tr key={p.id} className={i % 2 === 0 ? 'bg-white' : 'bg-cream'}>
                <td className="px-3 py-2.5 font-mono text-xs font-bold text-forestgreen">{p.policy_number}</td>
                <td className="px-3 py-2.5 font-mono text-xs">Order #{p.order_id}</td>
                <td className="px-3 py-2.5 font-semibold">₹{p.premium_paid}</td>
                <td className="px-3 py-2.5 font-bold text-forestgreen">₹{p.max_coverage.toLocaleString()}</td>
                <td className="px-3 py-2.5 text-xs font-mono">{p.terms_version || 'v1.0'}</td>
                <td className="px-3 py-2.5 text-xs text-gray-500">{p.terms_accepted_at ? new Date(p.terms_accepted_at).toLocaleString() : 'On purchase'}</td>
                <td className="px-3 py-2.5"><StatusBadge status={p.status} /></td>
                <td className="px-3 py-2.5 text-xs text-gray-500">{new Date(p.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Tab 6: Submit Claim (With 48h and Evidence Enforcements) ────────
function SubmitClaimTab({ customer }) {
  const [orders, setOrders] = useState([]);
  const [form, setForm] = useState({ order_id: '', claim_reason: '', description: '', requested_amount: '', delay_minutes: '' });
  const [evidence, setEvidence] = useState(null);
  const [msg, setMsg] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getCustomerOrders(customer.id)
      .then((all) => setOrders(all.filter((o) => o.has_insurance)))
      .catch(() => {});
  }, [customer.id]);

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (parseFloat(form.requested_amount) <= 0) {
      setMsg('Requested amount must be greater than 0');
      return;
    }

    if (form.claim_reason === 'Excessive delivery delay' && form.delay_minutes && parseInt(form.delay_minutes) <= 60) {
      setMsg('Excessive delivery delay must exceed 60 minutes beyond promised delivery time.');
      return;
    }

    if (['Spoiled food', 'Damaged food'].includes(form.claim_reason) && !evidence) {
      setMsg(`Photo evidence is mandatory for ${form.claim_reason.toLowerCase()} claims under policy terms.`);
      return;
    }

    setLoading(true); setMsg(''); setSuccess('');
    try {
      const fd = new FormData();
      fd.append('customer_id', customer.id);
      fd.append('order_id', form.order_id);
      fd.append('claim_reason', form.claim_reason);
      fd.append('description', form.description);
      fd.append('requested_amount', form.requested_amount);
      if (form.delay_minutes) fd.append('delay_minutes', form.delay_minutes);
      if (evidence) fd.append('evidence', evidence);

      const claim = await submitCustomerClaim(fd);
      setSuccess(`✅ Claim submitted! Claim ID: ${claim.claim_number} — Status: ${claim.status}`);
      setForm({ order_id: '', claim_reason: '', description: '', requested_amount: '', delay_minutes: '' });
      setEvidence(null);
    } catch (err) {
      setMsg(err.message || 'Failed to submit claim');
    } finally {
      setLoading(false);
    }
  };

  if (orders.length === 0 && !loading) {
    return (
      <div className="bg-yellow-50 border border-yellow-300 rounded-xl p-5 text-sm text-yellow-800">
        <p className="font-semibold mb-1">⚠️ No protected orders found.</p>
        <p>Place an order with a protection plan first, then come back to submit a claim.</p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="bg-white rounded-2xl shadow p-6 border border-gray-100">
        <h3 className="text-lg font-bold text-forestgreen mb-1">📋 Submit an Order Protection Claim</h3>
        <p className="text-xs text-gray-500 mb-3">Claims must be reported within <strong>48 hours</strong> of the order.</p>

        <Alert message={msg} type="error" onClose={() => setMsg('')} />
        <Alert message={success} type="success" onClose={() => setSuccess('')} />

        <div className="mb-4 p-2.5 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-800">
          <strong>⚠️ Exclusion Warning:</strong> Claims for customer address mistakes or change-of-mind requests are excluded and will be rejected automatically.
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="block text-sm font-semibold text-gray-700 mb-1">Select Protected Order</label>
            <select value={form.order_id} onChange={(e) => set('order_id')(e.target.value)} required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forestgreen">
              <option value="">— Select order —</option>
              {orders.map((o) => (
                <option key={o.id} value={o.id}>{o.order_number} — {o.restaurant_name} (₹{o.order_amount})</option>
              ))}
            </select>
          </div>

          <div className="mb-3">
            <label className="block text-sm font-semibold text-gray-700 mb-1">Claim Reason</label>
            <select value={form.claim_reason} onChange={(e) => set('claim_reason')(e.target.value)} required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forestgreen">
              <option value="">— Select reason —</option>
              <option value="Spoiled food">🤢 Spoiled food (Photo Required)</option>
              <option value="Damaged food">📦 Damaged food (Photo Required)</option>
              <option value="Excessive delivery delay">⏱ Excessive delivery delay (&gt; 60 mins)</option>
            </select>
          </div>

          {form.claim_reason === 'Excessive delivery delay' && (
            <Field
              label="Delay Beyond Promised Time (minutes)"
              type="number"
              min="61"
              value={form.delay_minutes}
              onChange={set('delay_minutes')}
              placeholder="e.g. 75"
              required
            />
          )}

          <div className="mb-3">
            <label className="block text-sm font-semibold text-gray-700 mb-1">Description</label>
            <textarea value={form.description} onChange={(e) => set('description')(e.target.value)}
              placeholder="Describe what occurred with the delivery or food quality…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm h-20 resize-none focus:outline-none focus:ring-2 focus:ring-forestgreen"
              required />
          </div>

          <Field label="Requested Compensation Amount (₹)" type="number" min="1" value={form.requested_amount}
            onChange={set('requested_amount')} placeholder="e.g. 200" required />

          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Upload Photographic Evidence {['Spoiled food', 'Damaged food'].includes(form.claim_reason) && <span className="text-red-500 font-bold">*Mandatory</span>}
            </label>
            <input type="file" accept="image/*,.pdf"
              required={['Spoiled food', 'Damaged food'].includes(form.claim_reason)}
              onChange={(e) => setEvidence(e.target.files[0] || null)}
              className="w-full text-sm text-gray-600 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:bg-forestgreen file:text-white hover:file:bg-green-700" />
            <p className="text-[11px] text-gray-400 mt-1">Upload clear photo of spoiled food packaging, damaged items, or delivery receipt.</p>
          </div>

          <button type="submit" disabled={loading}
            className="w-full py-2.5 bg-forestgreen text-white rounded-lg font-semibold hover:bg-green-700 transition disabled:opacity-50 shadow">
            {loading ? 'Submitting Claim…' : 'Submit Claim (Under 48h Deadline)'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Tab 7: My Claims ───────────────────────────────────────────────
function MyClaimsTab({ customer }) {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCustomerClaims(customer.id).then(setClaims).finally(() => setLoading(false));
  }, [customer.id]);

  if (loading) return <p className="animate-pulse text-forestgreen">Loading claims…</p>;
  if (claims.length === 0) return <p className="text-gray-500">No claims filed yet.</p>;

  return (
    <div>
      <h3 className="text-lg font-bold text-forestgreen mb-4">My Claims History</h3>
      <div className="space-y-4">
        {claims.map((c) => {
          let payoutLabel = '⏳ Pending Review';
          let payoutClass = 'text-yellow-700 bg-yellow-50 border-yellow-200';
          if (c.status === 'Paid') {
            payoutLabel = '💰 Simulated Payout Disbursed';
            payoutClass = 'text-purple-700 bg-purple-50 border-purple-200';
          } else if (c.status === 'Approved') {
            payoutLabel = '✅ Approved (Ready for Payout)';
            payoutClass = 'text-green-700 bg-green-50 border-green-200';
          } else if (c.status === 'Rejected') {
            payoutLabel = '❌ Claim Rejected (No Payout)';
            payoutClass = 'text-red-700 bg-red-50 border-red-200';
          } else if (c.status === 'Under Review') {
            payoutLabel = '🔍 Under Investigation';
            payoutClass = 'text-blue-700 bg-blue-50 border-blue-200';
          }

          return (
            <div key={c.id} className="border rounded-xl p-4 bg-cream shadow-sm">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-bold text-forestgreen">{c.claim_number}</p>
                  <p className="text-sm text-gray-600">Order #{c.order_id} | Policy #{c.policy_id} | Reason: <span className="font-semibold text-gray-800">{c.claim_reason}</span></p>
                  {c.delay_minutes && <p className="text-xs text-blue-800">Reported Delay: {c.delay_minutes} minutes</p>}
                  {c.description && <p className="text-sm text-gray-600 mt-1 italic">"{c.description}"</p>}
                </div>
                <StatusBadge status={c.status} />
              </div>

              {/* Compensation Breakdown */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3 text-sm">
                <div className="bg-white rounded-lg p-2.5 border border-gray-200">
                  <p className="text-xs text-gray-400">Requested Amount</p>
                  <p className="font-semibold text-gray-800">₹{c.requested_amount.toLocaleString()}</p>
                </div>
                <div className="bg-white rounded-lg p-2.5 border border-gray-200">
                  <p className="text-xs text-gray-400">Approved Compensation</p>
                  <p className={`font-semibold ${c.approved_amount > 0 ? 'text-green-700 font-bold' : 'text-gray-400'}`}>
                    {c.approved_amount > 0 ? `₹${c.approved_amount.toLocaleString()}` : '—'}
                  </p>
                </div>
                <div className={`rounded-lg p-2.5 border ${payoutClass}`}>
                  <p className="text-xs font-semibold">Payout Status</p>
                  <p className="font-bold text-xs">{payoutLabel}</p>
                </div>
              </div>

              {c.admin_reason && (
                <div className="mt-2 text-xs bg-white/70 rounded p-2 text-gray-700 border">
                  <strong>Admin Remarks:</strong> {c.admin_reason}
                </div>
              )}
              {c.evidence_path && (
                <a href={c.evidence_path} target="_blank" rel="noreferrer"
                  className="text-xs text-blue-600 hover:underline mt-2 inline-block">📎 View Attached Evidence</a>
              )}
              <p className="text-xs text-gray-400 mt-2">Submitted on: {new Date(c.created_at).toLocaleString()}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main CustomerPortal Component ──────────────────────────────────
export default function CustomerPortal() {
  const [customer, setCustomer] = useState(() => {
    try {
      const saved = localStorage.getItem('foodshield_customer');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  const [tab, setTab] = useState(() => {
    try {
      const saved = localStorage.getItem('foodshield_customer');
      return saved ? 'plans' : 'auth';
    } catch (e) {
      return 'auth';
    }
  });

  const handleLogin = (cust) => {
    setCustomer(cust);
    try {
      localStorage.setItem('foodshield_customer', JSON.stringify(cust));
    } catch (e) {}
    setTab('plans');
  };

  const handleLogout = () => {
    setCustomer(null);
    try {
      localStorage.removeItem('foodshield_customer');
    } catch (e) {}
    setTab('auth');
  };

  const TABS = [
    { id: 'auth', label: '🔑 Login / Register', alwaysShow: true },
    { id: 'plans', label: '🛡 Protection Plans', requiresAuth: true },
    { id: 'order', label: '🛒 Place Order', requiresAuth: true },
    { id: 'orders', label: '📦 My Orders', requiresAuth: true },
    { id: 'policies', label: '📄 My Policies', requiresAuth: true },
    { id: 'claim', label: '📋 Submit Claim', requiresAuth: true },
    { id: 'claims', label: '💬 My Claims', requiresAuth: true },
  ];

  const visibleTabs = TABS.filter((t) => t.alwaysShow || customer);

  return (
    <div className="max-w-5xl mx-auto">
      {/* Academic Demonstration Disclaimer */}
      <div className="bg-cream border-l-4 border-gold p-3 rounded-r-xl mb-4 text-xs text-gray-700 shadow-sm">
        <p className="font-bold text-forestgreen flex items-center gap-1.5">
          <span>🎓</span> Academic Demonstration Project
        </p>
        <p className="mt-0.5">
          FoodShieldAI is an academic demonstration project. Insurance plans, eligibility decisions and payouts displayed in this application are simulated and do not represent real insurance coverage.
        </p>
      </div>

      {/* Header with User Info and Logout */}
      <div className="flex flex-wrap justify-between items-center mb-4 gap-2 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-forestgreen">👤 Customer Protection Portal</h2>
          <p className="text-xs text-gray-500">Per-order food safety & spoliage compensation for delivery customers</p>
        </div>
        {customer && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">Logged in as <strong className="text-forestgreen">{customer.name}</strong></span>
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
        {tab === 'auth' && !customer && <AuthTab onLogin={handleLogin} />}
        {tab === 'auth' && customer && (
          <div className="text-center py-8 text-gray-500 bg-white rounded-xl p-6 border shadow-sm">
            <p className="text-lg">✅ You are logged in as <strong className="text-forestgreen">{customer.name}</strong> ({customer.email})</p>
            <p className="text-sm mt-1">Use the navigation tabs above to explore plans, place protected demo orders, or track claims.</p>
            <button onClick={handleLogout} className="mt-4 px-4 py-2 text-xs bg-red-100 text-red-700 rounded-lg font-semibold hover:bg-red-200">
              Sign Out
            </button>
          </div>
        )}
        {tab === 'plans' && customer && <PlansTab />}
        {tab === 'order' && customer && <PlaceOrderTab customer={customer} />}
        {tab === 'orders' && customer && <MyOrdersTab customer={customer} />}
        {tab === 'policies' && customer && <MyPoliciesTab customer={customer} />}
        {tab === 'claim' && customer && <SubmitClaimTab customer={customer} />}
        {tab === 'claims' && customer && <MyClaimsTab customer={customer} />}

        {!customer && tab !== 'auth' && (
          <div className="text-center py-12 bg-white rounded-xl shadow-sm border">
            <p className="text-4xl mb-3">🔒</p>
            <p className="text-lg font-semibold text-gray-700">Please sign in to access this section</p>
            <button onClick={() => setTab('auth')}
              className="mt-3 px-5 py-2 bg-forestgreen text-white rounded-lg hover:bg-green-700 transition font-semibold text-sm shadow">
              Go to Customer Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
