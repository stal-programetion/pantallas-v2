"""Endpoints de métricas en vivo Digiturno, comportamiento histórico y streaming SSE/WS."""

from __future__ import annotations

import asyncio
from collections import Counter
from datetime import datetime, timezone
import json
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.core.auth import decode_access_token, get_current_user, require_roles
from app.database import get_db
from app.engines.forecast import get_office_day_forecast
from app.etl.digiturno_source import get_digiturno_source
from app.etl.excel_importer import OPERATING_SLOTS_ALL
from app.models.entities import (
    HistoricalSummaryModel,
    HistoricalTurnModel,
    OfficeModel,
    SystemRulesModel,
)
from app.realtime.manager import broadcaster
from app.schemas.api import (
    BehaviorItemOut,
    DigiturnoConnectionStatusOut,
    HistoricalTicketSummaryOut,
    NetworkLoadOut,
    NetworkLoadPointOut,
    OfficeDailyActivityPointOut,
    OfficeRealtimeMetricsOut,
    SourceModeIn,
    UserBehaviorOut,
    UserOut,
)
from app.services.operations import record_audit

router = APIRouter()


def _active_source_mode(db: Session) -> str:
    rules = db.get(SystemRulesModel, 1)
    return rules.source_mode if rules else "mock"


@router.get("/digiturno/live-metrics", response_model=list[OfficeRealtimeMetricsOut])
def get_live_metrics(
    _user: Annotated[UserOut, Depends(get_current_user)],
    slot: str = "10:00",
    day_of_week: int = Query(4, alias="dayOfWeek"),
    is_fortnight: bool = Query(True, alias="isFortnight"),
    db: Session = Depends(get_db),
) -> list[OfficeRealtimeMetricsOut]:
    source = get_digiturno_source(_active_source_mode(db))
    return source.get_live_metrics(db, slot=slot, day_of_week=day_of_week, is_fortnight=is_fortnight)


@router.get("/digiturno/live-metrics/{office_id}", response_model=OfficeRealtimeMetricsOut)
def get_office_live_metrics(
    office_id: str,
    _user: Annotated[UserOut, Depends(get_current_user)],
    slot: str = "10:00",
    day_of_week: int = Query(4, alias="dayOfWeek"),
    is_fortnight: bool = Query(True, alias="isFortnight"),
    db: Session = Depends(get_db),
) -> OfficeRealtimeMetricsOut:
    source = get_digiturno_source(_active_source_mode(db))
    metric = source.get_office_live_status(
        db, office_id, slot=slot, day_of_week=day_of_week, is_fortnight=is_fortnight
    )
    if not metric:
        raise HTTPException(status_code=404, detail=f"Oficina {office_id} no encontrada")
    return metric


@router.get("/digiturno/network-load", response_model=NetworkLoadOut)
def get_network_load(
    _user: Annotated[UserOut, Depends(get_current_user)],
    is_fortnight: bool = Query(True, alias="isFortnight"),
    current_slot: str = Query("11:00", alias="currentSlot"),
    day_of_week: int = Query(4, alias="dayOfWeek"),
    db: Session = Depends(get_db),
) -> NetworkLoadOut:
    offices = db.execute(select(OfficeModel)).scalars().all()
    totals_by_slot = {s: 0.0 for s in OPERATING_SLOTS_ALL}
    for off in offices:
        for fc in get_office_day_forecast(db, off.id, day_of_week, is_fortnight):
            totals_by_slot[fc.franja] += fc.tasa_llegadas_hora

    series: list[NetworkLoadPointOut] = []
    for s in OPERATING_SLOTS_ALL:
        predicted = round(totals_by_slot[s])
        capacity = max(10, round(predicted * 1.06))
        live_val = round(predicted * (1.03 if s in ("09:00", "09:30", "14:00") else 0.97)) if s <= current_slot else None
        series.append(
            NetworkLoadPointOut(
                franja=s,
                demanda_pronosticada=predicted,
                llegadas_digiturno=live_val,
                capacidad_operativa=capacity,
            )
        )
    return NetworkLoadOut(is_fortnight=is_fortnight, current_slot=current_slot, series=series)


