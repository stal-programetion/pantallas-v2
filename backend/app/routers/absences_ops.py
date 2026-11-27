"""Endpoints de Ausencias (con Ley 1581 + recálculo <5s), Alertas, Reportes, Auditoría y ETL."""

from __future__ import annotations

from pathlib import Path
import tempfile
import time
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.auth import get_current_user, require_roles
from app.core.privacy import sanitize_absence_for_role
from app.database import get_db
from app.etl.digiturno_source import get_digiturno_source
from app.etl.excel_importer import import_digiturno_excel
from app.etl.excel_io import (
    export_absences_xlsx,
    export_reports_csv,
    export_reports_xlsx,
    parse_absences_excel,
)
from app.models.entities import (
    AbsenceModel,
    AlertModel,
    AuditLogModel,
    DayPlanModel,
    EtlRunModel,
    HistoricalTurnModel,
    OfficeModel,
    StaffModel,
    SystemRulesModel,
)
from app.schemas.api import (
    AbsenceCreateIn,
    AbsenceMutationOut,
    AbsenceOut,
    AbsenceUpdateIn,
    AlertOut,
    AuditLogOut,
    EtlRunOut,
    ReportOfficeRowOut,
    ReportSummaryOut,
    UserOut,
)
from app.services.operations import (
    record_audit,
    regenerate_full_day_state,
    serialize_alert,
    serialize_day_plan,
    serialize_redistribution,
)

router = APIRouter()


@router.get("/absences", response_model=list[AbsenceOut])
def list_absences(
    user: Annotated[UserOut, Depends(get_current_user)],
    estado: str | None = None,
    tipo: str | None = None,
    db: Session = Depends(get_db),
) -> list[AbsenceOut]:
    stmt = select(AbsenceModel)
    if estado:
        stmt = stmt.where(AbsenceModel.estado == estado)
    if tipo and tipo != "todos":
        stmt = stmt.where(AbsenceModel.tipo == tipo)
    rows = db.execute(stmt.order_by(AbsenceModel.created_at.desc())).scalars().all()
    return [sanitize_absence_for_role(r, user.rol) for r in rows]


@router.post("/absences", response_model=AbsenceMutationOut)
def create_absence(
    body: AbsenceCreateIn,
    user: Annotated[UserOut, Depends(require_roles("ADMIN", "COORDINADOR"))],
    fecha: str = Query("2026-10-15"),
    db: Session = Depends(get_db),
) -> AbsenceMutationOut:
    st = db.get(StaffModel, body.colaborador_id)
    if not st:
        raise HTTPException(status_code=404, detail="Colaborador no encontrado")

    deficit = body.impacto_estimado.deficit_horas if body.impacto_estimado else 7.5
    affected = body.impacto_estimado.oficinas_afectadas if body.impacto_estimado else [st.oficina_base_id]
    new_id = f"abs-{int(time.time() * 1000) % 1000000}"

    abs_model = AbsenceModel(
        id=new_id,
        colaborador_id=body.colaborador_id,
        tipo=body.tipo,
        fecha_inicio=body.fecha_inicio,
        fecha_fin=body.fecha_fin,
        diagnostico_salud=body.diagnostico_salud,
        aprobado_por=body.aprobado_por,
        motivo_detalle=body.motivo_detalle,
        estado=body.estado,
        deficit_horas=deficit,
        oficinas_afectadas=affected,
    )
    db.add(abs_model)
    db.commit()
    db.refresh(abs_model)

    current_plan = db.execute(select(DayPlanModel).where(DayPlanModel.fecha == fecha)).scalar_one_or_none()
    is_fortnight = current_plan.is_fortnight if current_plan else True

    plan, recs, alerts = regenerate_full_day_state(
        db, fecha=fecha, day_of_week=1, is_fortnight=is_fortnight, current_slot="10:00"
    )
    record_audit(
        db,
        user,
        action="ABSENCE_CREATED",
        entity_type="absence",
        entity_id=abs_model.id,
        summary=f"Ausencia registrada ({abs_model.tipo}) en sede {st.oficina_base_id}; malla recalculada.",
        after={"colaboradorId": abs_model.colaborador_id, "tipo": abs_model.tipo, "oficinasAfectadas": affected},
    )
    db.commit()

    return AbsenceMutationOut(
        absence=sanitize_absence_for_role(abs_model, user.rol),
        plan=serialize_day_plan(plan),
        alerts=[serialize_alert(a) for a in alerts],
        recommendations=[serialize_redistribution(r) for r in recs],
    )


