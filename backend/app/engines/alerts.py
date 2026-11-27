"""Motor de detección de alertas operativas proactivas."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.engines.erlang import evaluate_erlang_a
from app.engines.forecast import get_office_day_forecast
from app.etl.excel_importer import OPERATING_SLOTS_ALL
from app.models.entities import AbsenceModel, OfficeModel, StaffModel, SystemRulesModel


def evaluate_alerts_for_plan(
    db: Session,
    plan_fecha: str,
    turnos: dict[str, Any],
    current_slot: str = "10:00",
    day_of_week: int = 1,
    is_fortnight: bool = True,
) -> list[dict[str, Any]]:
    """Genera alertas por ausencias sin cubrir, SLA en riesgo, picos inminentes y almuerzos."""
    offices = db.execute(select(OfficeModel)).scalars().all()
    staff_list = db.execute(select(StaffModel)).scalars().all()
    absences = db.execute(select(AbsenceModel).where(AbsenceModel.estado == "activa")).scalars().all()
    rules = db.get(SystemRulesModel, 1)

    default_sla = rules.target_sla if rules else 0.80
    default_wait = rules.max_wait_min if rules else 10
    now_iso = datetime.now(timezone.utc).isoformat()
    alerts: list[dict[str, Any]] = []

    staff_map = {s.id: s for s in staff_list}
    office_map = {o.id: o for o in offices}

    # 1. Ausencias activas sin refuerzo en la franja actual
    for ab in absences:
        st = staff_map.get(ab.colaborador_id)
        if not st:
            continue
        off = office_map.get(st.oficina_base_id)
        if not off:
            continue

        has_reinforcement = any(
            (turnos.get(s.id, {}).get("slots") or {}).get(current_slot, {}).get("estado")
            in ("apoyo_virtual", "apoyo_presencial")
            and (turnos.get(s.id, {}).get("slots") or {}).get(current_slot, {}).get("oficinaAsignadaId") == off.id
            for s in staff_list
        )
        if not has_reinforcement:
            alerts.append(
                {
                    "id": f"alt-abs-{ab.id}",
                    "plan_fecha": plan_fecha,
                    "tipo": "ausencia_sin_cubrir",
                    "severidad": "critica" if off.capacidad_puestos <= 3 else "advertencia",
                    "oficina_id": off.id,
                    "oficina_nombre": off.nombre,
                    "titulo": f"Ausencia no cubierta en {off.ciudad}",
                    "mensaje": (
                        f"Novedad ({ab.tipo.replace('_', ' ')}) reduce la dotación de {off.nombre}. "
                        "Se recomienda activar refuerzo sugerido."
                    ),
                    "franja": current_slot,
                    "accion_sugerida": "Asignar apoyo virtual o presencial desde sede con superávit.",
                    "accion_tipo": "redistribuir",
                    "timestamp": now_iso,
                    "leida": False,
                }
            )

    # 2. SLA en riesgo, picos inminentes (~20-30 min) y almuerzos descubiertos
    cur_idx = OPERATING_SLOTS_ALL.index(current_slot) if current_slot in OPERATING_SLOTS_ALL else 4
    next_slot = OPERATING_SLOTS_ALL[cur_idx + 1] if cur_idx + 1 < len(OPERATING_SLOTS_ALL) else None

    for off in offices:
        fc_day = {f.franja: f for f in get_office_day_forecast(db, off.id, day_of_week, is_fortnight)}
        fc = fc_day.get(current_slot) or next(iter(fc_day.values()))
        sla_goal = off.sla_objetivo or default_sla
        wait_max = off.tiempo_espera_max_min or default_wait

        active_now = sum(
            1
            for s in staff_list
            if (turnos.get(s.id, {}).get("slots") or {}).get(current_slot, {}).get("estado")
            in ("atencion", "apoyo_virtual", "apoyo_presencial")
            and (turnos.get(s.id, {}).get("slots") or {}).get(current_slot, {}).get("oficinaAsignadaId") == off.id
        )

        ev = evaluate_erlang_a(fc.tasa_llegadas_hora, fc.tiempo_atencion_promedio_min, active_now, wait_max)
        if ev.nivel_servicio < 0.70:
            alerts.append(
                {
                    "id": f"alt-sla-{off.id}-{current_slot}",
                    "plan_fecha": plan_fecha,
                    "tipo": "sla_en_riesgo",
                    "severidad": "critica",
                    "oficina_id": off.id,
                    "oficina_nombre": off.nombre,
                    "titulo": f"SLA Crítico en {off.nombre} ({round(ev.nivel_servicio * 100)}%)",
                    "mensaje": (
                        f"Demanda de {fc.tasa_llegadas_hora} cli/h supera la capacidad de {active_now} asesores. "
                        f"Espera proyectada: {round(ev.tiempo_espera_promedio_min, 1)} min."
                    ),
                    "franja": current_slot,
                    "accion_sugerida": "Requerir apoyo virtual inmediato o reasignar puestos.",
                    "accion_tipo": "redistribuir",
                    "timestamp": now_iso,
                    "leida": False,
                }
            )
        elif ev.nivel_servicio < sla_goal:
            alerts.append(
                {
                    "id": f"alt-sla-{off.id}-{current_slot}",
                    "plan_fecha": plan_fecha,
                    "tipo": "sla_en_riesgo",
                    "severidad": "advertencia",
                    "oficina_id": off.id,
                    "oficina_nombre": off.nombre,
                    "titulo": f"Nivel de Servicio en Riesgo en {off.nombre}",
                    "mensaje": (
                        f"SLA proyectado de {round(ev.nivel_servicio * 100)}% bajo meta ({round(sla_goal * 100)}%)."
                    ),
                    "franja": current_slot,
                    "accion_sugerida": "Revisar traslados sugeridos.",
                    "accion_tipo": "redistribuir",
                    "timestamp": now_iso,
                    "leida": False,
                }
            )

        if next_slot and next_slot in fc_day:
            next_fc = fc_day[next_slot]
            active_next = sum(
                1
                for s in staff_list
                if (turnos.get(s.id, {}).get("slots") or {}).get(next_slot, {}).get("estado")
                in ("atencion", "apoyo_virtual", "apoyo_presencial")
                and (turnos.get(s.id, {}).get("slots") or {}).get(next_slot, {}).get("oficinaAsignadaId") == off.id
            )
            ev_next = evaluate_erlang_a(
                next_fc.tasa_llegadas_hora,
                next_fc.tiempo_atencion_promedio_min,
                active_next,
                wait_max,
            )
            if next_fc.es_pico and ev_next.nivel_servicio < sla_goal:
                alerts.append(
                    {
                        "id": f"alt-peak-{off.id}-{next_slot}",
                        "plan_fecha": plan_fecha,
                        "tipo": "pico_inminente",
                        "severidad": "advertencia",
                        "oficina_id": off.id,
                        "oficina_nombre": off.nombre,
                        "titulo": f"{off.ciudad} superará el umbral en ~20 min ({next_slot})",
                        "mensaje": (
                            f"Afluencia proyectada de {next_fc.tasa_llegadas_hora} cli/h en {off.nombre}; "
                            f"SLA estimado caerá a {round(ev_next.nivel_servicio * 100)}%."
                        ),
                        "franja": next_slot,
                        "accion_sugerida": "Activar ventanilla de refuerzo antes de la franja pico.",
                        "accion_tipo": "redistribuir",
                        "timestamp": now_iso,
                        "leida": False,
                    }
                )

        # Verificar almuerzos descubiertos (0 agentes)
        for l_slot in ("11:30", "12:00", "12:30", "13:00", "13:30", "14:00"):
            active_lunch = sum(
                1
                for s in staff_list
                if (turnos.get(s.id, {}).get("slots") or {}).get(l_slot, {}).get("estado")
                in ("atencion", "apoyo_virtual", "apoyo_presencial")
                and (turnos.get(s.id, {}).get("slots") or {}).get(l_slot, {}).get("oficinaAsignadaId") == off.id
            )
            if active_lunch == 0 and off.estado == "abierta":
                alerts.append(
                    {
                        "id": f"alt-lunch-{off.id}-{l_slot}",
                        "plan_fecha": plan_fecha,
                        "tipo": "almuerzo_descubierto",
                        "severidad": "critica",
                        "oficina_id": off.id,
                        "oficina_nombre": off.nombre,
                        "titulo": f"Oficina descubierta en franja {l_slot}",
                        "mensaje": (
                            f"{off.nombre} queda con 0 asesores activos entre {l_slot}. "
                            "Asignar apoyo virtual para continuidad."
                        ),
                        "franja": l_slot,
                        "accion_sugerida": "Escalonar almuerzos o asignar apoyo virtual.",
                        "accion_tipo": "ajustar_almuerzo",
                        "timestamp": now_iso,
                        "leida": False,
                    }
                )
                break  # Una alerta consolidada por oficina

    return alerts