@router.get("/digiturno/user-behavior", response_model=UserBehaviorOut)
def get_user_behavior(
    _user: Annotated[UserOut, Depends(get_current_user)],
    db: Session = Depends(get_db),
) -> UserBehaviorOut:
    turns = db.execute(select(HistoricalTurnModel)).scalars().all()
    if not turns:
        return UserBehaviorOut(
            pico_matutino="07:30 - 10:30",
            tasa_abandono_porcentaje=7.0,
            meta_abandono_porcentaje=3.0,
            tramites=[
                BehaviorItemOut(nombre="Facturación y Convenio de pago", porcentaje=44, tiempo_medio_min=7.4),
                BehaviorItemOut(nombre="Peticiones, Quejas y Reclamos (PQR)", porcentaje=30, tiempo_medio_min=11.2),
                BehaviorItemOut(nombre="Solicitudes y Radicación de carta", porcentaje=18, tiempo_medio_min=9.5),
                BehaviorItemOut(nombre="Información General", porcentaje=8, tiempo_medio_min=5.8),
            ],
        )

    total = len(turns)
    aba_count = sum(1 for t in turns if t.estado == "ABA")
    groups: dict[str, list[float]] = {
        "Peticiones, Quejas y Reclamos (PQR)": [],
        "Información General": [],
        "Solicitudes y Radicación": [],
        "Convenio de pago y Facturación": [],
        "Otros / Sin asignar": [],
    }
    group_counts: Counter[str] = Counter()

    for t in turns:
        tr = (t.tipo_tramite or "").lower()
        if "convenio" in tr or "factur" in tr or "pago" in tr:
            key = "Convenio de pago y Facturación"
        elif "reclamo" in tr or "petic" in tr or "queja" in tr or "pqr" in tr:
            key = "Peticiones, Quejas y Reclamos (PQR)"
        elif "solicitud" in tr or "radic" in tr or "registro" in tr:
            key = "Solicitudes y Radicación"
        elif "sin asignar" in tr or not tr.strip():
            key = "Otros / Sin asignar"
        else:
            key = "Información General"
        group_counts[key] += 1
        if t.estado == "FIN" and t.tiempo_atencion_seg and t.tiempo_atencion_seg > 0:
            groups[key].append(t.tiempo_atencion_seg / 60.0)

    items = []
    for name, count in group_counts.most_common():
        svc_list = groups[name]
        avg_min = round(sum(svc_list) / len(svc_list), 1) if svc_list else 8.0
        items.append(
            BehaviorItemOut(
                nombre=name,
                porcentaje=max(1, round((count / total) * 100)),
                tiempo_medio_min=avg_min,
            )
        )

    return UserBehaviorOut(
        pico_matutino="07:30 - 10:30",
        tasa_abandono_porcentaje=round((aba_count / total) * 100, 1),
        meta_abandono_porcentaje=3.0,
        tramites=items,
    )


@router.get("/digiturno/office-daily-activity/{office_id}", response_model=list[OfficeDailyActivityPointOut])
def get_office_daily_activity(
    office_id: str,
    _user: Annotated[UserOut, Depends(get_current_user)],
    current_slot: str = Query("11:00", alias="currentSlot"),
    day_of_week: int = Query(4, alias="dayOfWeek"),
    is_fortnight: bool = Query(True, alias="isFortnight"),
    db: Session = Depends(get_db),
) -> list[OfficeDailyActivityPointOut]:
    fc = get_office_day_forecast(db, office_id, day_of_week=day_of_week, is_fortnight=is_fortnight)
    points: list[OfficeDailyActivityPointOut] = []
    for item in fc:
        if item.franja > current_slot:
            break
        attended = max(1, round(item.llegadas_esperadas * (1.0 - item.tasa_abandono)))
        waiting = max(1, round(item.llegadas_esperadas * 0.22))
        points.append(
            OfficeDailyActivityPointOut(
                franja=item.franja,
                atendidos=attended,
                en_espera=waiting,
            )
        )
    return points


