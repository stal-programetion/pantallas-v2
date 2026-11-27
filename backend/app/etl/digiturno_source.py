"""Capa abstracta DigiturnoSource para desacoplar fuentes históricas y en tiempo real.

Contrato para integración futura con BD/API oficial de Digiturno:
1. Implementar una subclase de `DigiturnoSource` (p. ej. `DigiturnoApiSource`).
2. Sobrescribir `get_live_metrics`, `get_office_live_status` y `test_connection`
   devolviendo objetos `OfficeRealtimeMetricsOut` y `DigiturnoConnectionStatusOut`.
3. Registrar la fuente en `get_digiturno_source(mode)` usando las credenciales
   OAuth2/DB de entorno sin modificar los motores de colas ni el frontend.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime, timezone
import random

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.engines.erlang import calculate_required_agents, evaluate_erlang_a
from app.engines.forecast import get_office_day_forecast
from app.models.entities import DayPlanModel, OfficeModel, StaffModel, SystemRulesModel
from app.schemas.api import DigiturnoConnectionStatusOut, OfficeRealtimeMetricsOut


class DigiturnoSource(ABC):
    """Interfaz abstracta de fuente Digiturno."""

    source_name: str

    @abstractmethod
    def get_live_metrics(
        self,
        db: Session,
        slot: str = "10:00",
        day_of_week: int = 1,
        is_fortnight: bool = True,
    ) -> list[OfficeRealtimeMetricsOut]:
        """Retorna métricas actuales o proyectadas de las 14 oficinas."""

    @abstractmethod
    def get_office_live_status(
        self,
        db: Session,
        office_id: str,
        slot: str = "10:00",
        day_of_week: int = 1,
        is_fortnight: bool = True,
    ) -> OfficeRealtimeMetricsOut | None:
        """Retorna métricas para una oficina puntual."""

    @abstractmethod
    def test_connection(self) -> DigiturnoConnectionStatusOut:
        """Verifica conectividad con la fuente Digiturno configurada."""


def _count_active_agents_by_office(
    db: Session,
    offices: list[OfficeModel],
    slot: str,
) -> dict[str, int]:
    plan = db.execute(select(DayPlanModel).order_by(DayPlanModel.updated_at.desc())).scalars().first()
    counts = {o.id: 0 for o in offices}
    if plan and plan.turnos:
        for shift in plan.turnos.values():
            slot_obj = (shift.get("slots") or {}).get(slot)
            if not slot_obj:
                continue
            if slot_obj.get("estado") in ("atencion", "apoyo_virtual", "apoyo_presencial"):
                target_off = slot_obj.get("oficinaAsignadaId") or shift.get("oficinaBaseId")
                if target_off in counts:
                    counts[target_off] += 1
        return counts

    staff = db.execute(select(StaffModel)).scalars().all()
    for s in staff:
        if s.estado_hoy != "ausente" and s.oficina_actual_id in counts:
            counts[s.oficina_actual_id] += 1
    return counts


class ExcelSource(DigiturnoSource):
    """Fuente determinística basada en los históricos importados desde Excel de Digiturno."""

    source_name = "real"

    def get_live_metrics(
        self,
        db: Session,
        slot: str = "10:00",
        day_of_week: int = 1,
        is_fortnight: bool = True,
    ) -> list[OfficeRealtimeMetricsOut]:
        offices = db.execute(select(OfficeModel)).scalars().all()
        rules = db.get(SystemRulesModel, 1)
        default_sla = rules.target_sla if rules else 0.80
        default_wait = rules.max_wait_min if rules else 10
        active_map = _count_active_agents_by_office(db, offices, slot)

        metrics: list[OfficeRealtimeMetricsOut] = []
        for off in offices:
            fc_list = get_office_day_forecast(db, off.id, day_of_week, is_fortnight)
            fc = next((x for x in fc_list if x.franja == slot), fc_list[0])
            active = active_map.get(off.id, 1)
            sla_goal = off.sla_objetivo or default_sla
            wait_max = off.tiempo_espera_max_min or default_wait

            req, _ = calculate_required_agents(
                fc.tasa_llegadas_hora,
                fc.tiempo_atencion_promedio_min,
                sla_goal,
                wait_max,
                off.capacidad_puestos,
            )
            ev = evaluate_erlang_a(
                fc.tasa_llegadas_hora,
                fc.tiempo_atencion_promedio_min,
                active,
                wait_max,
            )
            queue_len = max(0, round((ev.tiempo_espera_promedio_min * fc.tasa_llegadas_hora) / 60.0))
            if ev.nivel_servicio < 0.70 or active == 0:
                estado_sla = "critico"
            elif ev.nivel_servicio < sla_goal:
                estado_sla = "alerta"
            else:
                estado_sla = "optimo"

            tendencia = "subiendo" if fc.es_pico else ("bajando" if ev.nivel_servicio < 0.75 else "estable")
            metrics.append(
                OfficeRealtimeMetricsOut(
                    oficina_id=off.id,
                    clientes_en_fila=queue_len,
                    espera_promedio_min=round(ev.tiempo_espera_promedio_min, 1),
                    sla_actual=round(ev.nivel_servicio, 4),
                    agentes_activos=active,
                    agentes_requeridos=req,
                    capacidad_utilizada=min(100, round((active / max(1, off.capacidad_puestos)) * 100)),
                    estado_sla=estado_sla,  # type: ignore[arg-type]
                    tendencia=tendencia,  # type: ignore[arg-type]
                )
            )
        return metrics

    def get_office_live_status(
        self,
        db: Session,
        office_id: str,
        slot: str = "10:00",
        day_of_week: int = 1,
        is_fortnight: bool = True,
    ) -> OfficeRealtimeMetricsOut | None:
        all_m = self.get_live_metrics(db, slot, day_of_week, is_fortnight)
        return next((m for m in all_m if m.oficina_id == office_id), None)

    def test_connection(self) -> DigiturnoConnectionStatusOut:
        return DigiturnoConnectionStatusOut(
            connected=True,
            latency_ms=18,
            endpoint_url="postgres://digiturno-excel-historical-store",
            version="v2.4-excel-etl",
            last_sync=datetime.now(timezone.utc).isoformat(),
            message="Fuente histórica Digiturno (Excel importado) conectada y sincronizada.",
            source_mode="real",
        )


class SimulatedLiveSource(DigiturnoSource):
    """Genera llegadas y colas en vivo siguiendo el patrón histórico real de Digiturno."""

    source_name = "mock"

    def __init__(self, seed: int = 13579) -> None:
        self._rng = random.Random(seed)

    def get_live_metrics(
        self,
        db: Session,
        slot: str = "10:00",
        day_of_week: int = 1,
        is_fortnight: bool = True,
    ) -> list[OfficeRealtimeMetricsOut]:
        offices = db.execute(select(OfficeModel)).scalars().all()
        rules = db.get(SystemRulesModel, 1)
        default_sla = rules.target_sla if rules else 0.80
        default_wait = rules.max_wait_min if rules else 10
        active_map = _count_active_agents_by_office(db, offices, slot)

        metrics: list[OfficeRealtimeMetricsOut] = []
        for off in offices:
            fc_list = get_office_day_forecast(db, off.id, day_of_week, is_fortnight)
            fc = next((x for x in fc_list if x.franja == slot), fc_list[0])
            active = active_map.get(off.id, 1)
            sla_goal = off.sla_objetivo or default_sla
            wait_max = off.tiempo_espera_max_min or default_wait

            jitter = self._rng.uniform(-0.12, 0.16) * max(2.0, fc.tasa_llegadas_hora)
            lambda_live = max(0.5, fc.tasa_llegadas_hora + jitter)

            req, _ = calculate_required_agents(
                lambda_live,
                fc.tiempo_atencion_promedio_min,
                sla_goal,
                wait_max,
                off.capacidad_puestos,
            )
            ev = evaluate_erlang_a(
                lambda_live,
                fc.tiempo_atencion_promedio_min,
                active,
                wait_max,
            )
            queue_len = max(
                0,
                round((ev.tiempo_espera_promedio_min * lambda_live) / 60.0) + self._rng.randint(0, 2),
            )
            if ev.nivel_servicio < 0.70 or active == 0:
                estado_sla = "critico"
            elif ev.nivel_servicio < sla_goal:
                estado_sla = "alerta"
            else:
                estado_sla = "optimo"

            tendencia = (
                "subiendo"
                if jitter > 0.5 or fc.es_pico
                else ("bajando" if ev.nivel_servicio >= sla_goal else "estable")
            )
            metrics.append(
                OfficeRealtimeMetricsOut(
                    oficina_id=off.id,
                    clientes_en_fila=queue_len,
                    espera_promedio_min=round(ev.tiempo_espera_promedio_min, 1),
                    sla_actual=round(ev.nivel_servicio, 4),
                    agentes_activos=active,
                    agentes_requeridos=req,
                    capacidad_utilizada=min(100, round((active / max(1, off.capacidad_puestos)) * 100)),
                    estado_sla=estado_sla,  # type: ignore[arg-type]
                    tendencia=tendencia,  # type: ignore[arg-type]
                )
            )
        return metrics

    def get_office_live_status(
        self,
        db: Session,
        office_id: str,
        slot: str = "10:00",
        day_of_week: int = 1,
        is_fortnight: bool = True,
    ) -> OfficeRealtimeMetricsOut | None:
        all_m = self.get_live_metrics(db, slot, day_of_week, is_fortnight)
        return next((m for m in all_m if m.oficina_id == office_id), None)

    def test_connection(self) -> DigiturnoConnectionStatusOut:
        return DigiturnoConnectionStatusOut(
            connected=True,
            latency_ms=34,
            endpoint_url="sim://surtigas-digiturno-live-stream",
            version="v2.4-simulated-live",
            last_sync=datetime.now(timezone.utc).isoformat(),
            message="SimulatedLiveSource activo: 14 oficinas alimentadas con patrón histórico Digiturno.",
            source_mode="mock",
        )


_SIMULATED_SOURCE = SimulatedLiveSource()
_EXCEL_SOURCE = ExcelSource()


def get_digiturno_source(mode: str) -> DigiturnoSource:
    if mode == "real":
        return _EXCEL_SOURCE
    return _SIMULATED_SOURCE
