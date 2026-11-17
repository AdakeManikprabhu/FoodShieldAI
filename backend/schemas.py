"""
schemas.py - Pydantic schemas for FoodShieldAI (Phase 3).
"""

from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List

# ---------- Sensor Readings ----------

class ReadingOut(BaseModel):
    id: int
    temperature: float
    timestamp: datetime
    event_type: str

    class Config:
        from_attributes = True

# ---------- Incidents ----------

class IncidentOut(BaseModel):
    id: int
    event_type: str
    description: str
    temperature: float
    risk_level: str
    timestamp: datetime

    class Config:
        from_attributes = True

# ---------- Kitchen Claims ----------

class ClaimOut(BaseModel):
    id: int
    incident_id: int
    policy_id: Optional[int] = None
    eligible: str
    payout_amount: float
    status: str
    incident_date: Optional[datetime] = None
    created_at: datetime
    spoilage_category: Optional[str] = None
    estimated_loss: Optional[float] = None
    requested_compensation: Optional[float] = None
    approved_compensation: Optional[float] = None
    evidence_path: Optional[str] = None
    admin_reason: Optional[str] = None

    class Config:
        from_attributes = True

# ---------- Dashboard ----------

class DashboardOut(BaseModel):
    current_temp: float
    risk_level: str
    total_incidents: int
    total_claims: int

# ---------- Simulation Response ----------

class SimulationResponse(BaseModel):
    """Returned after a simulation button press."""
    message: str
    dashboard: DashboardOut
    incident: Optional[IncidentOut] = None
    claim: Optional[ClaimOut] = None
    triggered: bool = False

# ---------- Insurance Plans (Kitchen & Customer) ----------

class InsurancePlanOut(BaseModel):
    id: int
    plan_type: Optional[str] = "kitchen"
    name: str
    coverage_amount: float
    monthly_premium: float
    benefits: Optional[str] = None
    exclusions: Optional[str] = None

    class Config:
        from_attributes = True

# ---------- Kitchen Policy Application ----------

class PolicyApplicationCreate(BaseModel):
    kitchen_name: str
    owner_name: str
    contact_info: str
    address: str
    storage_value: float
    plan_id: int
    requested_coverage: float
    refrigerator_details: Optional[str] = None
    duration_days: Optional[int] = 30
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    terms_accepted: Optional[bool] = None
    terms_version: Optional[str] = "v1.0"

class PolicyApplicationOut(BaseModel):
    id: int
    kitchen_name: str
    owner_name: str
    contact_info: str
    address: str
    storage_value: float
    plan_id: int
    requested_coverage: float
    refrigerator_details: Optional[str] = None
    duration_days: Optional[int] = 30
    calculated_premium: Optional[float] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    terms_version: Optional[str] = "v1.0"
    terms_accepted_at: Optional[datetime] = None
    status: str
    admin_reason: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

# ---------- Kitchen Policy ----------

class PolicyOut(BaseModel):
    id: int
    application_id: int
    plan_id: int
    kitchen_name: str
    start_date: datetime
    expiry_date: datetime
    duration_days: Optional[int] = 30
    total_premium: Optional[float] = None
    terms_version: Optional[str] = "v1.0"
    terms_accepted_at: Optional[datetime] = None
    status: str
    coverage_amount: float
    monthly_premium: float

    class Config:
        from_attributes = True

# ---------- Kitchen Claim Submission & Review ----------

class ClaimSubmissionCreate(BaseModel):
    incident_id: int
    policy_id: int
    spoilage_category: str
    estimated_loss: float
    requested_compensation: float

class ClaimReviewPayload(BaseModel):
    status: str
    admin_reason: Optional[str] = None
    approved_compensation: Optional[float] = None


# ═══════════════════════════════════════════════════════════════════════
# Phase 3: Customer Models & Schemas
# ═══════════════════════════════════════════════════════════════════════

# ---------- Customer Auth & Profile ----------

class CustomerRegister(BaseModel):
    name: str
    email: str
    phone: Optional[str] = None
    password: str
    address: Optional[str] = None

class CustomerLogin(BaseModel):
    email: str
    password: str

class CustomerOut(BaseModel):
    id: int
    name: str
    email: str
    phone: Optional[str] = None
    address: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

# ---------- Customer Orders ----------

class CustomerOrderCreate(BaseModel):
    customer_id: int
    restaurant_name: str
    items_summary: str
    order_amount: float
    plan_id: Optional[int] = None       # Customer insurance plan ID
    terms_accepted: Optional[bool] = False
    terms_version: Optional[str] = "v1.0"

class CustomerOrderOut(BaseModel):
    id: int
    order_number: str
    customer_id: int
    restaurant_name: str
    items_summary: str
    order_amount: float
    has_insurance: bool
    plan_id: Optional[int] = None
    terms_accepted: Optional[bool] = False
    terms_version: Optional[str] = None
    order_status: str
    created_at: datetime

    class Config:
        from_attributes = True

# ---------- Customer Policies ----------

class CustomerPolicyOut(BaseModel):
    id: int
    policy_number: str
    customer_id: int
    order_id: int
    plan_id: int
    premium_paid: float
    max_coverage: float
    terms_version: Optional[str] = "v1.0"
    terms_accepted_at: Optional[datetime] = None
    coverage_start: Optional[datetime] = None
    coverage_end: Optional[datetime] = None
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

# ---------- Customer Claims ----------

class CustomerClaimCreate(BaseModel):
    customer_id: int
    order_id: int
    claim_reason: str                  # Spoiled food | Damaged food | Excessive delivery delay
    description: Optional[str] = None
    requested_amount: float
    incident_date: Optional[datetime] = None
    delay_minutes: Optional[int] = None

class CustomerClaimOut(BaseModel):
    id: int
    claim_number: str
    customer_id: int
    order_id: int
    policy_id: int
    claim_reason: str
    description: Optional[str] = None
    requested_amount: float
    approved_amount: float
    incident_date: Optional[datetime] = None
    delay_minutes: Optional[int] = None
    evidence_path: Optional[str] = None
    status: str
    admin_reason: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class CustomerClaimReviewPayload(BaseModel):
    status: str                        # Pending | Under Review | Approved | Rejected | Paid
    admin_reason: Optional[str] = None
    approved_amount: Optional[float] = None

# ---------- Kitchen Owner Auth & Profile ----------

class KitchenOwnerRegister(BaseModel):
    name: str
    email: str
    phone: Optional[str] = None
    kitchen_name: str
    address: Optional[str] = None
    password: Optional[str] = "demo"

class KitchenOwnerLogin(BaseModel):
    email: str
    password: str

class KitchenOwnerOut(BaseModel):
    id: int
    name: str
    email: str
    phone: Optional[str] = None
    kitchen_name: str
    address: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

# ---------- Admin Overall Stats ----------

class AdminStatsOut(BaseModel):
    total_customers: int
    total_kitchen_owners: int
    total_kitchen_applications: int
    pending_kitchen_applications: int
    active_kitchen_policies: int
    total_kitchen_claims: int
    pending_kitchen_claims: int
    total_customer_policies: int
    active_customer_policies: int
    total_customer_claims: int
    pending_customer_claims: int