@router.get("/digiturno/historical", response_model=list[HistoricalTicketSummaryOut])
def get_historical(
    _user: Annotated[UserOut, Depends(get_current_user)],
    office_id: str | None = Query(None, alias="officeId"),
    is_fortnight: bool | None = Query(None, alias="isFortnight"),
    db: Session = Depends(get_db),
) -> list[HistoricalTicketSummaryOut]:
    stmt = select(HistoricalSummaryModel)
    if office_id:
        stmt = stmt.where(HistoricalSummaryModel.oficina_id == office_id)
    if is_fortnight is not None:
        stmt = stmt.where(HistoricalSummaryModel.es_quincena == is_fortnight)
    rows = db.execute(
        stmt.order_by(
            HistoricalSummaryModel.oficina_id,
            HistoricalSummaryModel.dia_semana,
            HistoricalSummaryModel.franja,
        )
    ).scalars().all()
    return [
        HistoricalTicketSummaryOut(
            franja=r.franja,
            dia_semana=r.dia_semana,
            oficina_id=r.oficina_id,
            llegadas_promedio=r.llegadas_promedio,
            ic_inferior=r.ic_inferior,
            ic_superior=r.ic_superior,
            tiempo_espera_promedio_seg=r.tiempo_espera_promedio_seg,
            tiempo_atencion_promedio_seg=r.tiempo_atencion_promedio_seg,
            tasa_abandono=r.tasa_abandono,
            tramite_principal=r.tramite_principal,
            es_quincena=r.es_quincena,
        )
        for r in rows
    ]


@router.get("/digiturno/connection-status", response_model=DigiturnoConnectionStatusOut)
def connection_status(
    _user: Annotated[UserOut, Depends(get_current_user)],
    db: Session = Depends(get_db),
) -> DigiturnoConnectionStatusOut:
    source = get_digiturno_source(_active_source_mode(db))
    return source.test_connection()


@router.post("/digiturno/test-connection", response_model=DigiturnoConnectionStatusOut)
def test_connection(
    user: Annotated[UserOut, Depends(require_roles("ADMIN", "COORDINADOR"))],
    db: Session = Depends(get_db),
) -> DigiturnoConnectionStatusOut:
    source = get_digiturno_source(_active_source_mode(db))
    return source.test_connection()


@router.put("/digiturno/source-mode", response_model=DigiturnoConnectionStatusOut)
def set_source_mode(
    body: SourceModeIn,
    user: Annotated[UserOut, Depends(require_roles("ADMIN", "COORDINADOR"))],
    db: Session = Depends(get_db),
) -> DigiturnoConnectionStatusOut:
    rules = db.get(SystemRulesModel, 1)
    prev_mode = rules.source_mode if rules else "mock"
    if not rules:
        rules = SystemRulesModel(id=1, source_mode=body.mode)
        db.add(rules)
    else:
        rules.source_mode = body.mode

    record_audit(
        db,
        user,
        action="DIGITURNO_SOURCE_MODE_CHANGED",
        entity_type="system_rules",
        entity_id="1",
        summary=f"Modo de fuente Digiturno cambiado de '{prev_mode}' a '{body.mode}'.",
        before={"sourceMode": prev_mode},
        after={"sourceMode": body.mode},
    )
    db.commit()
    source = get_digiturno_source(body.mode)
    return source.test_connection()


@router.get("/realtime/stream")
async def realtime_sse_stream(
    _user: Annotated[UserOut, Depends(get_current_user)],
):
    """Flujo Server-Sent Events (SSE) con métricas en vivo y alertas."""
    queue = broadcaster.subscribe()

    async def event_generator():
        try:
            yield f"data: {json.dumps({'type': 'heartbeat', 'timestamp': datetime.now(timezone.utc).isoformat()})}\n\n"
            while True:
                try:
                    msg = await asyncio.wait_for(queue.get(), timeout=15.0)
                    yield f"data: {msg}\n\n"
                except asyncio.TimeoutError:
                    yield f"data: {json.dumps({'type': 'heartbeat', 'timestamp': datetime.now(timezone.utc).isoformat()})}\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            broadcaster.unsubscribe(queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.websocket("/realtime/ws")
async def realtime_websocket(websocket: WebSocket, token: str | None = Query(None)):
    settings = get_settings()
    if settings.auth_required:
        if not token:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
        try:
            decode_access_token(token)
        except HTTPException:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

    await websocket.accept()
    queue = broadcaster.subscribe()
    try:
        while True:
            msg = await queue.get()
            await websocket.send_text(msg)
    except WebSocketDisconnect:
        pass
    finally:
        broadcaster.unsubscribe(queue)
