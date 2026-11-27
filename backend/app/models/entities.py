"""Modelos SQLAlchemy 2.0 del dominio Surtigas OptiTurnos."""

from datetime import datetime, timezone
from sqlalchemy import Boolean, DateTime, Float, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class OfficeModel(Base):
    __tablename__ = "offices"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    nombre: Mapped[str] = mapped_column(String(160), nullable=False)
    ciudad: Mapped[str] = mapped_column(String(100), nullable=False)
    departamento: Mapped[str] = mapped_column(String(80), nullable=False)
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lng: Mapped[float] = mapped_column(Float, nullable=False)
    capacidad_puestos: Mapped[int] = mapped_column(Integer, nullable=False, default=2)
    estado: Mapped[str] = mapped_column(String(32), nullable=False, default="abierta")
    horario_inicio: Mapped[str] = mapped_column(String(10), nullable=False, default="07:00")
    horario_fin: Mapped[str] = mapped_column(String(10), nullable=False, default="16:30")
    sla_objetivo: Mapped[float] = mapped_column(Float, nullable=False, default=0.80)
    tiempo_espera_max_min: Mapped[int] = mapped_column(Integer, nullable=False, default=10)
    telefono: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    direccion: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    is_synthetic: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class StaffModel(Base):
    __tablename__ = "staff"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    nombre: Mapped[str] = mapped_column(String(160), nullable=False)
    documento: Mapped[str] = mapped_column(String(40), nullable=False)
    oficina_base_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    cargo: Mapped[str] = mapped_column(String(120), nullable=False)
    jornada: Mapped[str] = mapped_column(String(32), nullable=False, default="completa")
    horario_entrada: Mapped[str] = mapped_column(String(10), nullable=False, default="07:00")
    horario_salida: Mapped[str] = mapped_column(String(10), nullable=False, default="16:30")
    almuerzo_inicio: Mapped[str] = mapped_column(String(10), nullable=False, default="12:00")
    almuerzo_fin: Mapped[str] = mapped_column(String(10), nullable=False, default="14:30")
    almuerzo_duracion_min: Mapped[int] = mapped_column(Integer, nullable=False, default=60)
    modalidad: Mapped[str] = mapped_column(String(32), nullable=False, default="presencial")
    competencias: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    estado_hoy: Mapped[str] = mapped_column(String(32), nullable=False, default="disponible")
    oficina_actual_id: Mapped[str] = mapped_column(String(64), nullable=False)
    is_synthetic: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class AbsenceModel(Base):
    __tablename__ = "absences"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    colaborador_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    tipo: Mapped[str] = mapped_column(String(48), nullable=False)
    fecha_inicio: Mapped[str] = mapped_column(String(16), nullable=False)
    fecha_fin: Mapped[str] = mapped_column(String(16), nullable=False)
    diagnostico_salud: Mapped[str | None] = mapped_column(Text, nullable=True)
    aprobado_por: Mapped[str] = mapped_column(String(160), nullable=False)
    motivo_detalle: Mapped[str] = mapped_column(Text, nullable=False)
    estado: Mapped[str] = mapped_column(String(32), nullable=False, default="activa")
    deficit_horas: Mapped[float] = mapped_column(Float, nullable=False, default=7.5)
    oficinas_afectadas: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class DayPlanModel(Base):
    __tablename__ = "day_plans"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    fecha: Mapped[str] = mapped_column(String(16), unique=True, nullable=False, index=True)
    estado: Mapped[str] = mapped_column(String(32), nullable=False, default="propuesto")
    aprobado_por: Mapped[str | None] = mapped_column(String(160), nullable=True)
    aprobado_en: Mapped[str | None] = mapped_column(String(64), nullable=True)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    total_cambios_manuales: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    tiempo_ahorrado_minutos: Mapped[int] = mapped_column(Integer, nullable=False, default=82)
    sla_proyectado_red: Mapped[float] = mapped_column(Float, nullable=False, default=0.82)
    turnos: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    original_turnos: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    justificaciones: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    is_fortnight: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)


class RedistributionModel(Base):
    __tablename__ = "redistributions"

    id: Mapped[str] = mapped_column(String(96), primary_key=True)
    plan_fecha: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    colaborador_id: Mapped[str] = mapped_column(String(64), nullable=False)
    colaborador_nombre: Mapped[str] = mapped_column(String(160), nullable=False)
    oficina_origen_id: Mapped[str] = mapped_column(String(64), nullable=False)
    oficina_origen_nombre: Mapped[str] = mapped_column(String(160), nullable=False)
    oficina_destino_id: Mapped[str] = mapped_column(String(64), nullable=False)
    oficina_destino_nombre: Mapped[str] = mapped_column(String(160), nullable=False)
    modalidad: Mapped[str] = mapped_column(String(32), nullable=False)
    distancia_km: Mapped[float] = mapped_column(Float, nullable=False)
    es_intermunicipal: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    franja_inicio: Mapped[str] = mapped_column(String(10), nullable=False)
    franja_fin: Mapped[str] = mapped_column(String(10), nullable=False)
    motivo: Mapped[str] = mapped_column(Text, nullable=False)
    reduccion_espera_min: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    sla_proyectado_destino: Mapped[float] = mapped_column(Float, nullable=False, default=0.8)
    sla_origen_resultante: Mapped[float] = mapped_column(Float, nullable=False, default=0.8)
    abandono_antes_pct: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    abandono_despues_pct: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    estado: Mapped[str] = mapped_column(String(32), nullable=False, default="pendiente")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)


