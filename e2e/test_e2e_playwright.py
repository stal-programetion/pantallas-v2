"""Prueba E2E básica con Playwright sobre el frontend real conectado al backend."""

from __future__ import annotations

import os
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE_URL = os.environ.get("E2E_BASE_URL", "http://localhost:8080")
SHOT_DIR = Path(__file__).resolve().parent / "screenshots"


def run_e2e() -> None:
    SHOT_DIR.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()

        console_errors: list[str] = []
        http_errors: list[str] = []
        page.on("pageerror", lambda err: console_errors.append(str(err)))
        page.on(
            "response",
            lambda res: http_errors.append(f"{res.status} {res.url}")
            if "/api/v1/" in res.url and res.status >= 400
            else None,
        )

        # 1. Login (/login) -> ingresar como Coordinador
        page.goto(f"{BASE_URL}/login", wait_until="networkidle")
        assert "Plataforma de Gestión" in page.content()
        page.screenshot(path=str(SHOT_DIR / "01_login.png"))
        page.get_by_role("button", name="Ingresar a la Plataforma").click()
        page.wait_for_url("**/dashboard")

        # 2. Dashboard (/dashboard) -> esperar carga real de las 14 oficinas
        page.get_by_role("button", name="Ver Oficina Cartagena Chambacú").wait_for(timeout=15000)
        assert "14 de 14" in page.content()
        page.screenshot(path=str(SHOT_DIR / "02_dashboard.png"))

        # 3. Plan del Día (/plan-dia)
        page.goto(f"{BASE_URL}/plan-dia", wait_until="networkidle")
        page.get_by_text("Plan Operativo del Día").first.wait_for(timeout=10000)
        page.screenshot(path=str(SHOT_DIR / "03_plan_dia.png"))

        # 4. Malla de Turnos (/malla)
        page.goto(f"{BASE_URL}/malla", wait_until="networkidle")
        page.get_by_text("Malla de turnos").first.wait_for(timeout=10000)
        page.screenshot(path=str(SHOT_DIR / "04_malla.png"))

        # 5. Redistribución (/redistribucion) -> editar primera recomendación si hay botón editar
        page.goto(f"{BASE_URL}/redistribucion", wait_until="networkidle")
        page.get_by_text("Redistribución y Traslados Inteligentes").first.wait_for(timeout=10000)
        edit_btn = page.get_by_role("button", name="Editar recomendación de redistribución").first
        if edit_btn.count() > 0:
            edit_btn.click()
            page.get_by_role("button", name="Guardar ajuste").click()
            page.get_by_text("Propuesta de redistribución actualizada").first.wait_for(timeout=10000)
        page.screenshot(path=str(SHOT_DIR / "05_redistribucion.png"))

        # 6. Demanda (/demanda)
        page.goto(f"{BASE_URL}/demanda", wait_until="networkidle")
        page.get_by_text("Mapa de Calor de Afluencia").first.wait_for(timeout=10000)
        page.screenshot(path=str(SHOT_DIR / "06_demanda.png"))

        # 7. Simulador (/simulador) -> verificar Tasa de Abandono (SimPy)
        page.goto(f"{BASE_URL}/simulador", wait_until="networkidle")
        page.get_by_text("Simulador de Escenarios What-If").first.wait_for(timeout=10000)
        page.get_by_text("Tasa de Abandono (SimPy):").first.wait_for(timeout=10000)
        page.screenshot(path=str(SHOT_DIR / "07_simulador.png"))

        # 8. Ausencias (/ausencias) -> registrar ausencia y verificar recálculo + Ley 1581
        page.goto(f"{BASE_URL}/ausencias", wait_until="networkidle")
        page.get_by_text("Gestión de Ausencias y Salud Laboral").first.wait_for(timeout=10000)
        page.get_by_role("button", name="Registrar Nueva Ausencia").click()
        page.get_by_role("button", name="Guardar y Recalcular Malla").click()
        page.get_by_text("Malla de turnos y alertas recalculadas").first.wait_for(timeout=10000)
        page.screenshot(path=str(SHOT_DIR / "08_ausencias.png"))

        # Cambiar a rol CONSULTA desde menú usuario para verificar Ley 1581 desde el backend
        page.locator("header button[aria-haspopup='menu']").click()
        page.get_by_role("menuitemradio", name="Consulta").click()
        page.get_by_text("Confidencial (Rol Consulta)").first.wait_for(timeout=10000)

        # Volver a rol COORDINADOR
        page.locator("header button[aria-haspopup='menu']").click()
        page.get_by_role("menuitemradio", name="Coordinador").click()
        page.get_by_text("CIE-10").first.wait_for(timeout=10000)

        # 9. Reportes (/reportes)
        page.goto(f"{BASE_URL}/reportes", wait_until="networkidle")
        page.get_by_text("Reportes Ejecutivos y Métricas de Rendimiento").wait_for(timeout=10000)
        page.screenshot(path=str(SHOT_DIR / "09_reportes.png"))

        # 10. Configuración (/configuracion)
        page.goto(f"{BASE_URL}/configuracion", wait_until="networkidle")
        page.get_by_text("Configuración y Parámetros del Sistema").wait_for(timeout=10000)
        page.screenshot(path=str(SHOT_DIR / "10_configuracion.png"))

        assert len(console_errors) == 0, f"Errores JS detectados: {console_errors}"
        assert len(http_errors) == 0, f"Errores HTTP API detectados: {http_errors}"
        browser.close()
        print("E2E Playwright PASSED: 10 pantallas verificadas, Ley 1581 y recálculo OK, 0 errores JS/HTTP.")


if __name__ == "__main__":
    run_e2e()
