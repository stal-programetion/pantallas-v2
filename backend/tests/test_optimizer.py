"""Pruebas del motor de asignación PuLP, redistribución y recálculo < 5 s."""

import time
from sqlalchemy.orm import Session

from app.engines.optimizer import generate_day_plan_data
from app.engines.redistribution import generate_redistributions_for_plan
from app.services.operations import regenerate_full_day_state


def test_optimizer_assigns_staggered_lunches_and_explanations(db_session: Session):
    data = generate_day_plan_data(db_session, fecha="2026-10-15", day_of_week=1, is_fortnight=True)
    turnos = data["turnos"]
    assert len(turnos) == 36
    assert len(data["justificaciones"]) > 0

    # st-01 disponible: debe tener exactamente 2 franjas continuas de almuerzo fuera del pico 08:00-10:30
    slots_01 = turnos["st-01"]["slots"]
    lunch_slots = [s for s, info in slots_01.items() if info["estado"] == "almuerzo"]
    assert len(lunch_slots) == 2
    assert all(s >= "11:30" for s in lunch_slots)

    # st-08 ausente: todas sus franjas deben quedar en estado 'ausente'
    assert all(info["estado"] == "ausente" for info in turnos["st-08"]["slots"].values())


def test_redistribution_and_absence_recalc_under_5_seconds(db_session: Session):
    t0 = time.perf_counter()
    plan, recs, alerts = regenerate_full_day_state(
        db_session, fecha="2026-10-15", day_of_week=1, is_fortnight=True, current_slot="10:00"
    )
    elapsed = time.perf_counter() - t0
    assert elapsed < 5.0
    assert plan.sla_proyectado_red > 0.0
    assert len(alerts) > 0

    # Verificar coherencia de recomendaciones generadas
    recs_check = generate_redistributions_for_plan(
        db_session, "2026-10-15", plan.turnos, franja="10:00", day_of_week=1, is_fortnight=True
    )
    for r in recs_check:
        assert r["modalidad"] in ("presencial", "virtual")
        assert "motivo" in r and len(r["motivo"]) > 10
