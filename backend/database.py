"""
database.py — SQLite database setup using SQLAlchemy.

Creates a local SQLite file (foodshield.db) inside the backend directory.
The database and all tables are created automatically when the app starts.
"""

from pathlib import Path
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, declarative_base

# SQLite database file lives next to this script in the backend directory
DB_PATH = Path(__file__).resolve().parent / "foodshield.db"
DATABASE_URL = f"sqlite:///{DB_PATH}"

# Create the SQLAlchemy engine
# check_same_thread=False is needed for SQLite with FastAPI (multiple threads)
engine = create_engine(
    DATABASE_URL, connect_args={"check_same_thread": False}
)

@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA synchronous=NORMAL")
    cursor.close()

# Each request will get its own database session
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class that our models inherit from
Base = declarative_base()


def get_db():
    """
    FastAPI dependency — yields a database session and closes it after use.
    Usage:  db: Session = Depends(get_db)
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
