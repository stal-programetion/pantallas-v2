"""Importación y exportación Excel/CSV para mallas, ausencias y reportes."""

from __future__ import annotations

import copy
import csv
import io
from typing import Iterable

from openpyxl import Workbook, load_workbook
from openpyxl.styles import Font, PatternFill

from app.core.privacy import sanitize_absence_for_role
from app.models.entities import AbsenceModel, DayPlanModel, OfficeModel, StaffModel
from app.schemas.api import OfficeRealtimeMetricsOut, UserRole


def export_day_plan_xlsx(
    plan: DayPlanModel,
    staff_list: list[StaffModel],
    offices: list[OfficeModel],
    slots_order: list[str],
) -> bytes:
    """Genera archivo Excel con la malla de turnos, justificaciones y auditoría."""
    wb = Workbook()
    ws = wb.active
    ws.title = "Malla_Turnos"

    office_map = {o.id: o.nombre for o in offices}
    header_fill = PatternFill(start_color="1F2B6B", end_color="1F2B6B", fill_type="solid")
    header_font = Font(color="FFFFFF", bold=True)

    headers = ["Colaborador", "Sede Base", "Modalidad", *slots_order, "Horas Totales"]
    ws.append(headers)
    for cell in ws[1]:
        cell.fill = header_fill
        cell.font = header_font

    turnos = plan.turnos or {}
    for st in staff_list:
        shift = turnos.get(st.id, {})
        slots_dict = shift.get("slots", {})
        row = [
            st.nombre,
            office_map.get(st.oficina_base_id, st.oficina_base_id),
            st.modalidad,
        ]
        for s in slots_order:
            slot_obj = slots_dict.get(s, {})
            estado = slot_obj.get("estado", "atencion")
            asignada = slot_obj.get("oficinaAsignadaId", st.oficina_base_id)
            if asignada != st.oficina_base_id and estado in ("apoyo_virtual", "apoyo_presencial"):
                row.append(f"{estado} ({office_map.get(asignada, asignada)})")
            else:
                row.append(estado)
        row.append(shift.get("horasTotales", 0))
        ws.append(row)

    ws_just = wb.create_sheet("Justificaciones")
    ws_just.append(["Franja", "Oficina", "Regla", "Tipo", "Explicación"])
    for cell in ws_just[1]:
        cell.fill = header_fill
        cell.font = header_font
    for j in plan.justificaciones or []:
        ws_just.append([
            j.get("franja", ""),
            office_map.get(j.get("oficinaId", ""), j.get("oficinaId", "")),
            j.get("regla", ""),
            j.get("tipo", ""),
            j.get("razon", ""),
        ])

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def parse_day_plan_excel(
    content: bytes,
    staff_list: list[StaffModel],
    offices: list[OfficeModel],
    slots_order: list[str],
    existing_turnos: dict,
) -> tuple[dict, int]:
    """Importa malla de turnos desde un Excel con el mismo formato de exportación."""
    wb = load_workbook(filename=io.BytesIO(content), read_only=True, data_only=True)
    ws = wb["Malla_Turnos"] if "Malla_Turnos" in wb.sheetnames else wb.active
    rows = ws.iter_rows(values_only=True)
    header = next(rows, None)
    if not header:
        wb.close()
        return existing_turnos, 0

    col_idx = {str(h).strip(): i for i, h in enumerate(header) if h is not None}
    staff_by_name = {s.nombre.strip().lower(): s for s in staff_list}
    office_by_name = {o.nombre.strip().lower(): o.id for o in offices}
    valid_states = {"atencion", "almuerzo", "pausa", "libre", "apoyo_virtual", "apoyo_presencial", "ausente"}

    updated = copy.deepcopy(existing_turnos)
    imported_rows = 0

    for row in rows:
        name_i = col_idx.get("Colaborador")
        if name_i is None or name_i >= len(row) or not row[name_i]:
            continue
        colab_name = str(row[name_i]).strip().lower()
        st = staff_by_name.get(colab_name)
        if not st or st.id not in updated:
            continue

        imported_rows += 1
        slots_dict = updated[st.id].setdefault("slots", {})
        for slot in slots_order:
            si = col_idx.get(slot)
            if si is None or si >= len(row) or not row[si]:
                continue
            raw_cell = str(row[si]).strip()
            estado = raw_cell
            oficina_id = st.oficina_base_id
            if "(" in raw_cell and raw_cell.endswith(")"):
                part_state, part_off = raw_cell.split("(", 1)
                estado = part_state.strip()
                off_label = part_off[:-1].strip().lower()
                oficina_id = office_by_name.get(off_label, st.oficina_base_id)

            if estado not in valid_states:
                continue
            prev_slot = slots_dict.get(slot, {})
            changed = prev_slot.get("estado") != estado or prev_slot.get("oficinaAsignadaId") != oficina_id
            slots_dict[slot] = {
                "franja": slot,
                "estado": estado,
                "oficinaAsignadaId": oficina_id,
                "esModificadoManual": bool(prev_slot.get("esModificadoManual") or changed),
                "nota": "Importado desde Excel" if changed else prev_slot.get("nota"),
            }

    wb.close()
    return updated, imported_rows


