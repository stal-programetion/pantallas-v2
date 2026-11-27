"""Fixtures compartidas para las pruebas pytest del backend."""

from __future__ import annotations

from pathlib import Path
import sys
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.database import Base, get_db  # noqa: E402
from app.main import create_app  # noqa: E402
from app.models.entities import OfficeModel, StaffModel, SystemRulesModel, AbsenceModel  # noqa: E402
from seed.synthetic_catalogs import SYNTHETIC_ABSENCES, SYNTHETIC_OFFICES, SYNTHETIC_STAFF  # noqa: E402


@pytest.fixture()
def db_session(tmp_path: Path) -> Session:
    db_file = tmp_path / "test_surtigas.db"
    engine = create_engine(f"sqlite:///{db_file}", connect_args={"check_same_thread": False})
    TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)
    Base.metadata.create_all(bind=engine)

    with TestingSession() as db:
        db.add(SystemRulesModel(id=1))
        db.add_all([OfficeModel(**o) for o in SYNTHETIC_OFFICES])
        db.add_all([StaffModel(**s) for s in SYNTHETIC_STAFF])
        db.add_all([AbsenceModel(**a) for a in SYNTHETIC_ABSENCES])
        db.commit()
        yield db

    engine.dispose()


@pytest.fixture()
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    db_file = tmp_path / "api_test.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_file}")
    monkeypatch.setenv("SEED_ON_STARTUP", "false")

    engine = create_engine(f"sqlite:///{db_file}", connect_args={"check_same_thread": False})
    TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)
    Base.metadata.create_all(bind=engine)

    from app.services.operations import regenerate_full_day_state

    with TestingSession() as seed_db:
        seed_db.add(SystemRulesModel(id=1))
        seed_db.add_all([OfficeModel(**o) for o in SYNTHETIC_OFFICES])
        seed_db.add_all([StaffModel(**s) for s in SYNTHETIC_STAFF])
        seed_db.add_all([AbsenceModel(**a) for a in SYNTHETIC_ABSENCES])
        seed_db.commit()
        regenerate_full_day_state(seed_db, fecha="2026-10-15", day_of_week=1, is_fortnight=True)

    app = create_app()

    def override_get_db():
        with TestingSession() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as tc:
        yield tc
    engine.dispose()
