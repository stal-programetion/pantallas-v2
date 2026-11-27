"""Importador ETL idempotente para exportaciones de Digiturno (.xlsx)."""

from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime
import math
from pathlib import Path
import re
import unicodedata

from openpyxl import load_workbook
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.privacy import pseudonymize_operator
from app.models.entities import EtlRunModel, HistoricalSummaryModel, HistoricalTurnModel
from app.schemas.api import EtlRunOut

OPERATING_SLOTS_ALL = [
    "07:00", "07:30", "08:00", "08:30", "09:00", "09:30",
    "10:00", "10:30", "11:00", "11:30", "12:00", "12:30",
    "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00",
]

OFFICE_NAME_TO_SLUG = {
    "cartagena": "cartagena-chambacu",
    "cartagena chambacu": "cartagena-chambacu",
    "sede principal chambacu": "cartagena-chambacu",
    "monteria": "monteria-centro",
    "monteria centro": "monteria-centro",
    "sincelejo": "sincelejo-la-palma",
    "sincelejo la palma": "sincelejo-la-palma",
    "cerete": "cerete",
    "turbaco": "turbaco",
    "magangue": "magangue",
    "corozal": "corozal",
    "sahagun": "sahagun",
    "carmen de bolivar": "el-carmen-de-bolivar",
    "el carmen de bolivar": "el-carmen-de-bolivar",
    "lorica": "lorica",
    "santa cruz de lorica": "lorica",
    "mompox": "mompox",
    "caucasia": "caucasia",
    "tolu": "tolu",
    "santiago de tolu": "tolu",
    "planeta rica": "planeta-rica",
}


def _strip_accents(text: str) -> str:
    return "".join(
        ch for ch in unicodedata.normalize("NFKD", text) if not unicodedata.combining(ch)
    )


def normalize_office_slug(raw_name: str) -> str:
    cleaned = _strip_accents((raw_name or "").lower()).strip()
    cleaned = re.sub(r"\boficina\b|\bsede\b", "", cleaned).strip()
    cleaned = re.sub(r"\s+", " ", cleaned)
    if cleaned in OFFICE_NAME_TO_SLUG:
        return OFFICE_NAME_TO_SLUG[cleaned]
    for key, slug in OFFICE_NAME_TO_SLUG.items():
        if key in cleaned:
            return slug
    return re.sub(r"[^a-z0-9]+", "-", cleaned).strip("-") or "cartagena-chambacu"


def parse_colombian_datetime(value: object) -> datetime | None:
    """Parsea fechas en español colombiano ('4/05/2026 8:09:38 a. m.') o datetime nativo."""
    if value is None:
        return None
    if isinstance(value, datetime):
        return value

    text = str(value).replace("\xa0", " ").strip()
    if not text:
        return None

    lowered = text.lower()
    lowered = re.sub(r"\ba\.\s*m\.?", "AM", lowered)
    lowered = re.sub(r"\bp\.\s*m\.?", "PM", lowered)
    lowered = re.sub(r"\s+", " ", lowered).strip()

    for fmt in (
        "%d/%m/%Y %I:%M:%S %p",
        "%d/%m/%Y %I:%M %p",
        "%d/%m/%Y %H:%M:%S",
        "%d/%m/%Y %H:%M",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%dT%H:%M:%S",
    ):
        try:
            return datetime.strptime(lowered, fmt)
        except ValueError:
            continue
    return None


def assign_slot_30m(dt: datetime) -> str:
    """Asigna la franja de 30 minutos ('07:00'..'16:00')."""
    hour = dt.hour
    minute = 0 if dt.minute < 30 else 30
    slot = f"{hour:02d}:{minute:02d}"
    if slot < "07:00":
        return "07:00"
    if slot > "16:00":
        return "16:00"
    return slot


def _to_float(val: object, default: float = 0.0) -> float:
    if val is None or val == "":
        return default
    try:
        return float(val)
    except (TypeError, ValueError):
        return default


