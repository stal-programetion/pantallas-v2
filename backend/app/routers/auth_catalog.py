"""Endpoints de salud, autenticación, catálogos (oficinas, personal) y reglas."""

from __future__ import annotations

from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.config import get_settings
from app.core.auth import (
    DEMO_CREDENTIALS,
    DEMO_USERS,
    create_access_token,
    get_current_user,
    require_roles,
)
from app.core.privacy import mask_document_for_role
from app.database import get_db
from app.models.entities import OfficeModel, StaffModel, SystemRulesModel
from app.schemas.api import (
    AuthTokenOut,
    BusinessHoursOut,
    ContractScheduleOut,
    CoordinatesOut,
    DemoSessionIn,
    LoginIn,
    LunchWindowOut,
    OfficeOut,
    OfficeUpdateIn,
    StaffOut,
    SystemRulesOut,
    SystemRulesUpdateIn,
    UserOut,
)
from app.services.operations import record_audit

router = APIRouter()


def _serialize_office(o: OfficeModel) -> OfficeOut:
    return OfficeOut(
        id=o.id,
        nombre=o.nombre,
        ciudad=o.ciudad,
        departamento=o.departamento,  # type: ignore[arg-type]
        coordenadas=CoordinatesOut(lat=o.lat, lng=o.lng),
        capacidad_puestos=o.capacidad_puestos,
        estado=o.estado,  # type: ignore[arg-type]
        horario_atencion=BusinessHoursOut(inicio=o.horario_inicio, fin=o.horario_fin),
        sla_objetivo=o.sla_objetivo,
        tiempo_espera_max_min=o.tiempo_espera_max_min,
        telefono=o.telefono,
        direccion=o.direccion,
    )


def _serialize_staff(s: StaffModel, role: str) -> StaffOut:
    return StaffOut(
        id=s.id,
        nombre=s.nombre,
        documento=mask_document_for_role(s.documento, role),  # type: ignore[arg-type]
        oficina_base_id=s.oficina_base_id,
        cargo=s.cargo,
        jornada=s.jornada,  # type: ignore[arg-type]
        horario_contrato=ContractScheduleOut(entrada=s.horario_entrada, salida=s.horario_salida),
        ventana_almuerzo=LunchWindowOut(
            inicio=s.almuerzo_inicio,
            fin=s.almuerzo_fin,
            duracion_minutos=s.almuerzo_duracion_min,
        ),
        modalidad=s.modalidad,  # type: ignore[arg-type]
        competencias=list(s.competencias or []),
        estado_hoy=s.estado_hoy,  # type: ignore[arg-type]
        oficina_actual_id=s.oficina_actual_id,
    )


@router.get("/health")
def health_check(db: Session = Depends(get_db)) -> dict:
    settings = get_settings()
    db_status = "connected"
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        db_status = "error"
    rules = db.get(SystemRulesModel, 1)
    return {
        "status": "ok" if db_status == "connected" else "degraded",
        "database": db_status,
        "sourceMode": rules.source_mode if rules else settings.digiturno_source_mode,
        "version": settings.app_version,
    }


@router.post("/auth/demo-session", response_model=AuthTokenOut)
def create_demo_session(body: DemoSessionIn) -> AuthTokenOut:
    settings = get_settings()
    if not settings.auth_demo_role_switch:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="El selector de rol demo está deshabilitado por configuración",
        )
    user = DEMO_USERS[body.rol]
    return AuthTokenOut(access_token=create_access_token(user), user=user)


@router.post("/auth/login", response_model=AuthTokenOut)
def login(body: LoginIn) -> AuthTokenOut:
    cred = DEMO_CREDENTIALS.get(body.email.strip().lower())
    if not cred or cred[0] != body.password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales inválidas",
        )
    user = DEMO_USERS[cred[1]]  # type: ignore[index]
    return AuthTokenOut(access_token=create_access_token(user), user=user)


@router.get("/auth/me", response_model=UserOut)
def get_me(user: Annotated[UserOut, Depends(get_current_user)]) -> UserOut:
    return user


@router.get("/offices", response_model=list[OfficeOut])
def list_offices(db: Session = Depends(get_db)) -> list[OfficeOut]:
    rows = db.execute(select(OfficeModel).order_by(OfficeModel.departamento, OfficeModel.nombre)).scalars().all()
    return [_serialize_office(o) for o in rows]


@router.get("/offices/{office_id}", response_model=OfficeOut)
def get_office(office_id: str, db: Session = Depends(get_db)) -> OfficeOut:
    off = db.get(OfficeModel, office_id)
    if not off:
        raise HTTPException(status_code=404, detail=f"Oficina {office_id} no encontrada")
    return _serialize_office(off)


