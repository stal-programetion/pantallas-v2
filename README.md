# Surtigas S.A. E.S.P. — Plataforma de Gestión Inteligente de Turnos (Full Stack)

Sistema integral para la optimización, simulación, análisis de demanda y gestión operativa de turnos y personal de las **14 oficinas de atención al cliente de Surtigas S.A. E.S.P.** (prototipo escalable TRL 6).

---

## Arquitectura del Sistema

- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS v4 + Zustand + Recharts + SSE (`EventSource`).
- **Backend:** Python + **FastAPI** + Pydantic v2 + SQLAlchemy 2.0 + Alembic + **PostgreSQL 16**.
- **Motores Matemáticos:**
  - **Pronóstico de demanda:** Línea base histórica por oficina × día de semana × franja de 30 min con intervalos de confianza al 95 % y estacionalidad de quincena.
  - **Teoría de colas:** Erlang C (`M/M/c`) y Erlang A (`M/M/c+M` con tasa de abandono) para dimensionamiento y cálculo de SLA.
  - **Simulación de eventos discretos:** **SimPy** con llegadas estocásticas y paciencia finita (abandono antes vs. después).
  - **Optimización y redistribución:** **PuLP (MILP CBC)** para escalonamiento de almuerzos y heurística territorial Haversine (< 45 km presencial / ≥ 45 km virtual) con explicabilidad y auditoría.
- **Tiempo Real:** `DigiturnoSource` (`ExcelSource` y `SimulatedLiveSource`) + Server-Sent Events (`/api/v1/realtime/stream`) y WebSocket (`/api/v1/realtime/ws`).

---

## Inicio Rápido con Docker Compose

```bash
cp .env.example .env
docker compose up --build -d
```

- **Frontend conectado:** `http://localhost:8080`
- **API FastAPI + OpenAPI Docs:** `http://localhost:8000/docs`
- **Healthcheck:** `http://localhost:8000/api/v1/health`

Al iniciar por primera vez, el backend ejecuta las migraciones **Alembic** y carga los catálogos iniciales junto con el histórico calibrado de **22.611 turnos** (o `data/Historicos_Turnos_MAY2026.xlsx` si se coloca en `data/`).

---

## Ejecución Local (Desarrollo sin Docker)

### Backend
```bash
cd backend
python -m venv .venv
# Windows PowerShell:
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend
```bash
npm install
# Asegúrate de tener VITE_API_BASE_URL=http://localhost:8000 en .env
npm run dev
```

---

## Ingesta ETL del Excel de Digiturno

Coloca el archivo real en `data/Historicos_Turnos_MAY2026.xlsx` (excluido de Git en `.gitignore`) e impórtalo por CLI o por API (`POST /api/v1/etl/digiturno/import`):

```bash
cd backend
python -m app.etl.cli --file ../data/Historicos_Turnos_MAY2026.xlsx
```

---

## Pruebas Automatizadas

```bash
# Backend (Erlang C/A, Pronóstico, ETL 22.6k turnos, SimPy, PuLP MILP, API & Ley 1581)
cd backend
pytest -v

# Frontend (motores TS y build de producción)
npm test
npm run build
```

---

## Documentación Técnica

- [Contrato de API Inferido](docs/CONTRATO_API.md)
- [Análisis Exploratorio de Datos (EDA)](docs/EDA.md)
- [Supuestos y Aproximaciones](docs/SUPUESTOS.md)
- [Cambios Realizados al Frontend](docs/CAMBIOS_FRONTEND.md)
- [Guion de Demo (5 min)](docs/GUION_DEMO.md)
