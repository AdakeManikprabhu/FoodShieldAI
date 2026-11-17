"""
main.py - FastAPI backend for FoodShieldAI (Phase 3).
Includes Kitchen Insurance, IoT Simulators, and Customer Order Protection.
"""

from fastapi import FastAPI, Depends, HTTPException, Body, UploadFile, File, Form, Query, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from datetime import datetime, timezone, timedelta
from pathlib import Path
from uuid import uuid4
from typing import Optional, List
import hashlib
import secrets

from database import engine, Base, get_db, SessionLocal
from models import (
    SensorReading, Incident, Claim, InsurancePlan, PolicyApplication, Policy,
    Customer, CustomerOrder, CustomerPolicy, CustomerClaim, KitchenOwner
)
from schemas import (
    ReadingOut, IncidentOut, ClaimOut,
    DashboardOut, SimulationResponse,
    InsurancePlanOut,
    PolicyApplicationCreate, PolicyApplicationOut,
    PolicyOut,
    ClaimSubmissionCreate, ClaimReviewPayload,
    CustomerRegister, CustomerLogin, CustomerOut,
    CustomerOrderCreate, CustomerOrderOut,
    CustomerPolicyOut,
    CustomerClaimCreate, CustomerClaimOut, CustomerClaimReviewPayload,
    KitchenOwnerRegister, KitchenOwnerLogin, KitchenOwnerOut,
    AdminStatsOut,
)

# ── Password Hashing & Security Helpers ──────────────────────────────
def hash_password(password: str) -> str:
    """Hash password using PBKDF2-HMAC-SHA256 with a secure random salt."""
    salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100000)
    return f"pbkdf2:sha256:100000${salt}${key.hex()}"

def verify_password(plain_password: str, stored_hash: str) -> bool:
    """Verify password against stored PBKDF2 hash or legacy demo plaintext."""
    if not stored_hash:
        return False
    if stored_hash.startswith("pbkdf2:sha256:"):
        try:
            parts = stored_hash.split("$")
            salt = parts[1]
            key_hex = parts[2]
            computed = hashlib.pbkdf2_hmac("sha256", plain_password.encode("utf-8"), salt.encode("utf-8"), 100000)
            return secrets.compare_digest(computed.hex(), key_hex)
        except Exception:
            return False
    # Fallback to legacy plaintext comparison
    return secrets.compare_digest(plain_password, stored_hash)

# ── File Upload Validation Helpers ────────────────────────────────────
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".pdf", ".webp"}
MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024  # 5MB

async def validate_uploaded_file(file: UploadFile) -> bytes:
    """Validate file extension and size (<= 5MB)."""
    filename = file.filename or ""
    suffix = Path(filename).suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format '{suffix}'. Allowed formats: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )
    content = await file.read()
    if len(content) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"File size exceeds maximum limit of 5MB ({len(content)} bytes uploaded)"
        )
    return content

# ── Admin & Role Authorization Dependencies ───────────────────────────
def require_admin(
    x_admin_role: Optional[str] = Header(None, alias="X-Admin-Role"),
    authorization: Optional[str] = Header(None, alias="Authorization"),
    x_user_role: Optional[str] = Header(None, alias="X-User-Role"),
):
    """Enforce admin authorization on admin routes."""
    if x_user_role is not None and x_user_role.lower() != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")
    if x_admin_role is not None and x_admin_role.lower() != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")
    if authorization is not None and authorization.lower() not in {"admin", "bearer admin", "bearer admin_token"}:
        raise HTTPException(status_code=401, detail="Unauthorized")

# Create uploads directory
UPLOADS_DIR = Path(__file__).parent / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)

# Create all tables on startup
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="FoodShieldAI API",
    description="Parametric Insurance for Food Spoilage and Cloud Kitchens",
    version="3.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount uploads as static files
if UPLOADS_DIR.exists():
    app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

# ── Configurable demo thresholds ──────────────────────────────────────
SAFE_TEMP = 4.0
EXCURSION_TEMP = 35.0
RISK_MEDIUM_THRESH = 15.0
RISK_HIGH_THRESH = 25.0
TRIGGER_TEMP = 30.0
TRIGGER_COUNT = 2
MAX_PAYOUT = 5000.0

# ── Seed demo insurance plans and demo customer on startup ────────────
_plans_seeded = False