class AlertModel(Base):
    __tablename__ = "alerts"

    id: Mapped[str] = mapped_column(String(120), primary_key=True)
    plan_fecha: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    tipo: Mapped[str] = mapped_column(String(48), nullable=False)
    severidad: Mapped[str] = mapped_column(String(32), nullable=False)
    oficina_id: Mapped[str] = mapped_column(String(64), nullable=False)
    oficina_nombre: Mapped[str] = mapped_column(String(160), nullable=False)
    titulo: Mapped[str] = mapped_column(String(200), nullable=False)
    mensaje: Mapped[str] = mapped_column(Text, nullable=False)
    franja: Mapped[str | None] = mapped_column(String(10), nullable=True)
    accion_sugerida: Mapped[str] = mapped_column(Text, nullable=False)
    accion_tipo: Mapped[str | None] = mapped_column(String(48), nullable=True)
    timestamp: Mapped[str] = mapped_column(String(64), nullable=False)
    leida: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


class HistoricalTurnModel(Base):
    __tablename__ = "historical_turns"

    id_turno: Mapped[str] = mapped_column(String(80), primary_key=True)
    id_oficina_raw: Mapped[str] = mapped_column(String(64), nullable=False)
    oficina_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    nombre_oficina: Mapped[str] = mapped_column(String(160), nullable=False)
    nombre_sala: Mapped[str] = mapped_column(String(120), nullable=False, default="General")
    numero: Mapped[str] = mapped_column(String(40), nullable=False, default="")
    id_servicio: Mapped[str] = mapped_column(String(40), nullable=False, default="")
    tipo: Mapped[str] = mapped_column(String(16), nullable=False, default="TUR")
    origen_turno: Mapped[str] = mapped_column(String(32), nullable=False, default="Atril")
    estado: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    tiempo_inicio_espera: Mapped[datetime] = mapped_column(DateTime(timezone=False), nullable=False, index=True)
    fecha_dia: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    dia_semana: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    franja: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    tiempo_espera_seg: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    tiempo_atencion_seg: Mapped[float | None] = mapped_column(Float, nullable=True)
    id_usuario: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    operador_pseudonimo: Mapped[str] = mapped_column(String(64), nullable=False, default="OP-000")
    nombre_terminal: Mapped[str] = mapped_column(String(64), nullable=False, default="T-01")
    nombre_cola: Mapped[str] = mapped_column(String(120), nullable=False, default="General")
    tipo_cliente: Mapped[str] = mapped_column(String(80), nullable=False, default="General")
    tipo_tramite: Mapped[str] = mapped_column(String(120), nullable=False, default="Información")
    departamento: Mapped[str] = mapped_column(String(80), nullable=False, default="Bolívar")
    ciudad: Mapped[str] = mapped_column(String(100), nullable=False, default="Cartagena")
    is_synthetic: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


class HistoricalSummaryModel(Base):
    __tablename__ = "historical_summaries"
    __table_args__ = (
        UniqueConstraint("oficina_id", "dia_semana", "franja", "es_quincena", name="uq_hist_summary_slot"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    oficina_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    dia_semana: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    franja: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    es_quincena: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    llegadas_promedio: Mapped[float] = mapped_column(Float, nullable=False)
    ic_inferior: Mapped[float] = mapped_column(Float, nullable=False)
    ic_superior: Mapped[float] = mapped_column(Float, nullable=False)
    tasa_llegadas_hora: Mapped[float] = mapped_column(Float, nullable=False)
    tiempo_espera_promedio_seg: Mapped[float] = mapped_column(Float, nullable=False)
    tiempo_atencion_promedio_seg: Mapped[float] = mapped_column(Float, nullable=False)
    tasa_abandono: Mapped[float] = mapped_column(Float, nullable=False, default=0.05)
    tramite_principal: Mapped[str] = mapped_column(String(120), nullable=False, default="Información")
    muestras: Mapped[int] = mapped_column(Integer, nullable=False, default=1)


class SystemRulesModel(Base):
    __tablename__ = "system_rules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    target_sla: Mapped[float] = mapped_column(Float, nullable=False, default=0.80)
    max_wait_min: Mapped[int] = mapped_column(Integer, nullable=False, default=10)
    max_presencial_km: Mapped[float] = mapped_column(Float, nullable=False, default=45.0)
    lunch_duration_min: Mapped[int] = mapped_column(Integer, nullable=False, default=60)
    fortnight_multiplier: Mapped[float] = mapped_column(Float, nullable=False, default=1.32)
    min_agents_open_office: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    source_mode: Mapped[str] = mapped_column(String(16), nullable=False, default="mock")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)


class AuditLogModel(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    actor_id: Mapped[str] = mapped_column(String(64), nullable=False)
    actor_nombre: Mapped[str] = mapped_column(String(160), nullable=False)
    actor_rol: Mapped[str] = mapped_column(String(32), nullable=False)
    action: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    entity_type: Mapped[str] = mapped_column(String(64), nullable=False)
    entity_id: Mapped[str] = mapped_column(String(96), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    payload_before: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    payload_after: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, index=True)


class EtlRunModel(Base):
    __tablename__ = "etl_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    source_type: Mapped[str] = mapped_column(String(32), nullable=False, default="excel")
    total_rows: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    inserted_rows: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    skipped_duplicates: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    invalid_rows: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    cleaned_service_outliers: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    date_min: Mapped[str | None] = mapped_column(String(32), nullable=True)
    date_max: Mapped[str | None] = mapped_column(String(32), nullable=True)
    offices_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    operators_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    warnings: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
