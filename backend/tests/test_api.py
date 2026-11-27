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


def test_multi_date_plans_no_pk_collision_and_invalid_date_400(client: TestClient):
    r_bad = client.get("/api/v1/plans/active")
    assert r_bad.status_code == 400

    r_day1 = client.get("/api/v1/plans/2026-10-15")
    r_day2 = client.get("/api/v1/plans/2026-10-16")
    assert r_day1.status_code == 200
    assert r_day2.status_code == 200

    alerts_1 = client.get("/api/v1/alerts?date=2026-10-15").json()
    alerts_2 = client.get("/api/v1/alerts?date=2026-10-16").json()
    assert len(alerts_1) > 0 and len(alerts_2) > 0
    assert {a["id"] for a in alerts_1}.isdisjoint({a["id"] for a in alerts_2})

    recs_2 = client.get("/api/v1/redistributions?date=2026-10-16").json()
    assert len(recs_2) >= 1


def test_absence_patch_recalculates_and_redistribution_edit_updates_impact(client: TestClient):
    token = client.post("/api/v1/auth/demo-session", json={"rol": "COORDINADOR"}).json()["accessToken"]
    headers = {"Authorization": f"Bearer {token}"}

    # Crear ausencia temporal en una fecha dedicada para aislar la prueba
    r_create = client.post(
        "/api/v1/absences?fecha=2026-10-19",
        headers=headers,
        json={
            "colaboradorId": "st-02",
            "tipo": "permiso_personal",
            "fechaInicio": "2026-10-19",
            "fechaFin": "2026-10-19",
            "diagnosticoSalud": "N/A",
            "aprobadoPor": "Coordinación",
            "motivoDetalle": "Prueba PATCH ausencia",
            "estado": "activa",
        },
    )
    assert r_create.status_code == 200
    abs_id = r_create.json()["absence"]["id"]
    assert r_create.json()["plan"]["turnos"]["st-02"]["slots"]["10:00"]["estado"] == "ausente"

    # Editar ausencia a rango fuera de la fecha -> debe recalcular y reintegrar colaborador
    r_patch = client.patch(
        f"/api/v1/absences/{abs_id}?fecha=2026-10-19",
        headers=headers,
        json={"estado": "finalizada", "fechaInicio": "2026-10-20", "fechaFin": "2026-10-21"},
    )
    assert r_patch.status_code == 200
    plan_after = client.get("/api/v1/plans/2026-10-19").json()
    assert plan_after["turnos"]["st-02"]["slots"]["10:00"]["estado"] != "ausente"

    # Editar redistribución cambiando franja y validar recálculo de impacto + auditoría
    recs = client.get("/api/v1/redistributions?date=2026-10-19").json()
    assert len(recs) >= 1
    rec_id = recs[0]["id"]
    r_edit = client.patch(
        f"/api/v1/redistributions/{rec_id}",
        headers=headers,
        json={"modalidad": "virtual", "franjaInicio": "08:00", "franjaFin": "10:30"},
    )
    assert r_edit.status_code == 200
    edited = r_edit.json()
    assert edited["impactoEstimado"]["reduccionEsperaMin"] > 0
    assert edited["impactoEstimado"]["slaOrigenResultante"] > 0

    audit = client.get("/api/v1/audit", headers=headers).json()
    assert any(a["action"] == "ABSENCE_UPDATED" for a in audit)


def test_simulation_apply_scenario_and_rules_lunch_duration(client: TestClient):
    token = client.post("/api/v1/auth/demo-session", json={"rol": "ADMIN"}).json()["accessToken"]
    headers = {"Authorization": f"Bearer {token}"}

    r_app = client.post(
        "/api/v1/simulation/apply-scenario",
        headers=headers,
        json={
            "fecha": "2026-10-19",
            "params": {
                "additionalAbsences": 1,
                "demandMultiplier": 1.25,
                "targetSla": 0.85,
                "officeIdFilter": "cartagena-chambacu",
            },
        },
    )
    assert r_app.status_code == 200
    justs = r_app.json()["justificaciones"]
    assert any(j["id"] == "just-sim-abs-cartagena-chambacu" for j in justs)

    # Regla de almuerzo de 30 min -> debe asignar exactamente 1 franja de almuerzo y luego restaurar 60 min
    try:
        r_rules = client.put(
            "/api/v1/settings/rules",
            headers=headers,
            json={"lunchDurationMin": 30, "targetSla": 0.80},
        )
        assert r_rules.status_code == 200
        plan_30 = client.get("/api/v1/plans/2026-10-19").json()
        lunch_30 = [
            s for s, info in plan_30["turnos"]["st-01"]["slots"].items() if info["estado"] == "almuerzo"
        ]
        assert len(lunch_30) == 1
    finally:
        client.put(
            "/api/v1/settings/rules",
            headers=headers,
            json={"lunchDurationMin": 60, "targetSla": 0.80},
        )

    rep_hoy = client.get("/api/v1/reports/summary?range=hoy").json()
    rep_30 = client.get("/api/v1/reports/summary?range=30d").json()
    assert rep_hoy["horasMesAhorradas"] < rep_30["horasMesAhorradas"]
