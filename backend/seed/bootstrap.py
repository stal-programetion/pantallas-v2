"""Inicialización de base de datos con catálogos, Excel histórico real y plan inicial."""

from __future__ import annotations

import logging
import os
from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.engines.forecast import (
    FALLBACK_HOURLY_PROFILE,
    FALLBACK_OFFICE_BASE_LAMBDA,
    FALLBACK_WEEKDAY_WEIGHTS,
)
from app.engines.optimizer import weekday_from_date
from app.etl.excel_importer import OPERATING_SLOTS_ALL, import_digiturno_excel
from app.models.entities import (
    AbsenceModel,
    DayPlanModel,
    EtlRunModel,
    HistoricalSummaryModel,
    HistoricalTurnModel,
    OfficeModel,
    StaffModel,
    SystemRulesModel,
)
from app.services.operations import regenerate_full_day_state
from seed.generate_synthetic_digiturno import generate_demo_excel
from seed.synthetic_catalogs import SYNTHETIC_ABSENCES, SYNTHETIC_OFFICES, SYNTHETIC_STAFF

logger = logging.getLogger("surtigas.bootstrap")


def resolve_real_excel_path(configured_path: str) -> Path | None:
    """Busca el archivo Excel real en las rutas esperadas (data/ o seed/)."""
    seed_dir = Path(__file__).resolve().parent
    candidates = [
        Path(configured_path),
        seed_dir / "Historicos Turnos MAY2026.xlsx",
        seed_dir / "Historicos_Turnos_MAY2026.xlsx",
        Path("/app/seed_data/Historicos Turnos MAY2026.xlsx"),
    ]
    for candidate in candidates:
        if candidate.exists() and candidate.is_file():
            return candidate
    return None


def _seed_fast_vercel_summaries(db: Session, fortnight_multiplier: float = 1.32) -> None:
    """Puebla resúmenes históricos calibrados en <1s para arranque frío serverless en Vercel."""
    summaries: list[HistoricalSummaryModel] = []
    for off in SYNTHETIC_OFFICES:
        off_id = off["id"]
        base_lambda = FALLBACK_OFFICE_BASE_LAMBDA.get(off_id, 5.0)
        for dow in range(1, 6):
            day_w = FALLBACK_WEEKDAY_WEIGHTS.get(dow, 1.0)
            for slot in OPERATING_SLOTS_ALL:
                slot_w = FALLBACK_HOURLY_PROFILE.get(slot, 0.8)
                if slot in ("08:00", "08:30", "09:00", "09:30", "10:00"):
                    tramite = "Peticiones, Quejas y Reclamos (PQR)"
                    svc_sec = 672.0
                elif slot in ("14:00", "14:30", "15:00"):
                    tramite = "Convenio de pago y Solicitudes"
                    svc_sec = 564.0
                else:
                    tramite = "Información y Facturación"
                    svc_sec = 444.0

                for is_fortnight in (False, True):
                    mult = fortnight_multiplier if is_fortnight else 1.0
                    lambda_h = round(base_lambda * day_w * slot_w * mult, 2)
                    mean_arr = round(lambda_h * 0.5, 2)
                    summaries.append(
                        HistoricalSummaryModel(
                            oficina_id=off_id,
                            dia_semana=dow,
                            franja=slot,
                            es_quincena=is_fortnight,
                            llegadas_promedio=mean_arr,
                            ic_inferior=round(max(0.0, mean_arr * 0.85), 2),
                            ic_superior=round(mean_arr * 1.15, 2),
                            tasa_llegadas_hora=lambda_h,
                            tiempo_espera_promedio_seg=960.0 if off_id == "cartagena-chambacu" else 420.0,
                            tiempo_atencion_promedio_seg=svc_sec,
                            tasa_abandono=0.098 if off_id in ("cartagena-chambacu", "monteria-centro", "magangue") else 0.045,
                            tramite_principal=tramite,
                            muestras=4,
                        )
                    )
    db.bulk_save_objects(summaries)
    db.add(
        EtlRunModel(
            filename="demo_calibrado_vercel",
            source_type="vercel_demo",
            total_rows=22611,
            inserted_rows=22611,
            skipped_duplicates=0,
            invalid_rows=0,
            cleaned_service_outliers=678,
            date_min="2026-05-04",
            date_max="2026-05-29",
            offices_count=14,
            operators_count=38,
            warnings=[
                "Modo demo serverless Vercel inicializado con resúmenes calibrados al patrón histórico Digiturno.",
            ],
        )
    )
    db.commit()


def bootstrap_database(db: Session) -> None:
    """Puebla datos iniciales si la BD está vacía."""
    settings = get_settings()

    if db.get(SystemRulesModel, 1) is None:
        db.add(
            SystemRulesModel(
                id=1,
                target_sla=0.80,
                max_wait_min=10,
                max_presencial_km=45.0,
                lunch_duration_min=60,
                fortnight_multiplier=1.32,
                min_agents_open_office=1,
                source_mode=settings.digiturno_source_mode if settings.digiturno_source_mode in ("mock", "real") else "mock",
            )
        )
        db.commit()

    if db.execute(select(func.count(OfficeModel.id))).scalar_one() == 0:
        db.add_all([OfficeModel(**o) for o in SYNTHETIC_OFFICES])
        db.commit()

    if db.execute(select(func.count(StaffModel.id))).scalar_one() == 0:
        db.add_all([StaffModel(**s) for s in SYNTHETIC_STAFF])
        db.commit()

    if db.execute(select(func.count(AbsenceModel.id))).scalar_one() == 0:
        db.add_all([AbsenceModel(**a) for a in SYNTHETIC_ABSENCES])
        db.commit()

    if db.execute(select(func.count(HistoricalTurnModel.id_turno))).scalar_one() == 0:
        if os.environ.get("VERCEL"):
            if db.execute(select(func.count(HistoricalSummaryModel.id))).scalar_one() == 0:
                logger.info("Inicializando resúmenes históricos calibrados para entorno serverless Vercel")
                _seed_fast_vercel_summaries(db)
        else:
            real_excel = resolve_real_excel_path(settings.excel_data_path)
            if real_excel is not None:
                logger.info("Importando Excel real de Digiturno desde %s", real_excel.name)
                import_digiturno_excel(db, real_excel, is_synthetic=False, source_type="excel")
            else:
                demo_excel = Path(__file__).resolve().parent / "demo_digiturno_may2026.xlsx"
                if not demo_excel.exists():
                    logger.info("Generando Excel sintético calibrado de 22.611 turnos")
                    generate_demo_excel(demo_excel)
                logger.info("Importando Excel sintético calibrado de demostración")
                import_digiturno_excel(db, demo_excel, is_synthetic=True, source_type="synthetic_demo")

    if db.execute(select(func.count(DayPlanModel.id))).scalar_one() == 0:
        regenerate_full_day_state(
            db,
            fecha=settings.default_plan_date,
            day_of_week=weekday_from_date(settings.default_plan_date),
            is_fortnight=True,
            current_slot="10:00",
        )
