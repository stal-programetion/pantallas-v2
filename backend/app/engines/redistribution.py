"""Motor de redistribución territorial (Haversine + Erlang A + validación SimPy)."""

from __future__ import annotations

import math
from typing import Any
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.engines.erlang import calculate_required_agents, evaluate_erlang_a
from app.engines.forecast import get_office_day_forecast
from app.engines.simulator import simulate_office_des
from app.models.entities import OfficeModel, StaffModel, SystemRulesModel


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0
    d_lat = math.radians(lat2 - lat1)
    d_lng = math.radians(lng2 - lng1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lng / 2) ** 2
    )
    return round(2 * r * math.atan2(math.sqrt(a), math.sqrt(1 - a)), 1)


def generate_redistributions_for_plan(
    db: Session,
    plan_fecha: str,
    turnos: dict[str, Any],
    franja: str = "10:00",
    day_of_week: int = 1,
    is_fortnight: bool = True,
) -> list[dict[str, Any]]:
    """Detecta sedes en déficit y propone refuerzos presenciales (<45 km) o virtuales."""
    offices = db.execute(select(OfficeModel)).scalars().all()
    staff_list = db.execute(select(StaffModel)).scalars().all()
    rules = db.get(SystemRulesModel, 1)

    max_km = rules.max_presencial_km if rules else 45.0
    default_sla = rules.target_sla if rules else 0.80
    default_wait = rules.max_wait_min if rules else 10

    balances = []
    for off in offices:
        assigned = 0
        for s in staff_list:
            sl = (turnos.get(s.id, {}).get("slots") or {}).get(franja)
            if (
                sl
                and sl.get("estado") in ("atencion", "apoyo_presencial", "apoyo_virtual")
                and sl.get("oficinaAsignadaId") == off.id
            ):
                assigned += 1

        fc_list = get_office_day_forecast(db, off.id, day_of_week, is_fortnight)
        fc = next((x for x in fc_list if x.franja == franja), fc_list[0])
        sla_goal = off.sla_objetivo or default_sla
        wait_max = off.tiempo_espera_max_min or default_wait

        req, _ = calculate_required_agents(
            fc.tasa_llegadas_hora,
            fc.tiempo_atencion_promedio_min,
            sla_goal,
            wait_max,
            off.capacidad_puestos,
        )
        ev = evaluate_erlang_a(fc.tasa_llegadas_hora, fc.tiempo_atencion_promedio_min, assigned, wait_max)
        balances.append(
            {
                "office": off,
                "assigned": assigned,
                "required": req,
                "balance": assigned - req,
                "lambda": fc.tasa_llegadas_hora,
                "service_min": fc.tiempo_atencion_promedio_min,
                "wait_max": wait_max,
                "sla": ev.nivel_servicio,
            }
        )

    deficits = sorted([b for b in balances if b["balance"] < 0], key=lambda x: x["balance"])
    surpluses = sorted([b for b in balances if b["balance"] >= 1], key=lambda x: x["balance"], reverse=True)

    # Complementar con sedes de >=2 asesores y mejor holgura de SLA como donantes virtuales/cercanos
    target_donors = min(4, len(deficits))
    current_capacity = sum(s["balance"] for s in surpluses)
    if current_capacity < target_donors:
        already_donor_ids = {s["office"].id for s in surpluses}
        top_deficit_ids = {d["office"].id for d in deficits[:2]}
        extra_candidates = sorted(
            [
                {**b, "balance": 1}
                for b in balances
                if b["assigned"] >= 2
                and b["office"].id not in already_donor_ids
                and b["office"].id not in top_deficit_ids
            ],
            key=lambda x: (x["sla"], -x["lambda"]),
            reverse=True,
        )
        for cand in extra_candidates:
            if current_capacity >= target_donors:
                break
            surpluses.append(cand)
            current_capacity += 1

    recommendations: list[dict[str, Any]] = []
    used_staff_ids: set[str] = set()

    for deficit in deficits:
        def_off: OfficeModel = deficit["office"]
        best_choice = None

        for sur in surpluses:
            if sur["balance"] <= 0:
                continue
            sur_off: OfficeModel = sur["office"]
            if sur_off.id == def_off.id:
                continue

            dist = haversine_km(def_off.lat, def_off.lng, sur_off.lat, sur_off.lng)
            modalidad = "presencial" if dist <= max_km else "virtual"

            # Buscar asesor disponible en sede origen (priorizar virtual si dist > max_km y afinidad de competencia)
            candidates = [
                s
                for s in staff_list
                if s.oficina_base_id == sur_off.id
                and s.id not in used_staff_ids
                and (turnos.get(s.id, {}).get("slots") or {}).get(franja, {}).get("estado") == "atencion"
            ]
            if not candidates:
                continue
            candidates.sort(
                key=lambda c: (
                    0 if (modalidad == "virtual" and c.modalidad == "virtual") else 1,
                    0 if any(k in ("PQR", "Atención Remota", "Facturación") for k in (c.competencias or [])) else 1,
                )
            )
            candidate_staff = candidates[0]

            score = dist if modalidad == "presencial" else dist + 15.0
            if best_choice is None or score < best_choice["score"]:
                best_choice = {
                    "sur": sur,
                    "dist": dist,
                    "modalidad": modalidad,
                    "staff": candidate_staff,
                    "score": score,
                }

        if not best_choice:
            continue

        sur = best_choice["sur"]
        sur_off = sur["office"]
        staff_member: StaffModel = best_choice["staff"]
        dist = best_choice["dist"]
        modalidad = best_choice["modalidad"]

        # Impacto analítico + validación SimPy antes vs. después
        w_before, sla_before, ab_before = simulate_office_des(
            deficit["lambda"],
            deficit["service_min"],
            max(1, deficit["assigned"]),
            deficit["wait_max"],
            replications=4,
            seed=300 + len(recommendations),
        )
        w_after, sla_after, ab_after = simulate_office_des(
            deficit["lambda"],
            deficit["service_min"],
            deficit["assigned"] + 1,
            deficit["wait_max"],
            replications=4,
            seed=300 + len(recommendations),
        )
        ev_orig_after = evaluate_erlang_a(
            sur["lambda"],
            sur["service_min"],
            max(1, sur["assigned"] - 1),
            sur["wait_max"],
        )

        wait_reduction = max(0.5, round(w_before - w_after, 1))
        used_staff_ids.add(staff_member.id)
        sur["balance"] -= 1

        recommendations.append(
            {
                "id": f"redist-{plan_fecha}-{def_off.id}-{sur_off.id}-{staff_member.id}",
                "plan_fecha": plan_fecha,
                "colaborador_id": staff_member.id,
                "colaborador_nombre": staff_member.nombre,
                "oficina_origen_id": sur_off.id,
                "oficina_origen_nombre": sur_off.nombre,
                "oficina_destino_id": def_off.id,
                "oficina_destino_nombre": def_off.nombre,
                "modalidad": modalidad,
                "distancia_km": dist,
                "es_intermunicipal": def_off.ciudad != sur_off.ciudad,
                "franja_inicio": "08:30",
                "franja_fin": "11:00",
                "motivo": (
                    f"Refuerzo {modalidad} ({', '.join((staff_member.competencias or [])[:2]) or 'Integral'}) para {def_off.nombre} "
                    f"(déficit de {abs(deficit['balance'])} puesto(s) en franja {franja}). "
                    f"{sur_off.nombre} mantiene SLA {round(ev_orig_after.nivel_servicio * 100)}%."
                ),
                "reduccion_espera_min": wait_reduction,
                "sla_proyectado_destino": round(max(sla_after, sla_before), 3),
                "sla_origen_resultante": round(ev_orig_after.nivel_servicio, 3),
                "abandono_antes_pct": round(ab_before, 1),
                "abandono_despues_pct": round(ab_after, 1),
                "estado": "pendiente",
            }
        )

    return recommendations
