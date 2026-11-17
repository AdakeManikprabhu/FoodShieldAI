"""
test_phase5.py - Verification suite for Phase 5: Policy Regulations, Eligibility, Security, and Validation.
Tests 18 requirements specified in Phase 5H.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from datetime import datetime, timezone, timedelta
from uuid import uuid4
import sys, os
import io

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from database import Base, get_db
from models import (
    InsurancePlan, KitchenOwner, Customer, CustomerOrder,
    CustomerPolicy, CustomerClaim, PolicyApplication, Policy,
    SensorReading, Incident, Claim
)
from main import app, hash_password, verify_password

TEST_DB_URL = "sqlite:///./test_phase5.db"
engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

def seed_test_data():
    db = TestingSessionLocal()
    if db.query(InsurancePlan).count() == 0:
        db.add_all([
            InsurancePlan(plan_type="kitchen", name="Basic", coverage_amount=10000, monthly_premium=199,
                          benefits="Basic coverage", exclusions="Power outages"),
            InsurancePlan(plan_type="kitchen", name="Standard", coverage_amount=25000, monthly_premium=399,
                          benefits="Standard coverage", exclusions="Negligence"),
            InsurancePlan(plan_type="kitchen", name="Premium", coverage_amount=50000, monthly_premium=699,
                          benefits="Full coverage", exclusions="None"),
            InsurancePlan(plan_type="customer", name="Basic", coverage_amount=200, monthly_premium=9,
                          benefits="Customer basic", exclusions="None"),
            InsurancePlan(plan_type="customer", name="Standard", coverage_amount=500, monthly_premium=19,
                          benefits="Customer standard", exclusions="None"),
            InsurancePlan(plan_type="customer", name="Premium", coverage_amount=1000, monthly_premium=29,
                          benefits="Customer premium", exclusions="None"),
        ])
    if db.query(Customer).count() == 0:
        db.add_all([
            Customer(name="Customer One", email="cust1@phase5.com", phone="9876543201",
                     address="Address 1", password=hash_password("secret123")),
            Customer(name="Customer Two", email="cust2@phase5.com", phone="9876543202",
                     address="Address 2", password=hash_password("secret456")),
        ])
    if db.query(KitchenOwner).count() == 0:
        db.add_all([
            KitchenOwner(name="Chef Owner One", email="owner1@kitchen.com", phone="9123456701",
                         kitchen_name="Cloud Kitchen Alpha", address="Sector 1", password=hash_password("secret123")),
            KitchenOwner(name="Chef Owner Two", email="owner2@kitchen.com", phone="9123456702",
                         kitchen_name="Cloud Kitchen Beta", address="Sector 2", password=hash_password("secret456")),
        ])
    db.commit()
    db.close()

@pytest.fixture(autouse=True)
def setup_phase5_db():
    app.dependency_overrides[get_db] = override_get_db
    Base.metadata.create_all(bind=engine)
    seed_test_data()
    yield
    app.dependency_overrides.pop(get_db, None)

client = TestClient(app)

# ── 1. Mandatory terms acceptance ─────────────────────────────────────
def test_01_mandatory_terms_acceptance():
    """Verify policy purchase and application fail if terms are not accepted."""
    # Customer order protection without terms acceptance -> 400
    res_cust = client.post("/api/customer/orders", json={
        "customer_id": 1,
        "restaurant_name": "Royal Treat",
        "items_summary": "Paneer Tikka Roll",
        "order_amount": 320.0,
        "plan_id": 4, # Customer Basic
        "terms_accepted": False,
    })
    assert res_cust.status_code == 400
    assert "terms" in res_cust.json()["detail"].lower()

    # Kitchen application with terms_accepted = False -> 400
    res_kitchen = client.post("/api/policy/apply", json={
        "kitchen_name": "Cloud Kitchen Alpha",
        "owner_name": "Chef Owner One",
        "contact_info": "owner1@kitchen.com",
        "address": "Sector 1",
        "storage_value": 20000,
        "plan_id": 1,
        "requested_coverage": 10000,
        "terms_accepted": False,
    })
    assert res_kitchen.status_code == 400
    assert "terms" in res_kitchen.json()["detail"].lower()

# ── 2. Terms version and timestamp storage ────────────────────────────
def test_02_terms_version_and_timestamp_storage():
    """Verify accepted terms version and timestamp are saved in policy records."""
    # Customer policy
    res_order = client.post("/api/customer/orders", json={
        "customer_id": 1,
        "restaurant_name": "Royal Treat",
        "items_summary": "Biryani Box",
        "order_amount": 400.0,
        "plan_id": 4,
        "terms_accepted": True,
        "terms_version": "v1.5",
    })
    assert res_order.status_code == 200

    policies = client.get("/api/customer/1/policies").json()
    assert len(policies) > 0
    cust_pol = policies[0]
    assert cust_pol["terms_version"] == "v1.5"
    assert cust_pol["terms_accepted_at"] is not None

    # Kitchen application & approval
    res_app = client.post("/api/policy/apply", json={
        "kitchen_name": "Cloud Kitchen Alpha",
        "owner_name": "Chef Owner One",
        "contact_info": "owner1@kitchen.com",
        "address": "Sector 1",
        "storage_value": 25000,
        "plan_id": 1,
        "requested_coverage": 10000,
        "duration_days": 30,
        "terms_accepted": True,
        "terms_version": "v2.0",
    })
    assert res_app.status_code == 200
    app_id = res_app.json()["id"]

    res_approve = client.put(f"/api/admin/applications/{app_id}", json={
        "status": "Approved", "admin_reason": "Setup verified"
    })
    assert res_approve.status_code == 200

    active_pols = client.get("/api/policy/active").json()
    matched = [p for p in active_pols if p["kitchen_name"] == "Cloud Kitchen Alpha"]
    assert len(matched) > 0
    assert matched[0]["terms_version"] == "v2.0"
    assert matched[0]["terms_accepted_at"] is not None

# ── 3. Customer per-order policy coverage ─────────────────────────────
def test_03_customer_per_order_policy_coverage():
    """Verify coverage applies to specific confirmed order and ends on cancellation."""
    # 1. Purchase protection on order
    res_order = client.post("/api/customer/orders", json={
        "customer_id": 1,
        "restaurant_name": "Wrap Hub",
        "items_summary": "Chicken Wrap",
        "order_amount": 250.0,
        "plan_id": 4,
        "terms_accepted": True,
    })
    assert res_order.status_code == 200
    order_id = res_order.json()["id"]

    # 2. Cancel order directly in DB to simulate cancellation
    db = TestingSessionLocal()
    order_obj = db.query(CustomerOrder).filter(CustomerOrder.id == order_id).first()
    order_obj.order_status = "Cancelled"
    db.commit()
    db.close()

    # 3. Attempt claim on cancelled order -> rejected (400)
    res_claim = client.post("/api/customer/claims/submit", data={
        "customer_id": 1,
        "order_id": order_id,
        "claim_reason": "Damaged food",
        "requested_amount": 150.0,
    }, files={"evidence": ("photo.jpg", io.BytesIO(b"fake image bytes"), "image/jpeg")})
    assert res_claim.status_code == 400
    assert "cancelled" in res_claim.json()["detail"].lower()

# ── 4. Kitchen full-month policy ──────────────────────────────────────
def test_04_kitchen_full_month_policy():
    """Verify 30-day coverage duration and standard monthly premium."""
    res = client.post("/api/policy/apply", json={
        "kitchen_name": "Cloud Kitchen Alpha",
        "owner_name": "Chef Owner One",
        "contact_info": "owner1@kitchen.com",
        "address": "Sector 1",
        "storage_value": 20000,
        "plan_id": 1, # Basic = 199/month
        "requested_coverage": 10000,
        "duration_days": 30,
        "terms_accepted": True,
    })
    assert res.status_code == 200
    data = res.json()
    assert data["duration_days"] == 30
    assert data["calculated_premium"] == 199.0

# ── 5. Kitchen partial-month premium calculation ──────────────────────
def test_05_kitchen_partial_month_premium_calculation():
    """Verify pro-rated premium calculation for short durations."""
    # 10 days for Basic (199 / 30 * 10 = 66.33)
    res10 = client.post("/api/policy/apply", json={
        "kitchen_name": "Cloud Kitchen Alpha",
        "owner_name": "Chef Owner One",
        "contact_info": "owner1@kitchen.com",
        "address": "Sector 1",
        "storage_value": 20000,
        "plan_id": 1,
        "requested_coverage": 10000,
        "duration_days": 10,
        "terms_accepted": True,
    })
    assert res10.status_code == 200
    assert res10.json()["calculated_premium"] == 66.33

    # 15 days for Standard (399 / 30 * 15 = 199.50)
    res15 = client.post("/api/policy/apply", json={
        "kitchen_name": "Cloud Kitchen Alpha",
        "owner_name": "Chef Owner One",
        "contact_info": "owner1@kitchen.com",
        "address": "Sector 1",
        "storage_value": 25000,
        "plan_id": 2,
        "requested_coverage": 25000,
        "duration_days": 15,
        "terms_accepted": True,
    })
    assert res15.status_code == 200
    assert res15.json()["calculated_premium"] == 199.50

# ── 6. Invalid policy date ranges ─────────────────────────────────────
def test_06_invalid_policy_date_ranges():
    """Verify application rejection when end date is before start date or in the past."""
    now = datetime.now(timezone.utc)

    # End date before start date
    res_inverted = client.post("/api/policy/apply", json={
        "kitchen_name": "Cloud Kitchen Alpha",
        "owner_name": "Chef Owner One",
        "contact_info": "owner1@kitchen.com",
        "address": "Sector 1",
        "storage_value": 20000,
        "plan_id": 1,
        "requested_coverage": 10000,
        "start_date": (now + timedelta(days=10)).isoformat(),
        "end_date": (now + timedelta(days=5)).isoformat(),
        "terms_accepted": True,
    })
    assert res_inverted.status_code == 400
    assert "end date must be after start date" in res_inverted.json()["detail"].lower()

    # Retrospective/past end date
    res_past = client.post("/api/policy/apply", json={
        "kitchen_name": "Cloud Kitchen Alpha",
        "owner_name": "Chef Owner One",
        "contact_info": "owner1@kitchen.com",
        "address": "Sector 1",
        "storage_value": 20000,
        "plan_id": 1,
        "requested_coverage": 10000,
        "start_date": (now - timedelta(days=30)).isoformat(),
        "end_date": (now - timedelta(days=10)).isoformat(),
        "terms_accepted": True,
    })
    assert res_past.status_code == 400
    assert "retrospective" in res_past.json()["detail"].lower()

def create_test_kitchen_policy(db, kitchen_name, start_date, expiry_date, status="Active", coverage=10000.0, premium=199.0):
    app_record = PolicyApplication(
        kitchen_name=kitchen_name,
        owner_name="Chef Owner",
        contact_info="owner@kitchen.com",
        address="Sector 1",
        storage_value=20000,
        plan_id=1,
        requested_coverage=coverage,
        duration_days=30,
        calculated_premium=premium,
        status="Approved",
    )
    db.add(app_record)
    db.commit()
    db.refresh(app_record)

    pol = Policy(
        application_id=app_record.id,
        plan_id=1,
        kitchen_name=kitchen_name,
        start_date=start_date,
        expiry_date=expiry_date,
        duration_days=30,
        total_premium=premium,
        coverage_amount=coverage,
        monthly_premium=premium,
        status=status,
    )
    db.add(pol)
    db.commit()
    db.refresh(pol)
    return pol

# ── 7. Claims outside policy coverage dates ───────────────────────────
def test_07_claims_outside_policy_coverage_dates():
    """Verify claims submitted before policy start or after policy expiry are rejected."""
    now = datetime.now(timezone.utc)
    db = TestingSessionLocal()
    # Create active policy with future start date
    pol = create_test_kitchen_policy(
        db,
        kitchen_name="Future Kitchen",
        start_date=now + timedelta(days=2),
        expiry_date=now + timedelta(days=32),
        status="Active",
    )

    # Create incident that occurred right now (before policy start date)
    inc = Incident(
        event_type="excursion",
        description="Temperature excursion before policy activation",
        temperature=35.0,
        risk_level="High",
        timestamp=now,
    )
    db.add(inc)
    db.commit()
    db.refresh(inc)
    pol_id = pol.id
    inc_id = inc.id
    db.close()

    # Claim for incident before policy started -> 400
    res = client.post("/api/claims/submit", data={
        "incident_id": inc_id,
        "policy_id": pol_id,
        "spoilage_category": "Dairy",
        "estimated_loss": 3000.0,
        "requested_compensation": 3000.0,
    })
    assert res.status_code == 400
    assert "before policy" in res.json()["detail"].lower() or "retroactive" in res.json()["detail"].lower()

# ── 8. Expired policies reject claims ─────────────────────────────────
def test_08_expired_policies_reject_claims():
    """Verify expired policies cannot accept new claims."""
    now = datetime.now(timezone.utc)
    db = TestingSessionLocal()
    # Create expired policy
    pol = create_test_kitchen_policy(
        db,
        kitchen_name="Expired Kitchen",
        start_date=now - timedelta(days=40),
        expiry_date=now - timedelta(days=10),
        status="Expired",
    )
    inc = Incident(
        event_type="excursion",
        description="Excursion in expired policy",
        temperature=34.0,
        risk_level="High",
        timestamp=now,
    )
    db.add(inc)
    db.commit()
    db.refresh(inc)
    pol_id = pol.id
    inc_id = inc.id
    db.close()

    res = client.post("/api/claims/submit", data={
        "incident_id": inc_id,
        "policy_id": pol_id,
        "spoilage_category": "Meat",
        "estimated_loss": 2000.0,
        "requested_compensation": 2000.0,
    })
    assert res.status_code == 400
    assert "expired" in res.json()["detail"].lower()

# ── 9. Claims submitted after 48-hour deadline ────────────────────────
def test_09_claims_submitted_after_deadline():
    """Verify claims submitted more than 48 hours after incident are rejected."""
    now = datetime.now(timezone.utc)
    db = TestingSessionLocal()
    pol = create_test_kitchen_policy(
        db,
        kitchen_name="48h Test Kitchen",
        start_date=now - timedelta(days=5),
        expiry_date=now + timedelta(days=25),
        status="Active",
    )
    # Incident older than 48h (e.g. 72h ago)
    inc = Incident(
        event_type="excursion",
        description="Incident from 3 days ago",
        temperature=36.0,
        risk_level="High",
        timestamp=now - timedelta(hours=72),
    )
    db.add(inc)
    db.commit()
    db.refresh(inc)
    pol_id = pol.id
    inc_id = inc.id
    db.close()

    res = client.post("/api/claims/submit", data={
        "incident_id": inc_id,
        "policy_id": pol_id,
        "spoilage_category": "Produce",
        "estimated_loss": 1500.0,
        "requested_compensation": 1500.0,
    })
    assert res.status_code == 400
    assert "48 hours" in res.json()["detail"].lower()

# ── 10. Excluded incident types ───────────────────────────────────────
def test_10_excluded_incident_types():
    """Verify customer claims for excluded incidents (address error, change of mind) are rejected."""
    res_order = client.post("/api/customer/orders", json={
        "customer_id": 1,
        "restaurant_name": "Taco Bell",
        "items_summary": "Tacos & Burritos",
        "order_amount": 350.0,
        "plan_id": 4,
        "terms_accepted": True,
    })
    assert res_order.status_code == 200
    order_id = res_order.json()["id"]

    # Address error
    res_addr = client.post("/api/customer/claims/submit", data={
        "customer_id": 1,
        "order_id": order_id,
        "claim_reason": "Spoiled food",
        "description": "Food delivered late due to my wrong address mistake",
        "requested_amount": 200.0,
    }, files={"evidence": ("proof.jpg", io.BytesIO(b"image bytes"), "image/jpeg")})
    assert res_addr.status_code == 400
    assert "excluded" in res_addr.json()["detail"].lower()

    # Change of mind
    res_mind = client.post("/api/customer/claims/submit", data={
        "customer_id": 1,
        "order_id": order_id,
        "claim_reason": "Damaged food",
        "description": "Customer change of mind, did not want this item",
        "requested_amount": 200.0,
    }, files={"evidence": ("proof.jpg", io.BytesIO(b"image bytes"), "image/jpeg")})
    assert res_mind.status_code == 400
    assert "excluded" in res_mind.json()["detail"].lower()

# ── 11. Duplicate claims ──────────────────────────────────────────────
def test_11_duplicate_claims_rejected():
    """Verify duplicate claims for the same order or incident are rejected."""
    res_order = client.post("/api/customer/orders", json={
        "customer_id": 1,
        "restaurant_name": "Burger King",
        "items_summary": "Whopper Meal",
        "order_amount": 300.0,
        "plan_id": 4,
        "terms_accepted": True,
    })
    order_id = res_order.json()["id"]

    # First claim -> succeeds
    res_claim1 = client.post("/api/customer/claims/submit", data={
        "customer_id": 1,
        "order_id": order_id,
        "claim_reason": "Spoiled food",
        "description": "Sour smelling burger",
        "requested_amount": 150.0,
    }, files={"evidence": ("photo.jpg", io.BytesIO(b"image bytes"), "image/jpeg")})
    assert res_claim1.status_code == 200

    # Second claim on same order -> rejected (400)
    res_claim2 = client.post("/api/customer/claims/submit", data={
        "customer_id": 1,
        "order_id": order_id,
        "claim_reason": "Spoiled food",
        "description": "Second submission",
        "requested_amount": 100.0,
    }, files={"evidence": ("photo.jpg", io.BytesIO(b"image bytes"), "image/jpeg")})
    assert res_claim2.status_code == 400
    assert "already been submitted" in res_claim2.json()["detail"].lower()

# ── 12. Compensation limits ───────────────────────────────────────────
def test_12_compensation_limits():
    """Verify approved payout does not exceed the plan maximum coverage limit."""
    res_order = client.post("/api/customer/orders", json={
        "customer_id": 1,
        "restaurant_name": "Sushi Express",
        "items_summary": "Salmon Roll",
        "order_amount": 500.0,
        "plan_id": 4, # Basic limit = ₹200
        "terms_accepted": True,
    })
    order_id = res_order.json()["id"]

    # Requesting > ₹200 limit fails on submit
    res_over = client.post("/api/customer/claims/submit", data={
        "customer_id": 1,
        "order_id": order_id,
        "claim_reason": "Spoiled food",
        "description": "Warm fish on arrival",
        "requested_amount": 400.0,
    }, files={"evidence": ("sushi.jpg", io.BytesIO(b"bytes"), "image/jpeg")})
    assert res_over.status_code == 400
    assert "exceeds plan maximum limit" in res_over.json()["detail"].lower()

    # Valid claim within ₹200
    res_valid = client.post("/api/customer/claims/submit", data={
        "customer_id": 1,
        "order_id": order_id,
        "claim_reason": "Spoiled food",
        "description": "Warm fish on arrival",
        "requested_amount": 190.0,
    }, files={"evidence": ("sushi.jpg", io.BytesIO(b"bytes"), "image/jpeg")})
    assert res_valid.status_code == 200
    claim_id = res_valid.json()["id"]

    # Admin approves with attempt to set above plan limit (e.g. 500) -> capped at 200
    res_review = client.put(f"/api/admin/customer-claims/{claim_id}", json={
        "status": "Approved",
        "approved_amount": 500.0,
        "admin_reason": "Approved"
    })
    assert res_review.status_code == 200
    assert res_review.json()["approved_amount"] == 200.0

# ── 13. Missing evidence ──────────────────────────────────────────────
def test_13_missing_evidence_rejected():
    """Verify spoiled or damaged food claims without required photo evidence are rejected."""
    res_order = client.post("/api/customer/orders", json={
        "customer_id": 1,
        "restaurant_name": "Pasta Fresca",
        "items_summary": "Penne Alfredo",
        "order_amount": 320.0,
        "plan_id": 4,
        "terms_accepted": True,
    })
    order_id = res_order.json()["id"]

    # Spoiled food without photo
    res_no_photo = client.post("/api/customer/claims/submit", data={
        "customer_id": 1,
        "order_id": order_id,
        "claim_reason": "Spoiled food",
        "description": "Curdled cream sauce",
        "requested_amount": 180.0,
    })
    assert res_no_photo.status_code == 400
    assert "photo evidence is required" in res_no_photo.json()["detail"].lower()

# ── 14. Customer data access restrictions ─────────────────────────────
def test_14_customer_data_access_restrictions():
    """Verify a customer cannot view another customer's orders, policies, or claims."""
    # Customer 1 attempts to access Customer 2's orders with X-Customer-ID: 1 -> 403 Forbidden
    res_orders = client.get("/api/customer/2/orders", headers={"X-Customer-ID": "1"})
    assert res_orders.status_code == 403
    assert "access denied" in res_orders.json()["detail"].lower()

    # Customer 1 attempts to access Customer 2's policies -> 403
    res_pols = client.get("/api/customer/2/policies", headers={"X-Customer-ID": "1"})
    assert res_pols.status_code == 403

    # Customer 1 attempts to access Customer 2's claims -> 403
    res_claims = client.get("/api/customer/2/claims", headers={"X-Customer-ID": "1"})
    assert res_claims.status_code == 403

