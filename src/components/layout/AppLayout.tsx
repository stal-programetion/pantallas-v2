import React, { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { CommandPalette } from './CommandPalette';
import { useAppStore } from '../../store/useAppStore';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export const AppLayout: React.FC = () => {
  const { init, toastMessage, clearToast } = useAppStore();
  const location = useLocation();

  const [menuOpen, setMenuOpen] = useState(false); // el menú arranca cerrado
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    init();
  }, [init]);

  // Cerrar el menú al navegar
  useEffect(() => setMenuOpen(false), [location.pathname]);

  // Atajo global Ctrl/Cmd + K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      } else if (e.key === 'Escape') {
        setMenuOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const toastIcons = { success: CheckCircle2, warning: AlertTriangle, error: AlertCircle, info: Info };
  const toastColors = {
    success: 'bg-emerald-900 text-white',
    warning: 'bg-amber-900 text-white',
    error: 'bg-rose-900 text-white',
    info: 'bg-slate-900 text-white',
  };

  return (
    <div className="flex h-screen bg-[#f4f6fa] text-slate-800 overflow-hidden font-sans">
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          menuOpen={menuOpen}
          onToggleMenu={() => setMenuOpen((v) => !v)}
          onOpenPalette={() => setPaletteOpen(true)}
        />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div key={location.pathname} className="max-w-[1400px] mx-auto anim-up">
            <Outlet />
          </div>
        </main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />

      {toastMessage && (
        <div
          role="alert"
          className={`fixed bottom-5 right-5 z-[70] flex items-center gap-3 pl-4 pr-3 py-3 rounded-2xl shadow-2xl text-sm font-medium max-w-md anim-up ${
            toastColors[toastMessage.type]
          }`}
        >
          {React.createElement(toastIcons[toastMessage.type], {
            size: 18,
            className: 'shrink-0 text-orange-400',
          })}
          <span className="flex-1 leading-snug">{toastMessage.text}</span>
          <button
            onClick={clearToast}
            aria-label="Cerrar aviso"
            className="text-slate-300 hover:text-white p-1 rounded-md hover:bg-white/10 transition-colors"
          >
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
};
