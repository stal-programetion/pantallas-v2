import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Bell, AlertTriangle } from 'lucide-react';
import { AlertItem } from './AlertItem';
import { useAppStore } from '../../store/useAppStore';

interface AlertDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AlertDrawer: React.FC<AlertDrawerProps> = ({ isOpen, onClose }) => {
  const { alerts } = useAppStore();

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Portal a body: el <header> usa backdrop-blur y atraparía este `fixed` dentro de sus 64px.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Alertas operativas"
      onClick={onClose}
      className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs anim-fade"
    >
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-screen max-w-md bg-white shadow-2xl border-l border-slate-200 flex flex-col anim-slide-right"
        >
          {/* Header */}
          <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
              <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center">
                <Bell size={16} />
              </div>
              <div>
                <span>Alertas Operativas Activas</span>
                <div className="text-[11px] font-normal text-slate-500">
                  {alerts.length} alertas detectadas por el motor
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              aria-label="Cerrar alertas"
              className="w-11 h-11 inline-flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* List */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3">
            {alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
                <AlertTriangle size={36} className="text-slate-300 mb-2 stroke-1" />
                <p className="text-xs font-medium text-slate-600">No hay alertas activas</p>
                <p className="text-[11px] text-slate-400 max-w-xs mt-1">
                  Todas las 14 oficinas operan dentro de los umbrales de SLA objetivo.
                </p>
              </div>
            ) : (
              alerts.map((alert) => (
                <AlertItem key={alert.id} alert={alert} onCloseDrawer={onClose} />
              ))
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