def export_absences_xlsx(
    absences: list[AbsenceModel],
    staff_list: list[StaffModel],
    offices: list[OfficeModel],
    role: UserRole,
) -> bytes:
    """Exporta ausencias a Excel respetando Ley 1581 según rol."""
    wb = Workbook()
    ws = wb.active
    ws.title = "Ausencias"

    staff_map = {s.id: s for s in staff_list}
    office_map = {o.id: o.nombre for o in offices}

    ws.append([
        "ID", "Colaborador", "Sede Base", "Tipo", "Fecha Inicio",
        "Fecha Fin", "Estado", "Diagnóstico / Detalle", "Aprobado Por", "Déficit (h)",
    ])
    for a in absences:
        safe = sanitize_absence_for_role(a, role)
        st = staff_map.get(a.colaborador_id)
        off_name = office_map.get(st.oficina_base_id, "") if st else ""
        ws.append([
            safe.id,
            st.nombre if st else safe.colaborador_id,
            off_name,
            safe.tipo,
            safe.fecha_inicio,
            safe.fecha_fin,
            safe.estado,
            safe.diagnostico_salud or safe.motivo_detalle,
            safe.aprobado_por,
            safe.impacto_estimado.deficit_horas if safe.impacto_estimado else 7.5,
        ])

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def parse_absences_excel(content: bytes) -> list[dict]:
    """Lee un archivo .xlsx de ausencias con columnas mínimas estándar."""
    wb = load_workbook(filename=io.BytesIO(content), read_only=True, data_only=True)
    ws = wb.active
    rows = ws.iter_rows(values_only=True)
    header = next(rows, None)
    if not header:
        wb.close()
        return []
    idx = {str(h).strip().lower(): i for i, h in enumerate(header) if h is not None}

    parsed: list[dict] = []
    for r in rows:
        def col(name: str, default: str = "") -> str:
            i = idx.get(name)
            if i is None or i >= len(r) or r[i] is None:
                return default
            return str(r[i]).strip()

        colab_id = col("colaboradorid") or col("colaborador_id") or col("id_colaborador")
        if not colab_id:
            continue
        parsed.append({
            "colaborador_id": colab_id,
            "tipo": col("tipo", "permiso_personal"),
            "fecha_inicio": col("fechainicio") or col("fecha_inicio") or "2026-10-15",
            "fecha_fin": col("fechafin") or col("fecha_fin") or "2026-10-15",
            "diagnostico_salud": col("diagnosticosalud") or col("diagnostico_salud") or None,
            "aprobado_por": col("aprobadopor") or col("aprobado_por") or "Gestión Humana Surtigas",
            "motivo_detalle": col("motivodetalle") or col("motivo_detalle") or "Importado desde Excel",
            "estado": col("estado", "activa"),
        })
    wb.close()
    return parsed


def export_reports_csv(
    offices: list[OfficeModel],
    metrics: Iterable[OfficeRealtimeMetricsOut],
) -> bytes:
    """Genera CSV UTF-8 con BOM para Excel en Colombia."""
    metric_map = {m.oficina_id: m for m in metrics}
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        "ID Oficina",
        "Nombre Oficina",
        "Ciudad",
        "Departamento",
        "Capacidad Puestos",
        "SLA Proyectado (%)",
        "Tiempo Espera Promedio (min)",
        "Clientes en Fila",
        "Utilizacion Estimada (%)",
        "Tiempo Ahorrado Diario (min)",
    ])
    for o in offices:
        m = metric_map.get(o.id)
        sla = round(m.sla_actual * 100) if m else 80
        wait = f"{m.espera_promedio_min:.1f}" if m else "6.5"
        queue = m.clientes_en_fila if m else 3
        util = m.capacidad_utilizada if m else 75
        writer.writerow([
            o.id, o.nombre, o.ciudad, o.departamento,
            o.capacidad_puestos, sla, wait, queue, util, 6,
        ])
    return ("\ufeff" + buf.getvalue()).encode("utf-8")


def export_reports_xlsx(
    offices: list[OfficeModel],
    metrics: Iterable[OfficeRealtimeMetricsOut],
) -> bytes:
    """Genera reporte ejecutivo en formato Excel (.xlsx)."""
    wb = Workbook()
    ws = wb.active
    ws.title = "Reporte_Surtigas"
    metric_map = {m.oficina_id: m for m in metrics}

    ws.append([
        "ID Oficina", "Oficina", "Ciudad", "Departamento",
        "Capacidad", "En Fila", "Espera Media (min)", "SLA (%)", "Estado SLA",
    ])
    for o in offices:
        m = metric_map.get(o.id)
        ws.append([
            o.id, o.nombre, o.ciudad, o.departamento, o.capacidad_puestos,
            m.clientes_en_fila if m else 0,
            round(m.espera_promedio_min, 1) if m else 0.0,
            round(m.sla_actual * 100) if m else 80,
            m.estado_sla if m else "optimo",
        ])

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()
