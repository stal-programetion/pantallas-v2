import React, { useRef } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { FECHA_BASE, useAppStore } from '../../store/useAppStore';
import { formatoFechaLarga, moverDiaHabil } from '../../engine/calendar';

/** Etiqueta corta: "Jue 15 oct" */
const etiquetaCorta = (fecha: string) => {
  const txt = new Date(`${fecha}T12:00:00`).toLocaleDateString('es-CO', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  return (txt.charAt(0).toUpperCase() + txt.slice(1)).replace(/\./g, '');
};

/**
 * Selector del día que se planifica. Al cambiar de día se recalculan la malla,
 * el plan, las alertas y los traslados con el día de la semana real.
 */
export const DateNavigator: React.FC = () => {
  const { selectedDate, setSelectedDate, isLoading } = useAppStore();
  const inputRef = useRef<HTMLInputElement>(null);

  const abrirCalendario = () => {
    const input = inputRef.current;
    if (!input) return;
    try {
      input.showPicker();
    } catch {
      input.focus();
    }
  };

  const btn =
    'p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-white disabled:opacity-40 transition-colors';

  return (
    <div
      className="flex items-center gap-0.5 rounded-xl border border-slate-200 bg-slate-50 p-0.5"
      role="group"
      aria-label="Día que se está planificando"
    >
      <button
        onClick={() => setSelectedDate(moverDiaHabil(selectedDate, -1))}
        disabled={isLoading}
        className={btn}
        aria-label="Día anterior"
        title="Día anterior"
      >
        <ChevronLeft size={16} />
      </button>

      <div className="relative">
        <button
          onClick={abrirCalendario}
          className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-sm font-medium text-slate-800 hover:bg-white transition-colors tabular-nums"
          title={`${formatoFechaLarga(selectedDate)} · clic para elegir otra fecha`}
        >
          <CalendarDays size={15} className="text-blue-700" />
          <span>{etiquetaCorta(selectedDate)}</span>
        </button>
        <input
          ref={inputRef}
          type="date"
          value={selectedDate}
          onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
          className="absolute inset-0 opacity-0 pointer-events-none"
          tabIndex={-1}
          aria-hidden="true"
        />
      </div>

      <button
        onClick={() => setSelectedDate(moverDiaHabil(selectedDate, 1))}
        disabled={isLoading}
        className={btn}
        aria-label="Día siguiente"
        title="Día siguiente"
      >
        <ChevronRight size={16} />
      </button>

      {selectedDate !== FECHA_BASE && (
        <button
          onClick={() => setSelectedDate(FECHA_BASE)}
          disabled={isLoading}
          className="hidden lg:block px-2 py-1 rounded-lg text-[11px] font-semibold text-blue-700 hover:bg-white"
          title={`Volver al día base del piloto (${formatoFechaLarga(FECHA_BASE)})`}
        >
          Día base
        </button>
      )}
    </div>
  );
};
