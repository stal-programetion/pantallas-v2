# Análisis Exploratorio de Datos (EDA) — Históricos Digiturno (Mayo 2026)

> **Origen de datos:** Archivo real `Historicos Turnos MAY2026.xlsx`, hoja `Mayo 2026` (export oficial de Digiturno): **22.611 registros**, **116 columnas**, **19 días hábiles** (`2026-05-04` al `2026-05-29`, lunes a viernes), **14 oficinas**, **38 operadores** (seudonimizados en cumplimiento de la Ley 1581 de 2012) y **42 terminales**.

---

## 1. Hallazgos de Auditoría y Reglas de Limpieza ETL (`excel_importer.py`)

| Campo / Aspecto | Hallazgo real en el archivo | Tratamiento en el ETL |
|---|---|---|
| `IdTurno` vs `ADI` | `IdTurno` tiene `20.273` IDs únicos y `2.338` filas adicionales (`ADI` / multi-servicio). | Se usa clave compuesta idempotente **`IdOficina:IdTurno:IdServicio`** (`22.611` únicas, `0` pérdidas). |
| `Fecha` | Columna repetida **2 veces** en el encabezado y no confiable. | Ignorada explícitamente; toda fecha/hora se deriva de `TiempoInicioEspera`. |
| `TiempoInicioEspera` | Texto en español colombiano (`4/05/2026 8:09:38 a. m.`). `2` filas `CAN` traen este campo vacío pero con `TiempoInicioAtencion` válido. | Parseo `a. m.`/`p. m.` en `dd/mm/yyyy` con fallback automático a `TiempoInicioAtencion` (`2` turnos recuperados y reportados en `warnings`). |
| `Calificacion` | Valor `0` en todo el archivo. | Descartada. |
| `TiempoAtencion` (`FIN`) | Rango real `2,0 s` a `6.650,0 s` (media global **`540,1 s = 9,0 min`**); `24` registros superan `3.600 s` (sesiones abiertas). | Para estimar $\mu$ solo se incluyen turnos `FIN` con $15 \le \text{TiempoAtencion} \le 3600$ s; atípicos se contabilizan en `cleanedServiceOutliers`. |
| `NombreOperador` | Nombres personales de 38 operadores. | Seudonimización determinística SHA-256 (`OP-XXXXXX`); nunca se almacenan ni registran en logs. |

---

## 2. Distribución Temporal (Patrón Real Auditado)

- **Llegadas por hora (total mayo 2026):**
  - `07 h`: **2.310** · `08 h`: **3.771** · `09 h`: **3.852 (máximo)** · `10 h`: **3.439** · `11 h`: **2.112**
  - `12 h`: **987 (valle de almuerzo)**
  - `13 h`: **1.470** · `14 h`: **2.483 (segundo pico)** · `15 h`: **1.958** · `16 h`: **195** · `17 h`: **32**
- **Por día de la semana:**
  - Totales mayo: Lunes `4.677` (3 lunes → **1.559 turnos/día**), Martes `5.540` (4 martes → **1.385/día**), Miércoles `4.994` (4 miércoles → **1.249/día**), Jueves `4.344` (4 jueves → **1.086/día**), Viernes `3.054` (4 viernes → **764/día**).
  - Rango diario observado: mínimo **667** turnos/día, máximo **1.768** turnos/día. **Lunes > Viernes en promedio diario (>2x)**.
- **Estados:** `FIN` **19.787 (87,5 %)**, `ABA` **1.546 (6,8 %)**, `CAN` **1.278 (5,7 %)**.
- **Segmentación Nivel 2 (`NombreElementoNodoNivel2`):** `General` (17.727 · 78,4 %), `Preferencial` (4.228 · 18,7 %), `Agendado Presencial` (429 · 1,9 %), `Empresas` (223 · 1,0 %), `Agendado Virtual` (2).
- **Trámites Nivel 4 (`NombreElementoNodoNivel4`):** `Información` (6.339), `Peticiones` (6.204), `Solicitudes` (4.639), `*Sin Asignar` (2.610), `Convenio de pago` (873), `Reclamos` (709), `Radiciación de carta` (626), `Registro en OSF` (166), `Quejas` (166), `Pago con datafono` (71).

---

## 3. Desequilibrio Operativo Entre las 14 Oficinas

| Oficina (Nombre Digiturno) | Turnos | Espera prom. (min) | Atención prom. (min) | Operadores | Abandono |
|---|---:|---:|---:|---:|---:|
| Oficina Surtigas - Sede Cartagena | 4.703 | **80,4** | 12,8 | 13 | 10,4 % |
| Oficina Surtigas - Sede Monteria | 3.478 | 42,4 | 8,8 | 9 | 10,6 % |
| Oficina Surtigas - Sede Sincelejo | 2.404 | 40,8 | 11,1 | 8 | 8,2 % |
| Oficina Surtigas - Sede Cerete | 1.579 | 19,9 | 7,5 | 3 | 0,2 % |
| Oficina Surtigas - Sede Turbaco | 1.554 | 30,7 | 9,9 | 6 | 2,4 % |
| Oficina Surtigas - Sede Magangue | 1.435 | 24,3 | 8,2 | 3 | 11,4 % |
| Oficina Surtigas - Sede Corozal | 1.256 | 13,9 | 5,9 | 3 | 1,8 % |
| Oficina Surtigas - Sede Sahagún | 1.246 | 17,7 | 6,8 | 4 | 3,9 % |
| Oficina Surtigas - Carmen de Bolivar | 1.056 | 14,4 | 5,9 | 4 | 5,3 % |
| Oficina Surtigas - Sede Lorica | 916 | 9,2 | 6,3 | 1 | 5,8 % |
| Oficina Surtigas - Mompox | 912 | 14,2 | 6,5 | 3 | 4,9 % |
| Oficina Surtigas - Sede Caucasia | 841 | 12,5 | 6,4 | 3 | 0,8 % |
| Oficina Surtigas - Tolú | 817 | 18,4 | 8,1 | 1 | 6,1 % |
| Oficina Surtigas - Planeta Rica | 414 | 5,7 | 7,1 | 2 | 0,5 % |

---

## 4. Aproximaciones Explícitas del Modelado

1. **Servicios heterogéneos tratados como mezcla agregada:** En Erlang C / Erlang A por franja de 30 min, los trámites heterogéneos se agregan mediante la media ponderada de `TiempoAtencion` limpio de esa oficina y franja, asumiendo llegadas Poisson estacionarias en cada ventana de 30 min.
2. **Validación dinámica con SimPy:** Para capturar variabilidad estocástica y abandono por impaciencia (`ABA`), la simulación de eventos discretos evalúa réplicas calibradas por sede.
3. **Catálogos sintéticos complementarios (`seed/`):** Mallas contractuales, capacidades físicas, competencias y ausencias iniciales (no presentes en el export de Digiturno) se cargan marcados con `is_synthetic=True` y son editables vía API o Excel.
