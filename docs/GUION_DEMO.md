# Guion de Demostración de 5 Minutos — Surtigas OptiTurnos (TRL 6)

> **Objetivo:** Mostrar cómo la plataforma reemplaza los ~90 minutos diarios de planeación manual en Excel por optimización matemática (Erlang C/A, SimPy y PuLP MILP), tiempo real vía SSE y soporte auditable a la decisión humana.

---

## Minuto 0:00 – 0:45 | Contexto y Login por Roles (`/login`)
1. Abrir `http://localhost:8080/login` (o `http://localhost:5173/login`).
2. Mostrar los 3 perfiles configurados (`ADMIN`, `COORDINADOR`, `CONSULTA`) y recalcar la protección de datos médicos (Ley 1581 de 2012).
3. Seleccionar **Coordinador de Turnos** (Liliana María Ramos) e ingresar al **Centro de Control**.

## Minuto 0:45 – 1:45 | Dashboard en Tiempo Real (`/dashboard`)
1. Mostrar el resumen ejecutivo de red: oficinas críticas/en riesgo, SLA global, espera promedio, clientes en fila y cobertura.
2. Señalar el indicador **En vivo** en la barra superior: las métricas se actualizan automáticamente desde el backend vía **SSE (`/api/v1/realtime/stream`)** usando `SimulatedLiveSource` calibrado al patrón histórico de mayo 2026 (pico 8–10 h, valle 12 h, segundo pico 14 h).
3. Abrir las pestañas **Carga operativa** y **Tipos de trámite** (tasa de abandono real e intensidad de trámites) y abrir el panel lateral de **Cartagena Chambacú**.

## Minuto 1:45 – 2:45 | Contingencia en Vivo: Ausencia en Cartagena (`/ausencias` → `/redistribucion`)
1. Ir a **Ausencias** (`/ausencias`).
2. Cambiar brevemente el rol a **Consulta** en el menú de usuario superior para demostrar que el backend oculta `diagnosticoSalud` (Ley 1581). Volver a **Coordinador**.
3. Registrar una nueva ausencia para un asesor de **Cartagena Chambacú** (`st-01`).
4. Mostrar que en **< 5 segundos** el backend recalcula la malla, dispara alertas y actualiza **Redistribución** (`/redistribucion`), sugiriendo refuerzo presencial (< 45 km, ej. desde Turbaco) o ventanilla virtual con impacto estimado antes/después.
5. Aceptar una recomendación y mostrar que queda reflejada en la malla y en auditoría.

## Minuto 2:45 – 3:45 | Plan del Día y Malla Interactiva (`/plan-dia` → `/malla`)
1. Abrir **Plan del Día** (`/plan-dia`), recorrer los 5 pasos (Ausencias → Picos previstos → Justificaciones explicables → Redistribuciones → Aprobación) y aprobar el plan.
2. Ir a **Malla de Turnos** (`/malla`), mostrar cómo **PuLP MILP** escalonó los almuerzos (60 min continuos fuera del pico 08:00–10:30) y editar manualmente una casilla viendo el impacto en cobertura en vivo.

## Minuto 3:45 – 5:00 | Demanda, Simulador What-If (SimPy) y Reportes (`/demanda`, `/simulador`, `/reportes`)
1. En **Demanda** (`/demanda`), mostrar el mapa de calor Lunes–Viernes × franjas de 30 min (lunes más cargado que viernes, valle a las 12:00).
2. En **Simulador Erlang C / SimPy** (`/simulador`), subir ausencias adicionales (+2) y demanda (+20%) en Cartagena: observar la caída proyectada de SLA, subida de espera y tasa de abandono estimada.
3. Finalizar en **Reportes** (`/reportes`) descargando el consolidado CSV/Excel listo para gerencia.