# ── 15. Kitchen owner data access restrictions ────────────────────────
def test_15_kitchen_owner_data_access_restrictions():
    """Verify a kitchen owner cannot view another kitchen owner's applications, policies, or claims."""
    # Owner 1 attempts to access Owner 2's applications with X-Kitchen-Owner-ID: 1 -> 403 Forbidden
    res_apps = client.get("/api/kitchen/2/applications", headers={"X-Kitchen-Owner-ID": "1"})
    assert res_apps.status_code == 403
    assert "access denied" in res_apps.json()["detail"].lower()

    # Owner 1 attempts to access Owner 2's policies -> 403
    res_pols = client.get("/api/kitchen/2/policies", headers={"X-Kitchen-Owner-ID": "1"})
    assert res_pols.status_code == 403

    # Owner 1 attempts to access Owner 2's claims -> 403
    res_claims = client.get("/api/kitchen/2/claims", headers={"X-Kitchen-Owner-ID": "1"})
    assert res_claims.status_code == 403

# ── 16. Admin endpoint authorization ──────────────────────────────────
def test_16_admin_endpoint_authorization():
    """Verify non-admin or unauthenticated access to admin endpoints is rejected (401 or 403)."""
    # Non-admin role passed via header -> 403 Forbidden
    res_forbidden = client.get("/api/admin/stats", headers={"X-Admin-Role": "customer"})
    assert res_forbidden.status_code == 403
    assert "admin" in res_forbidden.json()["detail"].lower()

    # Kitchen owner role -> 403
    res_kitchen_role = client.get("/api/admin/applications", headers={"X-User-Role": "kitchen_owner"})
    assert res_kitchen_role.status_code == 403

    # Invalid authorization header -> 401 Unauthorized
    res_unauthorized = client.get("/api/admin/claims", headers={"Authorization": "Bearer fake_token"})
    assert res_unauthorized.status_code == 401

    # Valid admin access -> 200 OK
    res_ok = client.get("/api/admin/stats", headers={"X-Admin-Role": "admin"})
    assert res_ok.status_code == 200

