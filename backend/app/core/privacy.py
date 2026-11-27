"""Protección de datos personales y diagnósticos médicos (Ley 1581 de 2012)."""

import hashlib
import logging
from app.models.entities import AbsenceModel
from app.schemas.api import AbsenceImpactOut, AbsenceOut, UserRole

logger = logging.getLogger("surtigas.privacy")


def pseudonymize_operator(raw_name: str, index_fallback: int = 0) -> str:
    """Genera un seudónimo determinístico sin almacenar nombres reales del Excel."""
    cleaned = (raw_name or "").strip().lower()
    if not cleaned:
        return f"OP-{index_fallback:03d}"
    digest = hashlib.sha256(cleaned.encode("utf-8")).hexdigest()[:6].upper()
    return f"OP-{digest}"


def sanitize_absence_for_role(model: AbsenceModel, role: UserRole) -> AbsenceOut:
    """Oculta el diagnóstico CIE-10 cuando el usuario tiene rol CONSULTA."""
    can_view_health = role in ("ADMIN", "COORDINADOR")
    return AbsenceOut(
        id=model.id,
        colaborador_id=model.colaborador_id,
        tipo=model.tipo,  # type: ignore[arg-type]
        fecha_inicio=model.fecha_inicio,
        fecha_fin=model.fecha_fin,
        diagnostico_salud=model.diagnostico_salud if can_view_health else None,
        aprobado_por=model.aprobado_por,
        motivo_detalle=model.motivo_detalle if can_view_health else "Información restringida (Ley 1581)",
        estado=model.estado,  # type: ignore[arg-type]
        impacto_estimado=AbsenceImpactOut(
            deficit_horas=model.deficit_horas,
            oficinas_afectadas=list(model.oficinas_afectadas or []),
        ),
    )


def mask_document_for_role(document: str, role: UserRole) -> str:
    """Enmascara el documento de identidad cuando el rol es CONSULTA."""
    if role in ("ADMIN", "COORDINADOR"):
        return document
    if len(document) <= 4:
        return "****"
    return f"***{document[-4:]}"


def safe_audit_log(actor_id: str, actor_rol: str, action: str, entity_id: str) -> None:
    """Registra trazabilidad técnica sin datos personales (sin nombres, cédulas ni CIE-10)."""
    logger.info(
        "audit actor_id=%s rol=%s action=%s entity_id=%s",
        actor_id,
        actor_rol,
        action,
        entity_id,
    )
