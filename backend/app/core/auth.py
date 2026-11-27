"""Autenticación JWT y control de acceso basado en roles (RBAC)."""

from datetime import datetime, timedelta, timezone
from typing import Annotated

import jwt
from fastapi import Depends, Header, HTTPException, Query, status

from app.config import get_settings
from app.schemas.api import UserOut, UserRole

DEMO_USERS: dict[UserRole, UserOut] = {
    "ADMIN": UserOut(
        id="usr-admin",
        nombre="Ing. Mauricio Beltrán",
        email="mbeltran@surtigas.com.co",
        rol="ADMIN",
        cargo="Gerente de Experiencia al Cliente y Canales",
    ),
    "COORDINADOR": UserOut(
        id="usr-coord",
        nombre="Liliana María Ramos",
        email="lramos@surtigas.com.co",
        rol="COORDINADOR",
        cargo="Coordinadora de Turnos y Gestión Operativa",
    ),
    "CONSULTA": UserOut(
        id="usr-view",
        nombre="Carlos Mario Mendoza",
        email="cmendoza@surtigas.com.co",
        rol="CONSULTA",
        cargo="Asesor Integral Surtigas Chambacú",
    ),
}

# Contraseñas de demostración únicamente usadas si AUTH_REQUIRED=true y AUTH_DEMO_ROLE_SWITCH=false
DEMO_CREDENTIALS = {
    "mbeltran@surtigas.com.co": ("SurtigasAdmin2026!", "ADMIN"),
    "lramos@surtigas.com.co": ("SurtigasCoord2026!", "COORDINADOR"),
    "cmendoza@surtigas.com.co": ("SurtigasConsulta2026!", "CONSULTA"),
}


def create_access_token(user: UserOut) -> str:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user.id,
        "rol": user.rol,
        "nombre": user.nombre,
        "email": user.email,
        "cargo": user.cargo,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=settings.jwt_expire_minutes)).timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> UserOut:
    settings = get_settings()
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )
        rol = payload.get("rol", "COORDINADOR")
        if rol not in DEMO_USERS:
            rol = "CONSULTA"
        return UserOut(
            id=payload.get("sub", DEMO_USERS[rol].id),
            nombre=payload.get("nombre", DEMO_USERS[rol].nombre),
            email=payload.get("email", DEMO_USERS[rol].email),
            rol=rol,
            cargo=payload.get("cargo", DEMO_USERS[rol].cargo),
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de sesión inválido o expirado",
        ) from exc


def get_current_user(
    authorization: Annotated[str | None, Header()] = None,
    x_demo_role: Annotated[str | None, Header(alias="X-Demo-Role")] = None,
    token_query: Annotated[str | None, Query(alias="token")] = None,
) -> UserOut:
    """Obtiene el usuario actual desde Bearer JWT o cabecera de rol demo si AUTH_REQUIRED=false."""
    settings = get_settings()

    raw_token: str | None = None
    if authorization and authorization.lower().startswith("bearer "):
        raw_token = authorization.split(" ", 1)[1].strip()
    elif token_query:
        raw_token = token_query.strip()

    if raw_token:
        return decode_access_token(raw_token)

    if not settings.auth_required:
        if settings.auth_demo_role_switch and x_demo_role and x_demo_role.upper() in DEMO_USERS:
            return DEMO_USERS[x_demo_role.upper()]  # type: ignore[index]
        return DEMO_USERS["COORDINADOR"]

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Autenticación requerida para acceder a este recurso",
    )


def require_roles(*allowed_roles: UserRole):
    """Dependencia RBAC para restringir endpoints por rol."""

    def _checker(user: Annotated[UserOut, Depends(get_current_user)]) -> UserOut:
        if user.rol not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"El rol {user.rol} no tiene permiso para ejecutar esta acción",
            )
        return user

    return _checker
