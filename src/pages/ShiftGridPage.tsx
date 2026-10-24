import React, { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { useAuthStore } from '../store/useAuthStore';
import { OPERATING_SLOTS, predictArrivals } from '../engine/forecast';
import { calculateRequiredAgents } from '../engine/erlangC';
import { validateShiftSlotChange } from '../engine/assignmentEngine';
import type { Office, SlotStatus, Staff } from '../types';

/* ------------------------------------------------------------------ */
/*  Constantes del diseño aprobado                                     */
/* ------------------------------------------------------------------ */

/** Día de la semana que usa el motor del store para generar el plan (jueves). */
const DAY_OF_WEEK = 4;
const PEAK = ['10:00', '10:30', '11:00', '11:30'];
const isLunchSlot = (t: string) => t >= '12:00' && t <= '13:30';
const isPeakSlot = (t: string) => PEAK.includes(t);

const ORDER: SlotStatus[] = [
  'atencion',
  'almuerzo',
  'apoyo_virtual',
  'apoyo_presencial',
  'pausa',
  'libre',
  'ausente',
];

interface StateInfo {
  label: string;
  code: string;
  bg: string;
  fg: string;
  border: string;
  cuenta: boolean;
  short: string;
  desc: string;
}

const ST: Record<SlotStatus, StateInfo> = {
  atencion: {
    label: 'Atención', code: 'AT', bg: '#1f6496', fg: '#ffffff', border: '#1f6496', cuenta: true,
    short: 'En su puesto atendiendo clientes.',
    desc: 'Está en su puesto atendiendo clientes en la oficina. Es el estado normal de trabajo.',
  },
  almuerzo: {
    label: 'Almuerzo', code: 'AL', bg: '#f7c548', fg: '#3d2a00', border: '#d9a521', cuenta: false,
    short: 'Hora de almuerzo (1 hora = 2 casillas).',
    desc: 'Hora de almuerzo. El motor los escalona entre 12:00 y 14:00 para que nunca salgan todos a la vez.',
  },
  apoyo_virtual: {
    label: 'Apoyo virtual', code: 'AV', bg: '#256f6d', fg: '#ffffff', border: '#256f6d', cuenta: true,
    short: 'Atiende remoto (video o chat) a esta oficina.',
    desc: 'Atiende de forma remota (video o chat). Se usa para reforzar horas pico o cubrir un almuerzo.',
  },
  apoyo_presencial: {
    label: 'Apoyo físico', code: 'AF', bg: '#2e3d82', fg: '#ffffff', border: '#2e3d82', cuenta: true,
    short: 'Se traslada a apoyar en otra sede.',
    desc: 'Se traslada físicamente a reforzar otra oficina durante esta franja.',
  },
  pausa: {
    label: 'Pausa', code: 'PA', bg: '#cfeefa', fg: '#0b4a66', border: '#7cc9ea', cuenta: false,
    short: 'Pausa activa corta, vuelve enseguida.',
    desc: 'Pausa corta (activa o de descanso). No atiende, pero vuelve en la siguiente franja.',
  },
  libre: {
    label: 'Libre', code: 'LI', bg: '#eef0f4', fg: '#3f4a5c', border: '#b4bccb', cuenta: false,
    short: 'Fuera de su horario de contrato.',
    desc: 'Fuera de su horario de contrato (llega tarde o sale temprano). No está en la oficina.',
  },
  ausente: {
    label: 'Ausente', code: 'AU',
    bg: 'repeating-linear-gradient(135deg, #fde2e1 0 5px, #f6c2bf 5px 10px)',
    fg: '#8a1414', border: '#e19995', cuenta: false,
    short: 'Incapacidad, permiso o licencia.',
    desc: 'No vino por incapacidad, permiso o licencia. Se registra desde la pantalla de Ausencias.',
  },
};

/** Colores semánticos de cobertura (no cambian con la marca: significan suficiente / falta / sin nadie). */
const COV = {
  ok: { bg: '#dcf2e3', fg: '#14532d', border: '1px solid #5fb37c' },
  low: { bg: '#ffe4cc', fg: '#7a2b05', border: '2px solid #e07a2e' },
  zero: { bg: '#9b1c1c', fg: '#ffffff', border: '1px solid #9b1c1c' },
} as const;

/** Cian de marca (logo) para guía, selección y punto de "cambiado a mano". */
const CYAN = '#1b9ad2';

const FONT_SANS = "'IBM Plex Sans', 'Inter', system-ui, sans-serif";
const FONT_MONO = "'IBM Plex Mono', ui-monospace, monospace";

const TOUR_KEY = 'optiturnos.malla.guia';

const STEPS = [
  {
    title: 'Elige la oficina que quieres revisar',
    text: 'La malla muestra una oficina a la vez para que sea fácil de leer. Si una oficina tiene un número naranja, significa que hay franjas donde le falta gente.',
  },
  {
    title: 'Aprende qué significa cada casilla',
    text: 'Cada color y sigla es una actividad. Lo importante es la marca «✓ cuenta»: solo Atención, Apoyo virtual y Apoyo físico suman gente atendiendo. Almuerzo, Pausa, Libre y Ausente no suman.',
  },
  {
    title: 'Lee la malla como un horario',
    text: 'Cada fila es una persona y cada columna es media hora, de 08:00 a 16:00. Lee de izquierda a derecha para ver el día de alguien; lee de arriba a abajo para ver quién está en una hora concreta.',
  },
  {
    title: 'Revisa la fila de cobertura',
    text: 'Debajo de las personas está la fila «Cobertura»: cuántos atienden en esa media hora contra cuántos se necesitan según la demanda prevista. Verde: suficiente. Naranja: falta gente y se forma fila. Rojo oscuro: la oficina queda sola.',
  },
  {
    title: 'Corrige con un clic y mira el impacto',
    text: 'Toca una casilla para cambiar lo que hace esa persona. Antes de confirmar, el panel de la derecha te muestra cómo quedaría la cobertura de la oficina en esa media hora.',
  },
  {
    title: 'Si te equivocas, restaura',
    text: 'Cada cambio hecho a mano queda marcado con un punto en la casilla y se cuenta arriba. Con «Restaurar propuesta del motor» vuelves al plan original con un clic.',
  },
];

/* ------------------------------------------------------------------ */
/*  Utilidades                                                         */
/* ------------------------------------------------------------------ */

const addHalfHour = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  const total = h * 60 + m + 30;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

const firstName = (full: string) => full.trim().split(/\s+/)[0];

const readTour = (): boolean => {
  try {
    return localStorage.getItem(TOUR_KEY) !== 'oculta';
  } catch {
    return true;
  }
};

const writeTour = (visible: boolean) => {
  try {
    localStorage.setItem(TOUR_KEY, visible ? 'visible' : 'oculta');
  } catch {
    /* sin almacenamiento: se ignora */
  }
};

const btnBase: React.CSSProperties = {
  font: 'inherit',
  minHeight: 44,
  borderRadius: 10,
  cursor: 'pointer',
};

const chipStyle = (st: SlotStatus, size: number): React.CSSProperties => ({
  width: size,
  height: size,
  flex: '0 0 auto',
  borderRadius: 8,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: FONT_MONO,
  fontSize: 12,
  fontWeight: 600,
  background: ST[st].bg,
  color: ST[st].fg,
  border: `1px ${st === 'libre' ? 'dashed' : 'solid'} ${ST[st].border}`,
  boxSizing: 'border-box',
});

/* ------------------------------------------------------------------ */
/*  Página                                                             */
/* ------------------------------------------------------------------ */

export const ShiftGridPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    offices,
    staff,
    currentPlan,
    selectedDate,
    isFortnight,
    isLoading,
    updateSlot,
    resetPlanToProposal,
    showToast,
  } = useAppStore();
  const { canEditShifts } = useAuthStore();
  const canEdit = canEditShifts();

  const [pickedOfficeId, setPickedOfficeId] = useState<string | null>(null);
  const [sel, setSel] = useState<{ pid: string; t: string } | null>(null);
  const [pending, setPending] = useState<SlotStatus | null>(null);
  const [applying, setApplying] = useState(false);
  const [tourOn, setTourOn] = useState<boolean>(readTour);
  const [step, setStep] = useState(0);

  const slots = OPERATING_SLOTS;

  /* ---- Personal necesario por franja: Erlang C del proyecto ---- */
  const requiredByOffice = useMemo(() => {
    const map: Record<string, number[]> = {};
    offices.forEach((o) => {
      map[o.id] = slots.map((t) => {
        const f = predictArrivals(o.id, DAY_OF_WEEK, t, isFortnight);
        return calculateRequiredAgents(
          f.tasaLlegadasHora,
          f.tiempoAtencionPromedioMin,
          o.slaObjetivo,
          o.tiempoEsperaMaxMin,
          o.capacidadPuestos
        ).requiredAgents;
      });
    });
    return map;
  }, [offices, isFortnight, slots]);

  /** Estado de una persona en una franja (con valor por defecto si el plan no la trae). */
  const stateOf = useCallback(
    (colabId: string, t: string): SlotStatus => currentPlan?.turnos[colabId]?.slots[t]?.estado ?? 'atencion',
    [currentPlan]
  );

  /** Quiénes atienden en una oficina y franja (incluye apoyo recibido de otras sedes). */
  const activeAt = useCallback(
    (officeId: string, t: string, skipId?: string) => {
      let n = 0;
      let external = 0;
      staff.forEach((s) => {
        if (s.id === skipId) return;
        const slot = currentPlan?.turnos[s.id]?.slots[t];
        if (!slot) return;
        const target = slot.oficinaAsignadaId || s.oficinaBaseId;
        if (target === officeId && ST[slot.estado].cuenta) {
          n++;
          if (s.oficinaBaseId !== officeId) external++;
        }
      });
      return { n, external };
    },
    [staff, currentPlan]
  );

  /** Franjas con faltante por oficina (para el número naranja del selector). */
  const deficitsByOffice = useMemo(() => {
    const map: Record<string, { t: string; a: number; r: number }[]> = {};
    offices.forEach((o) => {
      map[o.id] = [];
      slots.forEach((t, i) => {
        const a = activeAt(o.id, t).n;
        const r = requiredByOffice[o.id]?.[i] ?? 0;
        if (a < r) map[o.id].push({ t, a, r });
      });
    });
    return map;
  }, [offices, slots, activeAt, requiredByOffice]);

  const officeId =
    pickedOfficeId ??
    offices.find((o) => (deficitsByOffice[o.id]?.length ?? 0) > 0)?.id ??
    offices[0]?.id ??
    '';
  const office: Office | undefined = offices.find((o) => o.id === officeId);

  const officeStaff = useMemo(
    () => staff.filter((s) => s.oficinaBaseId === officeId),
    [staff, officeId]
  );

  const isAbsentAllDay = useCallback(
    (s: Staff) => {
      const sl = currentPlan?.turnos[s.id]?.slots;
      if (!sl) return s.estadoHoy === 'ausente';
      return slots.every((t) => sl[t]?.estado === 'ausente');
    },
    [currentPlan, slots]
  );

  const manualCount = useMemo(() => {
    let n = 0;
    if (currentPlan) {
      Object.values(currentPlan.turnos).forEach((sh) =>
        Object.values(sh.slots).forEach((sl) => {
          if (sl.esModificadoManual) n++;
        })
      );
    }
    return n;
  }, [currentPlan]);

  /* ---- Carga / sin datos ---- */
  if (!office || !currentPlan) {
    return (
      <div
        className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-600"
        style={{ fontFamily: FONT_SANS }}
      >
        <p className="text-lg font-semibold text-slate-900">
          {isLoading ? 'Cargando la malla de turnos…' : 'Todavía no hay un plan del día para mostrar.'}
        </p>
        {!isLoading && (
          <button
            onClick={() => navigate('/plan-dia')}
            style={{ ...btnBase, padding: '0 20px', border: 0, background: '#1f6496', color: '#fff', fontWeight: 600, marginTop: 16 }}
          >
            Ir al Plan del día
          </button>
        )}
      </div>
    );
  }

  /* ---- Derivados de la oficina elegida ---- */
  const required = requiredByOffice[office.id] ?? [];
  const defs = deficitsByOffice[office.id] ?? [];
  const absentCount = officeStaff.filter(isAbsentAllDay).length;
  const activeCount = officeStaff.length - absentCount;
  const coverage = slots.map((t, i) => {
    const { n, external } = activeAt(office.id, t);
    const r = required[i] ?? 0;
    const kind: 'ok' | 'low' | 'zero' = n === 0 ? 'zero' : n < r ? 'low' : 'ok';
    return { t, a: n, r, kind, external };
  });

  const ringStyle = (i: number): React.CSSProperties =>
    tourOn && step === i ? { outline: `3px solid ${CYAN}`, outlineOffset: 3 } : {};

  /* ---- Textos dinámicos de la guía (con datos reales) ---- */
  const officeWithDeficit = offices.find((o) => (deficitsByOffice[o.id]?.length ?? 0) > 0);
  const d0 = defs[0];
  const lunchPerson = d0
    ? officeStaff.find((p) => stateOf(p.id, d0.t) === 'almuerzo')
    : undefined;
  const stepTry = [
    officeWithDeficit
      ? `Toca «${officeWithDeficit.nombre}»: tiene ${deficitsByOffice[officeWithDeficit.id].length} ${
          deficitsByOffice[officeWithDeficit.id].length === 1 ? 'franja' : 'franjas'
        } con faltante.`
      : 'Toca cualquier oficina y observa cómo cambia la malla.',
    'Busca en la leyenda el estado Ausente (AU, rayado) y luego encuéntralo en la malla de una oficina con ausencias.',
    'Mira la columna 12:00 a 14:00 (fondo amarillo): fíjate que los almuerzos están repartidos, nunca salen todos juntos.',
    d0
      ? `En ${office.nombre}, la columna ${d0.t} está en ${d0.a === 0 ? 'rojo' : 'naranja'}: ${d0.a} atendiendo de ${d0.r} necesarios.`
      : 'Esta oficina no tiene faltantes. Elige otra con número naranja y busca la columna en naranja o rojo.',
    d0 && lunchPerson
      ? `Toca la casilla de ${firstName(lunchPerson.nombre)} a las ${d0.t} y elige Atención. Verás que la cobertura pasa de ${d0.a} a ${d0.a + 1}.`
      : 'Toca cualquier casilla de Almuerzo y mira qué le pasa a la cobertura si esa persona vuelve a Atención.',
    'Haz un par de cambios, mira el contador de «Cambios manuales» y luego pulsa «Restaurar».',
  ];

  const suggestion = (() => {
    if (defs.length === 0) {
      return 'Esta oficina tiene cobertura suficiente en todas las franjas. No hace falta cambiar nada.';
    }
    return (
      `A las ${defs[0].t} hay ${defs[0].a} de ${defs[0].r} necesarios.` +
      (lunchPerson
        ? ` Prueba pasar a ${firstName(lunchPerson.nombre)} a Atención en esa franja y mover su almuerzo a una franja verde.`
        : ' Asigna apoyo virtual desde otra oficina.')
    );
  })();

  /* ---- Editor ---- */
  const person = sel ? officeStaff.find((p) => p.id === sel.pid) : undefined;
  const selT = sel?.t ?? '';
  const cur: SlotStatus = person ? stateOf(person.id, selT) : 'atencion';
  const pend: SlotStatus = pending ?? cur;
  const selIdx = slots.indexOf(selT);
  const selSlot = person ? currentPlan.turnos[person.id]?.slots[selT] : undefined;
  const slotOfficeId = selSlot?.oficinaAsignadaId || office.id;
  const before = sel ? activeAt(office.id, selT).n : 0;
  const others = sel && person ? activeAt(office.id, selT, person.id).n : 0;
  const after = others + (ST[pend].cuenta && slotOfficeId === office.id ? 1 : 0);
  const reqSel = required[selIdx] ?? 0;
  const noChange = pend === cur;
  const absentCell = cur === 'ausente';

  let impactMsg = '';
  let impactBox: React.CSSProperties = {};
  if (sel) {
    if (after === 0) {
      impactMsg = `La oficina quedaría sin nadie atendiendo a las ${selT}. Asigna apoyo virtual o mueve este almuerzo.`;
      impactBox = { background: '#9b1c1c', color: '#ffffff' };
    } else if (after < reqSel) {
      const f = reqSel - after;
      impactMsg = `Faltaría${f > 1 ? 'n' : ''} ${f} persona${f > 1 ? 's' : ''} para lo que pide la demanda. Es probable que se forme fila.`;
      impactBox = { background: '#ffe4cc', color: '#5c1f02', border: '2px solid #e07a2e' };
    } else {
      impactMsg =
        after > before
          ? 'Mejora la cobertura: la oficina queda con lo necesario o más.'
          : 'La oficina sigue con cobertura suficiente en esta franja.';
      impactBox = { background: '#dcf2e3', color: '#12401f', border: '1px solid #5fb37c' };
    }
  }

  const openCell = (p: Staff, t: string) => {
    if (!canEdit) {
      showToast('Tu rol es de solo lectura. Puedes consultar la malla, pero no modificarla.', 'warning');
      return;
    }
    setSel({ pid: p.id, t });
    setPending(stateOf(p.id, t));
  };

  const closeEditor = () => {
    setSel(null);
    setPending(null);
  };

  const applyChange = async () => {
    if (!sel || !person || noChange || absentCell || applying || !canEdit) return;
    setApplying(true);
    try {
      const v = validateShiftSlotChange(currentPlan, person.id, sel.t, pend, offices, staff);
      if (!v.isValid) {
        showToast(v.warningMessage ?? 'No se puede aplicar este cambio.', 'error');
        return;
      }
      await updateSlot(person.id, sel.t, pend);
      if (v.warningMessage) {
        showToast(v.warningMessage, 'warning');
      } else {
        showToast(`${firstName(person.nombre)} a las ${sel.t}: ${ST[pend].label}.`, 'success');
      }
      closeEditor();
    } finally {
      setApplying(false);
    }
  };

  const hideTour = () => {
    setTourOn(false);
    writeTour(false);
  };
  const showTour = () => {
    setTourOn(true);
    setStep(0);
    writeTour(true);
  };

  const dateLabel = (() => {
    const d = new Date(`${selectedDate}T12:00:00`);
    const txt = d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
    return txt.charAt(0).toUpperCase() + txt.slice(1);
  })();
  const planLabel =
    currentPlan.estado === 'aprobado'
      ? 'Plan aprobado'
      : currentPlan.estado === 'borrador'
        ? 'Borrador del plan'
        : 'Plan propuesto por el motor';

  const gridCols = `220px repeat(${slots.length}, minmax(44px, 1fr))`;
  const card: React.CSSProperties = {
    background: '#ffffff',
    border: '1px solid #d6dfeb',
    borderRadius: 16,
  };

  return (
    <div
      style={{
        fontFamily: FONT_SANS,
        color: '#0f1b2d',
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
      }}
    >
      {/* ===== Encabezado ===== */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5 max-w-[720px]">
          <span style={{ fontSize: 13, color: '#5a6b82', fontWeight: 500 }}>
            {dateLabel} · {planLabel}
          </span>
          <h1 style={{ margin: 0, fontSize: 30, lineHeight: 1.15, fontWeight: 700, letterSpacing: '-.01em' }}>
            Malla de turnos
          </h1>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: '#3d4c63' }}>
            Quién está haciendo qué, cada media hora, en cada oficina. Úsala para asegurarte de que{' '}
            <strong>ninguna oficina se quede sin gente atendiendo</strong>, sobre todo en almuerzo y horas pico.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {!tourOn && (
            <button
              onClick={showTour}
              style={{ ...btnBase, fontSize: 14, fontWeight: 600, padding: '0 16px', border: '1px solid #b9c7da', background: '#fff', color: '#1f6496' }}
            >
              ¿Cómo se usa? Ver guía
            </button>
          )}
          <div style={{ borderRadius: 12, ...(tourOn && step === 5 ? { outline: `3px solid ${CYAN}`, outlineOffset: 3 } : {}) }}>
            <button
              onClick={() => resetPlanToProposal()}
              disabled={manualCount === 0 || !canEdit}
              style={{
                ...btnBase,
                fontSize: 14,
                fontWeight: 600,
                padding: '0 16px',
                border: '1px solid #b9c7da',
                background: '#fff',
                color: manualCount && canEdit ? '#0f1b2d' : '#8b97a8',
                cursor: manualCount && canEdit ? 'pointer' : 'not-allowed',
              }}
            >
              Restaurar propuesta del motor{manualCount ? ` (${manualCount})` : ''}
            </button>
          </div>
        </div>
      </header>

      {!canEdit && (
        <div
          role="status"
          style={{ background: '#e8f6fc', border: '1px solid #86bfe2', color: '#0b4a66', borderRadius: 12, padding: '12px 16px', fontSize: 14 }}
        >
          <strong>Modo solo lectura.</strong> Tu rol puede consultar la malla y la cobertura, pero no cambiar casillas.
        </div>
      )}

      {/* ===== Guía paso a paso ===== */}
      {tourOn && (
        <section aria-label="Guía paso a paso" style={{ ...card, padding: '20px 22px' }} className="flex flex-wrap items-stretch gap-x-7 gap-y-5">
          <div className="flex flex-col gap-3" style={{ flex: '1 1 260px' }}>
            <div className="flex items-center justify-between gap-3">
              <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: '#1f6496' }}>
                Guía rápida · Paso {step + 1} de {STEPS.length}
              </span>
              <button
                onClick={hideTour}
                style={{ font: 'inherit', fontSize: 13, color: '#5a6b82', background: 'transparent', border: 0, minHeight: 44, padding: '0 6px', cursor: 'pointer', textDecoration: 'underline' }}
              >
                Ocultar guía
              </button>
            </div>
            <ol className="flex flex-wrap gap-1.5" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {STEPS.map((s, i) => {
                const on = i === step;
                const done = i < step;
                return (
                  <li key={s.title}>
                    <button
                      onClick={() => setStep(i)}
                      aria-label={`Ir al paso ${i + 1}: ${s.title}`}
                      aria-current={on ? 'step' : undefined}
                      style={{
                        font: 'inherit', width: 44, height: 44, borderRadius: 22, cursor: 'pointer', fontWeight: 700, fontSize: 15, fontFamily: FONT_MONO,
                        ...(on
                          ? { background: '#1f6496', color: '#fff', border: '2px solid #1f6496' }
                          : done
                            ? { background: '#e6f3fb', color: '#1f6496', border: '2px solid #86bfe2' }
                            : { background: '#fff', color: '#5a6b82', border: '2px solid #d6dfeb' }),
                      }}
                    >
                      {i + 1}
                    </button>
                  </li>
                );
              })}
            </ol>
            <h2 style={{ margin: '4px 0 0', fontSize: 20, lineHeight: 1.25, fontWeight: 700 }}>{STEPS[step].title}</h2>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, color: '#3d4c63' }}>{STEPS[step].text}</p>
            <div className="flex gap-2.5 mt-auto pt-1">
              <button
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={step === 0}
                style={{ ...btnBase, fontSize: 14, fontWeight: 600, padding: '0 18px', border: '1px solid #b9c7da', background: '#fff', color: step === 0 ? '#8b97a8' : '#0f1b2d', cursor: step === 0 ? 'not-allowed' : 'pointer' }}
              >
                Anterior
              </button>
              <button
                onClick={() => {
                  if (step < STEPS.length - 1) setStep(step + 1);
                  else {
                    hideTour();
                    setStep(0);
                  }
                }}
                style={{ ...btnBase, fontSize: 14, fontWeight: 600, padding: '0 20px', border: 0, background: '#1f6496', color: '#fff' }}
              >
                {step === STEPS.length - 1 ? 'Terminar guía' : 'Siguiente'}
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-2.5" style={{ flex: '1 1 300px', background: '#f6f8fb', borderRadius: 12, padding: '16px 18px' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#3d4c63' }}>Prueba esto ahora</span>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55 }}>{stepTry[step]}</p>
            <span style={{ fontSize: 12, color: '#5a6b82', marginTop: 'auto' }}>
              La zona de la pantalla que explica este paso está marcada con un borde azul claro.
            </span>
          </div>
        </section>
      )}

      {/* ===== Selector de oficinas + KPIs ===== */}
      <section aria-label="Oficina y resumen" className="flex flex-wrap items-stretch gap-4">
        <div className="flex flex-col gap-3" style={{ flex: '2 1 420px', ...card, padding: '16px 18px', ...ringStyle(0) }}>
          <div className="flex flex-wrap items-baseline gap-2">
            <span style={{ fontSize: 14, fontWeight: 700 }}>1. Elige la oficina</span>
            <span style={{ fontSize: 13, color: '#5a6b82' }}>El número naranja indica franjas donde falta gente.</span>
          </div>
          <div role="group" aria-label="Oficinas" className="flex flex-wrap gap-2">
            {offices.map((o) => {
              const on = o.id === office.id;
              const d = deficitsByOffice[o.id]?.length ?? 0;
              const n = staff.filter((s) => s.oficinaBaseId === o.id).length;
              return (
                <button
                  key={o.id}
                  onClick={() => {
                    setPickedOfficeId(o.id);
                    closeEditor();
                  }}
                  aria-pressed={on}
                  style={{
                    font: 'inherit', minHeight: 56, padding: '8px 14px', borderRadius: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 12, textAlign: 'left',
                    ...(on
                      ? { background: '#1f2b6b', color: '#fff', border: '1px solid #1f2b6b' }
                      : { background: '#fff', color: '#0f1b2d', border: '1px solid #c9d4e3' }),
                  }}
                >
                  <span className="flex flex-col items-start gap-0.5">
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{o.nombre}</span>
                    <span style={{ fontSize: 12, opacity: 0.8 }}>
                      {o.ciudad} · {n} {n === 1 ? 'persona' : 'personas'}
                    </span>
                  </span>
                  {d > 0 && (
                    <span
                      aria-label={`${d} ${d === 1 ? 'franja con faltante' : 'franjas con faltante'}`}
                      style={{ minWidth: 24, height: 24, borderRadius: 12, background: '#c2410c', color: '#fff', fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 6px', boxSizing: 'border-box' }}
                    >
                      {d}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-3" style={{ flex: '1 1 340px', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', alignContent: 'start' }}>
          <Kpi label="Trabajando hoy" value={`${activeCount}/${officeStaff.length}`} hint={absentCount > 0 ? `${absentCount} ausente${absentCount > 1 ? 's' : ''} hoy` : 'nadie ausente'} />
          <Kpi
            label="Franjas con faltante"
            value={defs.length}
            hint={defs.length ? `a las ${defs.slice(0, 4).map((d) => d.t).join(', ')}${defs.length > 4 ? '…' : ''}` : 'todo cubierto'}
            alert={defs.length > 0}
          />
          <Kpi label="Cambios manuales" value={manualCount} hint="sobre la propuesta" />
        </div>
      </section>

      {/* ===== Leyenda explicada ===== */}
      <section aria-label="Qué significa cada color" className="flex flex-col gap-3" style={{ ...card, padding: '16px 18px', ...ringStyle(1) }}>
        <div className="flex flex-wrap items-baseline gap-2">
          <span style={{ fontSize: 14, fontWeight: 700 }}>2. Qué significa cada casilla</span>
          <span style={{ fontSize: 13, color: '#5a6b82' }}>
            Las marcadas con <strong style={{ color: '#0f1b2d' }}>✓ cuenta</strong> suman a la cobertura de la oficina.
          </span>
        </div>
        <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))' }}>
          {ORDER.map((k) => (
            <div key={k} className="flex items-start gap-2.5" style={{ padding: 10, borderRadius: 10, background: '#f6f8fb' }}>
              <span aria-hidden="true" style={chipStyle(k, 36)}>
                {ST[k].code}
              </span>
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="flex flex-wrap items-center gap-2">
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{ST[k].label}</span>
                  <span
                    style={{
                      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
                      ...(ST[k].cuenta ? { background: '#dcf2e3', color: '#14532d' } : { background: '#e9edf3', color: '#3f4a5c' }),
                    }}
                  >
                    {ST[k].cuenta ? '✓ cuenta' : 'no cuenta'}
                  </span>
                </span>
                <span style={{ fontSize: 13, lineHeight: 1.45, color: '#3d4c63' }}>{ST[k].desc}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ===== Malla + panel de edición ===== */}
      <section className="flex flex-wrap items-start gap-4">
        <div style={{ flex: '999 1 640px', minWidth: 0, ...card, overflow: 'hidden', ...ringStyle(2) }}>
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2" style={{ padding: '14px 18px', borderBottom: '1px solid #e3e9f1' }}>
            <div className="flex flex-col gap-0.5">
              <span style={{ fontSize: 16, fontWeight: 700 }}>{office.nombre}</span>
              <span style={{ fontSize: 13, color: '#5a6b82' }}>
                {office.ciudad}, {office.departamento} · {office.capacidadPuestos} puestos · {officeStaff.length} {officeStaff.length === 1 ? 'persona asignada' : 'personas asignadas'}
              </span>
            </div>
            <div className="flex flex-wrap gap-3.5" style={{ fontSize: 12, color: '#3d4c63' }}>
              <Swatch bg="#fff3d6" border="#e8c56a">Ventana de almuerzo</Swatch>
              <Swatch bg="#e3eefb" border="#9cbfe8">Hora pico prevista</Swatch>
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 4, background: CYAN, boxShadow: `0 0 0 2px #fff, 0 0 0 3px ${CYAN}` }} />
                Cambiado a mano
              </span>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 1040 }}>
              {/* Encabezado de horas */}
              <div style={{ display: 'grid', gridTemplateColumns: gridCols, borderBottom: '1px solid #e3e9f1', background: '#f6f8fb' }}>
                <div className="flex flex-col justify-center" style={{ padding: '10px 14px', fontSize: 12, fontWeight: 600, color: '#3d4c63' }}>
                  <span>Persona</span>
                  <span style={{ fontWeight: 400, color: '#5a6b82' }}>cada casilla = 30 min</span>
                </div>
                {slots.map((t) => {
                  const lunch = isLunchSlot(t);
                  const peak = isPeakSlot(t);
                  return (
                    <div
                      key={t}
                      className="flex flex-col items-center justify-center gap-0.5"
                      style={{
                        padding: '8px 2px', fontFamily: FONT_MONO, fontSize: 12, fontWeight: 600, minHeight: 48,
                        ...(lunch ? { background: '#fff3d6', color: '#6b4a00' } : peak ? { background: '#e3eefb', color: '#0b4a8f' } : { color: '#3d4c63' }),
                      }}
                    >
                      <span>{t}</span>
                      <span style={{ fontSize: 10, fontWeight: 500, fontFamily: FONT_SANS }}>{lunch ? 'almuerzo' : peak ? 'pico' : ''}</span>
                    </div>
                  );
                })}
              </div>

              {/* Filas por persona */}
              {officeStaff.map((p) => (
                <div key={p.id} style={{ display: 'grid', gridTemplateColumns: gridCols, borderBottom: '1px solid #eef2f7', alignItems: 'center' }}>
                  <div className="flex flex-col gap-0.5 min-w-0" style={{ padding: '8px 14px' }}>
                    <span style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.nombre}</span>
                    <span style={{ fontSize: 12, color: '#5a6b82', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p.cargo} · {p.modalidad}
                    </span>
                  </div>
                  {slots.map((t) => {
                    const slot = currentPlan.turnos[p.id]?.slots[t];
                    const st = slot?.estado ?? 'atencion';
                    const c = ST[st];
                    const manual = !!slot?.esModificadoManual;
                    const isSel = sel?.pid === p.id && sel.t === t;
                    const label = `${p.nombre}, ${t}: ${c.label}${manual ? ' (cambiado a mano)' : ''}. ${canEdit ? 'Toca para cambiar.' : ''}`;
                    return (
                      <div key={t} style={{ padding: '4px 2px', display: 'flex', height: 52, boxSizing: 'border-box', background: isLunchSlot(t) ? '#fffaf0' : undefined }}>
                        <button
                          onClick={() => openCell(p, t)}
                          aria-label={label}
                          title={label}
                          aria-pressed={isSel}
                          className={canEdit ? 'cell-malla' : undefined}
                          style={{
                            font: 'inherit', position: 'relative', width: '100%', height: '100%', borderRadius: 6, cursor: canEdit ? 'pointer' : 'default',
                            fontFamily: FONT_MONO, fontSize: 11, fontWeight: 600, background: c.bg, color: c.fg,
                            border: `1px ${st === 'libre' ? 'dashed' : 'solid'} ${c.border}`,
                            ...(isSel ? { outline: `3px solid ${CYAN}`, outlineOffset: 1, zIndex: 1 } : {}),
                          }}
                        >
                          {c.code}
                          {manual && (
                            <span aria-hidden="true" style={{ position: 'absolute', top: 3, right: 3, width: 7, height: 7, borderRadius: 4, background: CYAN, boxShadow: '0 0 0 1.5px #fff' }} />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ))}

              {/* Fila de cobertura (necesarios = Erlang C) */}
              <div
                style={{ display: 'grid', gridTemplateColumns: gridCols, background: '#f6f8fb', borderTop: '2px solid #d6dfeb', alignItems: 'stretch', ...ringStyle(3) }}
              >
                <div className="flex flex-col gap-0.5" style={{ padding: '10px 14px' }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>Cobertura</span>
                  <span style={{ fontSize: 12, color: '#5a6b82' }}>atendiendo / necesarios</span>
                </div>
                {coverage.map((v) => {
                  const k = COV[v.kind];
                  const title = `${v.t}: ${v.a} atendiendo de ${v.r} necesarios${v.external ? ` (incluye ${v.external} de apoyo de otras sedes)` : ''}`;
                  return (
                    <div key={v.t} className="flex" style={{ padding: '6px 3px' }}>
                      <span
                        title={title}
                        aria-label={title}
                        className="flex flex-1 flex-col items-center justify-center"
                        style={{ borderRadius: 6, minHeight: 44, fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, boxSizing: 'border-box', background: k.bg, color: k.fg, border: k.border }}
                      >
                        <span>
                          {v.a}/{v.r}
                        </span>
                        <span style={{ fontSize: 10, fontWeight: 600, fontFamily: FONT_SANS }}>
                          {v.kind === 'ok' ? '' : v.kind === 'low' ? `falta ${v.r - v.a}` : 'sola'}
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-2" style={{ padding: '12px 18px', borderTop: '1px solid #e3e9f1', fontSize: 12, color: '#3d4c63' }}>
            <Swatch bg="#dcf2e3" border="#5fb37c">Suficiente</Swatch>
            <Swatch bg="#ffe4cc" border="#e07a2e">Falta gente: se forma fila</Swatch>
            <Swatch bg="#9b1c1c" border="#9b1c1c">Oficina sin nadie atendiendo</Swatch>
            <span style={{ color: '#5a6b82' }}>«Necesarios» los calcula el motor (Erlang C) según la demanda prevista de cada franja.</span>
          </div>
        </div>

        {/* ===== Panel lateral de edición ===== */}
        <aside
          aria-label="Editar casilla"
          className="flex flex-col gap-3.5"
          style={{ flex: '1 1 300px', maxWidth: 380, ...card, padding: 18, boxSizing: 'border-box', ...ringStyle(4) }}
        >
          {!sel || !person ? (
            <div className="flex flex-col gap-2.5">
              <span style={{ fontSize: 14, fontWeight: 700 }}>5. Corrige con un clic</span>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: '#3d4c63' }}>
                Toca cualquier casilla de la malla. Aquí verás qué está haciendo esa persona, las opciones para cambiarlo y{' '}
                <strong>cómo queda la oficina antes de confirmar</strong>.
              </p>
              <div className="flex flex-col gap-1.5" style={{ background: '#e8f6fc', borderRadius: 10, padding: '12px 14px' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#0b4a66' }}>Sugerencia del motor</span>
                <span style={{ fontSize: 13, lineHeight: 1.5, color: '#0f3347' }}>{suggestion}</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col gap-0.5">
                  <span style={{ fontSize: 12, color: '#5a6b82', fontWeight: 500 }}>Editando casilla</span>
                  <span style={{ fontSize: 17, fontWeight: 700 }}>{person.nombre}</span>
                  <span style={{ fontSize: 13, color: '#3d4c63' }}>
                    De {selT} a {addHalfHour(selT)} · ahora: <strong>{ST[cur].label}</strong>
                  </span>
                </div>
                <button
                  onClick={closeEditor}
                  aria-label="Cerrar editor"
                  style={{ font: 'inherit', width: 44, height: 44, flex: '0 0 auto', borderRadius: 10, border: '1px solid #d6dfeb', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3d4c63' }}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M3 3l10 10M13 3L3 13" />
                  </svg>
                </button>
              </div>

              {absentCell ? (
                <div className="flex flex-col gap-2.5" style={{ background: '#fde2e1', border: '1px solid #e19995', color: '#8a1414', borderRadius: 12, padding: '12px 14px', fontSize: 14, lineHeight: 1.5 }}>
                  <span>Esta persona está <strong>ausente</strong>. Las ausencias no se cambian desde la malla: se registran o se quitan en la pantalla de Ausencias.</span>
                  <button
                    onClick={() => navigate('/ausencias')}
                    style={{ ...btnBase, fontSize: 14, fontWeight: 600, border: '1px solid #e19995', background: '#fff', color: '#8a1414' }}
                  >
                    Ir a Ausencias
                  </button>
                </div>
              ) : (
                <>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#3d4c63' }}>¿Qué debería hacer en esta media hora?</span>
                  <div role="radiogroup" aria-label="Nuevo estado" className="flex flex-col gap-1.5">
                    {ORDER.filter((k) => k !== 'ausente').map((k) => {
                      const on = k === pend;
                      return (
                        <button
                          key={k}
                          role="radio"
                          aria-checked={on}
                          onClick={() => setPending(k)}
                          style={{
                            font: 'inherit', display: 'flex', alignItems: 'center', gap: 10, minHeight: 52, padding: '8px 10px', borderRadius: 10, cursor: 'pointer', color: '#0f1b2d',
                            background: on ? '#eef6fb' : '#fff',
                            border: on ? '2px solid #1f6496' : '1px solid #d6dfeb',
                          }}
                        >
                          <span aria-hidden="true" style={chipStyle(k, 32)}>
                            {ST[k].code}
                          </span>
                          <span className="flex flex-col gap-px text-left">
                            <span style={{ fontSize: 14, fontWeight: 600 }}>{ST[k].label}</span>
                            <span style={{ fontSize: 12, color: '#5a6b82', lineHeight: 1.35 }}>{ST[k].short}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Impacto antes → después */}
                  <div className="flex flex-col gap-2" style={{ borderRadius: 12, padding: '12px 14px', ...impactBox }} aria-live="polite">
                    <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase' }}>
                      Impacto en la oficina a las {selT}
                    </span>
                    <div className="flex items-center gap-3" style={{ fontFamily: FONT_MONO }}>
                      <span className="flex flex-col items-center">
                        <span style={{ fontSize: 11, fontFamily: FONT_SANS }}>Antes</span>
                        <span style={{ fontSize: 22, fontWeight: 600 }}>{before}</span>
                      </span>
                      <svg width="24" height="12" viewBox="0 0 24 12" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M1 6h20M16 1l5 5-5 5" />
                      </svg>
                      <span className="flex flex-col items-center">
                        <span style={{ fontSize: 11, fontFamily: FONT_SANS }}>Después</span>
                        <span style={{ fontSize: 22, fontWeight: 700 }}>{after}</span>
                      </span>
                      <span style={{ fontSize: 13, fontFamily: FONT_SANS }}>de {reqSel} necesarios</span>
                    </div>
                    <span style={{ fontSize: 13, lineHeight: 1.5 }}>{impactMsg}</span>
                    {slotOfficeId !== office.id && (
                      <span style={{ fontSize: 12, lineHeight: 1.45 }}>
                        Nota: en esta franja la persona está asignada a otra sede, por eso el cambio no suma a esta oficina.
                      </span>
                    )}
                  </div>

                  <div className="flex gap-2.5">
                    <button
                      onClick={closeEditor}
                      style={{ ...btnBase, flex: 1, fontSize: 14, fontWeight: 600, border: '1px solid #b9c7da', background: '#fff', color: '#0f1b2d' }}
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={applyChange}
                      disabled={noChange || applying}
                      style={{
                        ...btnBase, flex: 1.4, fontSize: 14, fontWeight: 600, border: 0,
                        ...(noChange || applying
                          ? { background: '#e3e8ef', color: '#5a6b82', cursor: 'not-allowed' }
                          : { background: '#1f6496', color: '#fff' }),
                      }}
                    >
                      {noChange ? 'Elige un estado' : `Aplicar: ${ST[pend].label}`}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </aside>
      </section>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Piezas pequeñas                                                    */
/* ------------------------------------------------------------------ */

const Kpi: React.FC<{ label: string; value: React.ReactNode; hint: string; alert?: boolean }> = ({
  label,
  value,
  hint,
  alert = false,
}) => (
  <div
    className="flex flex-col gap-1"
    style={{
      borderRadius: 16,
      padding: '14px 16px',
      ...(alert
        ? { background: '#fff4ea', border: '2px solid #e07a2e', color: '#7a2b05' }
        : { background: '#fff', border: '1px solid #d6dfeb' }),
    }}
  >
    <span style={{ fontSize: 12, fontWeight: 500, color: '#5a6b82' }}>{label}</span>
    <span style={{ fontSize: 26, fontWeight: 700, fontFamily: FONT_MONO }}>{value}</span>
    <span style={{ fontSize: 12, color: '#5a6b82' }}>{hint}</span>
  </div>
);

const Swatch: React.FC<{ bg: string; border: string; children: React.ReactNode }> = ({ bg, border, children }) => (
  <span className="inline-flex items-center gap-1.5">
    <span aria-hidden="true" style={{ width: 14, height: 14, borderRadius: 3, background: bg, border: `1px solid ${border}` }} />
    {children}
  </span>
);