@router.patch("/offices/{office_id}", response_model=OfficeOut)
def update_office(
    office_id: str,
    body: OfficeUpdateIn,
    user: Annotated[UserOut, Depends(require_roles("ADMIN"))],
    db: Session = Depends(get_db),
) -> OfficeOut:
    off = db.get(OfficeModel, office_id)
    if not off:
        raise HTTPException(status_code=404, detail=f"Oficina {office_id} no encontrada")

    before = {"nombre": off.nombre, "capacidadPuestos": off.capacidad_puestos, "ciudad": off.ciudad}
    if body.nombre is not None:
        off.nombre = body.nombre
    if body.ciudad is not None:
        off.ciudad = body.ciudad
    if body.capacidad_puestos is not None:
        off.capacidad_puestos = body.capacidad_puestos
    if body.estado is not None:
        off.estado = body.estado
    if body.sla_objetivo is not None:
        off.sla_objetivo = body.sla_objetivo
    if body.tiempo_espera_max_min is not None:
        off.tiempo_espera_max_min = body.tiempo_espera_max_min

    record_audit(
        db,
        user,
        action="OFFICE_UPDATED",
        entity_type="office",
        entity_id=off.id,
        summary=f"Actualización de parámetros de sede {off.nombre}.",
        before=before,
        after={"nombre": off.nombre, "capacidadPuestos": off.capacidad_puestos, "ciudad": off.ciudad},
    )
    db.commit()
    db.refresh(off)
    return _serialize_office(off)


@router.get("/staff", response_model=list[StaffOut])
def list_staff(
    user: Annotated[UserOut, Depends(get_current_user)],
    oficina_base_id: str | None = None,
    db: Session = Depends(get_db),
) -> list[StaffOut]:
    stmt = select(StaffModel)
    if oficina_base_id:
        stmt = stmt.where(StaffModel.oficina_base_id == oficina_base_id)
    rows = db.execute(stmt.order_by(StaffModel.id)).scalars().all()
    return [_serialize_staff(s, user.rol) for s in rows]


@router.get("/settings/rules", response_model=SystemRulesOut)
def get_rules(db: Session = Depends(get_db)) -> SystemRulesOut:
    rules = db.get(SystemRulesModel, 1)
    if not rules:
        return SystemRulesOut(
            target_sla=0.80,
            max_wait_min=10,
            max_presencial_km=45.0,
            lunch_duration_min=60,
            fortnight_multiplier=1.32,
            min_agents_open_office=1,
            source_mode="mock",
        )
    return SystemRulesOut(
        target_sla=rules.target_sla,
        max_wait_min=rules.max_wait_min,
        max_presencial_km=rules.max_presencial_km,
        lunch_duration_min=rules.lunch_duration_min,
        fortnight_multiplier=rules.fortnight_multiplier,
        min_agents_open_office=rules.min_agents_open_office,
        source_mode=rules.source_mode,  # type: ignore[arg-type]
    )


@router.put("/settings/rules", response_model=SystemRulesOut)
def update_rules(
    body: SystemRulesUpdateIn,
    user: Annotated[UserOut, Depends(require_roles("ADMIN"))],
    db: Session = Depends(get_db),
) -> SystemRulesOut:
    rules = db.get(SystemRulesModel, 1)
    if not rules:
        rules = SystemRulesModel(id=1)
        db.add(rules)
    before = {"targetSla": rules.target_sla, "maxWaitMin": rules.max_wait_min, "maxPresencialKm": rules.max_presencial_km}
    if body.target_sla is not None:
        rules.target_sla = body.target_sla
    if body.max_wait_min is not None:
        rules.max_wait_min = body.max_wait_min
    if body.max_presencial_km is not None:
        rules.max_presencial_km = body.max_presencial_km
    if body.lunch_duration_min is not None:
        rules.lunch_duration_min = body.lunch_duration_min
    if body.fortnight_multiplier is not None:
        rules.fortnight_multiplier = body.fortnight_multiplier
    if body.min_agents_open_office is not None:
        rules.min_agents_open_office = body.min_agents_open_office

    record_audit(
        db,
        user,
        action="RULES_UPDATED",
        entity_type="system_rules",
        entity_id="1",
        summary="Actualización de reglas laborales y umbrales SLA.",
        before=before,
        after={"targetSla": rules.target_sla, "maxWaitMin": rules.max_wait_min, "maxPresencialKm": rules.max_presencial_km},
    )
    db.commit()
    db.refresh(rules)
    return get_rules(db)
