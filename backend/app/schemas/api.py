"""Esquemas Pydantic v2 con serialización camelCase exacta para el frontend."""

from typing import Any, Literal
from pydantic import BaseModel, ConfigDict


def to_camel(value: str) -> str:
    parts = value.split("_")
    return parts[0] + "".join(word.capitalize() for word in parts[1:])


class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


UserRole = Literal["ADMIN", "COORDINADOR", "CONSULTA"]
Department = Literal["Bolívar", "Córdoba", "Sucre", "Antioquia", "Magdalena"]
OfficeState = Literal["abierta", "cerrada", "mantenimiento"]
WorkShiftType = Literal["completa", "media_jornada"]
WorkModality = Literal["presencial", "virtual"]
AbsenceType = Literal["incapacidad_general", "permiso_personal", "licencia", "capacitacion"]
AbsenceState = Literal["activa", "finalizada", "programada"]
SlotStatus = Literal[
    "atencion",
    "almuerzo",
    "pausa",
    "libre",
    "apoyo_virtual",
    "apoyo_presencial",
    "ausente",
]
PlanState = Literal["borrador", "propuesto", "aprobado"]
RecState = Literal["pendiente", "aceptada", "rechazada"]
AlertSeverity = Literal["info", "advertencia", "critica"]
AlertType = Literal["pico_inminente", "ausencia_sin_cubrir", "sla_en_riesgo", "almuerzo_descubierto"]


# --- Auth ---
class UserOut(CamelModel):
    id: str
    nombre: str
    email: str
    rol: UserRole
    cargo: str
    avatar_url: str | None = None


class DemoSessionIn(CamelModel):
    rol: UserRole


class LoginIn(CamelModel):
    email: str
    password: str


