"""Endpoints de Plan del Día, Malla de Turnos y Redistribución."""

from __future__ import annotations

import copy
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import Response
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.auth import require_roles
from app.database import get_db
from app.engines.erlang import calculate_required_agents, evaluate_erlang_a
from app.engines.forecast import get_office_day_forecast
from app.engines.optimizer import validate_slot_change
from app.engines.redistribution import generate_redistributions_for_plan, haversine_km
from app.engines.simulator import simulate_office_des
from app.etl.excel_importer import OPERATING_SLOTS_ALL
from app.etl.excel_io import export_day_plan_xlsx, parse_day_plan_excel
from app.models.entities import DayPlanModel, OfficeModel, RedistributionModel, StaffModel, SystemRulesModel
from app.schemas.api import (
    ApprovePlanIn,
    DayPlanOut,
    GeneratePlanIn,
    RedistributionActionIn,
    RedistributionEditIn,
    RedistributionOut,
    SlotPatchIn,
    SlotValidateIn,
    SlotValidateOut,
    UserOut,
)
from app.services.operations import (
    apply_redistribution_to_plan,
    record_audit,
    regenerate_full_day_state,
    serialize_day_plan,
    serialize_redistribution,
)

router = APIRouter()


@router.get("/plans/{fecha}", response_model=DayPlanOut)
def get_day_plan(fecha: str, db: Session = Depends(get_db)) -> DayPlanOut:
    plan = db.execute(select(DayPlanModel).where(DayPlanModel.fecha == fecha)).scalar_one_or_none()
    if not plan:
        plan, _, _ = regenerate_full_day_state(db, fecha=fecha, day_of_week=1, is_fortnight=True)
    return serialize_day_plan(plan)


@router.post("/plans/generate", response_model=DayPlanOut)
def generate_day_plan(
    body: GeneratePlanIn,
    user: Annotated[UserOut, Depends(require_roles("ADMIN", "COORDINADOR"))],
    db: Session = Depends(get_db),
) -> DayPlanOut:
    dow = body.day_of_week if body.day_of_week is not None else 1
    plan, _, _ = regenerate_full_day_state(
        db,
        fecha=body.fecha,
        day_of_week=dow,
        is_fortnight=body.is_fortnight,
    )
    record_audit(
        db,
        user,
        action="PLAN_GENERATED",
        entity_type="day_plan",
        entity_id=plan.id,
        summary=f"Propuesta generada por el motor PuLP/Erlang C para {body.fecha}.",
        after={"isFortnight": body.is_fortnight, "slaProyectadoRed": plan.sla_proyectado_red},
    )
    db.commit()
    return serialize_day_plan(plan)


@router.post("/plans/{fecha}/approve", response_model=DayPlanOut)
def approve_day_plan(
    fecha: str,
    body: ApprovePlanIn,
    user: Annotated[UserOut, Depends(require_roles("ADMIN", "COORDINADOR"))],
    db: Session = Depends(get_db),
) -> DayPlanOut:
    plan = db.execute(select(DayPlanModel).where(DayPlanModel.fecha == fecha)).scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail=f"Plan para fecha {fecha} no encontrado")

    approver = body.approver_name or user.nombre
    manual_count = sum(
        1
        for shift in (plan.turnos or {}).values()
        for sl in (shift.get("slots") or {}).values()
        if sl.get("esModificadoManual")
    )
    before = {"estado": plan.estado, "version": plan.version}
    plan.estado = "aprobado"
    plan.aprobado_por = approver
    plan.aprobado_en = datetime.now(timezone.utc).isoformat()
    plan.version = (plan.version or 0) + 1
    plan.total_cambios_manuales = manual_count

    record_audit(
        db,
        user,
        action="PLAN_APPROVED",
        entity_type="day_plan",
        entity_id=plan.id,
        summary=f"Plan del día {fecha} aprobado oficialmente por {approver} (v{plan.version}).",
        before=before,
        after={"estado": plan.estado, "version": plan.version, "totalCambiosManuales": manual_count},
    )
    db.commit()
    db.refresh(plan)
    return serialize_day_plan(plan)


