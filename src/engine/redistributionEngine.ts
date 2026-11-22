import type { Office, Staff, DayPlan, RedistributionRecommendation } from '../types';
import { predictArrivals } from './forecast';
import { calculateRequiredAgents, evaluateErlangC } from './erlangC';

/**
 * Distancia en km mediante fórmula de Haversine
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Radio de la Tierra en km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(1));
}

export interface OfficeBalance {
  oficina: Office;
  agentesAsignados: number;
  agentesRequeridos: number;
  balance: number; // >0 superávit, <0 déficit
  franjaCritica: string;
  lambdaFranja: number;
  tiempoAtencionMin: number;
  slaActual: number;
}

/**
 * Analiza el balance de oferta vs demanda en una franja pico (ej. 10:30 o 11:30)
 */
export function analyzeOfficeBalances(
  offices: Office[],
  staffList: Staff[],
  plan: DayPlan,
  franja: string = '11:00',
  dayOfWeek: number = 1,
  isFortnight: boolean = false
): OfficeBalance[] {
  return offices.map((office) => {
    // Agentes activos en la franja
    let assigned = 0;
    staffList.forEach((s) => {
      const slot = plan.turnos[s.id]?.slots[franja];
      if (
        slot &&
        (slot.estado === 'atencion' ||
          slot.estado === 'apoyo_presencial' ||
          slot.estado === 'apoyo_virtual') &&
        slot.oficinaAsignadaId === office.id
      ) {
        assigned++;
      }
    });

    const forecast = predictArrivals(office.id, dayOfWeek, franja, isFortnight);
    const erlangReq = calculateRequiredAgents(
      forecast.tasaLlegadasHora,
      forecast.tiempoAtencionPromedioMin,
      office.slaObjetivo,
      office.tiempoEsperaMaxMin,
      office.capacidadPuestos
    );

    const evalCurrent = evaluateErlangC(
      forecast.tasaLlegadasHora,
      forecast.tiempoAtencionPromedioMin,
      assigned,
      office.tiempoEsperaMaxMin
    );

    return {
      oficina: office,
      agentesAsignados: assigned,
      agentesRequeridos: erlangReq.requiredAgents,
      balance: assigned - erlangReq.requiredAgents,
      franjaCritica: franja,
      lambdaFranja: forecast.tasaLlegadasHora,
      tiempoAtencionMin: forecast.tiempoAtencionPromedioMin,
      slaActual: evalCurrent.nivelServicio,
    };
  });
}

/** Cobertura de una oficina: agentes asignados sobre agentes requeridos (1 = justo lo necesario). */
const cobertura = (asignados: number, requeridos: number) => asignados / Math.max(1, requeridos);

/** Máximo de traslados que se proponen por corrida, para que la lista sea accionable. */
const MAX_RECOMENDACIONES = 6;
/** Beneficio neto mínimo (minutos de espera ahorrados a clientes por hora) para proponer un traslado. */
const BENEFICIO_MINIMO = 20;

/** Tope de la espera en régimen estable: más allá se considera colapso. */
const ESPERA_COLAPSO_MIN = 45;

/**
 * Espera media estimada por cliente (min) con `agentes` atendiendo.
 * - Si la oficina da abasto, Erlang C (con tope de 45 min).
 * - Si está saturada, Erlang C no tiene solución (la fila crece sin límite); se usa un
 *   modelo de flujo: durante una hora la fila crece a ritmo (λ − c·μ) y cada cliente espera,
 *   en promedio, la mitad de ese acumulado dividido por la capacidad. Se suma al tope de
 *   colapso para que más gente siempre signifique menos espera.
 */
export function esperaEstimadaMin(b: OfficeBalance, agentes: number): number {
  const mu = 60 / b.tiempoAtencionMin;
  const capacidad = agentes * mu;
  if (capacidad > b.lambdaFranja) {
    const r = evaluateErlangC(b.lambdaFranja, b.tiempoAtencionMin, agentes, b.oficina.tiempoEsperaMaxMin);
    return Math.min(ESPERA_COLAPSO_MIN, r.tiempoEsperaPromedioMin);
  }
  if (capacidad <= 0) return ESPERA_COLAPSO_MIN + 240;
  return ESPERA_COLAPSO_MIN + (((b.lambdaFranja - capacidad) / 2) / capacidad) * 60;
}

/** Minutos de espera acumulados por hora en una oficina: llegadas × espera media. */
const esperaTotal = (b: OfficeBalance, agentes: number) => b.lambdaFranja * esperaEstimadaMin(b, agentes);

/**
 * Propone traslados entre oficinas para equilibrar la carga en la franja pico.
 *
 * En días de alta demanda casi todas las oficinas quedan por debajo de lo requerido,
 * así que no basta con buscar oficinas "con sobrante". Para cada posible traslado se
 * calcula cuántos minutos de espera se ahorran los clientes del destino y cuántos se
 * agregan a los del origen (Erlang C); se propone el de mayor beneficio neto, se
 * actualiza el balance y se repite.
 * - El origen siempre conserva al menos una persona atendiendo.
 * - Es presencial si la distancia está dentro del límite configurado y el destino tiene un
 *   puesto libre; si no, el apoyo es virtual.
 */