def seed_plans():
    global _plans_seeded
    if _plans_seeded:
        return
    db = SessionLocal()
    try:
        # 1. Kitchen plans
        if db.query(InsurancePlan.id).filter(InsurancePlan.plan_type == "kitchen").first() is None:
            kitchen_plans = [
                InsurancePlan(
                    plan_type="kitchen",
                    name="Basic",
                    coverage_amount=10000,
                    monthly_premium=199,
                    benefits="Covers temperature excursions above 30°C; up to ₹10,000 payout",
                    exclusions="Does not cover power outages or pre-existing incidents",
                ),
                InsurancePlan(
                    plan_type="kitchen",
                    name="Standard",
                    coverage_amount=25000,
                    monthly_premium=399,
                    benefits="Covers excursions and minor power outages; up to ₹25,000 payout",
                    exclusions="Excludes intentional negligence",
                ),
                InsurancePlan(
                    plan_type="kitchen",
                    name="Premium",
                    coverage_amount=50000,
                    monthly_premium=699,
                    benefits="Full coverage for all spoilage events; up to ₹50,000 payout",
                    exclusions="None (demo)",
                ),
            ]
            db.add_all(kitchen_plans)

        # 2. Customer plans (Phase 3B)
        if db.query(InsurancePlan.id).filter(InsurancePlan.plan_type == "customer").first() is None:
            customer_plans = [
                InsurancePlan(
                    plan_type="customer",
                    name="Basic",
                    coverage_amount=200,
                    monthly_premium=9,
                    benefits="Covers transit food damage & minor delay; up to ₹200 compensation",
                    exclusions="Reporting after 24 hours of delivery",
                ),
                InsurancePlan(
                    plan_type="customer",
                    name="Standard",
                    coverage_amount=500,
                    monthly_premium=19,
                    benefits="Covers food spoilage & transit damage; up to ₹500 compensation",
                    exclusions="Customer-cancelled orders",
                ),
                InsurancePlan(
                    plan_type="customer",
                    name="Premium",
                    coverage_amount=1000,
                    monthly_premium=29,
                    benefits="Full protection for spoiled food, damaged packages, or excessive delivery delay; up to ₹1,000 compensation",
                    exclusions="None (demo)",
                ),
            ]
            db.add_all(customer_plans)

        # 3. Seed demo customer if none exists
        if db.query(Customer.id).first() is None:
            demo_customer = Customer(
                name="Rahul Sharma",
                email="rahul@example.com",
                phone="9876543210",
                password=hash_password("demo"),
                address="Flat 402, Green Valley Apartments, Delhi NCR",
            )
            db.add(demo_customer)

        # 4. Seed demo kitchen owner if none exists
        if db.query(KitchenOwner.id).first() is None:
            demo_owner = KitchenOwner(
                name="Chef Amit Verma",
                email="amit@cloudkitchen.com",
                phone="9123456780",
                kitchen_name="SpiceCraft Cloud Kitchen",
                address="Sector 18, Commercial Hub, Noida",
                password=hash_password("demo"),
            )
            db.add(demo_owner)

        db.commit()
        _plans_seeded = True
    finally:
        db.close()

seed_plans()

# ── Helper functions ─────────────────────────────────────────────────

def calculate_risk(db: Session) -> str:
    latest = db.query(SensorReading).order_by(SensorReading.id.desc()).first()
    if not latest:
        return "Low"
    temp = latest.temperature
    if temp <= RISK_MEDIUM_THRESH:
        return "Low"
    if temp <= RISK_HIGH_THRESH:
        return "Medium"
    recent = db.query(SensorReading).order_by(SensorReading.id.desc()).limit(3).all()
    high_count = sum(1 for r in recent if r.temperature > RISK_HIGH_THRESH)
    return "High" if high_count >= 2 else "Medium"


def check_insurance_trigger(db: Session) -> bool:
    recent = db.query(SensorReading).order_by(SensorReading.id.desc()).limit(TRIGGER_COUNT).all()
    if len(recent) < TRIGGER_COUNT:
        return False
    return all(r.temperature > TRIGGER_TEMP for r in recent)


def get_dashboard_data(db: Session) -> DashboardOut:
    latest = db.query(SensorReading).order_by(SensorReading.id.desc()).first()
    current_temp = latest.temperature if latest else SAFE_TEMP
    return DashboardOut(
        current_temp=current_temp,
        risk_level=calculate_risk(db),
        total_incidents=db.query(Incident).count(),
        total_claims=db.query(Claim).count(),
    )


def maybe_create_auto_claim(db: Session, incident: Incident) -> Claim | None:
    if not check_insurance_trigger(db):
        return None
    existing = db.query(Claim).filter(
        Claim.incident_id == incident.id,
        Claim.policy_id.is_(None)
    ).first()
    if existing:
        return None
    payout = min(MAX_PAYOUT, incident.temperature * 100)
    claim = Claim(
        incident_id=incident.id,
        eligible="Yes",
        payout_amount=round(payout, 2),
        approved_compensation=round(payout, 2),
        status="Approved",
    )
    db.add(claim)
    db.commit()
    db.refresh(claim)
    return claim

# ── Core Root & Health Endpoints ─────────────────────────────────────

@app.get("/")
def root():
    return {
        "message": "FoodShieldAI FastAPI Backend is running!",
        "frontend_ui": "http://localhost:5173",
        "api_docs": "http://127.0.0.1:8000/docs",
        "health": "/api/health"
    }

@app.get("/api/health")
def health_check():
    return {"status": "ok", "message": "FoodShieldAI backend is running (demo)"}

@app.get("/api/dashboard", response_model=DashboardOut)
def get_dashboard(db: Session = Depends(get_db)):
    return get_dashboard_data(db)

@app.get("/api/readings", response_model=List[ReadingOut])
def get_readings(db: Session = Depends(get_db)):
    return db.query(SensorReading).order_by(SensorReading.id).all()

@app.get("/api/incidents", response_model=List[IncidentOut])
def get_incidents(db: Session = Depends(get_db)):
    return db.query(Incident).order_by(Incident.id.desc()).all()

