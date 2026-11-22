import type { DayPlan, Office, SlotStatus, Staff } from '../types';
import { OPERATING_SLOTS, predictArrivals } from '../engine/forecast';
import { calculateRequiredAgents } from '../engine/erlangC';
import { diaSemana, formatoFechaLarga } from '../engine/calendar';
import type { ReglasLaborales } from '../engine/reglas';
import { ST } from '../components/shiftGrid/slotStates';

/**
 * Prepara la malla del día en una estructura plana, común a la exportación
 * a Excel y a la versión imprimible.
 */

export interface FilaColaborador {
  nombre: string;
  cargo: string;
  estados: SlotStatus[];
  manuales: boolean[];
  horas: number;
}

export interface BloqueOficina {
  oficina: Office;
  filas: FilaColaborador[];
  atendiendo: number[];
  requeridos: number[];
}

export interface DatosMalla {
  fecha: string;
  fechaLarga: string;
  franjas: string[];
  estadoPlan: string;
  aprobacion: string | null;
  quincena: boolean;
  reglas: ReglasLaborales;
  bloques: BloqueOficina[];
}

export interface EntradaMalla {
  plan: DayPlan;
  offices: Office[];
  staff: Staff[];
  isFortnight: boolean;
  reglas: ReglasLaborales;
}

const ETIQUETA_ESTADO: Record<DayPlan['estado'], string> = {
  aprobado: 'Aprobado',
  propuesto: 'Propuesto por el motor',
  borrador: 'Borrador',
};

export function prepararMalla({ plan, offices, staff, isFortnight, reglas }: EntradaMalla): DatosMalla {
  const franjas = OPERATING_SLOTS;
  const dia = diaSemana(plan.fecha);

  const bloques = offices
    .map((oficina): BloqueOficina => {
      const filas = staff
        .filter((s) => s.oficinaBaseId === oficina.id && plan.turnos[s.id])
        .map((s) => {
          const turno = plan.turnos[s.id];
          const estados = franjas.map((t) => turno.slots[t]?.estado ?? 'atencion');
          return {
            nombre: s.nombre,
            cargo: s.cargo,
            estados,
            manuales: franjas.map((t) => Boolean(turno.slots[t]?.esModificadoManual)),
            // Horas trabajadas: casillas que cuentan como atención (en esta u otra oficina)
            horas: estados.filter((e) => ST[e].cuenta).length * 0.5,
          };
        });

      // Personas atendiendo en esta oficina por franja (incluye apoyos que llegan de otras sedes)
      const atendiendo = franjas.map(
        (t) =>
          staff.filter((s) => {
            const slot = plan.turnos[s.id]?.slots[t];
            return slot && slot.oficinaAsignadaId === oficina.id && ST[slot.estado].cuenta;
          }).length
      );

      const requeridos = franjas.map((t) => {
        const f = predictArrivals(oficina.id, dia, t, isFortnight);
        return calculateRequiredAgents(
          f.tasaLlegadasHora,
          f.tiempoAtencionPromedioMin,
          oficina.slaObjetivo,
          oficina.tiempoEsperaMaxMin,
          oficina.capacidadPuestos
        ).requiredAgents;
      });

      return { oficina, filas, atendiendo, requeridos };
    })
    .filter((b) => b.filas.length > 0);

  const aud = plan.auditoria;
  const aprobacion =
    plan.estado === 'aprobado' && aud
      ? `${aud.aprobadoPor} · ${new Date(aud.aprobadoEn).toLocaleString('es-CO', {
          dateStyle: 'medium',
          timeStyle: 'short',
        })}`
      : null;

  return {
    fecha: plan.fecha,
    fechaLarga: formatoFechaLarga(plan.fecha),
    franjas,
    estadoPlan: ETIQUETA_ESTADO[plan.estado],
    aprobacion,
    quincena: isFortnight,
    reglas,
    bloques,
  };
}

export const resumenReglas = (r: ReglasLaborales) =>
  `SLA ${Math.round(r.slaObjetivo * 100)}% · espera máx. ${r.tiempoEsperaMaxMin} min · almuerzo ${r.duracionAlmuerzoMin} min · traslado presencial hasta ${r.distanciaMaxPresencialKm} km`;

export const nombreArchivo = (fecha: string, ext: string) => `malla-turnos-surtigas-${fecha}.${ext}`;
