"""Configuración centralizada del backend mediante variables de entorno."""

from functools import lru_cache
import os
from pathlib import Path
import tempfile
from pydantic_settings import BaseSettings, SettingsConfigDict


def _default_database_url() -> str:
    if os.environ.get("VERCEL"):
        db_file = (Path(tempfile.gettempdir()) / "surtigas_vercel.db").as_posix()
        return f"sqlite:///{db_file}"
    return "sqlite:///./surtigas_local.db"


class Settings(BaseSettings):
    """Parámetros de entorno de la aplicación."""

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "Surtigas OptiTurnos API"
    app_version: str = "1.0.0"

    database_url: str = _default_database_url()

    jwt_secret_key: str = "dev-surtigas-secret-change-in-production-2026"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 480

    auth_required: bool = False
    auth_demo_role_switch: bool = True

    cors_origins: str = (
        "http://localhost:5173,http://localhost:8080,"
        "http://127.0.0.1:5173,http://127.0.0.1:8080"
    )

    digiturno_source_mode: str = "mock"
    realtime_interval_seconds: int = 5
    seed_on_startup: bool = True

    default_plan_date: str = "2026-10-15"
    excel_data_path: str = str(
        Path(__file__).resolve().parents[2] / "data" / "Historicos_Turnos_MAY2026.xlsx"
    )

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    """Devuelve instancia cacheada de configuración."""
    return Settings()