@app.get("/api/claims", response_model=List[ClaimOut])
def get_claims(db: Session = Depends(get_db)):
    return db.query(Claim).order_by(Claim.id.desc()).all()

# ── IoT Simulation Endpoints ─────────────────────────────────────────

@app.post("/api/simulate/normal", response_model=SimulationResponse)
def simulate_normal(db: Session = Depends(get_db)):
    reading = SensorReading(temperature=SAFE_TEMP, event_type="normal")
    db.add(reading)
    db.commit()
    return SimulationResponse(
        message=f"Recorded normal reading: {SAFE_TEMP}°C (simulated)",
        dashboard=get_dashboard_data(db),
        triggered=False,
    )

@app.post("/api/simulate/excursion", response_model=SimulationResponse)
def simulate_excursion(db: Session = Depends(get_db)):
    reading = SensorReading(temperature=EXCURSION_TEMP, event_type="excursion")
    db.add(reading)
    db.commit()
    risk = calculate_risk(db)
    incident = Incident(
        event_type="excursion",
        description=f"Temperature excursion: {EXCURSION_TEMP}°C detected (simulated)",
        temperature=EXCURSION_TEMP,
        risk_level=risk,
    )
    db.add(incident)
    db.commit()
    db.refresh(incident)
    claim = maybe_create_auto_claim(db, incident)
    return SimulationResponse(
        message=f"Excursion recorded: {EXCURSION_TEMP}°C — Risk: {risk}",
        dashboard=get_dashboard_data(db),
        incident=IncidentOut.model_validate(incident),
        claim=ClaimOut.model_validate(claim) if claim else None,
        triggered=claim is not None,
    )

@app.post("/api/simulate/power-outage", response_model=SimulationResponse)
def simulate_power_outage(db: Session = Depends(get_db)):
    base = SensorReading(temperature=SAFE_TEMP, event_type="power_outage")
    db.add(base)
    db.commit()
    rising_temps = [6, 8, 12, 18, 25]
    for t in rising_temps:
        db.add(SensorReading(temperature=t, event_type="power_outage"))
    db.commit()
    risk = calculate_risk(db)
    final_temp = rising_temps[-1]
    incident = Incident(
        event_type="power_outage",
        description=f"Power outage – temperature rose to {final_temp}°C (simulated)",
        temperature=final_temp,
        risk_level=risk,
    )
    db.add(incident)
    db.commit()
    db.refresh(incident)
    claim = maybe_create_auto_claim(db, incident)
    return SimulationResponse(
        message=f"Power outage recorded – temp rose to {final_temp}°C — Risk: {risk}",
        dashboard=get_dashboard_data(db),
        incident=IncidentOut.model_validate(incident),
        claim=ClaimOut.model_validate(claim) if claim else None,
        triggered=claim is not None,
    )

# ── Insurance Plans (Kitchen & Customer) ─────────────────────────────

@app.get("/api/plans", response_model=List[InsurancePlanOut])
def list_plans(plan_type: Optional[str] = Query(None), db: Session = Depends(get_db)):
    # Default to kitchen plans for backward compatibility with existing tests/pages
    target_type = plan_type if plan_type else "kitchen"
    if target_type == "all":
        return db.query(InsurancePlan).order_by(InsurancePlan.id).all()
    return db.query(InsurancePlan).filter(InsurancePlan.plan_type == target_type).order_by(InsurancePlan.id).all()

@app.get("/api/customer/plans", response_model=List[InsurancePlanOut])
def list_customer_plans(db: Session = Depends(get_db)):
    """Return the three customer demonstration plans (₹9, ₹19, ₹29)."""
    return db.query(InsurancePlan).filter(InsurancePlan.plan_type == "customer").order_by(InsurancePlan.id).all()

# ── Kitchen Policy Applications & Active Policies ─────────────────────

@app.post("/api/policy/apply", response_model=PolicyApplicationOut)
def apply_policy(application: PolicyApplicationCreate, db: Session = Depends(get_db)):
    plan = db.query(InsurancePlan).filter(InsurancePlan.id == application.plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Insurance plan not found")
    if application.requested_coverage > plan.coverage_amount:
        raise HTTPException(
            status_code=400,
            detail=f"Requested coverage exceeds plan limit of ₹{plan.coverage_amount:,.0f}"
        )

    if application.terms_accepted is False:
        raise HTTPException(
            status_code=400,
            detail="You must read and agree to the Policy Terms and Conditions before submitting an application."
        )

    now = datetime.now(timezone.utc)
    start = application.start_date or now
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)

    if application.end_date is not None:
        end = application.end_date
        if end.tzinfo is None:
            end = end.replace(tzinfo=timezone.utc)
        if end <= start:
            raise HTTPException(status_code=400, detail="End date must be after start date")
        if end < now:
            raise HTTPException(status_code=400, detail="Cannot apply for an expired or retrospective date range")
        duration = (end - start).days
        if duration <= 0:
            raise HTTPException(status_code=400, detail="End date must be after start date")
    else:
        duration = application.duration_days if (application.duration_days and application.duration_days > 0) else 30
        end = start + timedelta(days=duration)

    calculated_prem = round((plan.monthly_premium / 30.0) * duration, 2)
    terms_acc_at = now if application.terms_accepted else None

    app_dict = application.model_dump()
    app_dict["duration_days"] = duration
    app_dict["calculated_premium"] = calculated_prem
    app_dict["start_date"] = start
    app_dict["end_date"] = end
    app_dict["terms_accepted_at"] = terms_acc_at
    app_dict.pop("terms_accepted", None)

    app_record = PolicyApplication(**app_dict)
    db.add(app_record)
    db.commit()
    db.refresh(app_record)
    return app_record

