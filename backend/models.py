"""
models.py - SQLAlchemy table definitions for FoodShieldAI (Phase 3).

Tables:
  1. kitchen_owners          - registered kitchen owners
  2. customers               - registered food delivery customers
  3. insurance_plans         - insurance plans for kitchens and customers
  4. policy_applications     - kitchen owner policy applications
  5. policies                - active kitchen insurance policies
  6. customer_orders         - customer food orders with optional protection
  7. customer_policies       - active insurance policies on customer orders
  8. sensor_readings         - IoT temperature readings
  9. incidents               - temperature excursions and power outages
 10. claims                  - kitchen insurance claims
 11. customer_claims         - customer order protection claims
"""

from sqlalchemy import Column, Integer, Float, String, DateTime, ForeignKey, Boolean
from datetime import datetime, timezone
from database import Base


# ── 1. Kitchen Owners ─────────────────────────────────────────────────

class KitchenOwner(Base):
    """Registered cloud kitchen owners."""
    __tablename__ = "kitchen_owners"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, nullable=False, unique=True, index=True)
    phone = Column(String, nullable=True)
    kitchen_name = Column(String, nullable=False)
    address = Column(String, nullable=True)
    password = Column(String, nullable=False, default="demo")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


# ── 2. Customers ──────────────────────────────────────────────────────

class Customer(Base):
    """Registered food delivery customers."""
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, nullable=False, unique=True, index=True)
    phone = Column(String, nullable=True)
    password = Column(String, nullable=False)
    address = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


# ── 3. Sensor Readings & Incidents ────────────────────────────────────

class SensorReading(Base):
    """Stores every simulated temperature reading."""
    __tablename__ = "sensor_readings"

    id = Column(Integer, primary_key=True, index=True)
    temperature = Column(Float, nullable=False)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    event_type = Column(String, default="normal")   # normal | excursion | power_outage


class Incident(Base):
    """Logs each notable event (excursion or power outage)."""
    __tablename__ = "incidents"

    id = Column(Integer, primary_key=True, index=True)
    event_type = Column(String, nullable=False)     # excursion | power_outage
    description = Column(String, nullable=False)
    temperature = Column(Float, nullable=False)
    risk_level = Column(String, nullable=False)     # Low | Medium | High
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))


# ── 4. Insurance Plans (Kitchen & Customer) ───────────────────────────

class InsurancePlan(Base):
    """Demonstration insurance plans for kitchens and customers."""
    __tablename__ = "insurance_plans"

    id = Column(Integer, primary_key=True, index=True)
    plan_type = Column(String, default="kitchen")     # kitchen | customer
    name = Column(String, nullable=False)             # Basic | Standard | Premium
    coverage_amount = Column(Float, nullable=False)   # in INR (max compensation)
    monthly_premium = Column(Float, nullable=False)   # in INR (for kitchen monthly, for customer per-order fee)
    benefits = Column(String, nullable=True)
    exclusions = Column(String, nullable=True)


# ── 5. Kitchen Policy Applications & Active Policies ──────────────────

class PolicyApplication(Base):
    """Kitchen owner's request to obtain an insurance policy."""
    __tablename__ = "policy_applications"

    id = Column(Integer, primary_key=True, index=True)
    kitchen_name = Column(String, nullable=False)
    owner_name = Column(String, nullable=False)
    contact_info = Column(String, nullable=False)
    address = Column(String, nullable=False)
    storage_value = Column(Float, nullable=False)
    plan_id = Column(Integer, ForeignKey("insurance_plans.id"), nullable=False)
    requested_coverage = Column(Float, nullable=False)
    refrigerator_details = Column(String, nullable=True)
    duration_days = Column(Integer, default=30)
    calculated_premium = Column(Float, nullable=True)
    start_date = Column(DateTime, nullable=True)
    end_date = Column(DateTime, nullable=True)
    terms_version = Column(String, default="v1.0")
    terms_accepted_at = Column(DateTime, nullable=True)
    status = Column(String, default="Pending")          # Pending | Approved | Rejected
    admin_reason = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class Policy(Base):
    """Approved and active insurance policy for a kitchen."""
    __tablename__ = "policies"

    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(Integer, ForeignKey("policy_applications.id"), nullable=False, unique=True)
    plan_id = Column(Integer, ForeignKey("insurance_plans.id"), nullable=False)
    kitchen_name = Column(String, nullable=False)
    start_date = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    expiry_date = Column(DateTime, nullable=False)
    duration_days = Column(Integer, default=30)
    total_premium = Column(Float, nullable=True)
    status = Column(String, default="Active")           # Active | Expired | Cancelled
    coverage_amount = Column(Float, nullable=False)
    monthly_premium = Column(Float, nullable=False)
    terms_version = Column(String, default="v1.0")
    terms_accepted_at = Column(DateTime, nullable=True)


