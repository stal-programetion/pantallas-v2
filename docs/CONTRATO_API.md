# Contrato de API Inferido — Plataforma de Gestión Inteligente de Turnos (Surtigas)

> **Estado:** Aprobado e implementado (v1.0.0).  
> **Base URL:** `${VITE_API_BASE_URL}/api/v1` (por defecto en desarrollo: `http://localhost:8000/api/v1`).  
> **Documentación interactiva:** OpenAPI 3.1 en `/docs` y `/openapi.json`.

---

## 1. Convenciones Generales

1. **Formato y nombres de campos:** JSON UTF-8 con propiedades en **camelCase** idénticas a las interfaces de `src/types/index.ts` para no alterar los componentes del frontend (en FastAPI mediante `BaseModel` con `alias_generator=to_camel`, `populate_by_name=True`).
2. **Fechas y horas:**
   - Fechas de calendario: `YYYY-MM-DD` (p. ej. `"2026-10-15"`).
   - Timestamps: ISO-8601 con zona horaria o UTC (`"2026-10-15T14:32:10Z"`).
   - Franjas de 30 min: `"HH:MM"` (p. ej. `"08:00"`, `"08:30"`).
3. **Autenticación y roles:**
   - Cabecera `Authorization: Bearer <jwt>`.
   - Roles alineados con el frontend: `ADMIN`, `COORDINADOR`, `CONSULTA` (configurable para mapear `Supervisor` -> `COORDINADOR` si se requiere).
   - Bandera `AUTH_REQUIRED` (por defecto `false` en demo local o `true` con sesión emitida desde `/auth/demo-session` cuando `AUTH_DEMO_ROLE_SWITCH=true`).
4. **Protección de datos (Ley 1581 de 2012):**
   - El campo `diagnosticoSalud` de `Absence` **se omite o retorna `null`** en el backend cuando el rol autenticado es `CONSULTA`.
   - Ningún log del servidor imprime nombres completos, cédulas (`documento`) ni diagnósticos médicos.
5. **Formato estándar de error:**
```json
{
  "detail": "Descripción legible del error en español",
  "code": "RESOURCE_NOT_FOUND",
  "errors": [
    { "field": "fechaFin", "message": "Debe ser mayor o igual a fechaInicio" }
  ]
}
```

---

## 2. Endpoints por Dominio

### 2.1 Salud del Servicio

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `GET` | `/api/v1/health` | Pública | Verifica estado de FastAPI, conexión a PostgreSQL y modo activo de `DigiturnoSource`. |

**Respuesta `200 OK`:**
```json
{
  "status": "ok",
  "database": "connected",
  "sourceMode": "mock",
  "version": "0.1.0"
}
```

---

### 2.2 Autenticación y Roles

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `POST` | `/api/v1/auth/demo-session` | Pública (si `AUTH_DEMO_ROLE_SWITCH=true`) | Emite un JWT para el perfil seleccionado en `LoginPage` o en el selector rápido `Ver como` del `Header`. |
| `POST` | `/api/v1/auth/login` | Pública | Autenticación estándar con `email` y `password` (cuando `AUTH_REQUIRED=true` sin demo switch). |
| `GET` | `/api/v1/auth/me` | Autenticada | Devuelve el `User` actual y sus permisos efectivos. |

**`POST /api/v1/auth/demo-session` — Request:**
```json
{ "rol": "COORDINADOR" }
```
**Response `200 OK`:**
```json
{
  "accessToken": "<jwt>",
  "tokenType": "bearer",
  "user": {
    "id": "usr-coord",
    "nombre": "Liliana María Ramos",
    "email": "lramos@surtigas.com.co",
    "rol": "COORDINADOR",
    "cargo": "Coordinadora de Turnos y Gestión Operativa"
  }
}
```

---

### 2.3 Catálogos (Oficinas, Personal) y Reglas Operativas

| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| `GET` | `/api/v1/offices` | Todos | Lista las 14 oficinas (`Office[]`). |
| `GET` | `/api/v1/offices/{officeId}` | Todos | Detalle de una oficina (`Office`). |
| `PATCH` | `/api/v1/offices/{officeId}` | `ADMIN` | Actualiza nombre, `capacidadPuestos`, `ciudad`, `slaObjetivo`, `tiempoEsperaMaxMin`, `estado`, horarios. |
| `GET` | `/api/v1/staff` | Todos (`documento` enmascarado para `CONSULTA` si aplica) | Lista colaboradores (`Staff[]`), filtrable por `?oficinaBaseId=...`. |
| `GET` | `/api/v1/settings/rules` | Todos | Obtiene reglas laborales y parámetros globales del motor. |
| `PUT` | `/api/v1/settings/rules` | `ADMIN` | Actualiza reglas globales (`targetSla`, `maxWaitMin`, `maxPresencialKm`, `lunchDuration`, etc.). |

**`GET /api/v1/settings/rules` — Response `200 OK`:**
```json
{
  "targetSla": 0.80,
  "maxWaitMin": 10,
  "maxPresencialKm": 45,
  "lunchDurationMin": 60,
  "fortnightMultiplier": 1.32,
  "minAgentsOpenOffice": 1
}
```

---

### 2.4 Digiturno y Analítica en Vivo

| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| `GET` | `/api/v1/digiturno/live-metrics` | Todos | Métricas actuales de las 14 oficinas (`OfficeRealtimeMetrics[]`). Query opcional: `?slot=11:00&isFortnight=true`. |
| `GET` | `/api/v1/digiturno/live-metrics/{officeId}` | Todos | Estado en vivo de una oficina (`OfficeRealtimeMetrics`). |
| `GET` | `/api/v1/digiturno/network-load` | Todos | Serie por franja de 30 min para `LiveQueueChart`: demanda pronosticada vs. llegadas Digiturno vs. capacidad operativa. |
| `GET` | `/api/v1/digiturno/user-behavior` | Todos | Distribución de trámites, tiempo medio de atención, pico matutino y tasa real de abandono (`UserBehaviorWidget`). |
| `GET` | `/api/v1/digiturno/office-daily-activity/{officeId}` | Todos | Serie por franja `Atendidos` vs `EnEspera` del día para `OfficeDetailPage`. |
| `GET` | `/api/v1/digiturno/historical` | Todos | Resúmenes históricos (`HistoricalTicketSummary[]`), filtrable por `?officeId=...&isFortnight=...`. |
| `GET` | `/api/v1/digiturno/connection-status` | Todos | Estado actual del conector (`DigiturnoConnectionStatus` + `sourceMode`). |
| `POST` | `/api/v1/digiturno/test-connection` | `ADMIN`, `COORDINADOR` | Prueba conectividad de `DigiturnoSource` y devuelve `DigiturnoConnectionStatus`. |
| `PUT` | `/api/v1/digiturno/source-mode` | `ADMIN`, `COORDINADOR` | Cambia entre `"mock"` (`SimulatedLiveSource`) y `"real"` (`ExcelSource`/API). |

**`GET /api/v1/digiturno/network-load?isFortnight=true` — Response `200 OK`:**
```json
{
  "isFortnight": true,
  "currentSlot": "11:00",
  "series": [
    {
      "franja": "08:00",
      "demandaPronosticada": 98,
      "llegadasDigiturno": 94,
      "capacidadOperativa": 105
    }
  ]
}
```

**`GET /api/v1/digiturno/user-behavior` — Response `200 OK`:**
```json
{
  "picoMatutino": "08:00 - 10:30",
  "tasaAbandonoPorcentaje": 6.8,
  "metaAbandonoPorcentaje": 3.0,
  "tramites": [
    {
      "nombre": "Facturación y Acuerdos de Pago",
      "porcentaje": 47,
      "tiempoMedioMin": 6.5
    }
  ]
}
```

---

### 2.5 Tiempo Real (SSE / WebSocket)

| Protocolo | Ruta | Auth | Descripción |
|---|---|---|---|
| `SSE (GET)` | `/api/v1/realtime/stream` | Token en query/header (si `AUTH_REQUIRED=true`) | Flujo de eventos en tiempo real (`metrics_update`, `alerts_update`, `plan_update`, `heartbeat`) cada N segundos según `SimulatedLiveSource`. |
| `WebSocket` | `/api/v1/realtime/ws` | Token en query | Canal bidireccional alternativo con el mismo formato de mensajes JSON. |

