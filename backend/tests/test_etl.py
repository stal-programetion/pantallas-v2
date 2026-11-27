"""Pruebas del ETL Digiturno: parseo de fechas CO, 22.611 turnos e idempotencia."""

from pathlib import Path
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.etl.excel_importer import import_digiturno_excel, parse_colombian_datetime
from app.models.entities import HistoricalSummaryModel, HistoricalTurnModel
from seed.generate_synthetic_digiturno import generate_demo_excel


def test_parse_colombian_datetime():
    dt_am = parse_colombian_datetime("4/05/2026 8:09:38 a. m.")
    dt_pm = parse_colombian_datetime("15/05/2026 2:45:10 p.\xa0m.")
    assert dt_am is not None and dt_am.hour == 8 and dt_am.day == 4 and dt_am.month == 5
    assert dt_pm is not None and dt_pm.hour == 14 and dt_pm.minute == 45


def test_etl_imports_22611_turns_and_is_idempotent(db_session: Session, tmp_path: Path):
    xlsx_path = tmp_path / "demo_may2026.xlsx"
    generate_demo_excel(xlsx_path, seed=202605)

    first_run = import_digiturno_excel(db_session, xlsx_path, is_synthetic=True, source_type="synthetic_demo")
    assert first_run.total_rows == 22611
    assert first_run.inserted_rows == 22611
    assert first_run.invalid_rows == 0
    assert first_run.offices_count == 14

    count_turns = db_session.execute(select(func.count(HistoricalTurnModel.id_turno))).scalar_one()
    count_summaries = db_session.execute(select(func.count(HistoricalSummaryModel.id))).scalar_one()
    assert count_turns == 22611
    assert count_summaries > 0

    # Segunda carga idempotente: no debe duplicar registros
    second_run = import_digiturno_excel(db_session, xlsx_path, is_synthetic=True, source_type="synthetic_demo")
    assert second_run.inserted_rows == 0
    assert second_run.skipped_duplicates == 22611


def test_etl_imports_real_excel_if_present(db_session: Session):
    real_path = Path(__file__).resolve().parents[1] / "seed" / "Historicos Turnos MAY2026.xlsx"
    if not real_path.exists():
        return

    first_run = import_digiturno_excel(db_session, real_path, is_synthetic=False, source_type="excel")
    assert first_run.total_rows == 22611
    assert first_run.inserted_rows == 22611
    assert first_run.invalid_rows == 0
    assert first_run.offices_count == 14
    assert first_run.operators_count == 38

    second_run = import_digiturno_excel(db_session, real_path, is_synthetic=False, source_type="excel")
    assert second_run.inserted_rows == 0
    assert second_run.skipped_duplicates == 22611
