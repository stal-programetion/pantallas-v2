"""Esquema inicial completo Surtigas OptiTurnos.

Revision ID: 0001_initial
Revises:
Create Date: 2026-11-26 17:50:00
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "offices",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("nombre", sa.String(160), nullable=False),
        sa.Column("ciudad", sa.String(100), nullable=False),
        sa.Column("departamento", sa.String(80), nullable=False),
        sa.Column("lat", sa.Float(), nullable=False),
        sa.Column("lng", sa.Float(), nullable=False),
        sa.Column("capacidad_puestos", sa.Integer(), nullable=False),
        sa.Column("estado", sa.String(32), nullable=False),
        sa.Column("horario_inicio", sa.String(10), nullable=False),
        sa.Column("horario_fin", sa.String(10), nullable=False),
        sa.Column("sla_objetivo", sa.Float(), nullable=False),
        sa.Column("tiempo_espera_max_min", sa.Integer(), nullable=False),
        sa.Column("telefono", sa.String(64), nullable=False),
        sa.Column("direccion", sa.String(200), nullable=False),
        sa.Column("is_synthetic", sa.Boolean(), nullable=False, server_default=sa.true()),
    )

    op.create_table(
        "staff",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("nombre", sa.String(160), nullable=False),
        sa.Column("documento", sa.String(40), nullable=False),
        sa.Column("oficina_base_id", sa.String(64), nullable=False),
        sa.Column("cargo", sa.String(120), nullable=False),
        sa.Column("jornada", sa.String(32), nullable=False),
        sa.Column("horario_entrada", sa.String(10), nullable=False),
        sa.Column("horario_salida", sa.String(10), nullable=False),
        sa.Column("almuerzo_inicio", sa.String(10), nullable=False),
        sa.Column("almuerzo_fin", sa.String(10), nullable=False),
        sa.Column("almuerzo_duracion_min", sa.Integer(), nullable=False),
        sa.Column("modalidad", sa.String(32), nullable=False),
        sa.Column("competencias", sa.JSON(), nullable=False),
        sa.Column("estado_hoy", sa.String(32), nullable=False),
        sa.Column("oficina_actual_id", sa.String(64), nullable=False),
        sa.Column("is_synthetic", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.create_index("ix_staff_oficina_base_id", "staff", ["oficina_base_id"])

    op.create_table(
        "absences",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("colaborador_id", sa.String(64), nullable=False),
        sa.Column("tipo", sa.String(48), nullable=False),
        sa.Column("fecha_inicio", sa.String(16), nullable=False),
        sa.Column("fecha_fin", sa.String(16), nullable=False),
        sa.Column("diagnostico_salud", sa.Text(), nullable=True),
        sa.Column("aprobado_por", sa.String(160), nullable=False),
        sa.Column("motivo_detalle", sa.Text(), nullable=False),
        sa.Column("estado", sa.String(32), nullable=False),
        sa.Column("deficit_horas", sa.Float(), nullable=False),
        sa.Column("oficinas_afectadas", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_absences_colaborador_id", "absences", ["colaborador_id"])

    op.create_table(
        "day_plans",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("fecha", sa.String(16), nullable=False, unique=True),
        sa.Column("estado", sa.String(32), nullable=False),
        sa.Column("aprobado_por", sa.String(160), nullable=True),
        sa.Column("aprobado_en", sa.String(64), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("total_cambios_manuales", sa.Integer(), nullable=False),
        sa.Column("tiempo_ahorrado_minutos", sa.Integer(), nullable=False),
        sa.Column("sla_proyectado_red", sa.Float(), nullable=False),
        sa.Column("turnos", sa.JSON(), nullable=False),
        sa.Column("original_turnos", sa.JSON(), nullable=False),
        sa.Column("justificaciones", sa.JSON(), nullable=False),
        sa.Column("is_fortnight", sa.Boolean(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_day_plans_fecha", "day_plans", ["fecha"])

    op.create_table(
        "redistributions",
        sa.Column("id", sa.String(96), primary_key=True),
        sa.Column("plan_fecha", sa.String(16), nullable=False),
        sa.Column("colaborador_id", sa.String(64), nullable=False),
        sa.Column("colaborador_nombre", sa.String(160), nullable=False),
        sa.Column("oficina_origen_id", sa.String(64), nullable=False),
        sa.Column("oficina_origen_nombre", sa.String(160), nullable=False),
        sa.Column("oficina_destino_id", sa.String(64), nullable=False),
        sa.Column("oficina_destino_nombre", sa.String(160), nullable=False),
        sa.Column("modalidad", sa.String(32), nullable=False),
        sa.Column("distancia_km", sa.Float(), nullable=False),
        sa.Column("es_intermunicipal", sa.Boolean(), nullable=False),
        sa.Column("franja_inicio", sa.String(10), nullable=False),
        sa.Column("franja_fin", sa.String(10), nullable=False),
        sa.Column("motivo", sa.Text(), nullable=False),
        sa.Column("reduccion_espera_min", sa.Float(), nullable=False),
        sa.Column("sla_proyectado_destino", sa.Float(), nullable=False),
        sa.Column("sla_origen_resultante", sa.Float(), nullable=False),
        sa.Column("abandono_antes_pct", sa.Float(), nullable=False),
        sa.Column("abandono_despues_pct", sa.Float(), nullable=False),
        sa.Column("estado", sa.String(32), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_redistributions_plan_fecha", "redistributions", ["plan_fecha"])

    op.create_table(
        "alerts",
        sa.Column("id", sa.String(120), primary_key=True),
        sa.Column("plan_fecha", sa.String(16), nullable=False),
        sa.Column("tipo", sa.String(48), nullable=False),
        sa.Column("severidad", sa.String(32), nullable=False),
        sa.Column("oficina_id", sa.String(64), nullable=False),
        sa.Column("oficina_nombre", sa.String(160), nullable=False),
        sa.Column("titulo", sa.String(200), nullable=False),
        sa.Column("mensaje", sa.Text(), nullable=False),
        sa.Column("franja", sa.String(10), nullable=True),
        sa.Column("accion_sugerida", sa.Text(), nullable=False),
        sa.Column("accion_tipo", sa.String(48), nullable=True),
        sa.Column("timestamp", sa.String(64), nullable=False),
        sa.Column("leida", sa.Boolean(), nullable=False),
    )
    op.create_index("ix_alerts_plan_fecha", "alerts", ["plan_fecha"])

    op.create_table(
        "historical_turns",
        sa.Column("id_turno", sa.String(80), primary_key=True),
        sa.Column("id_oficina_raw", sa.String(64), nullable=False),
        sa.Column("oficina_id", sa.String(64), nullable=False),
        sa.Column("nombre_oficina", sa.String(160), nullable=False),
        sa.Column("nombre_sala", sa.String(120), nullable=False),
        sa.Column("numero", sa.String(40), nullable=False),
        sa.Column("id_servicio", sa.String(40), nullable=False),
        sa.Column("tipo", sa.String(16), nullable=False),
        sa.Column("origen_turno", sa.String(32), nullable=False),
        sa.Column("estado", sa.String(16), nullable=False),
        sa.Column("tiempo_inicio_espera", sa.DateTime(timezone=False), nullable=False),
        sa.Column("fecha_dia", sa.String(16), nullable=False),
        sa.Column("dia_semana", sa.Integer(), nullable=False),
        sa.Column("franja", sa.String(10), nullable=False),
        sa.Column("tiempo_espera_seg", sa.Float(), nullable=False),
        sa.Column("tiempo_atencion_seg", sa.Float(), nullable=True),
        sa.Column("id_usuario", sa.String(64), nullable=False),
        sa.Column("operador_pseudonimo", sa.String(64), nullable=False),
        sa.Column("nombre_terminal", sa.String(64), nullable=False),
        sa.Column("nombre_cola", sa.String(120), nullable=False),
        sa.Column("tipo_cliente", sa.String(80), nullable=False),
        sa.Column("tipo_tramite", sa.String(120), nullable=False),
        sa.Column("departamento", sa.String(80), nullable=False),
        sa.Column("ciudad", sa.String(100), nullable=False),
        sa.Column("is_synthetic", sa.Boolean(), nullable=False),
    )
    op.create_index("ix_historical_turns_oficina_id", "historical_turns", ["oficina_id"])
    op.create_index("ix_historical_turns_estado", "historical_turns", ["estado"])
    op.create_index("ix_historical_turns_fecha_dia", "historical_turns", ["fecha_dia"])
    op.create_index("ix_historical_turns_dia_semana", "historical_turns", ["dia_semana"])
    op.create_index("ix_historical_turns_franja", "historical_turns", ["franja"])

    op.create_table(
        "historical_summaries",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("oficina_id", sa.String(64), nullable=False),
        sa.Column("dia_semana", sa.Integer(), nullable=False),
        sa.Column("franja", sa.String(10), nullable=False),
        sa.Column("es_quincena", sa.Boolean(), nullable=False),
        sa.Column("llegadas_promedio", sa.Float(), nullable=False),
        sa.Column("ic_inferior", sa.Float(), nullable=False),
        sa.Column("ic_superior", sa.Float(), nullable=False),
        sa.Column("tasa_llegadas_hora", sa.Float(), nullable=False),
        sa.Column("tiempo_espera_promedio_seg", sa.Float(), nullable=False),
        sa.Column("tiempo_atencion_promedio_seg", sa.Float(), nullable=False),
        sa.Column("tasa_abandono", sa.Float(), nullable=False),
        sa.Column("tramite_principal", sa.String(120), nullable=False),
        sa.Column("muestras", sa.Integer(), nullable=False),
        sa.UniqueConstraint("oficina_id", "dia_semana", "franja", "es_quincena", name="uq_hist_summary_slot"),
    )
    op.create_index("ix_historical_summaries_oficina_id", "historical_summaries", ["oficina_id"])

    op.create_table(
        "system_rules",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("target_sla", sa.Float(), nullable=False),
        sa.Column("max_wait_min", sa.Integer(), nullable=False),
        sa.Column("max_presencial_km", sa.Float(), nullable=False),
        sa.Column("lunch_duration_min", sa.Integer(), nullable=False),
        sa.Column("fortnight_multiplier", sa.Float(), nullable=False),
        sa.Column("min_agents_open_office", sa.Integer(), nullable=False),
        sa.Column("source_mode", sa.String(16), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("actor_id", sa.String(64), nullable=False),
        sa.Column("actor_nombre", sa.String(160), nullable=False),
        sa.Column("actor_rol", sa.String(32), nullable=False),
        sa.Column("action", sa.String(64), nullable=False),
        sa.Column("entity_type", sa.String(64), nullable=False),
        sa.Column("entity_id", sa.String(96), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("payload_before", sa.JSON(), nullable=True),
        sa.Column("payload_after", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_audit_logs_action", "audit_logs", ["action"])

    op.create_table(
        "etl_runs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("source_type", sa.String(32), nullable=False),
        sa.Column("total_rows", sa.Integer(), nullable=False),
        sa.Column("inserted_rows", sa.Integer(), nullable=False),
        sa.Column("skipped_duplicates", sa.Integer(), nullable=False),
        sa.Column("invalid_rows", sa.Integer(), nullable=False),
        sa.Column("cleaned_service_outliers", sa.Integer(), nullable=False),
        sa.Column("date_min", sa.String(32), nullable=True),
        sa.Column("date_max", sa.String(32), nullable=True),
        sa.Column("offices_count", sa.Integer(), nullable=False),
        sa.Column("operators_count", sa.Integer(), nullable=False),
        sa.Column("warnings", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    for table in [
        "etl_runs",
        "audit_logs",
        "system_rules",
        "historical_summaries",
        "historical_turns",
        "alerts",
        "redistributions",
        "day_plans",
        "absences",
        "staff",
        "offices",
    ]:
        op.drop_table(table)
