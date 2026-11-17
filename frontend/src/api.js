/**
 * api.js — Full API service for FoodShieldAI (Phase 3 + Insurance).
 */

const BASE = "/api";

async function request(path, options = {}) {
  const headers = { ...(options.headers || {}) };

  // Phase 5 Security & Access Control Headers
  if (path.startsWith("/admin")) {
    headers["X-Admin-Role"] = "admin";
  }

  try {
    const custJson = localStorage.getItem("foodshield_customer");
    if (custJson) {
      const cust = JSON.parse(custJson);
      if (cust && cust.id) {
        headers["X-Customer-ID"] = String(cust.id);
      }
    }
  } catch (_) {}

  try {
    const ownerJson = localStorage.getItem("foodshield_kitchen_owner");
    if (ownerJson) {
      const owner = JSON.parse(ownerJson);
      if (owner && owner.id) {
        headers["X-Kitchen-Owner-ID"] = String(owner.id);
      }
    }
  } catch (_) {}

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const text = await res.text();
    let detail = text;
    try { detail = JSON.parse(text).detail; } catch (_) {}
    throw new Error(detail || `API error ${res.status}`);
  }
  return res.json();
}

// ── Core dashboard / readings ─────────────────────────────────────
export const fetchHealth = () => request("/health");
export const fetchDashboard = () => request("/dashboard");
export const fetchReadings = () => request("/readings");
export const fetchIncidents = () => request("/incidents");
export const fetchClaims = () => request("/claims");

// ── Simulations ───────────────────────────────────────────────────
export const simulateNormal = () => request("/simulate/normal", { method: "POST" });
export const simulateExcursion = () => request("/simulate/excursion", { method: "POST" });
export const simulatePowerOutage = () => request("/simulate/power-outage", { method: "POST" });

// ── Insurance Plans ───────────────────────────────────────────────
export const fetchPlans = () => request("/plans");

// ── Policy Application ────────────────────────────────────────────
export const applyPolicy = (data) =>
  request("/policy/apply", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

export const fetchMyApplications = () => request("/policy/applications");
export const fetchActivePolicies = () => request("/policy/active");

// ── Submit Spoilage Claim (multipart form – supports file upload) ──
export const submitClaim = (formData) =>
  request("/claims/submit", { method: "POST", body: formData });

// ── Admin: Kitchen ────────────────────────────────────────────────
export const adminFetchApplications = () => request("/admin/applications");
export const adminFetchPolicies = () => request("/admin/policies");
export const adminFetchClaims = () => request("/admin/claims");

export const adminUpdateApplication = (id, status, reason) =>
  request(`/admin/applications/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, admin_reason: reason }),
  });

export const adminReviewClaim = (id, status, reason, approved_compensation) =>
  request(`/admin/claims/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, admin_reason: reason, approved_compensation }),
  });

// ═══════════════════════════════════════════════════════════════════
// Phase 3: Customer API Functions
// ═══════════════════════════════════════════════════════════════════

// ── Customer Auth ─────────────────────────────────────────────────
export const registerCustomer = (data) =>
  request("/customer/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

export const loginCustomer = (data) =>
  request("/customer/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

// ── Customer Plans ────────────────────────────────────────────────
export const fetchCustomerPlans = () => request("/customer/plans");

// ── Customer Orders ───────────────────────────────────────────────
export const createCustomerOrder = (data) =>
  request("/customer/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

export const getCustomerOrders = (customerId) =>
  request(`/customer/${customerId}/orders`);

// ── Customer Policies ─────────────────────────────────────────────
export const getCustomerPolicies = (customerId) =>
  request(`/customer/${customerId}/policies`);

// ── Customer Claims ───────────────────────────────────────────────
export const submitCustomerClaim = (formData) =>
  request("/customer/claims/submit", { method: "POST", body: formData });

export const getCustomerClaims = (customerId) =>
  request(`/customer/${customerId}/claims`);

// ── Admin: Customer ───────────────────────────────────────────────
export const adminFetchCustomerPolicies = () => request("/admin/customer-policies");
export const adminFetchCustomerClaims = () => request("/admin/customer-claims");

export const adminReviewCustomerClaim = (id, status, reason, approved_amount) =>
  request(`/admin/customer-claims/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, admin_reason: reason, approved_amount }),
  });

// ── Admin Stats ───────────────────────────────────────────────────
export const fetchAdminStats = () => request("/admin/stats");

// ── Kitchen Owner Auth & Dashboard ────────────────────────────────
export const registerKitchenOwner = (data) =>
  request("/kitchen/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

export const loginKitchenOwner = (data) =>
  request("/kitchen/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

export const getKitchenOwners = () => request("/kitchen/owners");

export const getKitchenApplications = (ownerId) =>
  request(`/kitchen/${ownerId}/applications`);

export const getKitchenPolicies = (ownerId) =>
  request(`/kitchen/${ownerId}/policies`);

export const getKitchenClaims = (ownerId) =>
  request(`/kitchen/${ownerId}/claims`);