@router.post("/plans/{fecha}/slots/validate", response_model=SlotValidateOut)
def validate_plan_slot(
    fecha: str,
    body: SlotValidateIn,
    db: Session = Depends(get_db),
) -> SlotValidateOut:
    plan = db.execute(select(DayPlanModel).where(DayPlanModel.fecha == fecha)).scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail=f"Plan {fecha} no encontrado")

    offices = db.execute(select(OfficeModel)).scalars().all()
    staff_list = db.execute(select(StaffModel)).scalars().all()
    st = next((s for s in staff_list if s.id == body.colaborador_id), None)
    required = 1
    if st:
        off = next((o for o in offices if o.id == st.oficina_base_id), None)
        if off:
            fc_list = get_office_day_forecast(db, off.id, 1, plan.is_fortnight)
            fc = next((x for x in fc_list if x.franja == body.franja), fc_list[0])
            required, _ = calculate_required_agents(
                fc.tasa_llegadas_hora,
                fc.tiempo_atencion_promedio_min,
                off.sla_objetivo,
                off.tiempo_espera_max_min,
                off.capacidad_puestos,
            )

    ok, msg, before, after, req = validate_slot_change(
        plan.turnos or {},
        body.colaborador_id,
        body.franja,
        body.estado,
        offices,
        staff_list,
        required,
    )
    return SlotValidateOut(
        is_valid=ok,
        warning_message=msg,
        before=before,
        after=after,
        required=req,
    )


@router.patch("/plans/{fecha}/slots", response_model=DayPlanOut)
def patch_plan_slot(
    fecha: str,
    body: SlotPatchIn,
    user: Annotated[UserOut, Depends(require_roles("ADMIN", "COORDINADOR"))],
    db: Session = Depends(get_db),
) -> DayPlanOut:
    plan = db.execute(select(DayPlanModel).where(DayPlanModel.fecha == fecha)).scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail=f"Plan {fecha} no encontrado")

    turnos = copy.deepcopy(plan.turnos or {})
    if body.colaborador_id not in turnos or body.franja not in (turnos[body.colaborador_id].get("slots") or {}):
        raise HTTPException(status_code=404, detail="Colaborador o franja no encontrada en el plan")

    slot_obj = turnos[body.colaborador_id]["slots"][body.franja]
    before_state = copy.deepcopy(slot_obj)
    slot_obj["estado"] = body.estado
    if body.oficina_asignada_id is not None:
        slot_obj["oficinaAsignadaId"] = body.oficina_asignada_id
    if body.nota is not None:
        slot_obj["nota"] = body.nota
    slot_obj["esModificadoManual"] = True

    manual_count = sum(
        1
        for shift in turnos.values()
        for sl in (shift.get("slots") or {}).values()
        if sl.get("esModificadoManual")
    )
    plan.turnos = turnos
    plan.total_cambios_manuales = manual_count

    record_audit(
        db,
        user,
        action="SLOT_UPDATED",
        entity_type="day_plan",
        entity_id=plan.id,
        summary=f"Cambio manual de casilla {body.colaborador_id} en franja {body.franja} a '{body.estado}'.",
        before=before_state,
        after=slot_obj,
    )
    db.commit()
    db.refresh(plan)
    return serialize_day_plan(plan)


@router.post("/plans/{fecha}/reset", response_model=DayPlanOut)
def reset_plan(
    fecha: str,
    user: Annotated[UserOut, Depends(require_roles("ADMIN", "COORDINADOR"))],
    db: Session = Depends(get_db),
) -> DayPlanOut:
    plan = db.execute(select(DayPlanModel).where(DayPlanModel.fecha == fecha)).scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail=f"Plan {fecha} no encontrado")

    plan.turnos = copy.deepcopy(plan.original_turnos or plan.turnos)
    plan.total_cambios_manuales = 0
    plan.estado = "propuesto"
    plan.aprobado_por = None
    plan.aprobado_en = None

    record_audit(
        db,
        user,
        action="PLAN_RESET",
        entity_type="day_plan",
        entity_id=plan.id,
        summary=f"Malla de {fecha} restaurada a la propuesta algorítmica original.",
    )
    db.commit()
    db.refresh(plan)
    return serialize_day_plan(plan)