# ── 17. Password hashing and login ────────────────────────────────────
def test_17_password_hashing_and_login():
    """Verify passwords are not stored in plaintext and login succeeds with hashed password."""
    # 1. Register new customer with unique email
    email = f"hashed_user_{uuid4().hex[:6]}@example.com"
    plain_pw = "SecureP@ssw0rd!"
    res_reg = client.post("/api/customer/register", json={
        "name": "Hashed User",
        "email": email,
        "phone": "9998887776",
        "password": plain_pw,
        "address": "Secure Tower",
    })
    assert res_reg.status_code == 200

    # 2. Verify stored password in database is PBKDF2 hashed and NOT plaintext
    db = TestingSessionLocal()
    user_in_db = db.query(Customer).filter(Customer.email == email).first()
    assert user_in_db is not None
    assert user_in_db.password != plain_pw
    assert user_in_db.password.startswith("pbkdf2:sha256:100000$")
    db.close()

    # 3. Successful login with correct password
    res_login_ok = client.post("/api/customer/login", json={
        "email": email,
        "password": plain_pw,
    })
    assert res_login_ok.status_code == 200

    # 4. Failed login with wrong password
    res_login_fail = client.post("/api/customer/login", json={
        "email": email,
        "password": "WrongPassword123",
    })
    assert res_login_fail.status_code == 401

