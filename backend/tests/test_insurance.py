"""
test_insurance.py — Tests for Kitchen Insurance Policy & Claim Management feature.
Uses FastAPI TestClient with an isolated SQLite DB.
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import sys, os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from database import Base, get_db
import models
from models import InsurancePlan
from main import app

TEST_DB_URL = "sqlite:///./test_insurance.db"
test_engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

def override_get_db():
    db = TestingSession()
    try:
        yield db
    finally:
        db.close()

def seed_test_plans():
    db = TestingSession()
    if db.query(InsurancePlan).filter(InsurancePlan.plan_type == "kitchen").count() == 0:
        db.add_all([
            InsurancePlan(plan_type="kitchen", name="Basic", coverage_amount=10000, monthly_premium=199,
                          benefits="Basic coverage", exclusions="Power outages"),
            InsurancePlan(plan_type="kitchen", name="Standard", coverage_amount=25000, monthly_premium=399,
                          benefits="Standard coverage", exclusions="Negligence"),
            InsurancePlan(plan_type="kitchen", name="Premium", coverage_amount=50000, monthly_premium=699,
                          benefits="Full coverage", exclusions="None"),
        ])
        db.commit()
    db.close()

@pytest.fixture(autouse=True)
def setup_insurance_db():
    app.dependency_overrides[get_db] = override_get_db
    Base.metadata.create_all(bind=test_engine)
    seed_test_plans()
    yield
    app.dependency_overrides.pop(get_db, None)

client = TestClient(app)

# ---------- Helpers ----------

def create_application(plan_id=1, coverage=8000):
    r = client.post("/api/policy/apply", json={
        "kitchen_name": "Test Kitchen", "owner_name": "Alice",
        "contact_info": "alice@test.com", "address": "123 St",
        "storage_value": 20000, "plan_id": plan_id,
        "requested_coverage": coverage, "refrigerator_details": "2-door",
    })
    assert r.status_code == 200, r.text
    return r.json()

def approve_application(app_id):
    r = client.put(f"/api/admin/applications/{app_id}",
                   json={"status": "Approved", "admin_reason": "All good"})
    assert r.status_code == 200, r.text
    return r.json()

def get_policies():
    return client.get("/api/admin/policies").json()

def create_incident():
    """Simulate two excursions to create an incident."""
    client.post("/api/simulate/excursion")
    r = client.post("/api/simulate/excursion")
    assert r.status_code == 200, r.text
    incident = r.json().get("incident")
    assert incident is not None, "No incident returned"
    return incident

# ---------- Tests ----------

def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"

def test_list_plans():
    r = client.get("/api/plans")
    assert r.status_code == 200
    plans = r.json()
    assert len(plans) == 3
    names = {p["name"] for p in plans}
    assert names == {"Basic", "Standard", "Premium"}

def test_application_created_as_pending():
    app_data = create_application()
    assert app_data["status"] == "Pending"
    assert app_data["id"] > 0

def test_admin_approve_creates_policy():
    app_data = create_application()
    updated = approve_application(app_data["id"])
    assert updated["status"] == "Approved"
    policies = get_policies()
    matching = [p for p in policies if p["application_id"] == app_data["id"]]
    assert len(matching) == 1
    assert matching[0]["status"] == "Active"

def test_admin_reject_application():
    app_data = create_application()
    r = client.put(f"/api/admin/applications/{app_data['id']}",
                   json={"status": "Rejected", "admin_reason": "Missing docs"})
    assert r.status_code == 200
    assert r.json()["status"] == "Rejected"

def test_coverage_limit_on_apply():
    """Requesting more than plan limit should be rejected."""
    r = client.post("/api/policy/apply", json={
        "kitchen_name": "Over Kitchen", "owner_name": "Bob",
        "contact_info": "bob@test.com", "address": "456 St",
        "storage_value": 5000, "plan_id": 1,
        "requested_coverage": 99999,   # exceeds Basic limit of 10,000
    })
    assert r.status_code == 400
    assert "coverage" in r.json()["detail"].lower()

def test_claim_submission_and_approval():
    app_data = create_application()
    approve_application(app_data["id"])
    policies = get_policies()
    policy_id = [p for p in policies if p["application_id"] == app_data["id"]][0]["id"]
    incident = create_incident()

    # Submit claim
    r = client.post("/api/claims/submit", data={
        "incident_id": str(incident["id"]),
        "policy_id": str(policy_id),
        "spoilage_category": "Vegetables",
        "estimated_loss": "3000",
        "requested_compensation": "3000",
    })
    assert r.status_code == 200, r.text
    claim = r.json()
    assert claim["status"] == "Pending"
    claim_id = claim["id"]

    # Admin approves
    r2 = client.put(f"/api/admin/claims/{claim_id}",
                    json={"status": "Approved", "admin_reason": "Valid claim", "approved_compensation": 3000})
    assert r2.status_code == 200
    data = r2.json()
    assert data["status"] == "Approved"
    assert data["payout_amount"] == 3000.0

def test_compensation_capped_at_coverage():
    """Claim request that exceeds coverage limit should be rejected."""
    app_data = create_application(plan_id=1, coverage=8000)
    approve_application(app_data["id"])
    policies = get_policies()
    policy_id = [p for p in policies if p["application_id"] == app_data["id"]][0]["id"]
    incident = create_incident()

    r = client.post("/api/claims/submit", data={
        "incident_id": str(incident["id"]),
        "policy_id": str(policy_id),
        "spoilage_category": "Meat",
        "estimated_loss": "15000",
        "requested_compensation": "15000",
    })
    assert r.status_code == 400
    assert "coverage" in r.json()["detail"].lower() or "limit" in r.json()["detail"].lower()

def test_duplicate_claim_prevention():
    app_data = create_application()
    approve_application(app_data["id"])
    policies = get_policies()
    policy_id = [p for p in policies if p["application_id"] == app_data["id"]][0]["id"]
    incident = create_incident()

    # First claim
    r1 = client.post("/api/claims/submit", data={
        "incident_id": str(incident["id"]), "policy_id": str(policy_id),
        "spoilage_category": "Dairy", "estimated_loss": "2000", "requested_compensation": "2000",
    })
    assert r1.status_code == 200, r1.text

    # Duplicate
    r2 = client.post("/api/claims/submit", data={
        "incident_id": str(incident["id"]), "policy_id": str(policy_id),
        "spoilage_category": "Dairy", "estimated_loss": "2000", "requested_compensation": "2000",
    })
    assert r2.status_code == 400
    detail = r2.json()["detail"].lower()
    assert "duplicate" in detail or "already exists" in detail

def test_claim_mark_paid():
    app_data = create_application()
    approve_application(app_data["id"])
    policies = get_policies()
    policy_id = [p for p in policies if p["application_id"] == app_data["id"]][0]["id"]
    incident = create_incident()

    r = client.post("/api/claims/submit", data={
        "incident_id": str(incident["id"]), "policy_id": str(policy_id),
        "spoilage_category": "Seafood", "estimated_loss": "1500", "requested_compensation": "1500",
    })
    claim_id = r.json()["id"]

    client.put(f"/api/admin/claims/{claim_id}", json={"status": "Approved", "approved_compensation": 1500})
    r2 = client.put(f"/api/admin/claims/{claim_id}", json={"status": "Paid"})
    assert r2.status_code == 200
    assert r2.json()["status"] == "Paid"