**Payload de evento `metrics_update`:**
```json
{
  "type": "metrics_update",
  "timestamp": "2026-10-15T11:00:05Z",
  "currentSlotTime": "11:00",
  "liveMetrics": [ /* OfficeRealtimeMetrics[] */ ],
  "alerts": [ /* Alert[] */ ]
}
```

---

### 2.6 Pronóstico y Demanda

| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| `GET` | `/api/v1/forecast/office/{officeId}` | Todos | Pronóstico por franja de 30 min para una oficina (`?dayOfWeek=1&isFortnight=false`), incluye intervalos de confianza (`icInferior`, `icSuperior`) y `tramitePredominante`. |
| `GET` | `/api/v1/forecast/heatmap/{officeId}` | Todos | Matriz Lunes–Viernes × franjas de 30 min para `DemandAnalysisPage`. |
| `GET` | `/api/v1/forecast/compare-fortnight/{officeId}` | Todos | Comparativa franja a franja: día estándar vs. día de quincena. |
| `GET` | `/api/v1/forecast/compare-offices` | Todos | Comparativa horaria entre `?officeA=...&officeB=...&dayOfWeek=1&isFortnight=true`. |
| `GET` | `/api/v1/forecast/required-agents` | Todos | Matriz `Record<officeId, number[]>` de agentes mínimos Erlang C/A por franja (`?dayOfWeek=4&isFortnight=true`). |
| `GET` | `/api/v1/forecast/peaks-summary` | Todos | Bloques pico proyectados y sedes con mayor tensión operativa para el Paso 2 de `DayPlanPage`. |

---

### 2.7 Plan del Día y Malla de Turnos

| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| `GET` | `/api/v1/plans/{date}` | Todos | Obtiene el `DayPlan` de la fecha (o `404` si no existe aún). |
| `POST` | `/api/v1/plans/generate` | `ADMIN`, `COORDINADOR` | Ejecuta el motor de optimización (`fecha`, `isFortnight`, `dayOfWeek?`) y guarda propuesta `DayPlan` (incluye `slaProyectadoRed`). |
| `POST` | `/api/v1/plans/{date}/approve` | `ADMIN`, `COORDINADOR` | Aprueba oficialmente el `DayPlan`, incrementa versión y registra evento en auditoría. |
| `POST` | `/api/v1/plans/{date}/slots/validate` | `ADMIN`, `COORDINADOR` | Valida un cambio manual de casilla y devuelve impacto antes/después y advertencias (`isValid`, `warningMessage`, `before`, `after`, `required`). |
| `PATCH` | `/api/v1/plans/{date}/slots` | `ADMIN`, `COORDINADOR` | Actualiza manualmente un slot (`colaboradorId`, `franja`, `estado`, `oficinaAsignadaId?`, `nota?`), marca `esModificadoManual=true` y audita. |
| `POST` | `/api/v1/plans/{date}/reset` | `ADMIN`, `COORDINADOR` | Restaura la malla a la propuesta algorítmica original y audita. |
| `GET` | `/api/v1/plans/{date}/export` | Todos | Descarga la malla y propuesta del día en Excel (`?format=xlsx`). |
| `POST` | `/api/v1/plans/{date}/import-excel` | `ADMIN`, `COORDINADOR` | Importa ajustes manuales de la malla desde Excel (`.xlsx`) y audita. |

**`POST /api/v1/plans/generate` — Request:**
```json
{
  "fecha": "2026-10-15",
  "isFortnight": true
}
```
**Response `200 OK`:** Objeto `DayPlan` completo (`id`, `fecha`, `estado`, `auditoria`, `tiempoAhorradoMinutos`, `turnos`, `justificaciones`) + campo aditivo `slaProyectadoRed: 0.834`.

---

### 2.8 Redistribución y Traslados

| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| `GET` | `/api/v1/redistributions` | Todos | Lista recomendaciones activas (`RedistributionRecommendation[]`), filtrable por `?date=...&modalidad=...`. |
| `POST` | `/api/v1/redistributions/recalculate` | `ADMIN`, `COORDINADOR` | Recalcula propuestas de traslado para una fecha/franja. |
| `POST` | `/api/v1/redistributions/{id}/accept` | `ADMIN`, `COORDINADOR` | Acepta la recomendación, actualiza los slots del `DayPlan` afectado y registra auditoría. |
| `POST` | `/api/v1/redistributions/{id}/reject` | `ADMIN`, `COORDINADOR` | Rechaza la recomendación (opcional `motivo`) y registra auditoría. |
| `PATCH` | `/api/v1/redistributions/{id}` | `ADMIN`, `COORDINADOR` | Edita colaborador, franja (`franjaInicio`/`franjaFin`) o modalidad antes de aceptar, recalculando impacto y auditando. |
| `POST` | `/api/v1/offices/{officeId}/request-support` | `ADMIN`, `COORDINADOR` | Solicita refuerzo para una oficina desde `OfficeDetailPage` y genera recomendación prioritaria. |
| `POST` | `/api/v1/offices/{officeId}/release-staff` | `ADMIN`, `COORDINADOR` | Marca disponibilidad/liberación de puesto de una oficina para apoyar la red. |

---

### 2.9 Gestión de Ausencias

| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| `GET` | `/api/v1/absences` | Todos (`diagnosticoSalud` oculto para `CONSULTA`) | Lista ausencias (`Absence[]`), con filtro opcional `?estado=activa&tipo=...`. |
| `POST` | `/api/v1/absences` | `ADMIN`, `COORDINADOR` | Registra nueva ausencia, calcula `impactoEstimado`, **recalcula automáticamente el `DayPlan`, alertas y redistribuciones (< 5 s)** y devuelve `{ absence, plan, alerts, recommendations }`. |
| `PATCH` | `/api/v1/absences/{id}` | `ADMIN`, `COORDINADOR` | Actualiza fechas, tipo o estado de una ausencia y recalcula. |
| `DELETE` | `/api/v1/absences/{id}` | `ADMIN`, `COORDINADOR` | Elimina/finaliza ausencia, reintegra al colaborador al `DayPlan` y recalcula alertas/redistribuciones. |
| `POST` | `/api/v1/absences/import-excel` | `ADMIN`, `COORDINADOR` | Carga masiva de ausencias desde archivo `.xlsx` con reporte de validación. |
| `GET` | `/api/v1/absences/export` | `ADMIN`, `COORDINADOR` | Exporta ausencias a `.xlsx`. |

---

### 2.10 Simulador What-If (Erlang C/A + SimPy)

| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| `POST` | `/api/v1/simulation/run` | Todos | Ejecuta evaluación analítica (Erlang C/A) + simulación de eventos discretos (SimPy con abandono). |
| `POST` | `/api/v1/simulation/apply-scenario` | `ADMIN`, `COORDINADOR` | Convierte los parámetros simulados en una nueva propuesta de `DayPlan` para `fecha`. |

**`POST /api/v1/simulation/run` — Request (`SimulationParams`):**
```json
{
  "additionalAbsences": 2,
  "demandMultiplier": 1.2,
  "targetSla": 0.8,
  "officeIdFilter": "cartagena-chambacu",
  "agentsOverride": null
}
```
**Response `200 OK` (`SimulationResult` + campos aditivos retrocompatibles):**
```json
{
  "params": {
    "additionalAbsences": 2,
    "demandMultiplier": 1.2,
    "targetSla": 0.8,
    "officeIdFilter": "cartagena-chambacu"
  },
  "totalAgentesActuales": 6,
  "totalAgentesSimulados": 8,
  "slaActualPonderado": 0.81,
  "slaSimuladoPonderado": 0.62,
  "esperaActualMin": 7.4,
  "esperaSimuladaMin": 14.9,
  "abandonoActualPorcentaje": 3.1,
  "abandonoSimuladoPorcentaje": 9.4,
  "curvaErlang": [
    { "agentes": "1 Agentes", "c": 1, "nivelServicio": 5, "esperaMin": 45.0 }
  ],
  "oficinasAfectadas": [
    {
      "oficinaId": "cartagena-chambacu",
      "oficinaNombre": "Sede Principal Chambacú",
      "slaActual": 0.81,
      "slaSimulado": 0.62,
      "esperaActualMin": 7.4,
      "esperaSimuladaMin": 14.9,
      "agentesActuales": 6,
      "agentesSimulados": 8,
      "abandonoActualPorcentaje": 3.1,
      "abandonoSimuladoPorcentaje": 9.4
    }
  ]
}
```

