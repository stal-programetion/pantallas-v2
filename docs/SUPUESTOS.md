# Supuestos, Aproximaciones y Decisiones Abiertas — Surtigas

Este documento registra todos los supuestos técnicos y de negocio identificados durante la **Fase 1 (Auditoría del Frontend)**, de acuerdo con la regla de no inventar información en silencio.

---

## 1. Catálogo de 14 Oficinas (Discrepancia Mock vs. Excel Real)

- **Observación:** El archivo `src/mock/officesData.ts` define 14 oficinas en 5 departamentos (`Bolívar`, `Córdoba`, `Sucre`, `Antioquia`, `Magdalena`), pero solo **9 coinciden** con los datos analizados de `Historicos_Turnos_MAY2026.xlsx`:
  - **Coinciden (9):** Cartagena, Montería, Sincelejo, Magangué, Corozal, Sahagún, El Carmen de Bolívar, Lorica, Caucasia.
  - **En el Excel real pero ausentes en mock (5):** Cereté, Turbaco, Mompox, Tolú, Planeta Rica.
  - **En el mock pero ausentes en el Excel real (5):** San Marcos, Apartadó, Santa Marta, Ciénaga, Fundación.
- **Supuesto propuesto:** Una vez confirmado por el usuario, el backend usará como catálogo maestro las **14 oficinas reales del Excel** (conservando la estructura `Office` de `src/types/index.ts`, con sus coordenadas reales de Bolívar, Córdoba, Sucre y Antioquia). Como los nombres e IDs de oficina provienen del API `/api/v1/offices`, la UI se adaptará automáticamente sin cambios visuales ni de diseño (revisando únicamente valores por defecto como `'cartagena-chambacu'`/`'monteria-centro'` si cambia algún `id`).

## 2. Horarios, Franjas de 30 Minutos y Calendario Laboral

- **Observación:** El Excel real registra llegadas desde las **07:00** (2.310 turnos entre 7:00 y 7:59), pico matutino entre **08:00 y 10:00**, valle al mediodía (**12:00**), segundo pico a las **14:00**, y mayor carga el **lunes** que el **viernes** (19 días hábiles lunes–viernes en mayo 2026). En contraste, el mock actual define `OPERATING_SLOTS` de **08:00 a 16:00** (17 franjas), pico 09:30–11:30 y `DAY_WEIGHTS` con viernes cercano al lunes.
- **Supuesto propuesto:** El motor de pronóstico, colas y ETL procesará la ventana completa real desde las **07:00 hasta las 16:30** (o cierre real observado por oficina). Queda pendiente de aprobación si `ShiftGridPage.tsx` y `DemandAnalysisPage.tsx` amplían su grilla de 17 a 19–20 franjas o mantienen `08:00–16:00` en la malla visual.

## 3. Datos No Presentes en el Excel y Estrategia `seed/` (Ley 1581 de 2012)

- **Observación:** El Excel de Digiturno no contiene mallas contractuales, horarios de almuerzo, ausencias, capacidad física instalada (`capacidadPuestos`), competencias por operador ni matriz de distancias entre oficinas. Además, la columna `Calificacion` es `0` en todo el archivo y será descartada en el ETL.
- **Supuesto propuesto:**
  - En `backend/seed/` se generarán datos iniciales realistas **explícitamente etiquetados como sintéticos/demo** para mallas base, competencias, capacidades por sede (coherentes con el número de terminales/operadores del Excel y la UI) y ausencias iniciales de demostración.
  - Los nombres reales de operadores presentes en `Historicos_Turnos_MAY2026.xlsx` se **seudonimizarán** (`OP-001` / nombres ficticios del `staffData` de demostración) al construir datos de prueba o respuestas de demostración, cumpliendo la **Ley 1581 de 2012**.
  - Las distancias entre sedes se calcularán mediante fórmula de **Haversine** a partir de las coordenadas geográficas de cada oficina, con umbral configurable `maxPresencialKm = 45`.

## 4. Limpieza e Idempotencia en el ETL (`Historicos_Turnos_MAY2026.xlsx`)

- **Supuestos de parseo:**
  - Las fechas en texto español colombiano (ej. `4/05/2026 8:09:38 a. m.`) se normalizarán reemplazando `a. m.`/`p. m.` (incluyendo espacios duros `\xa0` si existen) y parseando en formato `día/mes/año` con zona horaria `America/Bogota`.
  - Se usará `TiempoInicioEspera` como fuente autoritativa de fecha y hora de llegada; la columna duplicada `Fecha` será ignorada.
  - Para estimar el tiempo de servicio (`1/μ`), se usará `TiempoAtencion` de turnos finalizados (`Estado == 'FIN'`), excluyendo valores `<= 0` y recortando atípicos extremos (p. ej. percentil 99 o > 3 horas por sesión abierta olvidada), reportando exactamente cuántos registros fueron excluidos o corregidos en el reporte de calidad de datos.
  - La carga será **idempotente por `IdTurno`**: reimportar el mismo archivo actualizará o ignorará duplicados sin duplicar filas en PostgreSQL.
  - La tasa de abandono histórico se calculará sobre `Estado == 'ABA'` respecto al total de turnos válidos (`FIN + ABA + CAN` o `FIN + ABA`, documentado en `docs/EDA.md`).

