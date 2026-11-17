"""
test_phase4.py - Tests for Phase 4: Kitchen Owner Portal, Advanced Claims & Policy Management, and Admin Stats
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

TEST_DB_URL = "sqlite:///./test_phase4.db"

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from database import Base, get_db
from models import InsurancePlan, KitchenOwner, Customer, PolicyApplication, Policy, Claim
from main import app

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
    if db.query(KitchenOwner).count() == 0:
        db.add(KitchenOwner(
            name="Chef Rohit", email="rohit@kitchen.com", phone="9876543210",
            kitchen_name="Rohit Delights", address="Connaught Place, Delhi", password="demo"
        ))
    db.commit()
    db.close()

@pytest.fixture(autouse=True)
def setup_phase4_db():
    app.dependency_overrides[get_db] = override_get_db
    Base.metadata.create_all(bind=engine)
    seed_test_data()
    yield
    app.dependency_overrides.pop(get_db, None)

client = TestClient(app)

# ── 1. Kitchen Owner Login (Valid) ───────────────────────────────────

def test_kitchen_owner_login_valid():
    r = client.post("/api/kitchen/login", json={
        "email": "rohit@kitchen.com",
        "password": "demo"
    })
    assert r.status_code == 200
    data = r.json()
    assert data["email"] == "rohit@kitchen.com"
    assert data["kitchen_name"] == "Rohit Delights"
    assert "id" in data

# ── 2. Kitchen Owner Login (Invalid) ─────────────────────────────────

def test_kitchen_owner_login_invalid():
    r = client.post("/api/kitchen/login", json={
        "email": "rohit@kitchen.com",
        "password": "wrongpassword"
    })
    assert r.status_code == 401
    assert "Invalid email or password" in r.json()["detail"]

# ── 3. Kitchen Owner Applications Retrieval ──────────────────────────

def test_kitchen_owner_applications():
    # Get Rohit's ID
    login_res = client.post("/api/kitchen/login", json={"email": "rohit@kitchen.com", "password": "demo"}).json()
    owner_id = login_res["id"]

    # Submit an application for Rohit's kitchen
    app_res = client.post("/api/policy/apply", json={
        "kitchen_name": "Rohit Delights",
        "owner_name": "Chef Rohit",
        "contact_info": "rohit@kitchen.com",
        "address": "Connaught Place, Delhi",
        "storage_value": 30000,
        "plan_id": 1,
        "requested_coverage": 8000,
        "refrigerator_details": "Double door Samsung"
    })
    assert app_res.status_code == 200

    # Retrieve applications for Rohit
    r = client.get(f"/api/kitchen/{owner_id}/applications")
    assert r.status_code == 200
    apps = r.json()
    assert len(apps) >= 1
    assert apps[0]["kitchen_name"] == "Rohit Delights"

# ── 4. Kitchen Owner Policies Retrieval ──────────────────────────────

def test_kitchen_owner_policies():
    login_res = client.post("/api/kitchen/login", json={"email": "rohit@kitchen.com", "password": "demo"}).json()
    owner_id = login_res["id"]

    # Find the application and approve it
    apps = client.get(f"/api/kitchen/{owner_id}/applications").json()
    assert len(apps) >= 1
    app_id = apps[0]["id"]

    client.put(f"/api/admin/applications/{app_id}", json={"status": "Approved", "admin_reason": "Verified"})

    # Check Rohit's policies
    r = client.get(f"/api/kitchen/{owner_id}/policies")
    assert r.status_code == 200
    policies = r.json()
    assert len(policies) >= 1
    assert policies[0]["kitchen_name"] == "Rohit Delights"
    assert policies[0]["status"] == "Active"

# ── 5. Admin Stats API Detailed Breakdown ────────────────────────────

def test_admin_stats_breakdown():
    r = client.get("/api/admin/stats")
    assert r.status_code == 200
    stats = r.json()
    assert "total_customers" in stats
    assert "total_kitchen_owners" in stats
    assert "total_kitchen_applications" in stats
    assert "pending_kitchen_applications" in stats
    assert "active_kitchen_policies" in stats
    assert "total_kitchen_claims" in stats
    assert "pending_kitchen_claims" in stats
    assert "total_customer_policies" in stats
    assert "active_customer_policies" in stats
    assert "total_customer_claims" in stats
    assert "pending_customer_claims" in stats
    assert stats["total_kitchen_owners"] >= 1
    assert stats["active_kitchen_policies"] >= 1

# ── 6. Kitchen Claim Payout Status Workflow ──────────────────────────

def test_claim_payout_status_workflow():
    login_res = client.post("/api/kitchen/login", json={"email": "rohit@kitchen.com", "password": "demo"}).json()
    owner_id = login_res["id"]
    policies = client.get(f"/api/kitchen/{owner_id}/policies").json()
    policy_id = policies[0]["id"]

    # Trigger excursion incident
    client.post("/api/simulate/excursion")
    r_sim = client.post("/api/simulate/excursion")
    incident_id = r_sim.json()["incident"]["id"]

    # Submit claim
    r_claim = client.post("/api/claims/submit", data={
        "incident_id": str(incident_id),
        "policy_id": str(policy_id),
        "spoilage_category": "Dairy Products",
        "estimated_loss": "4000",
        "requested_compensation": "4000"
    })
    assert r_claim.status_code == 200
    claim_data = r_claim.json()
    claim_id = claim_data["id"]
    assert claim_data["status"] == "Pending"

    # Step 1: Admin marks Under Review
    r_rev = client.put(f"/api/admin/claims/{claim_id}", json={
        "status": "Under Review",
        "admin_reason": "Verifying sensor logs"
    })
    assert r_rev.status_code == 200
    assert r_rev.json()["status"] == "Under Review"

    # Step 2: Admin Approves with separate approved compensation
    r_app = client.put(f"/api/admin/claims/{claim_id}", json={
        "status": "Approved",
        "admin_reason": "Damage verified",
        "approved_compensation": 3500
    })
    assert r_app.status_code == 200
    approved_claim = r_app.json()
    assert approved_claim["status"] == "Approved"
    assert approved_claim["requested_compensation"] == 4000.0
    assert approved_claim["approved_compensation"] == 3500.0

    # Step 3: Admin marks as Paid (Simulated payout)
    r_paid = client.put(f"/api/admin/claims/{claim_id}", json={
        "status": "Paid",
        "admin_reason": "Simulated payout credited to kitchen account"
    })
    assert r_paid.status_code == 200
    paid_claim = r_paid.json()
    assert paid_claim["status"] == "Paid"
    assert paid_claim["payout_amount"] == 3500.0

    # Verify claim appears in Rohit's claims
    r_my_claims = client.get(f"/api/kitchen/{owner_id}/claims")
    assert r_my_claims.status_code == 200
    rohit_claims = r_my_claims.json()
    assert any(c["id"] == claim_id for c in rohit_claims)
