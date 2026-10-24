import type { Alert, Office, Staff, Absence, DayPlan } from '../types';
import { OPERATING_SLOTS, predictArrivals } from './forecast';
import { evaluateErlangC } from './erlangC';

/**
 * Motor de Detección de Alertas Operativas en Vivo
 */
export function evaluateSystemAlerts(
  offices: Office[],
  staffList: Staff[],
  absences: Absence[],
  plan: DayPlan,
  currentSlot: string = '11:00',
  dayOfWeek: number = 1,
  isFortnight: boolean = false
): Alert[] {
  const alerts: Alert[] = [];
  const now = new Date().toISOString();

  // 1. Alertas de ausencias sin cubrir
  const activeAbsences = absences.filter((a) => a.estado === 'activa');
  activeAbsences.forEach((abs) => {
    const staff = staffList.find((s) => s.id === abs.colaboradorId);
    if (!staff) return;
    const office = offices.find((o) => o.id === staff.oficinaBaseId);
    if (!office) return;

    // Verificar si hay refuerzo asignado en la oficina
    let hasReinforcement = false;
    staffList.forEach((s) => {
      const slot = plan.turnos[s.id]?.slots[currentSlot];
      if (
        slot &&
        (slot.estado === 'apoyo_virtual' || slot.estado === 'apoyo_presencial') &&
        slot.oficinaAsignadaId === office.id
      ) {
        hasReinforcement = true;
      }
    });

    if (!hasReinforcement) {
      alerts.push({
        id: `alt-abs-${abs.id}`,
        tipo: 'ausencia_sin_cubrir',
        severidad: office.capacidadPuestos <= 2 ? 'critica' : 'advertencia',
        oficinaId: office.id,
        oficinaNombre: office.nombre,
        titulo: `Ausencia no cubierta: ${staff.nombre}`,
        mensaje: `Incapacidad de ${staff.nombre} en ${office.nombre}. Capacidad operativa reducida a ${office.capacidadPuestos - 1} puestos.`,
        accionSugerida: 'Asignar apoyo virtual desde sede con superávit.',
        accionTipo: 'redistribuir',
        timestamp: now,
        leida: false,
      });
    }
  });

  // 2. Alertas de SLA en riesgo y picos inminentes por oficina
  offices.forEach((office) => {
    // Verificar agentes asignados en el slot actual
    let activeAgents = 0;
    staffList.forEach((s) => {
      const slot = plan.turnos[s.id]?.slots[currentSlot];
      if (
        slot &&
        (slot.estado === 'atencion' ||
          slot.estado === 'apoyo_virtual' ||
          slot.estado === 'apoyo_presencial') &&
        slot.oficinaAsignadaId === office.id
      ) {
        activeAgents++;
      }
    });

    const forecast = predictArrivals(office.id, dayOfWeek, currentSlot, isFortnight);
    const erlang = evaluateErlangC(
      forecast.tasaLlegadasHora,
      forecast.tiempoAtencionPromedioMin,
      activeAgents,
      office.tiempoEsperaMaxMin
    );

    if (erlang.nivelServicio < 0.70) {
      alerts.push({
        id: `alt-sla-${office.id}-${currentSlot}`,
        tipo: 'sla_en_riesgo',
        severidad: 'critica',
        oficinaId: office.id,
        oficinaNombre: office.nombre,
        titulo: `SLA Crítico en ${office.nombre} (${Math.round(erlang.nivelServicio * 100)}%)`,
        mensaje: `La demanda de ${forecast.tasaLlegadasHora} cli/h excede la capacidad de ${activeAgents} agentes. Espera esperada: ${Math.round(erlang.tiempoEsperaPromedioMin)} min.`,
        franja: currentSlot,
        accionSugerida: 'Requerir apoyo virtual inmediato o autorizar sobrecupo.',
        accionTipo: 'redistribuir',
        timestamp: now,
        leida: false,
      });
    } else if (erlang.nivelServicio < office.slaObjetivo) {
      alerts.push({
        id: `alt-sla-${office.id}-${currentSlot}`,
        tipo: 'sla_en_riesgo',
        severidad: 'advertencia',
        oficinaId: office.id,
        oficinaNombre: office.nombre,
        titulo: `Nivel de Servicio en Riesgo en ${office.nombre}`,
        mensaje: `SLA proyectado de ${Math.round(erlang.nivelServicio * 100)}% por debajo de la meta del ${Math.round(office.slaObjetivo * 100)}%.`,
        franja: currentSlot,
        accionSugerida: 'Verificar redistribuciones sugeridas.',
        accionTipo: 'redistribuir',
        timestamp: now,
        leida: false,
      });
    }

    // 3. Pico inminente en la siguiente hora
    const nextSlotIndex = OPERATING_SLOTS.indexOf(currentSlot) + 2;
    if (nextSlotIndex < OPERATING_SLOTS.length) {
      const nextSlot = OPERATING_SLOTS[nextSlotIndex];
      const nextForecast = predictArrivals(office.id, dayOfWeek, nextSlot, isFortnight);
      if (nextForecast.esPico && nextForecast.tasaLlegadasHora > forecast.tasaLlegadasHora * 1.25) {
        alerts.push({
          id: `alt-peak-${office.id}-${nextSlot}`,
          tipo: 'pico_inminente',
          severidad: 'advertencia',
          oficinaId: office.id,
          oficinaNombre: office.nombre,
          titulo: `Pico inminente en 1h (${nextSlot})`,
          mensaje: `Se proyecta incremento del 25%+ en afluencia (${nextForecast.tasaLlegadasHora} cli/h) para ${office.nombre}.`,
          franja: nextSlot,
          accionSugerida: 'Preparar ventanilla adicional o validar fin de almuerzos.',
          accionTipo: 'ajustar_almuerzo',
          timestamp: now,
          leida: false,
        });
      }
    }

    // 4. Verificación de oficinas sin agentes en almuerzos
    const lunchSlots = ['12:00', '12:30', '13:00', '13:30'];
    lunchSlots.forEach((lSlot) => {
      let agentsInLunchSlot = 0;
      staffList.forEach((s) => {
        const slot = plan.turnos[s.id]?.slots[lSlot];
        if (
          slot &&
          (slot.estado === 'atencion' ||
            slot.estado === 'apoyo_virtual' ||
            slot.estado === 'apoyo_presencial') &&
          slot.oficinaAsignadaId === office.id
        ) {
          agentsInLunchSlot++;
        }
      });

      if (agentsInLunchSlot === 0 && office.estado === 'abierta') {
        alerts.push({
          id: `alt-lunch-${office.id}-${lSlot}`,
          tipo: 'almuerzo_descubierto',
          severidad: 'critica',
          oficinaId: office.id,
          oficinaNombre: office.nombre,
          titulo: `Oficina descubierta en franja ${lSlot}`,
          mensaje: `No hay personal asignado para atención en ${office.nombre} durante el intervalo ${lSlot}.`,
          franja: lSlot,
          accionSugerida: 'Escalonar los turnos de almuerzo en la malla.',
          accionTipo: 'ajustar_almuerzo',
          timestamp: now,
          leida: false,
        });
      }
    });
  });

  return alerts;
}