class AuthTokenOut(CamelModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# --- Offices & Staff ---
class CoordinatesOut(CamelModel):
    lat: float
    lng: float


class BusinessHoursOut(CamelModel):
    inicio: str
    fin: str


class OfficeOut(CamelModel):
    id: str
    nombre: str
    ciudad: str
    departamento: Department
    coordenadas: CoordinatesOut
    capacidad_puestos: int
    estado: OfficeState
    horario_atencion: BusinessHoursOut
    sla_objetivo: float
    tiempo_espera_max_min: int
    telefono: str
    direccion: str


class OfficeUpdateIn(CamelModel):
    nombre: str | None = None
    ciudad: str | None = None
    capacidad_puestos: int | None = None
    estado: OfficeState | None = None
    sla_objetivo: float | None = None
    tiempo_espera_max_min: int | None = None


class ContractScheduleOut(CamelModel):
    entrada: str
    salida: str


class LunchWindowOut(CamelModel):
    inicio: str
    fin: str
    duracion_minutos: int


class StaffOut(CamelModel):
    id: str
    nombre: str
    documento: str
    oficina_base_id: str
    cargo: str
    jornada: WorkShiftType
    horario_contrato: ContractScheduleOut
    ventana_almuerzo: LunchWindowOut
    modalidad: WorkModality
    competencias: list[str]
    estado_hoy: Literal["disponible", "almuerzo", "ausente", "en_atencion", "trasladado"]
    oficina_actual_id: str


# --- Rules ---
class SystemRulesOut(CamelModel):
    target_sla: float
    max_wait_min: int
    max_presencial_km: float
    lunch_duration_min: int
    fortnight_multiplier: float
    min_agents_open_office: int
    source_mode: Literal["mock", "real"] = "mock"


class SystemRulesUpdateIn(CamelModel):
    target_sla: float | None = None
    max_wait_min: int | None = None
    max_presencial_km: float | None = None
    lunch_duration_min: int | None = None
    fortnight_multiplier: float | None = None
    min_agents_open_office: int | None = None


# --- Absences ---
class AbsenceImpactOut(CamelModel):
    deficit_horas: float
    oficinas_afectadas: list[str]


class AbsenceOut(CamelModel):
    id: str
    colaborador_id: str
    tipo: AbsenceType
    fecha_inicio: str
    fecha_fin: str
    diagnostico_salud: str | None = None
    aprobado_por: str
    motivo_detalle: str
    estado: AbsenceState
    impacto_estimado: AbsenceImpactOut | None = None


class AbsenceCreateIn(CamelModel):
    colaborador_id: str
    tipo: AbsenceType
    fecha_inicio: str
    fecha_fin: str
    diagnostico_salud: str | None = None
    aprobado_por: str
    motivo_detalle: str
    estado: AbsenceState = "activa"
    impacto_estimado: AbsenceImpactOut | None = None


class AbsenceUpdateIn(CamelModel):
    tipo: AbsenceType | None = None
    fecha_inicio: str | None = None
    fecha_fin: str | None = None
    diagnostico_salud: str | None = None
    aprobado_por: str | None = None
    motivo_detalle: str | None = None
    estado: AbsenceState | None = None


# --- Day Plan & Slots ---
class ShiftSlotOut(CamelModel):
    franja: str
    estado: SlotStatus
    oficina_asignada_id: str
    es_modificado_manual: bool | None = None
    nota: str | None = None


class ColaboradorShiftOut(CamelModel):
    colaborador_id: str
    oficina_base_id: str
    slots: dict[str, ShiftSlotOut]
    horas_totales: float


class DayPlanJustificationOut(CamelModel):
    id: str
    franja: str
    oficina_id: str
    razon: str
    regla: str
    tipo: Literal["pico_demanda", "cobertura_ausencia", "escalonamiento_almuerzo", "redistribucion"]


class DayPlanAuditOut(CamelModel):
    aprobado_por: str
    aprobado_en: str
    version: int
    total_cambios_manuales: int


class DayPlanOut(CamelModel):
    id: str
    fecha: str
    estado: PlanState
    auditoria: DayPlanAuditOut | None = None
    tiempo_ahorrado_minutos: int
    sla_proyectado_red: float = 0.83
    turnos: dict[str, ColaboradorShiftOut]
    justificaciones: list[DayPlanJustificationOut]


class GeneratePlanIn(CamelModel):
    fecha: str = "2026-10-15"
    is_fortnight: bool = True
    day_of_week: int | None = None


class ApprovePlanIn(CamelModel):
    approver_name: str | None = None


class SlotValidateIn(CamelModel):
    colaborador_id: str
    franja: str
    estado: SlotStatus


class SlotValidateOut(CamelModel):
    is_valid: bool
    warning_message: str | None = None
    before: int
    after: int
    required: int


class SlotPatchIn(CamelModel):
    colaborador_id: str
    franja: str
    estado: SlotStatus
    oficina_asignada_id: str | None = None
    nota: str | None = None


# --- Redistribution ---
class RedistributionImpactOut(CamelModel):
    reduccion_espera_min: float
    sla_proyectado_destino: float
    sla_origen_resultante: float
    abandono_antes_pct: float = 0.0
    abandono_despues_pct: float = 0.0


class RedistributionOut(CamelModel):
    id: str
    colaborador_id: str
    colaborador_nombre: str
    oficina_origen_id: str
    oficina_origen_nombre: str
    oficina_destino_id: str
    oficina_destino_nombre: str
    modalidad: WorkModality
    distancia_km: float
    es_intermunicipal: bool
    franja_inicio: str
    franja_fin: str
    motivo: str
    impacto_estimado: RedistributionImpactOut
    estado: RecState


class RedistributionEditIn(CamelModel):
    colaborador_id: str | None = None
    modalidad: WorkModality | None = None
    franja_inicio: str | None = None
    franja_fin: str | None = None


class RedistributionActionIn(CamelModel):
    motivo: str | None = None


# --- Alerts ---
class AlertOut(CamelModel):
    id: str
    tipo: AlertType
    severidad: AlertSeverity
    oficina_id: str
    oficina_nombre: str
    titulo: str
    mensaje: str
    franja: str | None = None
    accion_sugerida: str
    accion_tipo: Literal["redistribuir", "ajustar_almuerzo", "cubrir_ausencia", "revisar_malla"] | None = None
    timestamp: str
    leida: bool


# --- Digiturno & Analytics ---
class OfficeRealtimeMetricsOut(CamelModel):
    oficina_id: str
    clientes_en_fila: int
    espera_promedio_min: float
    sla_actual: float
    agentes_activos: int
    agentes_requeridos: int
    capacidad_utilizada: int
    estado_sla: Literal["optimo", "alerta", "critico"]
    tendencia: Literal["subiendo", "estable", "bajando"]


class DigiturnoConnectionStatusOut(CamelModel):
    connected: bool
    latency_ms: int
    endpoint_url: str
    version: str
    last_sync: str
    message: str
    source_mode: Literal["mock", "real"] = "mock"


class SourceModeIn(CamelModel):
    mode: Literal["mock", "real"]


class HistoricalTicketSummaryOut(CamelModel):
    franja: str
    dia_semana: int
    oficina_id: str
    llegadas_promedio: float
    ic_inferior: float = 0.0
    ic_superior: float = 0.0
    tiempo_espera_promedio_seg: float
    tiempo_atencion_promedio_seg: float
    tasa_abandono: float = 0.05
    tramite_principal: str
    es_quincena: bool


class NetworkLoadPointOut(CamelModel):
    franja: str
    demanda_pronosticada: int
    llegadas_digiturno: int | None
    capacidad_operativa: int


class NetworkLoadOut(CamelModel):
    is_fortnight: bool
    current_slot: str
    series: list[NetworkLoadPointOut]


class BehaviorItemOut(CamelModel):
    nombre: str
    porcentaje: int
    tiempo_medio_min: float


class UserBehaviorOut(CamelModel):
    pico_matutino: str
    tasa_abandono_porcentaje: float
    meta_abandono_porcentaje: float
    tramites: list[BehaviorItemOut]


class OfficeDailyActivityPointOut(CamelModel):
    franja: str
    atendidos: int
    en_espera: int


# --- Forecast ---
class SlotForecastOut(CamelModel):
    franja: str
    llegadas_esperadas: float
    tasa_llegadas_hora: float
    ic_inferior: float
    ic_superior: float
    tiempo_atencion_promedio_min: float
    tasa_abandono: float
    es_pico: bool
    tramite_predominante: str


class RequiredAgentsOut(CamelModel):
    operating_slots: list[str]
    required_by_office: dict[str, list[int]]


class PeakBlockOut(CamelModel):
    titulo: str
    rango: str
    descripcion: str
    recomendacion: str
    tone: str


class OfficeTensionOut(CamelModel):
    oficina_id: str
    nombre: str
    tasa_llegadas_pico: float
    agentes_requeridos: int
    ausentes: int


class PeaksSummaryOut(CamelModel):
    blocks: list[PeakBlockOut]
    tension_offices: list[OfficeTensionOut]


# --- Simulation ---
class SimulationParamsIn(CamelModel):
    additional_absences: int = 0
    demand_multiplier: float = 1.0
    target_sla: float = 0.80
    office_id_filter: str | None = None
    agents_override: dict[str, int] | None = None


class SimulationOfficeOut(CamelModel):
    oficina_id: str
    oficina_nombre: str
    sla_actual: float
    sla_simulado: float
    espera_actual_min: float
    espera_simulada_min: float
    agentes_actuales: int
    agentes_simulados: int
    abandono_actual_porcentaje: float = 0.0
    abandono_simulado_porcentaje: float = 0.0


class ErlangCurvePointOut(CamelModel):
    agentes: str
    c: int
    nivel_servicio: int
    espera_min: float


class SimulationResultOut(CamelModel):
    params: SimulationParamsIn
    total_agentes_actuales: int
    total_agentes_simulados: int
    sla_actual_ponderado: float
    sla_simulado_ponderado: float
    espera_actual_min: float
    espera_simulada_min: float
    abandono_actual_porcentaje: float = 0.0
    abandono_simulado_porcentaje: float = 0.0
    curva_erlang: list[ErlangCurvePointOut] = []
    oficinas_afectadas: list[SimulationOfficeOut]


class ApplyScenarioIn(CamelModel):
    fecha: str = "2026-10-15"
    params: SimulationParamsIn


# --- Absence Mutation Bundle ---
class AbsenceMutationOut(CamelModel):
    absence: AbsenceOut
    plan: DayPlanOut
    alerts: list[AlertOut]
    recommendations: list[RedistributionOut]


# --- Reports, Audit, ETL ---
class ReportOfficeRowOut(CamelModel):
    oficina_id: str
    nombre: str
    ciudad: str
    departamento: str
    capacidad_puestos: int
    clientes_en_fila: int
    espera_promedio_min: float
    sla_actual: float
    estado_sla: str
    tasa_abandono_pct: float


class ReportSummaryOut(CamelModel):
    range: str
    sla_red_pct: float
    espera_media_min: float
    utilizacion_pct: float
    tiempo_ahorrado_min_dia: int
    horas_mes_ahorradas: float
    tasa_abandono_pct: float
    oficinas: list[ReportOfficeRowOut]


class AuditLogOut(CamelModel):
    id: int
    actor_id: str
    actor_nombre: str
    actor_rol: str
    action: str
    entity_type: str
    entity_id: str
    summary: str
    payload_before: dict[str, Any] | None = None
    payload_after: dict[str, Any] | None = None
    created_at: str


class EtlRunOut(CamelModel):
    id: int
    filename: str
    source_type: str
    total_rows: int
    inserted_rows: int
    skipped_duplicates: int
    invalid_rows: int
    cleaned_service_outliers: int
    date_min: str | None = None
    date_max: str | None = None
    offices_count: int
    operators_count: int
    warnings: list[str]
    created_at: str
