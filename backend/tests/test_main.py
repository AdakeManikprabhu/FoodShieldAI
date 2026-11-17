import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database import Base, get_db
from main import app

# Use a dedicated SQLite file for test_main
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_main.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

@pytest.fixture(autouse=True)
def setup_db():
    app.dependency_overrides[get_db] = override_get_db
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    app.dependency_overrides.pop(get_db, None)

client = TestClient(app)

def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"

def test_normal_no_claim():
    r = client.post("/api/simulate/normal")
    data = r.json()
    assert data["triggered"] is False
    claims = client.get("/api/claims").json()
    assert len(claims) == 0

def test_excursion_claim_trigger():
    client.post("/api/simulate/excursion")
    r = client.post("/api/simulate/excursion")
    data = r.json()
    assert data["triggered"] is True
    assert data["claim"] is not None
    claims = client.get("/api/claims").json()
    assert len(claims) == 1

def test_no_duplicate_claim():
    client.post("/api/simulate/excursion")
    client.post("/api/simulate/excursion")
    r = client.post("/api/simulate/excursion")
    data = r.json()
    assert data["triggered"] is True

def test_power_outage_no_claim():
    r = client.post("/api/simulate/power-outage")
    data = r.json()
    assert data["triggered"] is False
