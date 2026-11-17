"""
test_terms_and_rules.py - Tests for Policy Terms, Eligibility Rules, and Coverage Duration.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import sys, os
import io

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from database import Base, get_db
from models import (
    InsurancePlan, KitchenOwner, Customer, CustomerOrder,
    CustomerPolicy, CustomerClaim, PolicyApplication, Policy
)
from main import app

TEST_DB_URL = "sqlite:///./test_terms_rules.db"
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
        db.add(Customer(
            name="Rahul Sharma", email="rahul.terms@example.com", phone="9876543210",
            address="Delhi NCR", password="demo"
        ))
    if db.query(KitchenOwner).count() == 0:
        db.add(KitchenOwner(
            name="Chef Amit", email="amit.terms@kitchen.com", phone="9123456780",
            kitchen_name="Amit Cloud Kitchen", address="Noida Hub", password="demo"
        ))
    db.commit()
    db.close()

@pytest.fixture(autouse=True)
def setup_terms_db():
    app.dependency_overrides[get_db] = override_get_db
    Base.metadata.create_all(bind=engine)
    seed_test_data()
    yield
    app.dependency_overrides.pop(get_db, None)

client = TestClient(app)

# ----------------- Kitchen Duration & Pro-Rated Premium Tests -----------------

def test_kitchen_application_prorated_premium():
    """Verify calculated pro-rated premium for custom durations: (monthly_premium / 30) * days"""
    # 1. 10 days for Basic (₹199 / 30 * 10 = ₹66.33)
    res_basic = client.post("/api/policy/apply", json={
        "kitchen_name": "Amit Cloud Kitchen", "owner_name": "Chef Amit",
        "contact_info": "amit.terms@kitchen.com", "address": "Noida",
        "storage_value": 25000, "plan_id": 1, "requested_coverage": 10000,
        "duration_days": 10, "terms_accepted": True, "terms_version": "v1.0"
    })
    assert res_basic.status_code == 200
    data_basic = res_basic.json()
    assert data_basic["duration_days"] == 10
    assert data_basic["calculated_premium"] == 66.33

    # 2. 10 days for Standard (₹399 / 30 * 10 = ₹133.00)
    res_std = client.post("/api/policy/apply", json={
        "kitchen_name": "Amit Cloud Kitchen", "owner_name": "Chef Amit",
        "contact_info": "amit.terms@kitchen.com", "address": "Noida",
        "storage_value": 30000, "plan_id": 2, "requested_coverage": 25000,
        "duration_days": 10, "terms_accepted": True, "terms_version": "v1.0"
    })
    assert res_std.status_code == 200
    assert res_std.json()["calculated_premium"] == 133.00

    # 3. 10 days for Premium (₹699 / 30 * 10 = ₹233.00)
    res_prem = client.post("/api/policy/apply", json={
        "kitchen_name": "Amit Cloud Kitchen", "owner_name": "Chef Amit",
        "contact_info": "amit.terms@kitchen.com", "address": "Noida",
        "storage_value": 60000, "plan_id": 3, "requested_coverage": 50000,
        "duration_days": 10, "terms_accepted": True, "terms_version": "v1.0"
    })
    assert res_prem.status_code == 200
    assert res_prem.json()["calculated_premium"] == 233.00


def test_kitchen_policy_approval_inherits_duration():
    """Verify policy activation creates policy with duration_days and total_premium."""
    res_app = client.post("/api/policy/apply", json={
        "kitchen_name": "Amit Cloud Kitchen", "owner_name": "Chef Amit",
        "contact_info": "amit.terms@kitchen.com", "address": "Noida",
        "storage_value": 30000, "plan_id": 2, "requested_coverage": 20000,
        "duration_days": 15, "terms_accepted": True, "terms_version": "v1.0"
    })
    app_id = res_app.json()["id"]

    # Approve
    res_approve = client.put(f"/api/admin/applications/{app_id}", json={
        "status": "Approved", "admin_reason": "Verified cooling setup"
    })
    assert res_approve.status_code == 200

    # Fetch policies
    policies = client.get("/api/admin/policies").json()
    matched = [p for p in policies if p["kitchen_name"] == "Amit Cloud Kitchen"]
    assert len(matched) > 0
    latest = matched[0]
    assert latest["duration_days"] == 15
    assert latest["total_premium"] == 199.50 # (399 / 30) * 15


# ----------------- Customer Order & Terms Acceptance Tests -----------------

def test_customer_order_mandatory_terms():
    """Verify customer order with insurance requires terms_accepted=True."""
    # When terms_accepted is False
    res_fail = client.post("/api/customer/orders", json={
        "customer_id": 1,
        "restaurant_name": "Biryani Express",
        "items_summary": "Chicken Dum Biryani",
        "order_amount": 450.0,
        "plan_id": 4, # Customer Basic
        "terms_accepted": False,
    })
    assert res_fail.status_code == 400
    assert "terms" in res_fail.json()["detail"].lower()

    # When terms_accepted is True
    res_ok = client.post("/api/customer/orders", json={
        "customer_id": 1,
        "restaurant_name": "Biryani Express",
        "items_summary": "Chicken Dum Biryani",
        "order_amount": 450.0,
        "plan_id": 4, # Customer Basic
        "terms_accepted": True,
        "terms_version": "v1.0",
    })
    assert res_ok.status_code == 200
    order_data = res_ok.json()
    assert order_data["terms_accepted"] is True
    assert order_data["terms_version"] == "v1.0"
    assert order_data["has_insurance"] is True


# ----------------- Customer Claim Eligibility & Restrictions Tests -----------------

def test_customer_claim_exclusions():
    """Verify exclusions: customer address mistakes and change of mind are rejected."""
    # Create protected order
    res_order = client.post("/api/customer/orders", json={
        "customer_id": 1,
        "restaurant_name": "Pizza Corner",
        "items_summary": "Farmhouse Pizza",
        "order_amount": 350.0,
        "plan_id": 5, # Standard
        "terms_accepted": True,
        "terms_version": "v1.0",
    })
    assert res_order.status_code == 200
    order_id = res_order.json()["id"]

    # 1. Address mistake
    res_ex1 = client.post("/api/customer/claims/submit", data={
        "customer_id": 1,
        "order_id": order_id,
        "claim_reason": "Spoiled food",
        "description": "Customer address mistake - entered wrong flat number",
        "requested_amount": 200.0,
    }, files={"evidence": ("photo.jpg", io.BytesIO(b"fake image bytes"), "image/jpeg")})
    assert res_ex1.status_code == 400
    assert "excluded" in res_ex1.json()["detail"].lower()

    # 2. Change of mind
    res_ex2 = client.post("/api/customer/claims/submit", data={
        "customer_id": 1,
        "order_id": order_id,
        "claim_reason": "Damaged food",
        "description": "Change of mind, ordered by mistake",
        "requested_amount": 200.0,
    }, files={"evidence": ("photo.jpg", io.BytesIO(b"fake image bytes"), "image/jpeg")})
    assert res_ex2.status_code == 400
    assert "excluded" in res_ex2.json()["detail"].lower()


def test_customer_claim_evidence_and_delay_rules():
    """Verify photo requirement for spoiled/damaged food and >60 min for delivery delay."""
    # Create protected order
    res_order = client.post("/api/customer/orders", json={
        "customer_id": 1,
        "restaurant_name": "Salad Bar",
        "items_summary": "Greek Salad",
        "order_amount": 280.0,
        "plan_id": 4, # Basic (limit 200)
        "terms_accepted": True,
        "terms_version": "v1.0",
    })
    assert res_order.status_code == 200
    order_id = res_order.json()["id"]

    # 1. Spoiled food without photo evidence -> rejected
    res_no_photo = client.post("/api/customer/claims/submit", data={
        "customer_id": 1,
        "order_id": order_id,
        "claim_reason": "Spoiled food",
        "description": "Food smells sour and spoiled",
        "requested_amount": 200.0,
    })
    assert res_no_photo.status_code == 400
    assert "photo evidence is required" in res_no_photo.json()["detail"].lower()

    # 2. Excessive delivery delay <= 60 minutes -> rejected
    res_low_delay = client.post("/api/customer/claims/submit", data={
        "customer_id": 1,
        "order_id": order_id,
        "claim_reason": "Excessive delivery delay",
        "description": "Delivery was 30 mins late",
        "delay_minutes": 30,
        "requested_amount": 150.0,
    })
    assert res_low_delay.status_code == 400
    assert "60 minutes" in res_low_delay.json()["detail"].lower()

    # 3. Excessive delivery delay > 60 minutes -> accepted
    res_valid_delay = client.post("/api/customer/claims/submit", data={
        "customer_id": 1,
        "order_id": order_id,
        "claim_reason": "Excessive delivery delay",
        "description": "Rider delayed due to heavy storm",
        "delay_minutes": 75,
        "requested_amount": 180.0,
    })
    assert res_valid_delay.status_code == 200
    claim_data = res_valid_delay.json()
    assert claim_data["delay_minutes"] == 75
    assert claim_data["status"] == "Pending"

    # 4. Duplicate claim on the same protected order -> rejected
    res_dup = client.post("/api/customer/claims/submit", data={
        "customer_id": 1,
        "order_id": order_id,
        "claim_reason": "Excessive delivery delay",
        "description": "Second claim for same order",
        "delay_minutes": 90,
        "requested_amount": 100.0,
    })
    assert res_dup.status_code == 400
    assert "already been submitted" in res_dup.json()["detail"].lower()


def test_customer_claim_payout_capped_at_plan_limit():
    """Verify compensation payout: min(verified_loss, plan_limit)."""
    # Create order with Basic plan (max compensation ₹200)
    res_order = client.post("/api/customer/orders", json={
        "customer_id": 1,
        "restaurant_name": "Dessert Shop",
        "items_summary": "Chocolate Cake",
        "order_amount": 600.0,
        "plan_id": 4, # Basic limit = 200
        "terms_accepted": True,
        "terms_version": "v1.0",
    })
    assert res_order.status_code == 200
    order_id = res_order.json()["id"]

    # 1. Attempting to claim amount > plan limit (e.g. ₹500 > ₹200) on submit is rejected
    res_over = client.post("/api/customer/claims/submit", data={
        "customer_id": 1,
        "order_id": order_id,
        "claim_reason": "Damaged food",
        "description": "Cake crushed into pieces during handling",
        "requested_amount": 500.0,
    }, files={"evidence": ("photo.jpg", io.BytesIO(b"fake photo bytes"), "image/jpeg")})
    assert res_over.status_code == 400
    assert "exceeds plan maximum limit" in res_over.json()["detail"].lower()

    # 2. Valid claim within limit (₹180 <= ₹200)
    res_claim = client.post("/api/customer/claims/submit", data={
        "customer_id": 1,
        "order_id": order_id,
        "claim_reason": "Damaged food",
        "description": "Cake crushed into pieces during handling",
        "requested_amount": 180.0,
    }, files={"evidence": ("photo.jpg", io.BytesIO(b"fake photo bytes"), "image/jpeg")})
    assert res_claim.status_code == 200
    claim_id = res_claim.json()["id"]

    # 3. Admin review calculates compensation capped at plan limit
    res_review = client.put(f"/api/admin/customer-claims/{claim_id}", json={
        "status": "Approved",
        "approved_amount": 180.0,
        "admin_reason": "Verified crushed package"
    })
    assert res_review.status_code == 200
    data = res_review.json()
    assert data["approved_amount"] == 180.0
    assert data["status"] == "Approved"
