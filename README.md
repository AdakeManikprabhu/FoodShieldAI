# FoodShieldAI: Parametric Insurance for Food Spoilage and Cloud Kitchens

A college mini-project demonstrating parametric insurance concepts using
simulated temperature monitoring for cloud kitchen food safety.

**All sensor readings and payouts are simulated demo data.**

---

## Tech Stack

| Layer    | Technology               |
|----------|--------------------------|
| Frontend | React + Vite + Tailwind CSS |
| Charts   | Recharts                 |
| Backend  | Python FastAPI           |
| Database | SQLite (via SQLAlchemy)  |

---

## How to Run (Windows)

You need **two terminals** — one for the backend and one for the frontend.

### Terminal 1 — Backend (FastAPI)

```powershell
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

The API will be available at:
- **API:** http://localhost:8000
- **Swagger Docs:** http://localhost:8000/docs

### Terminal 2 — Frontend (Vite + React)

```powershell
cd frontend
npm install
npm run dev
```

The app will be available at:
- **App:** http://localhost:5173

---

## Demo Thresholds (configurable in `backend/main.py`)

| Parameter          | Value | Description                         |
|--------------------|-------|-------------------------------------|
| SAFE_TEMP          | 4°C   | Normal refrigerator baseline        |
| EXCURSION_TEMP     | 35°C  | Simulated excursion temperature     |
| RISK_MEDIUM_THRESH | 15°C  | Above this → Medium risk            |
| RISK_HIGH_THRESH   | 25°C  | Above this → High risk              |
| TRIGGER_TEMP       | 30°C  | Insurance trigger temperature       |
| TRIGGER_COUNT      | 2     | Consecutive readings to trigger     |
| MAX_PAYOUT         | $5000 | Maximum demo payout                 |

---

## API Endpoints

| Method | Endpoint                    | Description                    |
|--------|-----------------------------|--------------------------------|
| GET    | /api/health                 | Health check                   |
| GET    | /api/dashboard              | Dashboard summary              |
| GET    | /api/readings               | All temperature readings       |
| GET    | /api/incidents              | All incidents                  |
| GET    | /api/claims                 | All claims                     |
| POST   | /api/simulate/normal        | Record normal reading (4°C)    |
| POST   | /api/simulate/excursion     | Record excursion event (35°C)  |
| POST   | /api/simulate/power-outage  | Record power outage event      |

---

## Project Structure

```
FOODSHIELD/
├── backend/
│   ├── main.py            # FastAPI app and endpoints
│   ├── database.py        # SQLite + SQLAlchemy setup
│   ├── models.py          # Database table definitions
│   ├── schemas.py         # Pydantic request/response schemas
│   └── requirements.txt   # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── api.js         # API service (fetch calls)
│   │   ├── App.jsx        # Main app component
│   │   ├── index.css      # Tailwind CSS
│   │   └── components/
│   │       ├── DashboardCard.jsx
│   │       ├── TemperatureChart.jsx
│   │       ├── SimulatorButtons.jsx
│   │       └── ClaimsTable.jsx
│   ├── vite.config.js     # Vite config with API proxy
│   └── package.json
├── .gitignore
└── README.md
```
