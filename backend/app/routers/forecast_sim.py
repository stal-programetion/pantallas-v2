"""Endpoints de pronóstico de demanda y simulador What-If (Erlang C/A + SimPy)."""

from __future__ import annotations

from typing import Annotated
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.auth import get_current_user, require_roles
from app.database import get_db
from app.engines.forecast import (
    build_fortnight_comparison,
    build_heatmap,
    build_office_comparison,
    build_peaks_summary,
    compute_required_agents_matrix,
    get_office_day_forecast,
)
from app.engines.optimizer import weekday_from_date
from app.engines.simulator import run_what_if_simulation
from app.etl.excel_importer import OPERATING_SLOTS_ALL
from app.models.entities import SystemRulesModel
from app.schemas.api import (
    ApplyScenarioIn,
    DayPlanOut,
    PeaksSummaryOut,
    RequiredAgentsOut,
    SimulationParamsIn,
    SimulationResultOut,
    SlotForecastOut,
    UserOut,
)
from app.services.operations import record_audit, regenerate_full_day_state, serialize_day_plan

router = APIRouter()


@router.get("/forecast/office/{office_id}", response_model=list[SlotForecastOut])
def forecast_office(
    office_id: str,
    _user: Annotated[UserOut, Depends(get_current_user)],
    day_of_week: int = Query(1, alias="dayOfWeek"),
    is_fortnight: bool = Query(False, alias="isFortnight"),
    db: Session = Depends(get_db),
) -> list[SlotForecastOut]:
    return get_office_day_forecast(db, office_id, day_of_week, is_fortnight)


@router.get("/forecast/heatmap/{office_id}")
def forecast_heatmap(
    office_id: str,
    _user: Annotated[UserOut, Depends(get_current_user)],
    is_fortnight: bool = Query(False, alias="isFortnight"),
    db: Session = Depends(get_db),
) -> dict:
    return {
        "officeId": office_id,
        "operatingSlots": OPERATING_SLOTS_ALL,
        "rows": build_heatmap(db, office_id, is_fortnight),
    }


@router.get("/forecast/compare-fortnight/{office_id}")
def forecast_compare_fortnight(
    office_id: str,
    _user: Annotated[UserOut, Depends(get_current_user)],
    day_of_week: int = Query(1, alias="dayOfWeek"),
    db: Session = Depends(get_db),
) -> list[dict]:
    return build_fortnight_comparison(db, office_id, day_of_week)


@router.get("/forecast/compare-offices")
def forecast_compare_offices(
    _user: Annotated[UserOut, Depends(get_current_user)],
    office_a: str = Query("cartagena-chambacu", alias="officeA"),
    office_b: str = Query("monteria-centro", alias="officeB"),
    day_of_week: int = Query(1, alias="dayOfWeek"),
    is_fortnight: bool = Query(True, alias="isFortnight"),
    db: Session = Depends(get_db),
) -> list[dict]:
    return build_office_comparison(db, office_a, office_b, day_of_week, is_fortnight)


@router.get("/forecast/required-agents", response_model=RequiredAgentsOut)
def forecast_required_agents(
    _user: Annotated[UserOut, Depends(get_current_user)],
    day_of_week: int = Query(4, alias="dayOfWeek"),
    is_fortnight: bool = Query(True, alias="isFortnight"),
    db: Session = Depends(get_db),
) -> RequiredAgentsOut:
    matrix = compute_required_agents_matrix(db, day_of_week, is_fortnight)
    return RequiredAgentsOut(operating_slots=OPERATING_SLOTS_ALL, required_by_office=matrix)


@router.get("/forecast/peaks-summary", response_model=PeaksSummaryOut)
def forecast_peaks_summary(
    _user: Annotated[UserOut, Depends(get_current_user)],
    day_of_week: int = Query(4, alias="dayOfWeek"),
    is_fortnight: bool = Query(True, alias="isFortnight"),
    db: Session = Depends(get_db),
) -> PeaksSummaryOut:
    return build_peaks_summary(db, day_of_week, is_fortnight)


@router.post("/simulation/run", response_model=SimulationResultOut)
def run_simulation(
    body: SimulationParamsIn,
    _user: Annotated[UserOut, Depends(get_current_user)],
    db: Session = Depends(get_db),
) -> SimulationResultOut:
    return run_what_if_simulation(db, body)


@router.post("/simulation/apply-scenario", response_model=DayPlanOut)
def apply_scenario(
    body: ApplyScenarioIn,
    user: Annotated[UserOut, Depends(require_roles("ADMIN", "COORDINADOR"))],
    db: Session = Depends(get_db),
) -> DayPlanOut:
    rules = db.get(SystemRulesModel, 1)
    if rules and body.params.target_sla:
        rules.target_sla = body.params.target_sla
        db.commit()

    is_fortnight = body.params.demand_multiplier >= 1.15
    residual_multiplier = round(
        body.params.demand_multiplier / (1.32 if is_fortnight else 1.0), 3
    )
    plan, _, _ = regenerate_full_day_state(
        db,
        fecha=body.fecha,
        day_of_week=weekday_from_date(body.fecha),
        is_fortnight=is_fortnight,
        current_slot="10:00",
        demand_multiplier=residual_multiplier,
        target_sla_override=body.params.target_sla,
        additional_absences=body.params.additional_absences,
        office_id_filter=body.params.office_id_filter,
        agents_override=body.params.agents_override,
    )
    record_audit(
        db,
        user,
        action="SIMULATION_SCENARIO_APPLIED",
        entity_type="day_plan",
        entity_id=plan.id,
        summary=(
            f"Escenario What-If convertido en propuesta de plan "
            f"(demanda x{body.params.demand_multiplier}, +{body.params.additional_absences} ausencias, "
            f"SLA meta {round(body.params.target_sla * 100)}%)."
        ),
        after={
            "demandMultiplier": body.params.demand_multiplier,
            "targetSla": body.params.target_sla,
            "additionalAbsences": body.params.additional_absences,
            "officeIdFilter": body.params.office_id_filter,
        },
    )
    db.commit()
    return serialize_day_plan(plan)
