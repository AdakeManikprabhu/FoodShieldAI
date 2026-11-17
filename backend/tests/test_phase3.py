"""
test_phase3.py - Tests for Phase 3: Customer Insurance & Claim Management

Tests:
  1. Customer registration
  2. Duplicate email rejection
  3. Customer login (valid + invalid)
  4. Customer plans endpoint
  5. Order without insurance
  6. Order with insurance (auto-creates customer policy)
  7. Customer policies listing
  8. Customer claim submission
  9. Duplicate claim prevention
 10. Coverage cap enforcement
 11. Invalid claim reason rejection
 12. Admin customer policies listing
 13. Admin customer claim approval (with coverage cap)
 14. Admin customer claim rejection
 15. Kitchen owner registration
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

TEST_DB_URL = "sqlite:///./test_phase3.db"

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from database import Base, get_db
from models import InsurancePlan
from main import app

engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

def seed_test_plans():
    db = TestingSessionLocal()
    if db.query(InsurancePlan).count() == 0:
        plans = [
            InsurancePlan(plan_type="kitchen", name="Basic", coverage_amount=10000, monthly_premium=199,
                          benefits="Kitchen basic", exclusions="None"),
            InsurancePlan(plan_type="kitchen", name="Standard", coverage_amount=25000, monthly_premium=399,
                          benefits="Kitchen standard", exclusions="None"),
            InsurancePlan(plan_type="kitchen", name="Premium", coverage_amount=50000, monthly_premium=699,
                          benefits="Kitchen premium", exclusions="None"),
            InsurancePlan(plan_type="customer", name="Basic", coverage_amount=200, monthly_premium=9,
                          benefits="Customer basic", exclusions="None"),
            InsurancePlan(plan_type="customer", name="Standard", coverage_amount=500, monthly_premium=19,
                          benefits="Customer standard", exclusions="None"),
            InsurancePlan(plan_type="customer", name="Premium", coverage_amount=1000, monthly_premium=29,
                          benefits="Customer premium", exclusions="None"),
        ]
        db.add_all(plans)
        db.commit()
    db.close()

@pytest.fixture(scope="module", autouse=True)
def clean_phase3_module_db():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    from models import Customer, KitchenOwner, CustomerOrder, CustomerPolicy, CustomerClaim
    db.query(CustomerClaim).delete()
    db.query(CustomerPolicy).delete()
    db.query(CustomerOrder).delete()
    db.query(Customer).filter(Customer.email.in_(["test@example.com", "captest@example.com", "reasontest@example.com", "rejecttest@example.com"])).delete()
    db.query(KitchenOwner).filter(KitchenOwner.email == "chef@kitchen.com").delete()
    db.commit()
    db.close()

@pytest.fixture(autouse=True)
def setup_phase3_db():
    app.dependency_overrides[get_db] = override_get_db
    Base.metadata.create_all(bind=engine)
    seed_test_plans()
    yield
    app.dependency_overrides.pop(get_db, None)

client = TestClient(app)

# ── 1. Customer Registration ──────────────────────────────────────────

def test_customer_register():
    r = client.post("/api/customer/register", json={
        "name": "Test User", "email": "test@example.com", "password": "pass123"
    })
    assert r.status_code == 200
    data = r.json()
    assert data["email"] == "test@example.com"
    assert data["name"] == "Test User"
    assert "id" in data

# ── 2. Duplicate Email Rejection ─────────────────────────────────────

def test_duplicate_email_rejected():
    r = client.post("/api/customer/register", json={
        "name": "Dupe User", "email": "test@example.com", "password": "pass123"
    })
    assert r.status_code == 400
    assert "already registered" in r.json()["detail"]

# ── 3a. Customer Login (valid) ────────────────────────────────────────

def test_customer_login_valid():
    r = client.post("/api/customer/login", json={
        "email": "test@example.com", "password": "pass123"
    })
    assert r.status_code == 200
    assert r.json()["email"] == "test@example.com"

# ── 3b. Customer Login (invalid password) ────────────────────────────

def test_customer_login_invalid():
    r = client.post("/api/customer/login", json={
        "email": "test@example.com", "password": "wrongpassword"
    })
    assert r.status_code == 401

# ── 4. Customer Plans ─────────────────────────────────────────────────

def test_customer_plans():
    r = client.get("/api/customer/plans")
    assert r.status_code == 200
    plans = r.json()
    assert len(plans) == 3
    names = [p["name"] for p in plans]
    assert "Basic" in names
    assert "Standard" in names
    assert "Premium" in names
    for p in plans:
        assert p["plan_type"] == "customer"

# ── Helper: get customer id ───────────────────────────────────────────

def get_customer_id():
    r = client.post("/api/customer/login", json={"email": "test@example.com", "password": "pass123"})
    return r.json()["id"]

# ── 5. Order Without Insurance ────────────────────────────────────────

def test_order_without_insurance():
    cid = get_customer_id()
    r = client.post("/api/customer/orders", json={
        "customer_id": cid,
        "restaurant_name": "Pizza Hut",
        "items_summary": "1x Pizza",
        "order_amount": 400,
        "plan_id": None
    })
    assert r.status_code == 200
    data = r.json()
    assert data["has_insurance"] is False
    assert data["plan_id"] is None

# ── 6. Order With Insurance (auto-creates customer policy) ────────────

def test_order_with_insurance():
    cid = get_customer_id()
    plans = client.get("/api/customer/plans").json()
    basic_plan = next(p for p in plans if p["name"] == "Basic")

    r = client.post("/api/customer/orders", json={
        "customer_id": cid,
        "restaurant_name": "Burger King",
        "items_summary": "2x Burger",
        "order_amount": 300,
        "plan_id": basic_plan["id"],
        "terms_accepted": True,
        "terms_version": "v1.0",
    })
    assert r.status_code == 200
    data = r.json()
    assert data["has_insurance"] is True
    assert data["plan_id"] == basic_plan["id"]

# ── 7. Customer Policies Listing ──────────────────────────────────────

def test_customer_policies():
    cid = get_customer_id()
    r = client.get(f"/api/customer/{cid}/policies")
    assert r.status_code == 200
    policies = r.json()
    assert len(policies) >= 1
    for p in policies:
        assert p["customer_id"] == cid
        assert p["status"] == "Active"

# ── 8. Customer Claim Submission ──────────────────────────────────────

def test_customer_claim_submit():
    cid = get_customer_id()
    orders = client.get(f"/api/customer/{cid}/orders").json()
    insured = next((o for o in orders if o["has_insurance"]), None)
    assert insured is not None, "No insured order found"

    r = client.post("/api/customer/claims/submit", data={
        "customer_id": cid,
        "order_id": insured["id"],
        "claim_reason": "Spoiled food",
        "description": "Food was rotten on arrival",
        "requested_amount": 150
    }, files={"evidence": ("photo.jpg", b"fake photo", "image/jpeg")})
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "Pending"
    assert data["claim_reason"] == "Spoiled food"
    assert data["requested_amount"] == 150
    assert data["approved_amount"] == 0.0
    assert "CCLM-" in data["claim_number"]

# ── 9. Duplicate Claim Prevention ────────────────────────────────────

def test_duplicate_claim_prevented():
    cid = get_customer_id()
    orders = client.get(f"/api/customer/{cid}/orders").json()
    insured = next((o for o in orders if o["has_insurance"]), None)

    r = client.post("/api/customer/claims/submit", data={
        "customer_id": cid,
        "order_id": insured["id"],
        "claim_reason": "Damaged food",
        "requested_amount": 100
    }, files={"evidence": ("photo.jpg", b"fake photo", "image/jpeg")})
    assert r.status_code == 400
    assert "already been submitted" in r.json()["detail"]

# ── 10. Coverage Cap Enforcement ─────────────────────────────────────

def test_coverage_cap_enforced():
    client.post("/api/customer/register", json={
        "name": "Cap Test", "email": "captest@example.com", "password": "pass"
    })
    cid = client.post("/api/customer/login", json={"email": "captest@example.com", "password": "pass"}).json()["id"]
    plans = client.get("/api/customer/plans").json()
    basic_plan = next(p for p in plans if p["name"] == "Basic")

    client.post("/api/customer/orders", json={
        "customer_id": cid,
        "restaurant_name": "Cafe Mocha",
        "items_summary": "1x Coffee",
        "order_amount": 500,
        "plan_id": basic_plan["id"],
        "terms_accepted": True,
        "terms_version": "v1.0",
    })

    orders = client.get(f"/api/customer/{cid}/orders").json()
    insured = orders[0]

    r = client.post("/api/customer/claims/submit", data={
        "customer_id": cid,
        "order_id": insured["id"],
        "claim_reason": "Spoiled food",
        "requested_amount": 999
    }, files={"evidence": ("photo.jpg", b"fake photo", "image/jpeg")})
    assert r.status_code == 400
    assert "maximum limit" in r.json()["detail"].lower() or "exceeds" in r.json()["detail"].lower()

# ── 11. Invalid Claim Reason Rejection ───────────────────────────────

def test_invalid_claim_reason():
    client.post("/api/customer/register", json={
        "name": "Reason Test", "email": "reasontest@example.com", "password": "pass"
    })
    cid = client.post("/api/customer/login", json={"email": "reasontest@example.com", "password": "pass"}).json()["id"]
    plans = client.get("/api/customer/plans").json()
    plan = plans[0]

    client.post("/api/customer/orders", json={
        "customer_id": cid, "restaurant_name": "X", "items_summary": "Y",
        "order_amount": 100, "plan_id": plan["id"],
        "terms_accepted": True, "terms_version": "v1.0"
    })
    orders = client.get(f"/api/customer/{cid}/orders").json()

    r = client.post("/api/customer/claims/submit", data={
        "customer_id": cid,
        "order_id": orders[0]["id"],
        "claim_reason": "I just felt like it",
        "requested_amount": 50
    })
    assert r.status_code == 400
    assert "Invalid claim reason" in r.json()["detail"]

# ── 12. Admin Customer Policies ───────────────────────────────────────

def test_admin_customer_policies():
    r = client.get("/api/admin/customer-policies")
    assert r.status_code == 200
    assert isinstance(r.json(), list)

# ── 13. Admin Customer Claim Approval ────────────────────────────────

def test_admin_customer_claim_approve():
    r = client.get("/api/admin/customer-claims")
    assert r.status_code == 200
    claims = r.json()
    assert len(claims) >= 1
    claim_id = claims[0]["id"]

    r2 = client.put(f"/api/admin/customer-claims/{claim_id}", json={
        "status": "Approved",
        "admin_reason": "Claim verified by admin",
        "approved_amount": 120
    })
    assert r2.status_code == 200
    data = r2.json()
    assert data["status"] == "Approved"
    assert data["approved_amount"] == 120
    assert data["admin_reason"] == "Claim verified by admin"

# ── 14. Admin Customer Claim Rejection ───────────────────────────────

def test_admin_customer_claim_reject():
    client.post("/api/customer/register", json={"name": "Reject Test", "email": "rejecttest@example.com", "password": "pass"})
    cid = client.post("/api/customer/login", json={"email": "rejecttest@example.com", "password": "pass"}).json()["id"]
    plans = client.get("/api/customer/plans").json()
    client.post("/api/customer/orders", json={
        "customer_id": cid, "restaurant_name": "R", "items_summary": "S",
        "order_amount": 200, "plan_id": plans[0]["id"],
        "terms_accepted": True, "terms_version": "v1.0"
    })
    orders = client.get(f"/api/customer/{cid}/orders").json()
    client.post("/api/customer/claims/submit", data={
        "customer_id": cid, "order_id": orders[0]["id"], "claim_reason": "Damaged food", "requested_amount": 80
    }, files={"evidence": ("photo.jpg", b"fake photo", "image/jpeg")})

    claims = client.get(f"/api/customer/{cid}/claims").json()
    claim_id = claims[0]["id"]

    r = client.put(f"/api/admin/customer-claims/{claim_id}", json={
        "status": "Rejected",
        "admin_reason": "Insufficient evidence"
    })
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "Rejected"
    assert data["approved_amount"] == 0.0

# ── 15. Kitchen Owner Registration ───────────────────────────────────

def test_kitchen_owner_register():
    r = client.post("/api/kitchen/register", json={
        "name": "Chef Test", "email": "chef@kitchen.com",
        "kitchen_name": "Test Kitchen", "phone": "9999999999"
    })
    assert r.status_code == 200
    data = r.json()
    assert data["kitchen_name"] == "Test Kitchen"
    assert data["email"] == "chef@kitchen.com"
