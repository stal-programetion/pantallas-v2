"""Pruebas de integración FastAPI: auth/Ley 1581, recálculo ausencia <5s, auditoría y Excel."""

import time
from fastapi.testclient import TestClient


def test_health_and_catalogs(client: TestClient):
    r_health = client.get("/api/v1/health")
    assert r_health.status_code == 200
    assert r_health.json()["status"] == "ok"

    r_offices = client.get("/api/v1/offices")
    assert r_offices.status_code == 200
    assert len(r_offices.json()) == 14

    r_staff = client.get("/api/v1/staff")
    assert r_staff.status_code == 200
    assert len(r_staff.json()) == 36


def test_ley_1581_hides_diagnostico_for_consulta_role(client: TestClient):
    r_coord = client.post("/api/v1/auth/demo-session", json={"rol": "COORDINADOR"})
    token_coord = r_coord.json()["accessToken"]

    r_view = client.post("/api/v1/auth/demo-session", json={"rol": "CONSULTA"})
    token_view = r_view.json()["accessToken"]

    abs_coord = client.get("/api/v1/absences", headers={"Authorization": f"Bearer {token_coord}"}).json()
    abs_view = client.get("/api/v1/absences", headers={"Authorization": f"Bearer {token_view}"}).json()

    assert any(a["diagnosticoSalud"] for a in abs_coord)
    assert all(a["diagnosticoSalud"] is None for a in abs_view)


def test_absence_in_cartagena_recalculates_under_5s_and_audits(client: TestClient):
    token = client.post("/api/v1/auth/demo-session", json={"rol": "COORDINADOR"}).json()["accessToken"]
    headers = {"Authorization": f"Bearer {token}"}

    t0 = time.perf_counter()
    resp = client.post(
        "/api/v1/absences",
        headers=headers,
        json={
            "colaboradorId": "st-01",
            "tipo": "incapacidad_general",
            "fechaInicio": "2026-10-15",
            "fechaFin": "2026-10-16",
            "diagnosticoSalud": "CIE-10 J00",
            "aprobadoPor": "Salud Ocupacional",
            "motivoDetalle": "Incapacidad de prueba",
            "estado": "activa",
        },
    )
    elapsed = time.perf_counter() - t0
    assert resp.status_code == 200
    assert elapsed < 5.0
    body = resp.json()
    assert body["plan"]["turnos"]["st-01"]["slots"]["10:00"]["estado"] == "ausente"
    assert len(body["recommendations"]) >= 1

    # Aprobar plan y revisar auditoría
    r_approve = client.post(
        "/api/v1/plans/2026-10-15/approve",
        headers=headers,
        json={"approverName": "Liliana María Ramos"},
    )
    assert r_approve.status_code == 200
    assert r_approve.json()["estado"] == "aprobado"

    audit = client.get("/api/v1/audit", headers=headers).json()
    actions = {a["action"] for a in audit}
    assert "ABSENCE_CREATED" in actions
    assert "PLAN_APPROVED" in actions


def test_plan_export_xlsx_and_reports_csv(client: TestClient):
    r_xlsx = client.get("/api/v1/plans/2026-10-15/export?format=xlsx")
    assert r_xlsx.status_code == 200
    assert r_xlsx.content[:2] == b"PK"  # Firma ZIP de archivo .xlsx

    r_csv = client.get("/api/v1/reports/export?format=csv")
    assert r_csv.status_code == 200
    assert "ID Oficina" in r_csv.text


def test_plan_import_excel_and_redistribution_edit_audit(client: TestClient):
    token = client.post("/api/v1/auth/demo-session", json={"rol": "COORDINADOR"}).json()["accessToken"]
    headers = {"Authorization": f"Bearer {token}"}

    # Round-trip export -> import de malla Excel
    r_xlsx = client.get("/api/v1/plans/2026-10-15/export?format=xlsx")
    assert r_xlsx.status_code == 200
    r_imp = client.post(
        "/api/v1/plans/2026-10-15/import-excel",
        headers=headers,
        files={"file": ("Plan.xlsx", r_xlsx.content, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
    )
    assert r_imp.status_code == 200
    assert r_imp.json()["fecha"] == "2026-10-15"

    # Editar y aceptar redistribución con auditoría
    recs = client.get("/api/v1/redistributions?date=2026-10-15").json()
    if recs:
        rec_id = recs[0]["id"]
        r_edit = client.patch(
            f"/api/v1/redistributions/{rec_id}",
            headers=headers,
            json={"modalidad": "virtual", "franjaInicio": "09:00", "franjaFin": "11:30"},
        )
        assert r_edit.status_code == 200
        assert r_edit.json()["modalidad"] == "virtual"
        assert r_edit.json()["franjaInicio"] == "09:00"

        audit = client.get("/api/v1/audit", headers=headers).json()
        actions = {a["action"] for a in audit}
        assert "PLAN_IMPORTED_EXCEL" in actions
        assert "REDISTRIBUTION_EDITED" in actions