@router.patch("/absences/{absence_id}", response_model=AbsenceOut)
def update_absence(
    absence_id: str,
    body: AbsenceUpdateIn,
    user: Annotated[UserOut, Depends(require_roles("ADMIN", "COORDINADOR"))],
    db: Session = Depends(get_db),
) -> AbsenceOut:
    ab = db.get(AbsenceModel, absence_id)
    if not ab:
        raise HTTPException(status_code=404, detail="Ausencia no encontrada")
    if body.tipo is not None:
        ab.tipo = body.tipo
    if body.fecha_inicio is not None:
        ab.fecha_inicio = body.fecha_inicio
    if body.fecha_fin is not None:
        ab.fecha_fin = body.fecha_fin
    if body.diagnostico_salud is not None:
        ab.diagnostico_salud = body.diagnostico_salud
    if body.aprobado_por is not None:
        ab.aprobado_por = body.aprobado_por
    if body.motivo_detalle is not None:
        ab.motivo_detalle = body.motivo_detalle
    if body.estado is not None:
        ab.estado = body.estado

    record_audit(
        db,
        user,
        action="ABSENCE_UPDATED",
        entity_type="absence",
        entity_id=ab.id,
        summary=f"Ausencia {ab.id} actualizada.",
    )
    db.commit()
    db.refresh(ab)
    return sanitize_absence_for_role(ab, user.rol)


@router.delete("/absences/{absence_id}")
def delete_absence(
    absence_id: str,
    user: Annotated[UserOut, Depends(require_roles("ADMIN", "COORDINADOR"))],
    fecha: str = Query("2026-10-15"),
    db: Session = Depends(get_db),
) -> dict:
    ab = db.get(AbsenceModel, absence_id)
    if not ab:
        raise HTTPException(status_code=404, detail="Ausencia no encontrada")

    db.delete(ab)
    db.commit()

    current_plan = db.execute(select(DayPlanModel).where(DayPlanModel.fecha == fecha)).scalar_one_or_none()
    is_fortnight = current_plan.is_fortnight if current_plan else True
    plan, recs, alerts = regenerate_full_day_state(
        db, fecha=fecha, day_of_week=1, is_fortnight=is_fortnight, current_slot="10:00"
    )
    record_audit(
        db,
        user,
        action="ABSENCE_DELETED",
        entity_type="absence",
        entity_id=absence_id,
        summary=f"Ausencia {absence_id} eliminada; colaborador reintegrado y malla recalculada.",
    )
    db.commit()

    return {
        "deleted": True,
        "plan": serialize_day_plan(plan).model_dump(by_alias=True),
        "alerts": [serialize_alert(a).model_dump(by_alias=True) for a in alerts],
        "recommendations": [serialize_redistribution(r).model_dump(by_alias=True) for r in recs],
    }


@router.post("/absences/import-excel")
async def import_absences_excel(
    user: Annotated[UserOut, Depends(require_roles("ADMIN", "COORDINADOR"))],
    file: UploadFile = File(...),
    fecha: str = Query("2026-10-15"),
    db: Session = Depends(get_db),
) -> dict:
    content = await file.read()
    items = parse_absences_excel(content)
    inserted = 0
    for idx, item in enumerate(items):
        st = db.get(StaffModel, item["colaborador_id"])
        if not st:
            continue
        db.add(
            AbsenceModel(
                id=f"abs-xl-{int(time.time()) % 100000}-{idx}",
                colaborador_id=st.id,
                tipo=item["tipo"],
                fecha_inicio=item["fecha_inicio"],
                fecha_fin=item["fecha_fin"],
                diagnostico_salud=item["diagnostico_salud"],
                aprobado_por=item["aprobado_por"],
                motivo_detalle=item["motivo_detalle"],
                estado=item["estado"],
                deficit_horas=7.5,
                oficinas_afectadas=[st.oficina_base_id],
            )
        )
        inserted += 1
    db.commit()
    regenerate_full_day_state(db, fecha=fecha, day_of_week=1, is_fortnight=True)
    record_audit(
        db,
        user,
        action="ABSENCES_IMPORTED_EXCEL",
        entity_type="absence",
        entity_id=file.filename or "excel",
        summary=f"Importadas {inserted} ausencias desde Excel.",
    )
    db.commit()
    return {"inserted": inserted, "totalParsed": len(items)}


