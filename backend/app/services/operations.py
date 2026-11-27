"""Orquestador de operaciones, auditoría y recálculo en < 5 s."""

from __future__ import annotations

import copy
from datetime import datetime, timezone
from typing import Any
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.privacy import safe_audit_log
from app.engines.alerts import evaluate_alerts_for_plan
from app.engines.optimizer import generate_day_plan_data
from app.engines.redistribution import generate_redistributions_for_plan
from app.models.entities import (
    AlertModel,
    AuditLogModel,
    DayPlanModel,
    RedistributionModel,
    StaffModel,
)
from app.schemas.api import (
    AlertOut,
    ColaboradorShiftOut,
    DayPlanAuditOut,
    DayPlanJustificationOut,
    DayPlanOut,
    RedistributionImpactOut,
    RedistributionOut,
    UserOut,
)


def record_audit(
    db: Session,
    user: UserOut,
    action: str,
    entity_type: str,
    entity_id: str,
    summary: str,
    before: dict[str, Any] | None = None,
    after: dict[str, Any] | None = None,
) -> None:
    db.add(
        AuditLogModel(
            actor_id=user.id,
            actor_nombre=user.nombre,
            actor_rol=user.rol,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            summary=summary,
            payload_before=before,
            payload_after=after,
        )
    )
    safe_audit_log(user.id, user.rol, action, entity_id)


def serialize_day_plan(plan: DayPlanModel) -> DayPlanOut:
    turnos_out = {
        colab_id: ColaboradorShiftOut.model_validate(shift_data)
        for colab_id, shift_data in (plan.turnos or {}).items()
    }
    just_out = [
        DayPlanJustificationOut.model_validate(j) for j in (plan.justificaciones or [])
    ]
    audit_out = (
        DayPlanAuditOut(
            aprobado_por=plan.aprobado_por,
            aprobado_en=plan.aprobado_en or "",
            version=plan.version,
            total_cambios_manuales=plan.total_cambios_manuales,
        )
        if plan.aprobado_por
        else None
    )
    return DayPlanOut(
        id=plan.id,
        fecha=plan.fecha,
        estado=plan.estado,  # type: ignore[arg-type]
        auditoria=audit_out,
        tiempo_ahorrado_minutos=plan.tiempo_ahorrado_minutos,
        sla_proyectado_red=plan.sla_proyectado_red,
        turnos=turnos_out,
        justificaciones=just_out,
    )


def serialize_redistribution(model: RedistributionModel) -> RedistributionOut:
    return RedistributionOut(
        id=model.id,
        colaborador_id=model.colaborador_id,
        colaborador_nombre=model.colaborador_nombre,
        oficina_origen_id=model.oficina_origen_id,
        oficina_origen_nombre=model.oficina_origen_nombre,
        oficina_destino_id=model.oficina_destino_id,
        oficina_destino_nombre=model.oficina_destino_nombre,
        modalidad=model.modalidad,  # type: ignore[arg-type]
        distancia_km=model.distancia_km,
        es_intermunicipal=model.es_intermunicipal,
        franja_inicio=model.franja_inicio,
        franja_fin=model.franja_fin,
        motivo=model.motivo,
        impacto_estimado=RedistributionImpactOut(
            reduccion_espera_min=model.reduccion_espera_min,
            sla_proyectado_destino=model.sla_proyectado_destino,
            sla_origen_resultante=model.sla_origen_resultante,
            abandono_antes_pct=model.abandono_antes_pct,
            abandono_despues_pct=model.abandono_despues_pct,
        ),
        estado=model.estado,  # type: ignore[arg-type]
    )


def serialize_alert(model: AlertModel) -> AlertOut:
    return AlertOut(
        id=model.id,
        tipo=model.tipo,  # type: ignore[arg-type]
        severidad=model.severidad,  # type: ignore[arg-type]
        oficina_id=model.oficina_id,
        oficina_nombre=model.oficina_nombre,
        titulo=model.titulo,
        mensaje=model.mensaje,
        franja=model.franja,
        accion_sugerida=model.accion_sugerida,
        accion_tipo=model.accion_tipo,  # type: ignore[arg-type]
        timestamp=model.timestamp,
        leida=model.leida,
    )