def rebuild_historical_summaries(db: Session, fortnight_multiplier: float = 1.32) -> int:
    """Recalcula la tabla agregada historical_summaries desde historical_turns."""
    turns = db.execute(select(HistoricalTurnModel)).scalars().all()
    if not turns:
        return 0

    # Agrupar por (oficina_id, dia_semana, franja, fecha_dia) para calcular promedio diario e IC 95%
    daily_counts: dict[tuple[str, int, str, str], int] = defaultdict(int)
    waits_bucket: dict[tuple[str, int, str], list[float]] = defaultdict(list)
    service_bucket: dict[tuple[str, int, str], list[float]] = defaultdict(list)
    states_bucket: dict[tuple[str, int, str], Counter[str]] = defaultdict(Counter)
    tramite_bucket: dict[tuple[str, int, str], Counter[str]] = defaultdict(Counter)
    days_seen_per_weekday: dict[int, set[str]] = defaultdict(set)

    for t in turns:
        key = (t.oficina_id, t.dia_semana, t.franja)
        daily_counts[(t.oficina_id, t.dia_semana, t.franja, t.fecha_dia)] += 1
        days_seen_per_weekday[t.dia_semana].add(t.fecha_dia)
        waits_bucket[key].append(max(0.0, float(t.tiempo_espera_seg or 0.0)))
        if t.estado == "FIN" and t.tiempo_atencion_seg is not None and 0 < t.tiempo_atencion_seg <= 7200:
            service_bucket[key].append(float(t.tiempo_atencion_seg))
        states_bucket[key][t.estado] += 1
        tramite_bucket[key][t.tipo_tramite or "Información"] += 1

    db.execute(delete(HistoricalSummaryModel))
    created = 0

    office_ids = sorted({t.oficina_id for t in turns})
    for off_id in office_ids:
        for dow in range(1, 6):  # Lunes=1 .. Viernes=5
            observed_days = sorted(days_seen_per_weekday.get(dow, set()))
            n_days = max(1, len(observed_days))
            for slot in OPERATING_SLOTS_ALL:
                key = (off_id, dow, slot)
                counts_per_day = [
                    daily_counts.get((off_id, dow, slot, d), 0) for d in observed_days
                ] or [0]
                mean_arrivals = sum(counts_per_day) / n_days
                if len(counts_per_day) > 1:
                    variance = sum((c - mean_arrivals) ** 2 for c in counts_per_day) / (len(counts_per_day) - 1)
                    se = math.sqrt(variance / len(counts_per_day))
                else:
                    se = math.sqrt(max(mean_arrivals, 0.25))
                margin = 1.96 * se

                wait_vals = waits_bucket.get(key, [])
                svc_vals = service_bucket.get(key, [])
                avg_wait = sum(wait_vals) / len(wait_vals) if wait_vals else 600.0
                avg_svc = sum(svc_vals) / len(svc_vals) if svc_vals else 480.0

                st_counter = states_bucket.get(key, Counter())
                total_st = sum(st_counter.values())
                aba_rate = (st_counter.get("ABA", 0) / total_st) if total_st > 0 else 0.05

                tr_counter = tramite_bucket.get(key, Counter())
                top_tramite = tr_counter.most_common(1)[0][0] if tr_counter else "Facturación y Pagos"

                for is_fortnight in (False, True):
                    mult = fortnight_multiplier if is_fortnight else 1.0
                    adj_mean = round(mean_arrivals * mult, 2)
                    adj_ic_low = round(max(0.0, (mean_arrivals - margin) * mult), 2)
                    adj_ic_high = round(max(adj_mean, (mean_arrivals + margin) * mult), 2)
                    lambda_h = round(adj_mean * 2.0, 2)

                    db.add(
                        HistoricalSummaryModel(
                            oficina_id=off_id,
                            dia_semana=dow,
                            franja=slot,
                            es_quincena=is_fortnight,
                            llegadas_promedio=adj_mean,
                            ic_inferior=adj_ic_low,
                            ic_superior=adj_ic_high,
                            tasa_llegadas_hora=lambda_h,
                            tiempo_espera_promedio_seg=round(avg_wait * (1.12 if is_fortnight else 1.0), 1),
                            tiempo_atencion_promedio_seg=round(avg_svc, 1),
                            tasa_abandono=round(min(0.35, aba_rate), 4),
                            tramite_principal=top_tramite,
                            muestras=total_st,
                        )
                    )
                    created += 1

    db.commit()
    return created


