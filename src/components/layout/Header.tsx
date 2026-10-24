import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  Menu,
  X,
  Search,
  Flame,
  LogOut,
  ChevronDown,
  Check,
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useAuthStore } from '../../store/useAuthStore';
import { AlertDrawer } from '../alerts/AlertDrawer';
import { SurtigasLogo } from '../common/SurtigasLogo';
import { UserRole } from '../../types';

interface HeaderProps {
  menuOpen: boolean;
  onToggleMenu: () => void;
  onOpenPalette: () => void;
}

const PAGE_TITLES: Array<[string, string]> = [
  ['/dashboard', 'Centro de control'],
  ['/plan-dia', 'Plan del día'],
  ['/malla', 'Malla de turnos'],
  ['/redistribucion', 'Redistribución'],
  ['/oficina', 'Detalle de oficina'],
  ['/demanda', 'Análisis de demanda'],
  ['/simulador', 'Simulador Erlang C'],
  ['/reportes', 'Reportes y KPIs'],
  ['/ausencias', 'Gestión de ausencias'],
  ['/configuracion', 'Configuración'],
];

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Administrador',
  COORDINADOR: 'Coordinador',
  CONSULTA: 'Consulta',
};

export const Header: React.FC<HeaderProps> = ({ menuOpen, onToggleMenu, onOpenPalette }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    isSimulationPaused,
    toggleSimulation,
    isFortnight,
    toggleFortnight,
    alerts,
    tickSimulation,
  } = useAppStore();
  const { currentUser, setRole } = useAuthStore();

  const [isAlertDrawerOpen, setIsAlertDrawerOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [time, setTime] = useState(() =>
    new Date().toLocaleTimeString('es-CO', { hour12: false, hour: '2-digit', minute: '2-digit' })
  );
  const menuRef = useRef<HTMLDivElement>(null);

  // Reloj + tick de simulación cada 5 s (misma lógica del boceto original)
  useEffect(() => {
    const clock = setInterval(() => {
      setTime(new Date().toLocaleTimeString('es-CO', { hour12: false, hour: '2-digit', minute: '2-digit' }));
    }, 15000);
    const tick = setInterval(() => tickSimulation(), 5000);
    return () => {
      clearInterval(clock);
      clearInterval(tick);
    };
  }, [tickSimulation]);

  // Cerrar menú de usuario al hacer clic fuera / Esc
  useEffect(() => {
    if (!userMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setUserMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setUserMenuOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [userMenuOpen]);

  const title = PAGE_TITLES.find(([p]) => location.pathname.startsWith(p))?.[1] ?? 'Centro de control';
  const activeAlerts = alerts.filter((a) => !a.leida);
  const initials = currentUser.nombre
    .split(' ')
    .slice(0, 2)
    .map((p) => p.charAt(0))
    .join('');

  return (
    <header className="h-16 bg-white/90 backdrop-blur border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-3 sticky top-0 z-30 select-none">
      {/* Izquierda: menú móvil + título + estado en vivo */}
      <div className="flex items-center gap-3 min-w-0">
        <Link to="/dashboard" aria-label="Ir al centro de control" className="shrink-0 flex items-center">
          <SurtigasLogo size="sm" />
        </Link>
        <span className="hidden md:block w-px h-6 bg-slate-200" aria-hidden="true" />

        <h1 className="text-base font-semibold text-slate-900 truncate">{title}</h1>

        <button
          onClick={() => toggleSimulation()}
          className="hidden sm:inline-flex items-center gap-2 pl-2.5 pr-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200/70 text-xs font-medium text-slate-700 transition-colors"
          title={isSimulationPaused ? 'Reanudar datos en vivo' : 'Pausar datos en vivo'}
          aria-label={isSimulationPaused ? 'Reanudar datos en vivo' : 'Pausar datos en vivo'}
        >
          <span className="relative flex h-2 w-2">
            {!isSimulationPaused && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            )}
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                isSimulationPaused ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
            />
          </span>
          <span>{isSimulationPaused ? 'En pausa' : 'En vivo'}</span>
          <span className="text-slate-400 tabular-nums">{time}</span>
        </button>
      </div>

      {/* Derecha: búsqueda, quincena, alertas, usuario */}
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenPalette}
          className="hidden md:inline-flex items-center gap-2 w-56 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white hover:border-slate-300 text-sm text-slate-500 transition-colors"
          aria-label="Buscar oficinas y páginas"
        >
          <Search size={15} />
          <span className="flex-1 text-left">Buscar…</span>
          <kbd className="text-[11px] font-medium text-slate-400 bg-white border border-slate-200 rounded px-1.5 py-0.5">
            Ctrl K
          </kbd>
        </button>
        <button
          onClick={onOpenPalette}
          className="md:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100"
          aria-label="Buscar"
        >
          <Search size={19} />
        </button>

        <button
          onClick={() => toggleFortnight()}
          role="switch"
          aria-checked={isFortnight}
          title="Quincena: +32% de demanda por pagos y facturación"
          className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border transition-colors ${
            isFortnight
              ? 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Flame size={15} className={isFortnight ? 'text-orange-500' : 'text-slate-400'} />
          <span>Quincena</span>
          <span
            className={`ml-0.5 w-7 h-4 rounded-full p-0.5 transition-colors ${isFortnight ? 'bg-orange-500' : 'bg-slate-300'}`}
          >
            <span
              className={`block w-3 h-3 rounded-full bg-white transition-transform ${isFortnight ? 'translate-x-3' : ''}`}
            />
          </span>
        </button>

        <button
          onClick={() => setIsAlertDrawerOpen(true)}
          aria-label={`Alertas operativas (${activeAlerts.length} sin leer)`}
          className="relative p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <Bell size={19} />
          {activeAlerts.length > 0 && (
            <span className="absolute top-0.5 right-0 min-w-4 h-4 px-1 inline-flex items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white tabular-nums">
              {activeAlerts.length}
            </span>
          )}
        </button>

        {/* Menú de usuario: rol y cambio de sesión viven aquí, no en el menú lateral */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setUserMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={userMenuOpen}
            className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <span className="w-8 h-8 rounded-lg bg-[#1F2B6B] text-white flex items-center justify-center text-xs font-bold">
              {initials}
            </span>
            <span className="hidden lg:block text-left leading-tight">
              <span className="block text-sm font-medium text-slate-900 max-w-32 truncate">{currentUser.nombre}</span>
              <span className="block text-[11px] text-slate-500">{ROLE_LABELS[currentUser.rol]}</span>
            </span>
            <ChevronDown size={14} className={`text-slate-400 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {userMenuOpen && (
            <div
              role="menu"
              className="absolute right-0 mt-2 w-64 bg-white rounded-2xl border border-slate-200 shadow-xl p-2 anim-pop z-40"
            >
              <div className="px-3 py-2">
                <div className="text-sm font-semibold text-slate-900">{currentUser.nombre}</div>
                <div className="text-xs text-slate-500">{currentUser.cargo}</div>
              </div>
              <div className="my-1 h-px bg-slate-100" />
              <div className="px-3 pt-1.5 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Ver como
              </div>
              {(['ADMIN', 'COORDINADOR', 'CONSULTA'] as UserRole[]).map((r) => (
                <button
                  key={r}
                  role="menuitemradio"
                  aria-checked={currentUser.rol === r}
                  onClick={() => {
                    setRole(r);
                    setUserMenuOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-50"
                >
                  <span>{ROLE_LABELS[r]}</span>
                  {currentUser.rol === r && <Check size={15} className="text-blue-600" />}
                </button>
              ))}
              <div className="my-1 h-px bg-slate-100" />
              <button
                role="menuitem"
                onClick={() => {
                  setUserMenuOpen(false);
                  navigate('/login');
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-50"
              >
                <LogOut size={15} className="text-slate-400" />
                Cambiar de usuario
              </button>
            </div>
          )}
        </div>

        {/* Abrir / cerrar el menú lateral */}
        <button
          onClick={onToggleMenu}
          aria-expanded={menuOpen}
          aria-controls="menu-principal"
          aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
          title={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
          className={`w-11 h-11 inline-flex items-center justify-center rounded-xl border transition-colors ${
            menuOpen
              ? 'bg-[#1F2B6B] text-white border-[#1F2B6B]'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      <AlertDrawer isOpen={isAlertDrawerOpen} onClose={() => setIsAlertDrawerOpen(false)} />
    </header>
  );
};