@router.get("/plans/{fecha}/export")
def export_plan(
    fecha: str,
    format: str = Query("xlsx"),
    db: Session = Depends(get_db),
) -> Response:
    plan = db.execute(select(DayPlanModel).where(DayPlanModel.fecha == fecha)).scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail=f"Plan {fecha} no encontrado")
    staff_list = db.execute(select(StaffModel).order_by(StaffModel.id)).scalars().all()
    offices = db.execute(select(OfficeModel)).scalars().all()
    content = export_day_plan_xlsx(plan, staff_list, offices, OPERATING_SLOTS_ALL)
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="Plan_Turnos_Surtigas_{fecha}.xlsx"'},
    )


@router.post("/plans/{fecha}/import-excel", response_model=DayPlanOut)
async def import_plan_excel(
    fecha: str,
    user: Annotated[UserOut, Depends(require_roles("ADMIN", "COORDINADOR"))],
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> DayPlanOut:
    plan = db.execute(select(DayPlanModel).where(DayPlanModel.fecha == fecha)).scalar_one_or_none()
    if not plan:
        plan, _, _ = regenerate_full_day_state(db, fecha=fecha, day_of_week=1, is_fortnight=True)

    staff_list = db.execute(select(StaffModel).order_by(StaffModel.id)).scalars().all()
    offices = db.execute(select(OfficeModel)).scalars().all()
    content = await file.read()
    updated_turnos, imported_rows = parse_day_plan_excel(
        content, staff_list, offices, OPERATING_SLOTS_ALL, plan.turnos or {}
    )
    manual_count = sum(
        1
        for shift in updated_turnos.values()
        for sl in (shift.get("slots") or {}).values()
        if sl.get("esModificadoManual")
    )
    plan.turnos = updated_turnos
    plan.total_cambios_manuales = manual_count
    plan.estado = "borrador" if manual_count > 0 else plan.estado

    record_audit(
        db,
        user,
        action="PLAN_IMPORTED_EXCEL",
        entity_type="day_plan",
        entity_id=plan.id,
        summary=f"Malla de {fecha} importada desde Excel ({imported_rows} filas procesadas, {manual_count} ajustes).",
    )
    db.commit()
    db.refresh(plan)
    return serialize_day_plan(plan)


# --- Redistribuciones ---

@router.get("/redistributions", response_model=list[RedistributionOut])
def list_redistributions(
    date: str | None = None,
    modalidad: str | None = None,
    db: Session = Depends(get_db),
) -> list[RedistributionOut]:
    stmt = select(RedistributionModel)
    if date:
        stmt = stmt.where(RedistributionModel.plan_fecha == date)
    if modalidad and modalidad != "todos":
        stmt = stmt.where(RedistributionModel.modalidad == modalidad)
    rows = db.execute(stmt).scalars().all()
    return [serialize_redistribution(r) for r in rows]


@router.post("/redistributions/recalculate", response_model=list[RedistributionOut])
def recalculate_redistributions(
    user: Annotated[UserOut, Depends(require_roles("ADMIN", "COORDINADOR"))],
    date: str = "2026-10-15",
    franja: str = "10:00",
    db: Session = Depends(get_db),
) -> list[RedistributionOut]:
    plan = db.execute(select(DayPlanModel).where(DayPlanModel.fecha == date)).scalar_one_or_none()
    if not plan:
        plan, recs, _ = regenerate_full_day_state(db, fecha=date, current_slot=franja)
        return [serialize_redistribution(r) for r in recs]

    db.execute(delete(RedistributionModel).where(RedistributionModel.plan_fecha == date))
    rec_dicts = generate_redistributions_for_plan(
        db, date, plan.turnos or {}, franja=franja, is_fortnight=plan.is_fortnight
    )
    models = [RedistributionModel(**r) for r in rec_dicts]
    db.add_all(models)
    record_audit(
        db,
        user,
        action="REDISTRIBUTIONS_RECALCULATED",
        entity_type="redistribution",
        entity_id=date,
        summary=f"Recalculadas {len(models)} propuestas de redistribución para {date}.",
    )
    db.commit()
    return [serialize_redistribution(r) for r in models]


@router.post("/redistributions/{rec_id}/accept", response_model=RedistributionOut)
def accept_redistribution(
    rec_id: str,
    user: Annotated[UserOut, Depends(require_roles("ADMIN", "COORDINADOR"))],
    db: Session = Depends(get_db),
) -> RedistributionOut:
    rec = db.get(RedistributionModel, rec_id)
    if not rec:
        raise HTTPException(status_code=404, detail=f"Recomendación {rec_id} no encontrada")
    updated, _ = apply_redistribution_to_plan(db, rec, user)
    return serialize_redistribution(updated)


@router.post("/redistributions/{rec_id}/reject", response_model=RedistributionOut)
def reject_redistribution(
    rec_id: str,
    user: Annotated[UserOut, Depends(require_roles("ADMIN", "COORDINADOR"))],
    body: RedistributionActionIn | None = None,
    db: Session = Depends(get_db),
) -> RedistributionOut:
    rec = db.get(RedistributionModel, rec_id)
    if not rec:
        raise HTTPException(status_code=404, detail=f"Recomendación {rec_id} no encontrada")
    before = {"estado": rec.estado}
    rec.estado = "rechazada"
    record_audit(
        db,
        user,
        action="REDISTRIBUTION_REJECTED",
        entity_type="redistribution",
        entity_id=rec.id,
        summary=f"Redistribución hacia {rec.oficina_destino_nombre} rechazada."
        + (f" Motivo: {body.motivo}" if body and body.motivo else ""),
        before=before,
        after={"estado": "rechazada"},
    )
    db.commit()
    db.refresh(rec)
    return serialize_redistribution(rec)


@router.patch("/redistributions/{rec_id}", response_model=RedistributionOut)
def edit_redistribution(
    rec_id: str,
    body: RedistributionEditIn,
    user: Annotated[UserOut, Depends(require_roles("ADMIN", "COORDINADOR"))],
    db: Session = Depends(get_db),
) -> RedistributionOut:
    rec = db.get(RedistributionModel, rec_id)
    if not rec:
        raise HTTPException(status_code=404, detail=f"Recomendación {rec_id} no encontrada")

    before = {
        "colaboradorId": rec.colaborador_id,
        "modalidad": rec.modalidad,
        "franjaInicio": rec.franja_inicio,
        "franjaFin": rec.franja_fin,
    }
    if body.colaborador_id is not None:
        st = db.get(StaffModel, body.colaborador_id)
        if not st:
            raise HTTPException(status_code=404, detail="Colaborador no encontrado")
        orig_off = db.get(OfficeModel, st.oficina_base_id)
        dest_off = db.get(OfficeModel, rec.oficina_destino_id)
        rec.colaborador_id = st.id
        rec.colaborador_nombre = st.nombre
        if orig_off and dest_off:
            rec.oficina_origen_id = orig_off.id
            rec.oficina_origen_nombre = orig_off.nombre
            rec.distancia_km = haversine_km(orig_off.lat, orig_off.lng, dest_off.lat, dest_off.lng)
            rec.es_intermunicipal = orig_off.ciudad != dest_off.ciudad
    if body.modalidad is not None:
        rec.modalidad = body.modalidad
    if body.franja_inicio is not None:
        rec.franja_inicio = body.franja_inicio
    if body.franja_fin is not None:
        rec.franja_fin = body.franja_fin

    record_audit(
        db,
        user,
        action="REDISTRIBUTION_EDITED",
        entity_type="redistribution",
        entity_id=rec.id,
        summary=f"Parámetros de redistribución editados para {rec.oficina_destino_nombre}.",
        before=before,
        after={
            "colaboradorId": rec.colaborador_id,
            "modalidad": rec.modalidad,
            "franjaInicio": rec.franja_inicio,
            "franjaFin": rec.franja_fin,
        },
    )
    db.commit()
    db.refresh(rec)
    return serialize_redistribution(rec)


@router.post("/offices/{office_id}/request-support", response_model=RedistributionOut)
def request_office_support(
    office_id: str,
    user: Annotated[UserOut, Depends(require_roles("ADMIN", "COORDINADOR"))],
    db: Session = Depends(get_db),
) -> RedistributionOut:
    dest_off = db.get(OfficeModel, office_id)
    if not dest_off:
        raise HTTPException(status_code=404, detail="Oficina no encontrada")

    plan = db.execute(select(DayPlanModel).order_by(DayPlanModel.updated_at.desc())).scalars().first()
    plan_fecha = plan.fecha if plan else "2026-10-15"

    # Buscar asesor virtual disponible en otra sede
    staff_list = db.execute(select(StaffModel)).scalars().all()
    candidate = next(
        (s for s in staff_list if s.oficina_base_id != office_id and s.estado_hoy == "disponible" and s.modalidad == "virtual"),
        next((s for s in staff_list if s.oficina_base_id != office_id and s.estado_hoy == "disponible"), None),
    )
    if not candidate:
        raise HTTPException(status_code=400, detail="No hay colaboradores disponibles para apoyo")

    orig_off = db.get(OfficeModel, candidate.oficina_base_id) or dest_off
    dist = haversine_km(orig_off.lat, orig_off.lng, dest_off.lat, dest_off.lng)
    rules = db.get(SystemRulesModel, 1)
    max_km = rules.max_presencial_km if rules else 45.0
    modalidad = "presencial" if dist <= max_km else "virtual"

    fc_list = get_office_day_forecast(db, dest_off.id, 1, True)
    peak_fc = next((f for f in fc_list if f.franja == "10:00"), fc_list[0])
    cur_agents = max(1, len([s for s in staff_list if s.oficina_base_id == dest_off.id and s.estado_hoy == "disponible"]))
    w_before, _, ab_before = simulate_office_des(
        peak_fc.tasa_llegadas_hora, peak_fc.tiempo_atencion_promedio_min, cur_agents, dest_off.tiempo_espera_max_min, replications=4
    )
    w_after, sla_after, ab_after = simulate_office_des(
        peak_fc.tasa_llegadas_hora, peak_fc.tiempo_atencion_promedio_min, cur_agents + 1, dest_off.tiempo_espera_max_min, replications=4
    )
    ev_orig = evaluate_erlang_a(8.0, 7.0, 2, 10)

    rec_id = f"redist-req-{dest_off.id}-{candidate.id}"
    existing = db.get(RedistributionModel, rec_id)
    if existing:
        db.delete(existing)
        db.flush()

    rec = RedistributionModel(
        id=rec_id,
        plan_fecha=plan_fecha,
        colaborador_id=candidate.id,
        colaborador_nombre=candidate.nombre,
        oficina_origen_id=orig_off.id,
        oficina_origen_nombre=orig_off.nombre,
        oficina_destino_id=dest_off.id,
        oficina_destino_nombre=dest_off.nombre,
        modalidad=modalidad,
        distancia_km=dist,
        es_intermunicipal=orig_off.ciudad != dest_off.ciudad,
        franja_inicio="10:00",
        franja_fin="12:00",
        motivo=f"Solicitud directa de refuerzo para {dest_off.nombre}.",
        reduccion_espera_min=max(1.0, round(w_before - w_after, 1)),
        sla_proyectado_destino=round(sla_after, 3),
        sla_origen_resultante=round(ev_orig.nivel_servicio, 3),
        abandono_antes_pct=ab_before,
        abandono_despues_pct=ab_after,
        estado="pendiente",
    )
    db.add(rec)
    record_audit(
        db,
        user,
        action="SUPPORT_REQUESTED",
        entity_type="office",
        entity_id=dest_off.id,
        summary=f"Refuerzo {modalidad} solicitado para {dest_off.nombre}.",
        after={"recommendationId": rec.id},
    )
    db.commit()
    db.refresh(rec)
    return serialize_redistribution(rec)


@router.post("/offices/{office_id}/release-staff")
def release_office_staff(
    office_id: str,
    user: Annotated[UserOut, Depends(require_roles("ADMIN", "COORDINADOR"))],
    db: Session = Depends(get_db),
) -> dict:
    off = db.get(OfficeModel, office_id)
    if not off:
        raise HTTPException(status_code=404, detail="Oficina no encontrada")
    record_audit(
        db,
        user,
        action="STAFF_RELEASED_TO_NETWORK",
        entity_type="office",
        entity_id=off.id,
        summary=f"Capacidad puesta a disposición desde {off.nombre} para redistribución en red.",
    )
    db.commit()
    return {"status": "ok", "officeId": off.id, "message": f"Puesto disponible en {off.nombre} para apoyo de red."}
