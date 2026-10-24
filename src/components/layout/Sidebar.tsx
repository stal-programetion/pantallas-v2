import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  CalendarCheck,
  CalendarDays,
  ArrowLeftRight,
  BarChart3,
  Sliders,
  FileSpreadsheet,
  UserX,
  Settings,
  X,
} from 'lucide-react';
import { SurtigasLogo } from '../common/SurtigasLogo';
import { useAppStore } from '../../store/useAppStore';

interface NavItem {
  name: string;
  path: string;
  icon: React.ElementType;
  badge?: number;
  dot?: boolean;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

/** Menú lateral: panel que se abre y se cierra desde el botón del encabezado. */
export const Sidebar: React.FC<SidebarProps> = ({ open, onClose }) => {
  const location = useLocation();
  const { absences, recommendations, currentPlan } = useAppStore();

  const pendingRecs = recommendations.filter((r) => r.estado === 'pendiente').length;
  const activeAbsences = absences.filter((a) => a.estado === 'activa').length;
  const planPending = !!currentPlan && currentPlan.estado !== 'aprobado';

  const groups: NavGroup[] = [
    {
      title: 'Operación',
      items: [
        { name: 'Centro de control', path: '/dashboard', icon: LayoutDashboard },
        { name: 'Plan del día', path: '/plan-dia', icon: CalendarCheck, dot: planPending },
        { name: 'Malla de turnos', path: '/malla', icon: CalendarDays },
        { name: 'Redistribución', path: '/redistribucion', icon: ArrowLeftRight, badge: pendingRecs || undefined },
      ],
    },
    {
      title: 'Análisis',
      items: [
        { name: 'Demanda', path: '/demanda', icon: BarChart3 },
        { name: 'Simulador Erlang C', path: '/simulador', icon: Sliders },
        { name: 'Reportes', path: '/reportes', icon: FileSpreadsheet },
      ],
    },
    {
      title: 'Administración',
      items: [
        { name: 'Ausencias', path: '/ausencias', icon: UserX, badge: activeAbsences || undefined },
        { name: 'Configuración', path: '/configuracion', icon: Settings },
      ],
    },
  ];

  const isItemActive = (path: string) => {
    if (path === '/dashboard') {
      return (
        location.pathname === '/' ||
        location.pathname.startsWith('/dashboard') ||
        location.pathname.startsWith('/oficina')
      );
    }
    return location.pathname.startsWith(path);
  };

  return (
    <>
      {/* Fondo oscuro: clic fuera para cerrar */}
      <div
        className={`fixed inset-0 z-40 bg-slate-900/50 transition-opacity duration-200 ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        id="menu-principal"
        aria-label="Navegación principal"
        // inert: cerrado, el menú no recibe foco ni lo lee el lector de pantalla
        inert={!open}
        className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] flex flex-col select-none bg-[#1F2B6B] text-slate-200 shadow-2xl transition-transform duration-200 ease-out ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Marca: el logo oficial va sobre fondo blanco */}
        <div className="p-4 pb-2 flex items-start gap-3">
          <NavLink
            to="/dashboard"
            className="flex-1 flex items-center justify-center rounded-2xl bg-white px-4 py-3"
            aria-label="Ir al centro de control"
          >
            <SurtigasLogo size="md" variant="full" />
          </NavLink>
          <button
            onClick={onClose}
            className="w-11 h-11 shrink-0 inline-flex items-center justify-center rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Cerrar menú"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-4 pt-3 space-y-5">
          {groups.map((group) => (
            <div key={group.title}>
              <h3 className="px-3 mb-1.5 text-[11px] font-semibold tracking-wider uppercase text-slate-400">
                {group.title}
              </h3>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = isItemActive(item.path);
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={onClose}
                      aria-current={active ? 'page' : undefined}
                      className={`relative flex items-center gap-3 px-3 min-h-11 rounded-xl text-sm font-medium transition-colors duration-150 ${
                        active ? 'bg-white/14 text-white' : 'text-slate-200 hover:bg-white/8 hover:text-white'
                      }`}
                    >
                      {active && (
                        <span className="absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-r-full bg-brand-leaf" />
                      )}
                      <Icon size={19} className={active ? 'text-brand-leaf' : ''} />
                      <span className="flex-1 truncate">{item.name}</span>
                      {item.badge !== undefined && (
                        <span className="min-w-5 h-5 px-1.5 inline-flex items-center justify-center rounded-full bg-brand-leaf text-[#1F2B6B] text-[11px] font-bold tabular-nums">
                          {item.badge}
                        </span>
                      )}
                      {item.dot && (
                        <span className="w-2 h-2 rounded-full bg-brand-leaf" title="Pendiente de aprobar" />
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="px-5 py-4 border-t border-white/10 text-[11px] text-slate-400">
          Sistema de optimización de turnos · Surtigas S.A. E.S.P.
        </div>
      </aside>
    </>
  );
};