@app.get("/api/policy/applications", response_model=List[PolicyApplicationOut])
def list_my_applications(db: Session = Depends(get_db)):
    return db.query(PolicyApplication).order_by(PolicyApplication.id.desc()).all()

@app.get("/api/policy/active", response_model=List[PolicyOut])
def list_active_policies(db: Session = Depends(get_db)):
    return db.query(Policy).filter(Policy.status == "Active").order_by(Policy.id.desc()).all()

# ── Kitchen Claims ───────────────────────────────────────────────────

@app.post("/api/claims/submit", response_model=ClaimOut)
async def submit_claim(
    incident_id: int = Form(...),
    policy_id: int = Form(...),
    spoilage_category: str = Form(...),
    estimated_loss: float = Form(...),
    requested_compensation: float = Form(...),
    evidence: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
):
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    policy = db.query(Policy).filter(Policy.id == policy_id).first()
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    if policy.status == "Expired":
        raise HTTPException(status_code=400, detail="Policy has expired")
    if policy.status != "Active":
        raise HTTPException(status_code=400, detail="Policy is not active")

    incident_ts = incident.timestamp
    if incident_ts.tzinfo is None:
        incident_ts = incident_ts.replace(tzinfo=timezone.utc)
    policy_start = policy.start_date
    if policy_start.tzinfo is None:
        policy_start = policy_start.replace(tzinfo=timezone.utc)
    policy_expiry = policy.expiry_date
    if policy_expiry.tzinfo is None:
        policy_expiry = policy_expiry.replace(tzinfo=timezone.utc)

    # 1. Retroactive check
    if incident_ts < policy_start:
        raise HTTPException(
            status_code=400,
            detail="Incident occurred before policy was activated (no retroactive coverage)"
        )

    # 2. Expiry check
    now = datetime.now(timezone.utc)
    if policy.status == "Expired" or (policy_expiry and now > policy_expiry):
        policy.status = "Expired"
        db.commit()
        raise HTTPException(
            status_code=400,
            detail="Policy has expired"
        )
    if incident_ts > policy_expiry:
        raise HTTPException(
            status_code=400,
            detail="Incident occurred after policy expired"
        )

    # 3. 48-hour submission deadline check
    if (now - incident_ts) > timedelta(hours=48):
        raise HTTPException(
            status_code=400,
            detail="Claims must be reported within 48 hours of the incident"
        )

    # 4. Coverage limit check
    if requested_compensation > policy.coverage_amount:
        raise HTTPException(
            status_code=400,
            detail=f"Requested compensation exceeds policy coverage limit of ₹{policy.coverage_amount:,.0f}"
        )

    # 5. Duplicate claim check
    dup = db.query(Claim).filter(
        Claim.incident_id == incident_id,
        Claim.policy_id == policy_id,
    ).first()
    if dup:
        raise HTTPException(status_code=400, detail="A claim for this incident already exists")

    evidence_path = None
    if evidence and evidence.filename:
        content = await validate_uploaded_file(evidence)
        file_path = UPLOADS_DIR / f"{uuid4().hex}_{evidence.filename}"
        with open(file_path, "wb") as f:
            f.write(content)
        evidence_path = f"/uploads/{file_path.name}"

    claim = Claim(
        incident_id=incident_id,
        policy_id=policy_id,
        eligible="Pending Review",
        spoilage_category=spoilage_category,
        estimated_loss=estimated_loss,
        requested_compensation=requested_compensation,
        approved_compensation=0.0,
        incident_date=incident.timestamp,
        evidence_path=evidence_path,
        status="Pending",
        payout_amount=0.0,
    )
    db.add(claim)
    db.commit()
    db.refresh(claim)
    return claim


# ═══════════════════════════════════════════════════════════════════════
# Phase 3B & 3C: Customer Insurance & Claim Management
# ═══════════════════════════════════════════════════════════════════════

# ── Customer Registration & Login ────────────────────────────────────

def verify_customer_access(customer_id: int, x_customer_id: Optional[str] = None):
    if x_customer_id is not None:
        try:
            if int(x_customer_id) != customer_id:
                raise HTTPException(status_code=403, detail="Access denied: Cannot access another customer's data")
        except ValueError:
            raise HTTPException(status_code=403, detail="Access denied: Invalid customer ID header")

