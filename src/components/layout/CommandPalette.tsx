import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  LayoutDashboard,
  CalendarCheck,
  CalendarDays,
  ArrowLeftRight,
  BarChart3,
  Sliders,
  FileSpreadsheet,
  UserX,
  Settings,
  Building2,
  Flame,
  Pause,
  Play,
  CornerDownLeft,
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

interface Command {
  id: string;
  label: string;
  hint?: string;
  group: 'Ir a' | 'Oficinas' | 'Acciones';
  icon: React.ElementType;
  run: () => void;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

/** Paleta de comandos (Ctrl/Cmd + K): salta a cualquier pantalla u oficina sin recorrer el menú. */
export const CommandPalette: React.FC<Props> = ({ open, onClose }) => {
  const navigate = useNavigate();
  const { offices, isFortnight, toggleFortnight, isSimulationPaused, toggleSimulation } = useAppStore();
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const commands = useMemo<Command[]>(() => {
    const go = (path: string) => () => navigate(path);
    const pages: Command[] = [
      { id: 'p-dash', label: 'Centro de control', group: 'Ir a', icon: LayoutDashboard, run: go('/dashboard') },
      { id: 'p-plan', label: 'Plan del día', group: 'Ir a', icon: CalendarCheck, run: go('/plan-dia') },
      { id: 'p-malla', label: 'Malla de turnos', group: 'Ir a', icon: CalendarDays, run: go('/malla') },
      { id: 'p-redis', label: 'Redistribución', group: 'Ir a', icon: ArrowLeftRight, run: go('/redistribucion') },
      { id: 'p-dem', label: 'Análisis de demanda', group: 'Ir a', icon: BarChart3, run: go('/demanda') },
      { id: 'p-sim', label: 'Simulador Erlang C', group: 'Ir a', icon: Sliders, run: go('/simulador') },
      { id: 'p-rep', label: 'Reportes y KPIs', group: 'Ir a', icon: FileSpreadsheet, run: go('/reportes') },
      { id: 'p-aus', label: 'Gestión de ausencias', group: 'Ir a', icon: UserX, run: go('/ausencias') },
      { id: 'p-conf', label: 'Configuración', group: 'Ir a', icon: Settings, run: go('/configuracion') },
    ];
    const offs: Command[] = offices.map((o) => ({
      id: `o-${o.id}`,
      label: o.nombre,
      hint: `${o.ciudad}, ${o.departamento}`,
      group: 'Oficinas',
      icon: Building2,
      run: go(`/oficina/${o.id}`),
    }));
    const actions: Command[] = [
      {
        id: 'a-fort',
        label: isFortnight ? 'Desactivar modo quincena' : 'Activar modo quincena',
        group: 'Acciones',
        icon: Flame,
        run: () => toggleFortnight(),
      },
      {
        id: 'a-live',
        label: isSimulationPaused ? 'Reanudar datos en vivo' : 'Pausar datos en vivo',
        group: 'Acciones',
        icon: isSimulationPaused ? Play : Pause,
        run: () => toggleSimulation(),
      },
    ];
    return [...pages, ...offs, ...actions];
  }, [offices, navigate, isFortnight, toggleFortnight, isSimulationPaused, toggleSimulation]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands.filter((c) => c.group !== 'Oficinas').concat(commands.filter((c) => c.group === 'Oficinas').slice(0, 4));
    return commands.filter((c) => `${c.label} ${c.hint ?? ''}`.toLowerCase().includes(q));
  }, [commands, query]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => setIndex(0), [query]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [index]);

  if (!open) return null;

  const choose = (cmd?: Command) => {
    if (!cmd) return;
    onClose();
    cmd.run();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(results[index]);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  let lastGroup = '';

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center pt-[12vh] px-4 bg-slate-900/40 backdrop-blur-[2px] anim-fade"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-label="Buscar"
        className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden anim-pop"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-3 px-4 border-b border-slate-100">
          <Search size={18} className="text-slate-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Busca una oficina, pantalla o acción…"
            className="flex-1 py-4 text-sm bg-transparent outline-none placeholder:text-slate-400"
          />
          <kbd className="text-[11px] text-slate-400 border border-slate-200 rounded px-1.5 py-0.5">Esc</kbd>
        </div>

        <div ref={listRef} className="max-h-[50vh] overflow-y-auto p-2">
          {results.length === 0 && (
            <div className="py-10 text-center text-sm text-slate-500">
              Nada coincide con “{query}”.
            </div>
          )}
          {results.map((cmd, i) => {
            const Icon = cmd.icon;
            const showGroup = cmd.group !== lastGroup;
            lastGroup = cmd.group;
            const active = i === index;
            return (
              <React.Fragment key={cmd.id}>
                {showGroup && (
                  <div className="px-3 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    {cmd.group}
                  </div>
                )}
                <button
                  data-active={active}
                  onMouseEnter={() => setIndex(i)}
                  onClick={() => choose(cmd)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm transition-colors ${
                    active ? 'bg-blue-50 text-blue-900' : 'text-slate-700'
                  }`}
                >
                  <Icon size={16} className={active ? 'text-blue-600' : 'text-slate-400'} />
                  <span className="flex-1 truncate font-medium">{cmd.label}</span>
                  {cmd.hint && <span className="text-xs text-slate-400 truncate">{cmd.hint}</span>}
                  {active && <CornerDownLeft size={14} className="text-blue-400" />}
                </button>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};