def regenerate_full_day_state(
    db: Session,
    fecha: str,
    day_of_week: int = 1,
    is_fortnight: bool = True,
    current_slot: str = "10:00",
) -> tuple[DayPlanModel, list[RedistributionModel], list[AlertModel]]:
    """Recalcula el plan del día, redistribuciones y alertas atómicamente."""
    generated = generate_day_plan_data(db, fecha, day_of_week, is_fortnight)
    turnos = generated["turnos"]

    plan = db.execute(select(DayPlanModel).where(DayPlanModel.fecha == fecha)).scalar_one_or_none()
    if plan is None:
        plan = DayPlanModel(
            id=f"plan-{fecha}",
            fecha=fecha,
            estado="propuesto",
            version=1,
            total_cambios_manuales=0,
            tiempo_ahorrado_minutos=generated["tiempo_ahorrado_minutos"],
            sla_proyectado_red=generated["sla_proyectado_red"],
            turnos=turnos,
            original_turnos=copy.deepcopy(turnos),
            justificaciones=generated["justificaciones"],
            is_fortnight=is_fortnight,
        )
        db.add(plan)
    else:
        plan.estado = "propuesto"
        plan.aprobado_por = None
        plan.aprobado_en = None
        plan.total_cambios_manuales = 0
        plan.tiempo_ahorrado_minutos = generated["tiempo_ahorrado_minutos"]
        plan.sla_proyectado_red = generated["sla_proyectado_red"]
        plan.turnos = turnos
        plan.original_turnos = copy.deepcopy(turnos)
        plan.justificaciones = generated["justificaciones"]
        plan.is_fortnight = is_fortnight

    # Actualizar estadoHoy de staff según ausencias activas en el plan
    staff_list = db.execute(select(StaffModel)).scalars().all()
    for st in staff_list:
        slots = turnos.get(st.id, {}).get("slots", {})
        if slots and all(sl.get("estado") == "ausente" for sl in slots.values()):
            st.estado_hoy = "ausente"
        else:
            st.estado_hoy = "disponible"

    # Recalcular redistribuciones
    db.execute(delete(RedistributionModel).where(RedistributionModel.plan_fecha == fecha))
    rec_dicts = generate_redistributions_for_plan(
        db, fecha, turnos, franja=current_slot, day_of_week=day_of_week, is_fortnight=is_fortnight
    )
    rec_models = [RedistributionModel(**r) for r in rec_dicts]
    db.add_all(rec_models)

    # Recalcular alertas
    db.execute(delete(AlertModel).where(AlertModel.plan_fecha == fecha))
    alert_dicts = evaluate_alerts_for_plan(
        db, fecha, turnos, current_slot=current_slot, day_of_week=day_of_week, is_fortnight=is_fortnight
    )
    alert_models = [AlertModel(**a) for a in alert_dicts]
    db.add_all(alert_models)

    db.commit()
    db.refresh(plan)
    return plan, rec_models, alert_models


def apply_redistribution_to_plan(
    db: Session,
    rec: RedistributionModel,
    user: UserOut,
) -> tuple[RedistributionModel, DayPlanModel | None]:
    """Acepta una redistribución, actualiza slots en el DayPlan y registra auditoría."""
    before_state = {"estado": rec.estado}
    rec.estado = "aceptada"
    plan = db.execute(select(DayPlanModel).where(DayPlanModel.fecha == rec.plan_fecha)).scalar_one_or_none()
    if plan and rec.colaborador_id in (plan.turnos or {}):
        turnos = copy.deepcopy(plan.turnos)
        slots = turnos[rec.colaborador_id].get("slots", {})
        target_state = "apoyo_presencial" if rec.modalidad == "presencial" else "apoyo_virtual"
        manual_count = 0
        for franja, sl in slots.items():
            if rec.franja_inicio <= franja <= rec.franja_fin:
                sl["estado"] = target_state
                sl["oficinaAsignadaId"] = rec.oficina_destino_id
                sl["esModificadoManual"] = True
                sl["nota"] = f"Redistribución aprobada: apoyo a {rec.oficina_destino_nombre}"
        for shift in turnos.values():
            for sl in (shift.get("slots") or {}).values():
                if sl.get("esModificadoManual"):
                    manual_count += 1
        plan.turnos = turnos
        plan.total_cambios_manuales = manual_count
        plan.updated_at = datetime.now(timezone.utc)

    record_audit(
        db,
        user,
        action="REDISTRIBUTION_ACCEPTED",
        entity_type="redistribution",
        entity_id=rec.id,
        summary=f"Traslado {rec.modalidad} aceptado hacia {rec.oficina_destino_nombre} ({rec.franja_inicio}-{rec.franja_fin}).",
        before=before_state,
        after={"estado": rec.estado, "modalidad": rec.modalidad},
    )
    db.commit()
    db.refresh(rec)
    if plan:
        db.refresh(plan)
    return rec, plan