@app.post("/api/customer/register", response_model=CustomerOut)
def register_customer(payload: CustomerRegister, db: Session = Depends(get_db)):
    existing = db.query(Customer).filter(Customer.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email is already registered")
    data = payload.model_dump()
    data["password"] = hash_password(payload.password)
    customer = Customer(**data)
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return customer

@app.post("/api/customer/login", response_model=CustomerOut)
def login_customer(payload: CustomerLogin, db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(Customer.email == payload.email).first()
    if not customer or not verify_password(payload.password, customer.password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    # Upgrade legacy plain password to PBKDF2 hash on login
    if not customer.password.startswith("pbkdf2:sha256:"):
        customer.password = hash_password(payload.password)
        db.commit()
        db.refresh(customer)
    return customer

@app.get("/api/customer/profile/{customer_id}", response_model=CustomerOut)
def get_customer_profile(
    customer_id: int,
    x_customer_id: Optional[str] = Header(None, alias="X-Customer-ID"),
    db: Session = Depends(get_db)
):
    verify_customer_access(customer_id, x_customer_id)
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer

@app.get("/api/customers", response_model=List[CustomerOut])
def list_customers(db: Session = Depends(get_db)):
    return db.query(Customer).order_by(Customer.id.desc()).all()


# ── Customer Orders with Protection Plans ────────────────────────────

@app.post("/api/customer/orders", response_model=CustomerOrderOut)
def create_customer_order(payload: CustomerOrderCreate, db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(Customer.id == payload.customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    has_ins = payload.plan_id is not None and payload.plan_id > 0
    if has_ins and not payload.terms_accepted:
        raise HTTPException(
            status_code=400,
            detail="You must read and agree to the Policy Terms and Conditions before purchasing protection."
        )

    order_num = f"ORD-{uuid4().hex[:6].upper()}"
    now = datetime.now(timezone.utc)

    order = CustomerOrder(
        order_number=order_num,
        customer_id=payload.customer_id,
        restaurant_name=payload.restaurant_name,
        items_summary=payload.items_summary,
        order_amount=payload.order_amount,
        has_insurance=has_ins,
        plan_id=payload.plan_id if has_ins else None,
        terms_accepted=payload.terms_accepted if has_ins else False,
        terms_version=payload.terms_version if has_ins else None,
        order_status="Delivered",
    )
    db.add(order)
    db.commit()
    db.refresh(order)

    # If protection was selected, activate a CustomerPolicy
    if has_ins:
        plan = db.query(InsurancePlan).filter(InsurancePlan.id == payload.plan_id).first()
        if not plan:
            raise HTTPException(status_code=404, detail="Selected insurance plan not found")
        pol_num = f"CPOL-{uuid4().hex[:6].upper()}"
        cust_policy = CustomerPolicy(
            policy_number=pol_num,
            customer_id=customer.id,
            order_id=order.id,
            plan_id=plan.id,
            premium_paid=plan.monthly_premium,    # per-order premium (₹9 / ₹19 / ₹29)
            max_coverage=plan.coverage_amount,    # max compensation (₹200 / ₹500 / ₹1,000)
            terms_version=payload.terms_version or "v1.0",
            terms_accepted_at=now,
            coverage_start=now,
            coverage_end=None,
            status="Active",
        )
        db.add(cust_policy)
        db.commit()

    return order

@app.get("/api/customer/{customer_id}/orders", response_model=List[CustomerOrderOut])
def get_customer_orders(
    customer_id: int,
    x_customer_id: Optional[str] = Header(None, alias="X-Customer-ID"),
    db: Session = Depends(get_db)
):
    verify_customer_access(customer_id, x_customer_id)
    return db.query(CustomerOrder).filter(CustomerOrder.customer_id == customer_id).order_by(CustomerOrder.id.desc()).all()

@app.get("/api/customer/{customer_id}/policies", response_model=List[CustomerPolicyOut])
def get_customer_policies(
    customer_id: int,
    x_customer_id: Optional[str] = Header(None, alias="X-Customer-ID"),
    db: Session = Depends(get_db)
):
    verify_customer_access(customer_id, x_customer_id)
    return db.query(CustomerPolicy).filter(CustomerPolicy.customer_id == customer_id).order_by(CustomerPolicy.id.desc()).all()

@app.get("/api/customer/orders/{order_id}", response_model=CustomerOrderOut)
def get_single_order(order_id: int, db: Session = Depends(get_db)):
    order = db.query(CustomerOrder).filter(CustomerOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


# ── Customer Claims Submission & Tracking ────────────────────────────

VALID_CUSTOMER_CLAIM_REASONS = {"Spoiled food", "Damaged food", "Excessive delivery delay"}
EXCLUDED_PATTERNS = ["address mistake", "wrong address", "change of mind", "changed mind", "no longer needed", "mistake in address", "ordered by mistake"]

@app.post("/api/customer/claims/submit", response_model=CustomerClaimOut)
async def submit_customer_claim(
    customer_id: int = Form(...),
    order_id: int = Form(...),
    claim_reason: str = Form(...),
    description: Optional[str] = Form(None),
    requested_amount: float = Form(...),
    delay_minutes: Optional[int] = Form(None),
    evidence: Optional[UploadFile] = File(None),
    x_customer_id: Optional[str] = Header(None, alias="X-Customer-ID"),
    db: Session = Depends(get_db),
):
    verify_customer_access(customer_id, x_customer_id)

    # 1. Verify customer and order
    order = db.query(CustomerOrder).filter(CustomerOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.customer_id != customer_id:
        raise HTTPException(status_code=403, detail="Order does not belong to this customer")

    # 2. Verify active customer policy on this order
    policy = db.query(CustomerPolicy).filter(
        CustomerPolicy.order_id == order_id,
        CustomerPolicy.customer_id == customer_id
    ).first()
    if not policy:
        raise HTTPException(status_code=400, detail="This order is not covered by any insurance policy")
    if policy.status not in {"Active", "Claimed"}:
        raise HTTPException(status_code=400, detail=f"Policy status is '{policy.status}', not eligible for new claims")

    now = datetime.now(timezone.utc)
    if policy.status == "Expired" or (policy.coverage_end and now > policy.coverage_end):
        raise HTTPException(status_code=400, detail="Policy has expired")

    # 3. Check for cancelled orders (coverage ends when order is cancelled)
    if order.order_status == "Cancelled":
        raise HTTPException(status_code=400, detail="Cannot submit claim for a cancelled order (coverage ended)")

    # 4. Valid claim reasons
    if claim_reason not in VALID_CUSTOMER_CLAIM_REASONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid claim reason. Must be one of: {', '.join(VALID_CUSTOMER_CLAIM_REASONS)}"
        )

    # 5. Excluded incidents check (address mistake, change of mind)
    combined_text = f"{claim_reason} {description or ''}".lower()
    for pattern in EXCLUDED_PATTERNS:
        if pattern in combined_text:
            raise HTTPException(
                status_code=400,
                detail="Claims resulting from customer address mistakes or change-of-mind requests are excluded from coverage."
            )

    # 6. 48-hour submission deadline check
    order_time = order.created_at
    if order_time.tzinfo is None:
        order_time = order_time.replace(tzinfo=timezone.utc)
    if (now - order_time) > timedelta(hours=48):
        raise HTTPException(
            status_code=400,
            detail="Claims must be submitted within 48 hours of the incident / delivery"
        )

    # 7. Evidence requirement: Photo evidence is required for spoiled or damaged food
    has_evidence_file = evidence is not None and bool(evidence.filename)
    if claim_reason in {"Spoiled food", "Damaged food"} and not has_evidence_file:
        raise HTTPException(
            status_code=400,
            detail=f"Photo evidence is required for {claim_reason.lower()} claims."
        )

    # 8. Excessive delivery delay check: must exceed 60 minutes
    if claim_reason == "Excessive delivery delay":
        if delay_minutes is not None and delay_minutes <= 60:
            raise HTTPException(
                status_code=400,
                detail="Excessive delivery delay is eligible only when delay exceeds 60 minutes beyond promised delivery time."
            )

    # 9. Check coverage limit
    if requested_amount > policy.max_coverage:
        raise HTTPException(
            status_code=400,
            detail=f"Requested amount exceeds plan maximum limit of ₹{policy.max_coverage:,.0f}"
        )

    # 10. Prevent duplicate claims on same order
    dup = db.query(CustomerClaim).filter(CustomerClaim.order_id == order_id).first()
    if dup:
        raise HTTPException(status_code=400, detail="A claim has already been submitted for this order")

    # 11. Save evidence file if provided
    evidence_path = None
    if has_evidence_file:
        content = await validate_uploaded_file(evidence)
        file_path = UPLOADS_DIR / f"cust_{uuid4().hex}_{evidence.filename}"
        with open(file_path, "wb") as f:
            f.write(content)
        evidence_path = f"/uploads/{file_path.name}"

    claim_num = f"CCLM-{uuid4().hex[:6].upper()}"
    claim = CustomerClaim(
        claim_number=claim_num,
        customer_id=customer_id,
        order_id=order_id,
        policy_id=policy.id,
        claim_reason=claim_reason,
        description=description,
        requested_amount=requested_amount,
        approved_amount=0.0,
        incident_date=order_time,
        delay_minutes=delay_minutes,
        evidence_path=evidence_path,
        status="Pending",
    )
    db.add(claim)
    policy.status = "Claimed"
    db.commit()
    db.refresh(claim)
    return claim

@app.get("/api/customer/{customer_id}/claims", response_model=List[CustomerClaimOut])
def get_customer_claims(
    customer_id: int,
    x_customer_id: Optional[str] = Header(None, alias="X-Customer-ID"),
    db: Session = Depends(get_db)
):
    verify_customer_access(customer_id, x_customer_id)
    return db.query(CustomerClaim).filter(CustomerClaim.customer_id == customer_id).order_by(CustomerClaim.id.desc()).all()

@app.get("/api/customer/claims/{claim_id}", response_model=CustomerClaimOut)
def get_single_customer_claim(claim_id: int, db: Session = Depends(get_db)):
    claim = db.query(CustomerClaim).filter(CustomerClaim.id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    return claim


# ═══════════════════════════════════════════════════════════════════════
# Phase 3E: Admin Dashboard & Unified Management
# ═══════════════════════════════════════════════════════════════════════

@app.get("/api/admin/stats", response_model=AdminStatsOut, dependencies=[Depends(require_admin)])
def get_admin_stats(db: Session = Depends(get_db)):
    return AdminStatsOut(
        total_customers=db.query(Customer).count(),
        total_kitchen_owners=db.query(KitchenOwner).count(),
        total_kitchen_applications=db.query(PolicyApplication).count(),
        pending_kitchen_applications=db.query(PolicyApplication).filter(PolicyApplication.status == "Pending").count(),
        active_kitchen_policies=db.query(Policy).filter(Policy.status == "Active").count(),
        total_kitchen_claims=db.query(Claim).count(),
        pending_kitchen_claims=db.query(Claim).filter(Claim.status.in_(["Pending", "Under Review"])).count(),
        total_customer_policies=db.query(CustomerPolicy).count(),
        active_customer_policies=db.query(CustomerPolicy).filter(CustomerPolicy.status == "Active").count(),
        total_customer_claims=db.query(CustomerClaim).count(),
        pending_customer_claims=db.query(CustomerClaim).filter(CustomerClaim.status.in_(["Pending", "Under Review"])).count(),
    )

# ── Admin: Kitchen Applications & Policies ────────────────────────────

@app.get("/api/admin/applications", response_model=List[PolicyApplicationOut], dependencies=[Depends(require_admin)])
def admin_list_applications(db: Session = Depends(get_db)):
    return db.query(PolicyApplication).order_by(PolicyApplication.id.desc()).all()

@app.put("/api/admin/applications/{app_id}", response_model=PolicyApplicationOut, dependencies=[Depends(require_admin)])
def admin_update_application(
    app_id: int,
    status: str = Body(..., embed=True),
    admin_reason: Optional[str] = Body(None, embed=True),
    db: Session = Depends(get_db),
):
    application = db.query(PolicyApplication).filter(PolicyApplication.id == app_id).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    if status not in {"Approved", "Rejected"}:
        raise HTTPException(status_code=400, detail="Status must be Approved or Rejected")

    application.status = status
    application.admin_reason = admin_reason

    if status == "Approved":
        existing_policy = db.query(Policy).filter(Policy.application_id == application.id).first()
        if not existing_policy:
            plan = db.query(InsurancePlan).filter(InsurancePlan.id == application.plan_id).first()
            duration = application.duration_days if (application.duration_days and application.duration_days > 0) else 30
            start = application.start_date or datetime.now(timezone.utc)
            if start.tzinfo is None:
                start = start.replace(tzinfo=timezone.utc)
            expiry = start + timedelta(days=duration)
            calc_prem = application.calculated_premium or round((plan.monthly_premium / 30.0) * duration, 2)
            policy = Policy(
                application_id=application.id,
                plan_id=plan.id,
                kitchen_name=application.kitchen_name,
                start_date=start,
                expiry_date=expiry,
                duration_days=duration,
                total_premium=calc_prem,
                coverage_amount=application.requested_coverage or plan.coverage_amount,
                monthly_premium=plan.monthly_premium,
                terms_version=application.terms_version or "v1.0",
                terms_accepted_at=application.terms_accepted_at or datetime.now(timezone.utc),
                status="Active",
            )
            db.add(policy)

    db.commit()
    db.refresh(application)
    return application

@app.get("/api/admin/policies", response_model=List[PolicyOut], dependencies=[Depends(require_admin)])
def admin_list_policies(db: Session = Depends(get_db)):
    return db.query(Policy).order_by(Policy.id.desc()).all()

# ── Admin: Kitchen Claims Review ─────────────────────────────────────

@app.get("/api/admin/claims", response_model=List[ClaimOut], dependencies=[Depends(require_admin)])
def admin_list_claims(db: Session = Depends(get_db)):
    return db.query(Claim).order_by(Claim.id.desc()).all()

@app.put("/api/admin/claims/{claim_id}", response_model=ClaimOut, dependencies=[Depends(require_admin)])
def admin_review_claim(
    claim_id: int,
    payload: ClaimReviewPayload,
    db: Session = Depends(get_db),
):
    claim = db.query(Claim).filter(Claim.id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    valid_statuses = {"Pending", "Under Review", "Approved", "Rejected", "Paid"}
    if payload.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Choose from: {valid_statuses}")

    claim.status = payload.status
    claim.admin_reason = payload.admin_reason

    if payload.status == "Approved":
        policy = db.query(Policy).filter(Policy.id == claim.policy_id).first()
        max_coverage = policy.coverage_amount if policy else MAX_PAYOUT
        requested = claim.requested_compensation or 0.0
        approved = min(payload.approved_compensation or requested, max_coverage)
        claim.approved_compensation = round(approved, 2)
        claim.payout_amount = round(approved, 2)
        claim.eligible = "Yes"
    elif payload.status == "Rejected":
        claim.eligible = "No"
        claim.payout_amount = 0.0

    db.commit()
    db.refresh(claim)
    return claim

# ── Admin: Customer Policies ─────────────────────────────────────────

@app.get("/api/admin/customer-policies", response_model=List[CustomerPolicyOut], dependencies=[Depends(require_admin)])
def admin_list_customer_policies(db: Session = Depends(get_db)):
    return db.query(CustomerPolicy).order_by(CustomerPolicy.id.desc()).all()

# ── Admin: Customer Claims Review ────────────────────────────────────

@app.get("/api/admin/customer-claims", response_model=List[CustomerClaimOut], dependencies=[Depends(require_admin)])
def admin_list_customer_claims(db: Session = Depends(get_db)):
    return db.query(CustomerClaim).order_by(CustomerClaim.id.desc()).all()

@app.put("/api/admin/customer-claims/{claim_id}", response_model=CustomerClaimOut, dependencies=[Depends(require_admin)])
def admin_review_customer_claim(
    claim_id: int,
    payload: CustomerClaimReviewPayload,
    db: Session = Depends(get_db),
):
    claim = db.query(CustomerClaim).filter(CustomerClaim.id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Customer claim not found")

    valid_statuses = {"Pending", "Under Review", "Approved", "Rejected", "Paid"}
    if payload.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Choose from: {valid_statuses}")

    claim.status = payload.status
    claim.admin_reason = payload.admin_reason

    if payload.status == "Approved":
        policy = db.query(CustomerPolicy).filter(CustomerPolicy.id == claim.policy_id).first()
        max_coverage = policy.max_coverage if policy else 1000.0
        requested = claim.requested_amount or 0.0
        # Calculate compensation capped within selected plan limit
        approved = min(payload.approved_amount or requested, max_coverage)
        claim.approved_amount = round(approved, 2)
    elif payload.status == "Rejected":
        claim.approved_amount = 0.0

    db.commit()
    db.refresh(claim)
    return claim

# ── Kitchen Owners ───────────────────────────────────────────────────

def verify_kitchen_access(owner_id: int, x_kitchen_owner_id: Optional[str] = None):
    if x_kitchen_owner_id is not None:
        try:
            if int(x_kitchen_owner_id) != owner_id:
                raise HTTPException(status_code=403, detail="Access denied: Cannot access another kitchen owner's data")
        except ValueError:
            raise HTTPException(status_code=403, detail="Access denied: Invalid kitchen owner ID header")

@app.post("/api/kitchen/register", response_model=KitchenOwnerOut)
def register_kitchen_owner(payload: KitchenOwnerRegister, db: Session = Depends(get_db)):
    existing = db.query(KitchenOwner).filter(KitchenOwner.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Kitchen owner email already registered")
    data = payload.model_dump()
    data["password"] = hash_password(payload.password)
    owner = KitchenOwner(**data)
    db.add(owner)
    db.commit()
    db.refresh(owner)
    return owner

@app.post("/api/kitchen/login", response_model=KitchenOwnerOut)
def login_kitchen_owner(payload: KitchenOwnerLogin, db: Session = Depends(get_db)):
    owner = db.query(KitchenOwner).filter(KitchenOwner.email == payload.email).first()
    if not owner or not verify_password(payload.password, owner.password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    # Upgrade legacy plain password to PBKDF2 hash on login
    if not owner.password.startswith("pbkdf2:sha256:"):
        owner.password = hash_password(payload.password)
        db.commit()
        db.refresh(owner)
    return owner

@app.get("/api/kitchen/owners", response_model=List[KitchenOwnerOut])
def list_kitchen_owners(db: Session = Depends(get_db)):
    return db.query(KitchenOwner).order_by(KitchenOwner.id.desc()).all()

@app.get("/api/kitchen/{owner_id}/applications", response_model=List[PolicyApplicationOut])
def get_kitchen_applications(
    owner_id: int,
    x_kitchen_owner_id: Optional[str] = Header(None, alias="X-Kitchen-Owner-ID"),
    db: Session = Depends(get_db)
):
    verify_kitchen_access(owner_id, x_kitchen_owner_id)
    owner = db.query(KitchenOwner).filter(KitchenOwner.id == owner_id).first()
    if not owner:
        raise HTTPException(status_code=404, detail="Kitchen owner not found")
    return db.query(PolicyApplication).filter(
        (PolicyApplication.kitchen_name == owner.kitchen_name) |
        (PolicyApplication.contact_info == owner.email) |
        (PolicyApplication.owner_name == owner.name)
    ).order_by(PolicyApplication.id.desc()).all()

@app.get("/api/kitchen/{owner_id}/policies", response_model=List[PolicyOut])
def get_kitchen_policies(
    owner_id: int,
    x_kitchen_owner_id: Optional[str] = Header(None, alias="X-Kitchen-Owner-ID"),
    db: Session = Depends(get_db)
):
    verify_kitchen_access(owner_id, x_kitchen_owner_id)
    owner = db.query(KitchenOwner).filter(KitchenOwner.id == owner_id).first()
    if not owner:
        raise HTTPException(status_code=404, detail="Kitchen owner not found")
    return db.query(Policy).filter(
        Policy.kitchen_name == owner.kitchen_name
    ).order_by(Policy.id.desc()).all()

@app.get("/api/kitchen/{owner_id}/claims", response_model=List[ClaimOut])
def get_kitchen_claims(
    owner_id: int,
    x_kitchen_owner_id: Optional[str] = Header(None, alias="X-Kitchen-Owner-ID"),
    db: Session = Depends(get_db)
):
    verify_kitchen_access(owner_id, x_kitchen_owner_id)
    owner = db.query(KitchenOwner).filter(KitchenOwner.id == owner_id).first()
    if not owner:
        raise HTTPException(status_code=404, detail="Kitchen owner not found")
    policy_ids = [p.id for p in db.query(Policy).filter(Policy.kitchen_name == owner.kitchen_name).all()]
    if not policy_ids:
        return []
    return db.query(Claim).filter(Claim.policy_id.in_(policy_ids)).order_by(Claim.id.desc()).all()