def import_digiturno_excel(
    db: Session,
    file_path: str | Path,
    sheet_name: str = "Mayo 2026",
    is_synthetic: bool = False,
    source_type: str = "excel",
) -> EtlRunOut:
    """Importa el Excel de Digiturno de forma idempotente con reporte de calidad."""
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"No se encontró el archivo Excel: {path}")

    wb = load_workbook(filename=path, read_only=True, data_only=True)
    if sheet_name in wb.sheetnames:
        ws = wb[sheet_name]
    else:
        ws = wb.active

    rows_iter = ws.iter_rows(values_only=True)
    try:
        header_row = next(rows_iter)
    except StopIteration as exc:
        raise ValueError("La hoja Excel está vacía") from exc

    col_index: dict[str, int] = {}
    for idx, name in enumerate(header_row):
        if name is not None:
            key = str(name).strip()
            if key not in col_index:
                col_index[key] = idx
    required_cols = ["IdTurno", "NombreOficina", "Estado", "TiempoInicioEspera"]
    missing = [c for c in required_cols if c not in col_index]
    if missing:
        raise ValueError(f"Faltan columnas requeridas en el Excel: {', '.join(missing)}")

    existing_ids = set(db.execute(select(HistoricalTurnModel.id_turno)).scalars().all())

    total_rows = 0
    inserted_rows = 0
    skipped_duplicates = 0
    invalid_rows = 0
    cleaned_service_outliers = 0
    recovered_dates = 0
    post_closing_turns = 0
    date_min: str | None = None
    date_max: str | None = None
    offices_seen: set[str] = set()
    operators_seen: set[str] = set()
    warnings: list[str] = []
    batch: list[HistoricalTurnModel] = []

    if "Fecha" in col_index:
        warnings.append("Columna 'Fecha' duplicada ignorada; se usó 'TiempoInicioEspera'.")
    if "Calificacion" in col_index:
        warnings.append("Columna 'Calificacion' ignorada (sin varianza útil en histórico).")

    def get_val(row: tuple, col: str, default: object = "") -> object:
        idx = col_index.get(col)
        if idx is None or idx >= len(row):
            return default
        val = row[idx]
        return default if val is None else val

    for row in rows_iter:
        total_rows += 1
        raw_id = str(get_val(row, "IdTurno", "")).strip()
        if not raw_id:
            invalid_rows += 1
            continue

        raw_of_id = str(get_val(row, "IdOficina", "")).strip()
        raw_srv = str(get_val(row, "IdServicio", "")).strip()
        composite_id = f"{raw_of_id}:{raw_id}:{raw_srv}" if (raw_of_id or raw_srv) else raw_id
        if composite_id in existing_ids:
            skipped_duplicates += 1
            continue

        dt_wait = parse_colombian_datetime(get_val(row, "TiempoInicioEspera", None))
        if dt_wait is None:
            dt_wait = parse_colombian_datetime(get_val(row, "TiempoInicioAtencion", None))
            if dt_wait is not None:
                recovered_dates += 1
        if dt_wait is None:
            invalid_rows += 1
            continue

        raw_office = str(get_val(row, "NombreOficina", "")).strip()
        oficina_id = normalize_office_slug(raw_office)
        offices_seen.add(oficina_id)

        estado = str(get_val(row, "Estado", "FIN")).strip().upper()
        if estado not in ("FIN", "ABA", "CAN"):
            estado = "FIN"

        wait_sec = max(0.0, _to_float(get_val(row, "TiempoEspera", 0.0)))
        raw_svc = _to_float(get_val(row, "TiempoAtencion", 0.0))
        cleaned_svc: float | None
        if estado == "FIN":
            if raw_svc < 15 or raw_svc > 3600:
                cleaned_service_outliers += 1
                cleaned_svc = None
            else:
                cleaned_svc = raw_svc
        else:
            cleaned_svc = None

        raw_op = str(get_val(row, "NombreOperador", "")).strip()
        op_pseudo = pseudonymize_operator(raw_op, total_rows)
        operators_seen.add(op_pseudo)

        fecha_dia = dt_wait.strftime("%Y-%m-%d")
        if date_min is None or fecha_dia < date_min:
            date_min = fecha_dia
        if date_max is None or fecha_dia > date_max:
            date_max = fecha_dia

        # ISO weekday: Lunes=1 .. Domingo=7 (convertir Domingo a 0 como frontend)
        iso_wd = dt_wait.isoweekday()
        dia_semana = 0 if iso_wd == 7 else iso_wd
        if f"{dt_wait.hour:02d}:{(0 if dt_wait.minute < 30 else 30):02d}" > "16:00":
            post_closing_turns += 1
        franja = assign_slot_30m(dt_wait)

        existing_ids.add(composite_id)
        batch.append(
            HistoricalTurnModel(
                id_turno=composite_id,
                id_oficina_raw=raw_of_id,
                oficina_id=oficina_id,
                nombre_oficina=raw_office,
                nombre_sala=str(get_val(row, "NombreSala", "General")),
                numero=str(get_val(row, "Numero", "")),
                id_servicio=raw_srv,
                tipo=str(get_val(row, "Tipo", "TUR")),
                origen_turno=str(get_val(row, "OrigenTurno", "Atril")),
                estado=estado,
                tiempo_inicio_espera=dt_wait,
                fecha_dia=fecha_dia,
                dia_semana=dia_semana,
                franja=franja,
                tiempo_espera_seg=wait_sec,
                tiempo_atencion_seg=cleaned_svc,
                id_usuario=str(get_val(row, "IdUsuario", "")),
                operador_pseudonimo=op_pseudo,
                nombre_terminal=str(get_val(row, "NombreTerminal", "T-01")),
                nombre_cola=str(get_val(row, "NombreCola", "General")),
                tipo_cliente=str(get_val(row, "NombreElementoNodoNivel2", "General")),
                tipo_tramite=str(get_val(row, "NombreElementoNodoNivel4", "Información")),
                departamento=str(get_val(row, "NombreNivelGeografico2", "")),
                ciudad=str(get_val(row, "NombreNivelGeografico3", "")),
                is_synthetic=is_synthetic,
            )
        )
        inserted_rows += 1

        if len(batch) >= 2000:
            db.bulk_save_objects(batch)
            db.commit()
            batch.clear()

    if batch:
        db.bulk_save_objects(batch)
        db.commit()

    wb.close()

    if recovered_dates > 0:
        warnings.append(
            f"{recovered_dates} turnos sin TiempoInicioEspera recuperados con TiempoInicioAtencion."
        )
    if post_closing_turns > 0:
        warnings.append(
            f"{post_closing_turns} turnos posteriores a 16:30 consolidados en la franja de cierre 16:00."
        )
    if cleaned_service_outliers > 0:
        warnings.append(
            f"{cleaned_service_outliers} tiempos de atención atípicos (<15s o >3600s) excluidos del cálculo de μ."
        )

    if inserted_rows > 0:
        rebuild_historical_summaries(db)

    run = EtlRunModel(
        filename=path.name,
        source_type=source_type,
        total_rows=total_rows,
        inserted_rows=inserted_rows,
        skipped_duplicates=skipped_duplicates,
        invalid_rows=invalid_rows,
        cleaned_service_outliers=cleaned_service_outliers,
        date_min=date_min,
        date_max=date_max,
        offices_count=len(offices_seen),
        operators_count=len(operators_seen),
        warnings=warnings,
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    return EtlRunOut(
        id=run.id,
        filename=run.filename,
        source_type=run.source_type,
        total_rows=run.total_rows,
        inserted_rows=run.inserted_rows,
        skipped_duplicates=run.skipped_duplicates,
        invalid_rows=run.invalid_rows,
        cleaned_service_outliers=run.cleaned_service_outliers,
        date_min=run.date_min,
        date_max=run.date_max,
        offices_count=run.offices_count,
        operators_count=run.operators_count,
        warnings=list(run.warnings or []),
        created_at=run.created_at.isoformat() if run.created_at else "",
    )