---

### 2.11 Alertas, Reportes, Auditoría y ETL

| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| `GET` | `/api/v1/alerts` | Todos | Lista alertas activas (`Alert[]`). |
| `POST` | `/api/v1/alerts/{id}/dismiss` | Todos | Marca una alerta como descartada/leída. |
| `GET` | `/api/v1/reports/summary` | Todos | KPIs ejecutivos globales, tabla Antes vs. Después y desglose por oficina (`?range=hoy|7d|30d|90d`). |
| `GET` | `/api/v1/reports/export` | Todos | Descarga reporte ejecutivo (`?format=csv|xlsx&range=30d`). |
| `GET` | `/api/v1/audit` | `ADMIN`, `COORDINADOR` | Consulta historial de auditoría (quién, cuándo, acción, entidad, detalle). |
| `POST` | `/api/v1/etl/digiturno/import` | `ADMIN`, `COORDINADOR` | Sube e importa `.xlsx` de Digiturno de forma idempotente y devuelve reporte de calidad de datos. |
| `GET` | `/api/v1/etl/digiturno/runs` | `ADMIN`, `COORDINADOR` | Historial de ejecuciones ETL y métricas de calidad. |

---

## 3. Matriz Pantalla → Endpoints

| Pantalla | Endpoints consumidos |
|---|---|
| `AppLayout` / `Header` / `Sidebar` | `GET /offices`, `GET /staff`, `GET /plans/{date}`, `GET /absences`, `GET /alerts`, `GET /redistributions`, `GET /realtime/stream` (SSE), `POST /alerts/{id}/dismiss` |
| `LoginPage` | `POST /auth/demo-session`, `POST /auth/login`, `GET /auth/me` |
| `DashboardPage` | `GET /digiturno/live-metrics`, `GET /digiturno/network-load`, `GET /digiturno/user-behavior`, `POST /redistributions/{id}/accept`, `POST /redistributions/{id}/reject` |
| `DayPlanPage` | `POST /plans/generate`, `GET /forecast/peaks-summary`, `POST /plans/{date}/approve`, `POST /redistributions/{id}/accept|reject` |
| `ShiftGridPage` | `GET /plans/{date}`, `GET /forecast/required-agents`, `POST /plans/{date}/slots/validate`, `PATCH /plans/{date}/slots`, `POST /plans/{date}/reset`, `GET /plans/{date}/export`, `POST /plans/{date}/import-excel` |
| `RedistributionPage` | `GET /redistributions`, `POST /redistributions/{id}/accept|reject`, `PATCH /redistributions/{id}` |
| `OfficeDetailPage` | `GET /offices/{officeId}`, `GET /digiturno/live-metrics/{officeId}`, `GET /digiturno/office-daily-activity/{officeId}`, `GET /forecast/office/{officeId}`, `POST /offices/{officeId}/request-support`, `POST /offices/{officeId}/release-staff` |
| `DemandAnalysisPage` | `GET /forecast/heatmap/{officeId}`, `GET /forecast/compare-fortnight/{officeId}`, `GET /forecast/compare-offices` |
| `SimulatorPage` | `POST /simulation/run`, `POST /simulation/apply-scenario` |
| `AbsencesPage` | `GET /absences`, `POST /absences`, `DELETE /absences/{id}`, `POST /absences/import-excel`, `GET /absences/export` |
| `ReportsPage` | `GET /reports/summary`, `GET /reports/export` |
| `SettingsPage` | `GET /digiturno/connection-status`, `POST /digiturno/test-connection`, `PUT /digiturno/source-mode`, `PATCH /offices/{officeId}`, `GET/PUT /settings/rules`, `POST /etl/digiturno/import` |