## 5. Aproximaciones de los Modelos Matemáticos

1. **Pronóstico de demanda:** Línea base no paramétrica por `(oficina, día_semana, franja_30_min)` calculada sobre las llegadas observadas en mayo 2026, con intervalo de confianza (media ± desviación estándar / t-Student o bootstrap sobre los días hábiles observados) y factor multiplicador de quincena configurable (por defecto `+32%`, calibrable si en los 19 días de mayo se observa diferencia entre días de quincena 14–16/29–31 y días estándar).
2. **Teoría de colas (Erlang C / Erlang A):**
   - El sistema real atiende múltiples trámites heterogéneos (`PQR`, `Facturación`, `Convenio de pago`, `Información`, `Reclamos`, etc.) y tipos de cola (`General`, `Preferencial`, `Empresas`, `Agendado`).
   - **Aproximación explícita:** El modelo analítico **Erlang C / Erlang A** evalúa cada franja de 30 min asumiendo llegadas Poisson estacionarias dentro de la franja y un **tiempo de servicio exponencial homogéneo agregado** (`tiempoAtencionPromedioMin` ponderado por la mezcla de trámites de esa oficina y franja). Cuando se incorpora abandono (`Erlang A`), se estima la tasa de impaciencia `θ` a partir de la relación entre espera y abandonos (`ABA`) históricos. Esta aproximación quedará documentada en `docs/EDA.md` y visible en los tooltips técnicos si corresponde.
3. **Simulación de eventos discretos (SimPy):**
   - Complementa a Erlang C modelando llegadas no estacionarias a lo largo del día, tiempos de atención por distribución empírica/lognormal o exponencial por categoría de trámite, paciencia limitada (abandono si espera supera umbral estocástico) y cambios de capacidad por almuerzos/ausencias.
4. **Motor de asignación y redistribución (OR-Tools CP-SAT / PuLP):**
   - **Reglas duras configurables:** cobertura mínima (`>= 1` agente atendiendo en toda sede abierta, o cobertura remota virtual si es unipersonal en almuerzo), 1 ventana continua de almuerzo de 60 min (2 franjas consecutivas) fuera del pico principal cuando sea posible, respeto de horario contractual y competencias requeridas.
   - **Objetivo blando:** minimizar déficit frente a operadores requeridos por Erlang C/A (espera y abandono), minimizar traslados presenciales innecesarios y balancear carga entre colaboradores.

## 6. Autenticación, Roles y Bandera de Configuración

- **Observación:** El frontend actual implementa 3 roles (`ADMIN`, `COORDINADOR`, `CONSULTA`) sin formulario de usuario/contraseña en `/login` y con selector rápido `"Ver como"` en el menú superior. El prompt menciona `(Coordinador, Supervisor de oficina, Administrador)` y solicita no agregar login si el frontend no tiene uno, dejándolo detrás de una bandera de configuración.
- **Supuesto propuesto:**
  - El backend implementará RBAC completo sobre `ADMIN`, `COORDINADOR` (equivalente operativo al supervisor/coordinador; si se requiere alcance por oficina se añadirá `oficinaAsignadaId` opcional en `User`) y `CONSULTA`.
  - Se expondrá la variable de entorno `AUTH_REQUIRED` (y `AUTH_DEMO_ROLE_SWITCH=true` para el selector rápido del prototipo), permitiendo activar JWT obligatorio con login real en producción sin romper el flujo actual de `/login` ni cambiar el diseño de la pantalla.

## 7. Restricciones de UI y Documentación

- No se rediseñará ni cambiará el aspecto visual de ninguna pantalla.
- Todo ajuste estrictamente necesario en `src/` (configuración de `VITE_API_BASE_URL`, reemplazo de `Mock*Service` por servicios HTTP/SSE, eliminación de llamadas directas a `src/engine/` en páginas, y estados de carga/error) se registrará en `docs/CAMBIOS_FRONTEND.md`.
- No se agregarán botones nuevos (p. ej. carga Excel en UI o edición inline de recomendaciones) sin aprobación explícita previa.

## 8. Prerrequisito Operativo Pendiente

- El archivo `data/Historicos_Turnos_MAY2026.xlsx` **no está actualmente dentro del workspace** (`Pantallas-v2`). Antes de iniciar la Fase 3 (ETL y EDA), deberá ubicarse en `data/Historicos_Turnos_MAY2026.xlsx` (y se añadirá `data/*.xlsx` a `.gitignore` en Fase 2 para evitar subir datos personales a git).
