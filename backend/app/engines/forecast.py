"""Motor de pronóstico de demanda basado en históricos Digiturno con intervalos de confianza."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.engines.erlang import calculate_required_agents
from app.etl.excel_importer import OPERATING_SLOTS_ALL
from app.models.entities import AbsenceModel, HistoricalSummaryModel, OfficeModel, SystemRulesModel
from app.schemas.api import (
    OfficeTensionOut,
    PeakBlockOut,
    PeaksSummaryOut,
    SlotForecastOut,
)

# Pesos de respaldo calibrados al patrón real de Digiturno mayo 2026 (7h-16h)
FALLBACK_HOURLY_PROFILE = {
    "07:00": 0.92, "07:30": 1.05,
    "08:00": 1.48, "08:30": 1.60,
    "09:00": 1.65, "09:30": 1.58,
    "10:00": 1.50, "10:30": 1.32,
    "11:00": 0.95, "11:30": 0.80,
    "12:00": 0.42, "12:30": 0.45,
    "13:00": 0.58, "13:30": 0.72,
    "14:00": 1.12, "14:30": 1.05,
    "15:00": 0.90, "15:30": 0.65,
    "16:00": 0.16,
}

FALLBACK_WEEKDAY_WEIGHTS = {
    1: 1.28,  # Lunes
    2: 1.06,  # Martes
    3: 1.00,  # Miércoles
    4: 0.96,  # Jueves
    5: 0.74,  # Viernes
    6: 0.50,
    0: 0.00,
}

FALLBACK_OFFICE_BASE_LAMBDA = {
    "cartagena-chambacu": 20.5,
    "monteria-centro": 15.2,
    "sincelejo-la-palma": 10.5,
    "cerete": 6.9,
    "turbaco": 6.8,
    "magangue": 6.3,
    "corozal": 5.5,
    "sahagun": 5.4,
    "el-carmen-de-bolivar": 4.6,
    "lorica": 4.0,
    "mompox": 4.0,
    "caucasia": 3.7,
    "tolu": 3.6,
    "planeta-rica": 1.8,
}


def _fallback_slot_forecast(
    office_id: str,
    day_of_week: int,
    slot: str,
    is_fortnight: bool,
    fortnight_multiplier: float = 1.32,
) -> SlotForecastOut:
    base = FALLBACK_OFFICE_BASE_LAMBDA.get(office_id, 5.0)
    day_w = FALLBACK_WEEKDAY_WEIGHTS.get(day_of_week, 1.0)
    slot_w = FALLBACK_HOURLY_PROFILE.get(slot, 0.8)
    fn_w = fortnight_multiplier if is_fortnight else 1.0

    lambda_h = round(base * day_w * slot_w * fn_w, 2)
    arrivals_30m = round(lambda_h * 0.5, 2)
    ic_low = round(max(0.0, arrivals_30m * 0.85), 2)
    ic_high = round(arrivals_30m * 1.15, 2)

    is_peak = slot_w >= 1.10 or (is_fortnight and slot_w >= 1.0)
    if slot in ("08:00", "08:30", "09:00", "09:30", "10:00"):
        tramite = "Peticiones, Quejas y Reclamos (PQR)"
        svc_min = 11.2
    elif slot in ("14:00", "14:30", "15:00"):
        tramite = "Convenio de pago y Solicitudes"
        svc_min = 9.4
    else:
        tramite = "Información y Facturación"
        svc_min = 7.4

    return SlotForecastOut(
        franja=slot,
        llegadas_esperadas=arrivals_30m,
        tasa_llegadas_hora=lambda_h,
        ic_inferior=ic_low,
        ic_superior=ic_high,
        tiempo_atencion_promedio_min=svc_min,
        tasa_abandono=0.07,
        es_pico=is_peak,
        tramite_predominante=tramite,
    )


def get_office_day_forecast(
    db: Session,
    office_id: str,
    day_of_week: int = 1,
    is_fortnight: bool = False,
) -> list[SlotForecastOut]:
    """Obtiene pronóstico por franja de 30 min desde historical_summaries (con respaldo calibrado)."""
    rules = db.get(SystemRulesModel, 1)
    fn_mult = rules.fortnight_multiplier if rules else 1.32

    rows = db.execute(
        select(HistoricalSummaryModel).where(
            HistoricalSummaryModel.oficina_id == office_id,
            HistoricalSummaryModel.dia_semana == day_of_week,
            HistoricalSummaryModel.es_quincena == is_fortnight,
        )
    ).scalars().all()
    by_slot = {r.franja: r for r in rows}

    # Calcular promedio diario de la oficina para marcar picos relativos
    if by_slot:
        avg_lambda = sum(r.tasa_llegadas_hora for r in by_slot.values()) / max(1, len(by_slot))
    else:
        avg_lambda = 10.0

    results: list[SlotForecastOut] = []
    for slot in OPERATING_SLOTS_ALL:
        r = by_slot.get(slot)
        if r and r.muestras > 0:
            svc_min = max(4.0, round(r.tiempo_atencion_promedio_seg / 60.0, 1))
            es_pico = r.tasa_llegadas_hora >= avg_lambda * 1.18 or slot in ("08:30", "09:00", "09:30", "10:00", "14:00")
            results.append(
                SlotForecastOut(
                    franja=slot,
                    llegadas_esperadas=round(r.llegadas_promedio, 1),
                    tasa_llegadas_hora=round(r.tasa_llegadas_hora, 2),
                    ic_inferior=round(r.ic_inferior, 1),
                    ic_superior=round(r.ic_superior, 1),
                    tiempo_atencion_promedio_min=svc_min,
                    tasa_abandono=round(r.tasa_abandono, 4),
                    es_pico=es_pico,
                    tramite_predominante=r.tramite_principal,
                )
            )
        else:
            results.append(
                _fallback_slot_forecast(office_id, day_of_week, slot, is_fortnight, fn_mult)
            )
    return results


def build_heatmap(db: Session, office_id: str, is_fortnight: bool = False) -> list[dict]:
    """Construye matriz Lunes-Viernes × franjas de 30 min para Análisis de Demanda."""
    days = [
        (1, "Lunes"),
        (2, "Martes"),
        (3, "Miércoles"),
        (4, "Jueves"),
        (5, "Viernes"),
    ]
    rows = []
    for dow, name in days:
        forecast = get_office_day_forecast(db, office_id, dow, is_fortnight)
        rows.append(
            {
                "dayName": name,
                "dayNum": dow,
                "slots": [
                    {
                        "slot": f.franja,
                        "demand": round(f.llegadas_esperadas, 1),
                        "icInferior": f.ic_inferior,
                        "icSuperior": f.ic_superior,
                        "isPeak": f.es_pico,
                    }
                    for f in forecast
                ],
            }
        )
    return rows


def build_fortnight_comparison(db: Session, office_id: str, day_of_week: int = 1) -> list[dict]:
    normal = get_office_day_forecast(db, office_id, day_of_week, False)
    fortnight = get_office_day_forecast(db, office_id, day_of_week, True)
    return [
        {
            "franja": n.franja,
            "diaEstandar": round(n.llegadas_esperadas, 1),
            "diaQuincena": round(f.llegadas_esperadas, 1),
        }
        for n, f in zip(normal, fortnight)
    ]


def build_office_comparison(
    db: Session,
    office_a_id: str,
    office_b_id: str,
    day_of_week: int = 1,
    is_fortnight: bool = True,
) -> list[dict]:
    fa = get_office_day_forecast(db, office_a_id, day_of_week, is_fortnight)
    fb = get_office_day_forecast(db, office_b_id, day_of_week, is_fortnight)
    return [
        {
            "franja": a.franja,
            "officeA": round(a.llegadas_esperadas, 1),
            "officeB": round(b.llegadas_esperadas, 1),
        }
        for a, b in zip(fa, fb)
    ]


def compute_required_agents_matrix(
    db: Session,
    day_of_week: int = 4,
    is_fortnight: bool = True,
) -> dict[str, list[int]]:
    """Calcula agentes requeridos por oficina y franja con Erlang C."""
    offices = db.execute(select(OfficeModel)).scalars().all()
    rules = db.get(SystemRulesModel, 1)
    default_sla = rules.target_sla if rules else 0.80
    default_wait = rules.max_wait_min if rules else 10

    matrix: dict[str, list[int]] = {}
    for off in offices:
        day_fc = get_office_day_forecast(db, off.id, day_of_week, is_fortnight)
        sla = off.sla_objetivo or default_sla
        wait_max = off.tiempo_espera_max_min or default_wait
        reqs: list[int] = []
        for f in day_fc:
            req, _ = calculate_required_agents(
                f.tasa_llegadas_hora,
                f.tiempo_atencion_promedio_min,
                sla,
                wait_max,
                off.capacidad_puestos,
            )
            reqs.append(req)
        matrix[off.id] = reqs
    return matrix


def build_peaks_summary(
    db: Session,
    day_of_week: int = 1,
    is_fortnight: bool = True,
) -> PeaksSummaryOut:
    """Resumen de bloques pico y oficinas con mayor tensión operativa para Plan del Día."""
    offices = db.execute(select(OfficeModel)).scalars().all()
    absences = db.execute(select(AbsenceModel).where(AbsenceModel.estado == "activa")).scalars().all()

    from app.models.entities import StaffModel
    staff = db.execute(select(StaffModel)).scalars().all()
    staff_office = {s.id: s.oficina_base_id for s in staff}
    abs_per_office: dict[str, int] = {}
    for a in absences:
        oid = staff_office.get(a.colaborador_id)
        if oid:
            abs_per_office[oid] = abs_per_office.get(oid, 0) + 1

    rules = db.get(SystemRulesModel, 1)
    sla_goal = rules.target_sla if rules else 0.80
    wait_goal = rules.max_wait_min if rules else 10

    tensions: list[OfficeTensionOut] = []
    morning_rate = 0.0
    valley_rate = 0.0
    afternoon_rate = 0.0

    for off in offices:
        fc = {f.franja: f for f in get_office_day_forecast(db, off.id, day_of_week, is_fortnight)}
        peak_f = max((fc[s] for s in ("08:30", "09:00", "09:30", "10:00") if s in fc), key=lambda x: x.tasa_llegadas_hora)
        morning_rate += peak_f.tasa_llegadas_hora
        valley_rate += fc.get("12:00", peak_f).tasa_llegadas_hora
        afternoon_rate += fc.get("14:00", peak_f).tasa_llegadas_hora

        req, _ = calculate_required_agents(
            peak_f.tasa_llegadas_hora,
            peak_f.tiempo_atencion_promedio_min,
            off.sla_objetivo or sla_goal,
            off.tiempo_espera_max_min or wait_goal,
            off.capacidad_puestos,
        )
        tensions.append(
            OfficeTensionOut(
                oficina_id=off.id,
                nombre=off.nombre,
                tasa_llegadas_pico=round(peak_f.tasa_llegadas_hora, 1),
                agentes_requeridos=req,
                ausentes=abs_per_office.get(off.id, 0),
            )
        )

    tensions.sort(key=lambda t: t.tasa_llegadas_pico, reverse=True)
    top_4 = tensions[:4]

    blocks = [
        PeakBlockOut(
            titulo="Pico Matutino (Máxima Afluencia)",
            rango="08:00 - 10:30",
            descripcion=(
                f"Mayor congestión de la jornada (~{round(morning_rate, 1)} cli/h en toda la red). "
                "Predominan reclamos, PQR y solicitudes."
            ),
            recomendacion="100% de agentes en ventanilla; prohibidos almuerzos en esta ventana",
            tone="blue",
        ),
        PeakBlockOut(
            titulo="Valle de Mediodía y Almuerzos",
            rango="12:00 - 13:30",
            descripcion=(
                f"Descenso de llegadas (~{round(valley_rate, 1)} cli/h en red). "
                "Ventana óptima para escalonar almuerzos sin cerrar oficinas."
            ),
            recomendacion="Almuerzos escalonados de 60 min (≥1 agente activo por sede)",
            tone="orange",
        ),
        PeakBlockOut(
            titulo="Segundo Pico Vespertino",
            rango="14:00 - 15:30",
            descripcion=(
                f"Repunte de la tarde (~{round(afternoon_rate, 1)} cli/h en red) por convenios de pago "
                "y radicaciones empresariales."
            ),
            recomendacion="Malla completa reincorporada tras el último turno de almuerzo",
            tone="indigo",
        ),
    ]
    return PeaksSummaryOut(blocks=blocks, tension_offices=top_4)
