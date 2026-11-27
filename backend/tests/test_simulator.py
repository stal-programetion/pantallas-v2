"""Pruebas del simulador de eventos discretos SimPy (antes vs. después con abandono)."""

from sqlalchemy.orm import Session

from app.engines.simulator import run_what_if_simulation, simulate_office_des
from app.schemas.api import SimulationParamsIn


def test_simpy_reinforcement_reduces_wait_and_abandonment():
    # Escenario Cartagena saturada: 4 vs 6 agentes
    wait_before, sla_before, ab_before = simulate_office_des(
        lambda_hour=26.0,
        avg_service_min=12.0,
        agents=4,
        target_wait_min=10.0,
        avg_patience_min=22.0,
        replications=6,
    )
    wait_after, sla_after, ab_after = simulate_office_des(
        lambda_hour=26.0,
        avg_service_min=12.0,
        agents=7,
        target_wait_min=10.0,
        avg_patience_min=22.0,
        replications=6,
    )
    assert wait_after < wait_before
    assert ab_after <= ab_before
    assert sla_after > sla_before


def test_what_if_simulation_returns_curve_and_office_impact(db_session: Session):
    res = run_what_if_simulation(
        db_session,
        SimulationParamsIn(
            additional_absences=2,
            demand_multiplier=1.25,
            target_sla=0.80,
            office_id_filter="cartagena-chambacu",
        ),
    )
    assert len(res.oficinas_afectadas) == 1
    assert res.oficinas_afectadas[0].oficina_id == "cartagena-chambacu"
    assert len(res.curva_erlang) >= 8
    assert res.abandono_simulado_porcentaje >= 0.0