export function generateRedistributionRecommendations(
  offices: Office[],
  staffList: Staff[],
  plan: DayPlan,
  franja: string = '11:00',
  dayOfWeek: number = 1,
  isFortnight: boolean = false,
  maxPresencialKm: number = 45
): RedistributionRecommendation[] {
  const balances = analyzeOfficeBalances(offices, staffList, plan, franja, dayOfWeek, isFortnight);
  // Copia de trabajo: se va actualizando a medida que se proponen traslados
  const estado = new Map(balances.map((b) => [b.oficina.id, { ...b }]));
  const recommendations: RedistributionRecommendation[] = [];
  const usados = new Set<string>();

  const disponiblesEn = (oficinaId: string) =>
    staffList.filter(
      (s) =>
        s.oficinaBaseId === oficinaId &&
        !usados.has(s.id) &&
        plan.turnos[s.id]?.slots[franja]?.estado === 'atencion'
    );

  while (recommendations.length < MAX_RECOMENDACIONES) {
    const lista = [...estado.values()];
    let propuesta: { origen: OfficeBalance; destino: OfficeBalance; neto: number; distKm: number } | null = null;

    for (const destino of lista) {
      if (destino.agentesAsignados >= destino.agentesRequeridos) continue;
      const ahorro = esperaTotal(destino, destino.agentesAsignados) - esperaTotal(destino, destino.agentesAsignados + 1);

      for (const origen of lista) {
        if (origen.oficina.id === destino.oficina.id || origen.agentesAsignados < 2) continue;
        if (disponiblesEn(origen.oficina.id).length === 0) continue;
        const costo = esperaTotal(origen, origen.agentesAsignados - 1) - esperaTotal(origen, origen.agentesAsignados);
        const neto = ahorro - costo;
        if (neto < BENEFICIO_MINIMO) continue;

        const distKm = calculateDistanceKm(
          destino.oficina.coordenadas.lat,
          destino.oficina.coordenadas.lng,
          origen.oficina.coordenadas.lat,
          origen.oficina.coordenadas.lng
        );
        // Mayor beneficio primero; a igualdad, el origen más cercano
        if (!propuesta || neto > propuesta.neto + 0.5 || (Math.abs(neto - propuesta.neto) <= 0.5 && distKm < propuesta.distKm)) {
          propuesta = { origen, destino, neto, distKm };
        }
      }
    }

    if (!propuesta) break;

    const { origen, destino, distKm } = propuesta;
    const hayPuesto = destino.agentesAsignados < destino.oficina.capacidadPuestos;
    const modalidad: 'presencial' | 'virtual' = distKm <= maxPresencialKm && hayPuesto ? 'presencial' : 'virtual';
    const disponibles = disponiblesEn(origen.oficina.id);
    // Para apoyo virtual se prefiere a quien ya trabaja en modalidad virtual
    const colaborador =
      (modalidad === 'virtual' && disponibles.find((s) => s.modalidad === 'virtual')) || disponibles[0];

    const evalDestinoDespues = evaluateErlangC(
      destino.lambdaFranja,
      destino.tiempoAtencionMin,
      destino.agentesAsignados + 1,
      destino.oficina.tiempoEsperaMaxMin
    );
    const evalOrigenDespues = evaluateErlangC(
      origen.lambdaFranja,
      origen.tiempoAtencionMin,
      origen.agentesAsignados - 1,
      origen.oficina.tiempoEsperaMaxMin
    );

    const reduccion = Math.max(
      0,
      esperaEstimadaMin(destino, destino.agentesAsignados) - esperaEstimadaMin(destino, destino.agentesAsignados + 1)
    );
    const pct = (a: number, r: number) => Math.round(cobertura(a, r) * 100);

    recommendations.push({
      id: `redist-${destino.oficina.id}-${origen.oficina.id}-${colaborador.id}`,
      colaboradorId: colaborador.id,
      colaboradorNombre: colaborador.nombre,
      oficinaOrigenId: origen.oficina.id,
      oficinaOrigenNombre: origen.oficina.nombre,
      oficinaDestinoId: destino.oficina.id,
      oficinaDestinoNombre: destino.oficina.nombre,
      modalidad,
      distanciaKm: distKm,
      esIntermunicipal: destino.oficina.ciudad !== origen.oficina.ciudad,
      franjaInicio: '10:30',
      franjaFin: '13:00',
      motivo:
        `${destino.oficina.nombre} cubre ${pct(destino.agentesAsignados, destino.agentesRequeridos)}% de lo requerido ` +
        `(${destino.agentesAsignados} de ${destino.agentesRequeridos}) en la franja ${franja}; ` +
        `${origen.oficina.nombre} cubre ${pct(origen.agentesAsignados, origen.agentesRequeridos)}% y puede ceder una persona.`,
      impactoEstimado: {
        reduccionEsperaMin: Number(reduccion.toFixed(1)),
        slaProyectadoDestino: evalDestinoDespues.nivelServicio,
        slaOrigenResultante: evalOrigenDespues.nivelServicio,
      },
      estado: 'pendiente',
    });

    usados.add(colaborador.id);
    estado.get(origen.oficina.id)!.agentesAsignados -= 1;
    estado.get(destino.oficina.id)!.agentesAsignados += 1;
  }

  return recommendations;
}