@router.get("/absences/export")
def export_absences(
    user: Annotated[UserOut, Depends(get_current_user)],
    db: Session = Depends(get_db),
) -> Response:
    absences = db.execute(select(AbsenceModel)).scalars().all()
    staff_list = db.execute(select(StaffModel)).scalars().all()
    offices = db.execute(select(OfficeModel)).scalars().all()
    content = export_absences_xlsx(absences, staff_list, offices, user.rol)
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="Ausencias_Surtigas.xlsx"'},
    )


# --- Alertas ---

@router.get("/alerts", response_model=list[AlertOut])
def list_alerts(
    include_dismissed: bool = Query(False, alias="includeDismissed"),
    db: Session = Depends(get_db),
) -> list[AlertOut]:
    stmt = select(AlertModel)
    if not include_dismissed:
        stmt = stmt.where(AlertModel.leida.is_(False))
    rows = db.execute(stmt).scalars().all()
    return [serialize_alert(a) for a in rows]


@router.post("/alerts/{alert_id}/dismiss", response_model=AlertOut)
def dismiss_alert(alert_id: str, db: Session = Depends(get_db)) -> AlertOut:
    alert = db.get(AlertModel, alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alerta no encontrada")
    alert.leida = True
    db.commit()
    db.refresh(alert)
    return serialize_alert(alert)


# --- Reportes ---

@router.get("/reports/summary", response_model=ReportSummaryOut)
def reports_summary(
    range: str = Query("30d"),
    db: Session = Depends(get_db),
) -> ReportSummaryOut:
    offices = db.execute(select(OfficeModel)).scalars().all()
    rules = db.get(SystemRulesModel, 1)
    mode = rules.source_mode if rules else "mock"
    source = get_digiturno_source(mode)
    metrics = source.get_live_metrics(db, slot="10:00", day_of_week=1, is_fortnight=True)
    metric_map = {m.oficina_id: m for m in metrics}

    turns = db.execute(select(HistoricalTurnModel)).scalars().all()
    aba_by_off: dict[str, list[bool]] = {}
    for t in turns:
        aba_by_off.setdefault(t.oficina_id, []).append(t.estado == "ABA")

    office_rows: list[ReportOfficeRowOut] = []
    sla_sum = 0.0
    wait_sum = 0.0
    util_sum = 0.0
    for off in offices:
        m = metric_map.get(off.id)
        sla = m.sla_actual if m else 0.80
        wait = m.espera_promedio_min if m else 6.5
        util = m.capacidad_utilizada if m else 78
        flags = aba_by_off.get(off.id, [])
        aba_pct = round((sum(flags) / len(flags)) * 100, 1) if flags else 4.5

        sla_sum += sla
        wait_sum += wait
        util_sum += util

        office_rows.append(
            ReportOfficeRowOut(
                oficina_id=off.id,
                nombre=off.nombre,
                ciudad=off.ciudad,
                departamento=off.departamento,
                capacidad_puestos=off.capacidad_puestos,
                clientes_en_fila=m.clientes_en_fila if m else 0,
                espera_promedio_min=round(wait, 1),
                sla_actual=round(sla, 3),
                estado_sla=m.estado_sla if m else "optimo",
                tasa_abandono_pct=aba_pct,
            )
        )

    n = max(1, len(offices))
    total_aba = sum(1 for t in turns if t.estado == "ABA")
    global_aba = round((total_aba / len(turns)) * 100, 1) if turns else 6.8

    plan = db.execute(select(DayPlanModel).order_by(DayPlanModel.updated_at.desc())).scalars().first()
    saved_min = plan.tiempo_ahorrado_minutos if plan else 82

    return ReportSummaryOut(
        range=range,
        sla_red_pct=round((sla_sum / n) * 100, 1),
        espera_media_min=round(wait_sum / n, 1),
        utilizacion_pct=round(util_sum / n, 1),
        tiempo_ahorrado_min_dia=saved_min,
        horas_mes_ahorradas=round((saved_min * 22) / 60.0, 1),
        tasa_abandono_pct=global_aba,
        oficinas=office_rows,
    )


@router.get("/reports/export")
def export_report(
    format: str = Query("csv"),
    db: Session = Depends(get_db),
) -> Response:
    offices = db.execute(select(OfficeModel)).scalars().all()
    rules = db.get(SystemRulesModel, 1)
    source = get_digiturno_source(rules.source_mode if rules else "mock")
    metrics = source.get_live_metrics(db, slot="10:00", day_of_week=1, is_fortnight=True)

    if format.lower() == "xlsx":
        content = export_reports_xlsx(offices, metrics)
        return Response(
            content=content,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": 'attachment; filename="Reporte_Turnos_Surtigas.xlsx"'},
        )

    content = export_reports_csv(offices, metrics)
    return Response(
        content=content,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="Reporte_Turnos_Surtigas.csv"'},
    )


# --- Auditoría ---

@router.get("/audit", response_model=list[AuditLogOut])
def list_audit_logs(
    user: Annotated[UserOut, Depends(require_roles("ADMIN", "COORDINADOR"))],
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
) -> list[AuditLogOut]:
    rows = db.execute(select(AuditLogModel).order_by(AuditLogModel.id.desc()).limit(limit)).scalars().all()
    return [
        AuditLogOut(
            id=r.id,
            actor_id=r.actor_id,
            actor_nombre=r.actor_nombre,
            actor_rol=r.actor_rol,
            action=r.action,
            entity_type=r.entity_type,
            entity_id=r.entity_id,
            summary=r.summary,
            payload_before=r.payload_before,
            payload_after=r.payload_after,
            created_at=r.created_at.isoformat() if r.created_at else "",
        )
        for r in rows
    ]


# --- ETL Digiturno ---

@router.post("/etl/digiturno/import", response_model=EtlRunOut)
async def import_digiturno_endpoint(
    user: Annotated[UserOut, Depends(require_roles("ADMIN", "COORDINADOR"))],
    file: UploadFile = File(...),
    sheet_name: str = Query("Mayo 2026", alias="sheetName"),
    db: Session = Depends(get_db),
) -> EtlRunOut:
    content = await file.read()
    with tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False) as tmp:
        tmp.write(content)
        tmp_path = Path(tmp.name)

    try:
        report = import_digiturno_excel(db, tmp_path, sheet_name=sheet_name, is_synthetic=False, source_type="excel")
    finally:
        tmp_path.unlink(missing_ok=True)

    record_audit(
        db,
        user,
        action="ETL_DIGITURNO_IMPORTED",
        entity_type="etl_run",
        entity_id=str(report.id),
        summary=f"Ingesta Excel '{file.filename}': {report.inserted_rows} insertados, {report.skipped_duplicates} duplicados omitidos.",
    )
    db.commit()
    return report


@router.get("/etl/digiturno/runs", response_model=list[EtlRunOut])
def list_etl_runs(
    user: Annotated[UserOut, Depends(require_roles("ADMIN", "COORDINADOR"))],
    db: Session = Depends(get_db),
) -> list[EtlRunOut]:
    rows = db.execute(select(EtlRunModel).order_by(EtlRunModel.id.desc())).scalars().all()
    return [
        EtlRunOut(
            id=r.id,
            filename=r.filename,
            source_type=r.source_type,
            total_rows=r.total_rows,
            inserted_rows=r.inserted_rows,
            skipped_duplicates=r.skipped_duplicates,
            invalid_rows=r.invalid_rows,
            cleaned_service_outliers=r.cleaned_service_outliers,
            date_min=r.date_min,
            date_max=r.date_max,
            offices_count=r.offices_count,
            operators_count=r.operators_count,
            warnings=list(r.warnings or []),
            created_at=r.created_at.isoformat() if r.created_at else "",
        )
        for r in rows
    ]
