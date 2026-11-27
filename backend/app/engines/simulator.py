"""Simulador de eventos discretos (SimPy) con abandono para validar escenarios What-If."""

from __future__ import annotations

import random
import simpy

from app.engines.erlang import calculate_required_agents, evaluate_erlang_a
from app.engines.forecast import get_office_day_forecast
from app.models.entities import AbsenceModel, OfficeModel, StaffModel, SystemRulesModel
from app.schemas.api import (
    ErlangCurvePointOut,
    SimulationOfficeOut,
    SimulationParamsIn,
    SimulationResultOut,
)
from sqlalchemy import select
from sqlalchemy.orm import Session


def simulate_office_des(
    lambda_hour: float,
    avg_service_min: float,
    agents: int,
    target_wait_min: float = 10.0,
    avg_patience_min: float = 28.0,
    horizon_minutes: float = 120.0,
    replications: int = 8,
    seed: int = 4242,
) -> tuple[float, float, float]:
    """Ejecuta simulación de eventos discretos (SimPy) con abandono.

    Retorna (espera_promedio_min, sla_cumplimiento, tasa_abandono_pct).
    """
    if lambda_hour <= 0:
        return 0.0, 1.0, 0.0
    if agents <= 0:
        return 60.0, 0.0, 100.0

    waits_all: list[float] = []
    sla_hits = 0
    served_or_abandoned = 0
    abandoned_count = 0

    for rep in range(replications):
        rng = random.Random(seed + rep * 97)
        env = simpy.Environment()
        servers = simpy.Resource(env, capacity=agents)

        def customer(arrival_t: float) -> simpy.events.Event:
            nonlocal sla_hits, served_or_abandoned, abandoned_count
            patience = rng.expovariate(1.0 / max(3.0, avg_patience_min))
            with servers.request() as req:
                res = yield req | env.timeout(patience)
                wait_t = env.now - arrival_t
                served_or_abandoned += 1
                if req in res:
                    waits_all.append(wait_t)
                    if wait_t <= target_wait_min:
                        sla_hits += 1
                    svc_t = rng.expovariate(1.0 / max(1.0, avg_service_min))
                    yield env.timeout(svc_t)
                else:
                    abandoned_count += 1
                    waits_all.append(wait_t)

        def arrival_generator() -> simpy.events.Event:
            rate_per_min = lambda_hour / 60.0
            while env.now < horizon_minutes:
                inter = rng.expovariate(rate_per_min)
                yield env.timeout(inter)
                if env.now >= horizon_minutes:
                    break
                env.process(customer(env.now))

        env.process(arrival_generator())
        env.run(until=horizon_minutes + 30.0)

    if served_or_abandoned == 0:
        return 0.0, 1.0, 0.0

    avg_wait = sum(waits_all) / max(1, len(waits_all))
    sla = sla_hits / served_or_abandoned
    abandon_pct = (abandoned_count / served_or_abandoned) * 100.0
    return round(avg_wait, 2), round(sla, 4), round(abandon_pct, 2)


