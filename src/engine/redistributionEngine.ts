import { Office, Staff, DayPlan, RedistributionRecommendation } from '../types';
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

/**
 * Propone redistribuciones inteligentes considerando cercanía y modalidad
 */
export function generateRedistributionRecommendations(
  offices: Office[],
  staffList: Staff[],
  plan: DayPlan,
  franja: string = '11:00',
  dayOfWeek: number = 1,
  isFortnight: boolean = false
): RedistributionRecommendation[] {
  const balances = analyzeOfficeBalances(offices, staffList, plan, franja, dayOfWeek, isFortnight);
  const deficits = balances.filter((b) => b.balance < 0).sort((a, b) => a.balance - b.balance);
  const surpluses = balances.filter((b) => b.balance > 0).sort((a, b) => b.balance - a.balance);

  const recommendations: RedistributionRecommendation[] = [];

  deficits.forEach((def) => {
    // Buscar la oficina con superávit más conveniente (priorizando cercanía geográfica)
    let bestCandidate: {
      surplus: OfficeBalance;
      distKm: number;
      modalidad: 'presencial' | 'virtual';
    } | null = null;

    surpluses.forEach((sur) => {
      if (sur.balance <= 0) return;

      const dist = calculateDistanceKm(
        def.oficina.coordenadas.lat,
        def.oficina.coordenadas.lng,
        sur.oficina.coordenadas.lat,
        sur.oficina.coordenadas.lng
      );

      // Si dist < 45 km, viable presencial; si no, virtual
      const modalidad = dist <= 45 ? 'presencial' : 'virtual';

      if (!bestCandidate || dist < bestCandidate.distKm) {
        bestCandidate = { surplus: sur, distKm: dist, modalidad };
      }
    });

    if (bestCandidate) {
      const sur = (bestCandidate as { surplus: OfficeBalance; distKm: number; modalidad: 'presencial' | 'virtual' }).surplus;
      const modalidad = (bestCandidate as { surplus: OfficeBalance; distKm: number; modalidad: 'presencial' | 'virtual' }).modalidad;
      const distKm = (bestCandidate as { surplus: OfficeBalance; distKm: number; modalidad: 'presencial' | 'virtual' }).distKm;

      // Buscar colaborador disponible en la oficina origen
      const availableStaff = staffList.find(
        (s) =>
          s.oficinaBaseId === sur.oficina.id &&
          plan.turnos[s.id]?.slots[franja]?.estado === 'atencion' &&
          !recommendations.some((r) => r.colaboradorId === s.id)
      );

      if (availableStaff) {
        // Impacto en destino (+1 agente)
        const evalDestinoBefore = evaluateErlangC(
          def.lambdaFranja,
          def.tiempoAtencionMin,
          def.agentesAsignados,
          def.oficina.tiempoEsperaMaxMin
        );
        const evalDestinoAfter = evaluateErlangC(
          def.lambdaFranja,
          def.tiempoAtencionMin,
          def.agentesAsignados + 1,
          def.oficina.tiempoEsperaMaxMin
        );

        // Impacto en origen (-1 agente)
        const evalOrigenAfter = evaluateErlangC(
          sur.lambdaFranja,
          sur.tiempoAtencionMin,
          sur.agentesAsignados - 1,
          sur.oficina.tiempoEsperaMaxMin
        );

        const diffWait = Math.max(
          0,
          evalDestinoBefore.tiempoEsperaPromedioMin - evalDestinoAfter.tiempoEsperaPromedioMin
        );

        const isIntercity = def.oficina.ciudad !== sur.oficina.ciudad;

        recommendations.push({
          id: `redist-${def.oficina.id}-${sur.oficina.id}-${availableStaff.id}`,
          colaboradorId: availableStaff.id,
          colaboradorNombre: availableStaff.nombre,
          oficinaOrigenId: sur.oficina.id,
          oficinaOrigenNombre: sur.oficina.nombre,
          oficinaDestinoId: def.oficina.id,
          oficinaDestinoNombre: def.oficina.nombre,
          modalidad,
          distanciaKm: distKm,
          esIntermunicipal: isIntercity,
          franjaInicio: '10:30',
          franjaFin: '13:00',
          motivo: `Refuerzo de ${def.oficina.nombre} (déficit de ${Math.abs(def.balance)} agentes en hora pico). Origen con superávit de ${sur.balance} puestos.`,
          impactoEstimado: {
            reduccionEsperaMin: Number(diffWait.toFixed(1)),
            slaProyectadoDestino: evalDestinoAfter.nivelServicio,
            slaOrigenResultante: evalOrigenAfter.nivelServicio,
          },
          estado: 'pendiente',
        });

        // Disminuir balance temporal del origen
        sur.balance -= 1;
      }
    }
  });

  return recommendations;
}