# ── 18. File upload restrictions ──────────────────────────────────────
def test_18_file_upload_restrictions():
    """Verify unsupported file formats and files exceeding 5MB are rejected."""
    now = datetime.now(timezone.utc)
    db = TestingSessionLocal()
    pol = create_test_kitchen_policy(
        db,
        kitchen_name="Upload Test Kitchen",
        start_date=now - timedelta(days=2),
        expiry_date=now + timedelta(days=28),
        status="Active",
    )
    inc = Incident(
        event_type="excursion",
        description="Fresh excursion for upload test",
        temperature=35.0,
        risk_level="High",
        timestamp=now,
    )
    db.add(inc)
    db.commit()
    db.refresh(inc)
    pol_id = pol.id
    inc_id = inc.id
    db.close()

    # 1. Unsupported format (.exe) -> 400
    res_exe = client.post("/api/claims/submit", data={
        "incident_id": inc_id,
        "policy_id": pol_id,
        "spoilage_category": "Dairy",
        "estimated_loss": 1000.0,
        "requested_compensation": 1000.0,
    }, files={"evidence": ("malware.exe", io.BytesIO(b"executable bytes"), "application/x-msdownload")})
    assert res_exe.status_code == 400
    assert "unsupported file format" in res_exe.json()["detail"].lower()

    # 2. File exceeding 5MB (> 5 * 1024 * 1024 bytes) -> 400
    large_payload = b"A" * (5 * 1024 * 1024 + 1024) # 5MB + 1KB
    res_large = client.post("/api/claims/submit", data={
        "incident_id": inc_id,
        "policy_id": pol_id,
        "spoilage_category": "Dairy",
        "estimated_loss": 1000.0,
        "requested_compensation": 1000.0,
    }, files={"evidence": ("huge_photo.jpg", io.BytesIO(large_payload), "image/jpeg")})
    assert res_large.status_code == 400
    assert "exceeds maximum limit of 5mb" in res_large.json()["detail"].lower()

    # 3. Valid photo format (.jpg) within 5MB -> 200
    valid_payload = b"VALID_JPG_HEADER_AND_IMAGE_DATA"
    res_valid = client.post("/api/claims/submit", data={
        "incident_id": inc_id,
        "policy_id": pol_id,
        "spoilage_category": "Dairy",
        "estimated_loss": 1000.0,
        "requested_compensation": 1000.0,
    }, files={"evidence": ("evidence.jpg", io.BytesIO(valid_payload), "image/jpeg")})
    assert res_valid.status_code == 200
    assert res_valid.json()["status"] == "Pending"