def run_what_if_simulation(db: Session, params: SimulationParamsIn) -> SimulationResultOut:
    """Ejecuta simulación comparativa Base vs. What-If combinando Erlang A y SimPy."""
    all_offices = db.execute(select(OfficeModel)).scalars().all()
    if params.office_id_filter and params.office_id_filter != "todos":
        offices = [o for o in all_offices if o.id == params.office_id_filter]
        if not offices:
            offices = all_offices
    else:
        offices = all_offices

    staff_list = db.execute(select(StaffModel)).scalars().all()
    active_absences = db.execute(select(AbsenceModel).where(AbsenceModel.estado == "activa")).scalars().all()
    absent_ids = {a.colaborador_id for a in active_absences}
    rules = db.get(SystemRulesModel, 1)
    default_wait = rules.max_wait_min if rules else 10

    office_rows: list[SimulationOfficeOut] = []
    sum_wait_act = 0.0
    sum_wait_sim = 0.0
    sum_sla_act = 0.0
    sum_sla_sim = 0.0
    sum_ab_act = 0.0
    sum_ab_sim = 0.0
    total_agents_act = 0
    total_agents_req = 0

    for off in offices:
        day_fc = get_office_day_forecast(db, off.id, day_of_week=1, is_fortnight=False)
        # Franja pico representativa 09:00
        peak_fc = next((f for f in day_fc if f.franja == "09:00"), day_fc[0])
        base_lambda = peak_fc.tasa_llegadas_hora
        sim_lambda = base_lambda * params.demand_multiplier
        wait_limit = off.tiempo_espera_max_min or default_wait

        present_staff = [
            s for s in staff_list
            if s.oficina_base_id == off.id and s.id not in absent_ids
        ]
        agentes_actuales = max(1, len(present_staff))

        agentes_simulados = (
            params.agents_override.get(off.id, agentes_actuales)
            if params.agents_override
            else agentes_actuales
        )
        # Si hay filtro de oficina o es Cartagena en vista global, descuenta ausencias adicionales
        if params.additional_absences > 0:
            if (params.office_id_filter and params.office_id_filter == off.id) or (
                not params.office_id_filter and off.id == "cartagena-chambacu"
            ):
                agentes_simulados = max(1, agentes_simulados - params.additional_absences)

        patience = 22.0 if peak_fc.tasa_abandono > 0.08 else 32.0
        w_act, sla_act, ab_act = simulate_office_des(
            base_lambda,
            peak_fc.tiempo_atencion_promedio_min,
            agentes_actuales,
            wait_limit,
            avg_patience_min=patience,
            replications=5,
            seed=1000 + abs(hash(off.id)) % 500,
        )
        w_sim, sla_sim, ab_sim = simulate_office_des(
            sim_lambda,
            peak_fc.tiempo_atencion_promedio_min,
            agentes_simulados,
            wait_limit,
            avg_patience_min=patience,
            replications=5,
            seed=2000 + abs(hash(off.id)) % 500,
        )

        req_agents, _ = calculate_required_agents(
            sim_lambda,
            peak_fc.tiempo_atencion_promedio_min,
            params.target_sla,
            wait_limit,
            off.capacidad_puestos + 4,
        )

        sum_wait_act += w_act
        sum_wait_sim += w_sim
        sum_sla_act += sla_act
        sum_sla_sim += sla_sim
        sum_ab_act += ab_act
        sum_ab_sim += ab_sim
        total_agents_act += agentes_actuales
        total_agents_req += req_agents

        office_rows.append(
            SimulationOfficeOut(
                oficina_id=off.id,
                oficina_nombre=off.nombre,
                sla_actual=round(sla_act, 3),
                sla_simulado=round(sla_sim, 3),
                espera_actual_min=round(w_act, 1),
                espera_simulada_min=round(w_sim, 1),
                agentes_actuales=agentes_actuales,
                agentes_simulados=req_agents,
                abandono_actual_porcentaje=round(ab_act, 1),
                abandono_simulado_porcentaje=round(ab_sim, 1),
            )
        )

    # Curva Erlang A/C para la oficina foco
    focus_off = offices[0]
    focus_fc = next(
        (f for f in get_office_day_forecast(db, focus_off.id, 1, False) if f.franja == "09:00"),
        get_office_day_forecast(db, focus_off.id, 1, False)[0],
    )
    focus_lambda = focus_fc.tasa_llegadas_hora * params.demand_multiplier
    max_curve = max(8, focus_off.capacidad_puestos + 2)
    curve: list[ErlangCurvePointOut] = []
    for c in range(1, max_curve + 1):
        ev = evaluate_erlang_a(
            focus_lambda,
            focus_fc.tiempo_atencion_promedio_min,
            c,
            focus_off.tiempo_espera_max_min or default_wait,
        )
        curve.append(
            ErlangCurvePointOut(
                agentes=f"{c} Agentes",
                c=c,
                nivel_servicio=round(ev.nivel_servicio * 100),
                espera_min=round(ev.tiempo_espera_promedio_min, 1),
            )
        )

    n = max(1, len(offices))
    return SimulationResultOut(
        params=params,
        total_agentes_actuales=total_agents_act,
        total_agentes_simulados=total_agents_req,
        sla_actual_ponderado=round(sum_sla_act / n, 3),
        sla_simulado_ponderado=round(sum_sla_sim / n, 3),
        espera_actual_min=round(sum_wait_act / n, 1),
        espera_simulada_min=round(sum_wait_sim / n, 1),
        abandono_actual_porcentaje=round(sum_ab_act / n, 1),
        abandono_simulado_porcentaje=round(sum_ab_sim / n, 1),
        curva_erlang=curve,
        oficinas_afectadas=office_rows,
    )