# ── 6. Kitchen Claims ─────────────────────────────────────────────────

class Claim(Base):
    """Insurance claims for cloud kitchens."""
    __tablename__ = "claims"

    id = Column(Integer, primary_key=True, index=True)
    incident_id = Column(Integer, ForeignKey("incidents.id"), nullable=False)
    policy_id = Column(Integer, ForeignKey("policies.id"), nullable=True)
    eligible = Column(String, default="Pending Review")
    payout_amount = Column(Float, default=0.0)
    status = Column(String, default="Pending")          # Pending | Under Review | Approved | Rejected | Paid
    incident_date = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    spoilage_category = Column(String, nullable=True)
    estimated_loss = Column(Float, nullable=True)
    requested_compensation = Column(Float, nullable=True)
    approved_compensation = Column(Float, nullable=True)
    evidence_path = Column(String, nullable=True)
    admin_reason = Column(String, nullable=True)


# ── 7. Customer Orders & Customer Policies ────────────────────────────

class CustomerOrder(Base):
    """Orders placed by food delivery customers."""
    __tablename__ = "customer_orders"

    id = Column(Integer, primary_key=True, index=True)
    order_number = Column(String, unique=True, nullable=False, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    restaurant_name = Column(String, nullable=False)
    items_summary = Column(String, nullable=False)
    order_amount = Column(Float, nullable=False)
    has_insurance = Column(Boolean, default=False)
    plan_id = Column(Integer, ForeignKey("insurance_plans.id"), nullable=True)
    terms_accepted = Column(Boolean, default=False)
    terms_version = Column(String, nullable=True)
    order_status = Column(String, default="Delivered")  # Delivered | In Transit | Delayed
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class CustomerPolicy(Base):
    """Active per-order insurance policy for customer orders."""
    __tablename__ = "customer_policies"

    id = Column(Integer, primary_key=True, index=True)
    policy_number = Column(String, unique=True, nullable=False, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    order_id = Column(Integer, ForeignKey("customer_orders.id"), nullable=False)
    plan_id = Column(Integer, ForeignKey("insurance_plans.id"), nullable=False)
    premium_paid = Column(Float, nullable=False)        # ₹9 / ₹19 / ₹29
    max_coverage = Column(Float, nullable=False)        # ₹200 / ₹500 / ₹1,000
    terms_version = Column(String, default="v1.0")
    terms_accepted_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    coverage_start = Column(DateTime, nullable=True)
    coverage_end = Column(DateTime, nullable=True)
    status = Column(String, default="Active")           # Active | Claimed | Expired
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


# ── 8. Customer Claims ────────────────────────────────────────────────

class CustomerClaim(Base):
    """Customer protection claims for food orders."""
    __tablename__ = "customer_claims"

    id = Column(Integer, primary_key=True, index=True)
    claim_number = Column(String, unique=True, nullable=False, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    order_id = Column(Integer, ForeignKey("customer_orders.id"), nullable=False)
    policy_id = Column(Integer, ForeignKey("customer_policies.id"), nullable=False)
    claim_reason = Column(String, nullable=False)       # Spoiled food | Damaged food | Excessive delivery delay
    description = Column(String, nullable=True)
    requested_amount = Column(Float, nullable=False)
    approved_amount = Column(Float, default=0.0)
    incident_date = Column(DateTime, nullable=True)
    delay_minutes = Column(Integer, nullable=True)
    evidence_path = Column(String, nullable=True)
    status = Column(String, default="Pending")          # Pending | Under Review | Approved | Rejected | Paid
    admin_reason = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
