import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  AlertOctagon,
  Info,
  Clock,
  ArrowRight,
  Check,
} from 'lucide-react';
import { Alert } from '../../types';
import { useAppStore } from '../../store/useAppStore';

interface AlertItemProps {
  alert: Alert;
  onCloseDrawer?: () => void;
}

export const AlertItem: React.FC<AlertItemProps> = ({ alert, onCloseDrawer }) => {
  const navigate = useNavigate();
  const { dismissAlert } = useAppStore();

  const severityConfigs = {
    critica: {
      border: 'border-rose-200 bg-rose-50/70 text-rose-900',
      icon: AlertOctagon,
      badge: 'bg-rose-100 text-rose-700 border-rose-200',
      badgeText: 'Crítica',
    },
    advertencia: {
      border: 'border-amber-200 bg-amber-50/70 text-amber-900',
      icon: AlertTriangle,
      badge: 'bg-amber-100 text-amber-800 border-amber-200',
      badgeText: 'Advertencia',
    },
    info: {
      border: 'border-blue-200 bg-blue-50/70 text-blue-900',
      icon: Info,
      badge: 'bg-blue-100 text-blue-700 border-blue-200',
      badgeText: 'Informativa',
    },
  };

  const config = severityConfigs[alert.severidad] || severityConfigs.info;
  const Icon = config.icon;

  const handleAction = () => {
    if (onCloseDrawer) onCloseDrawer();
    if (alert.accionTipo === 'redistribuir') {
      navigate('/redistribucion');
    } else if (alert.accionTipo === 'ajustar_almuerzo') {
      navigate('/malla');
    } else if (alert.accionTipo === 'cubrir_ausencia') {
      navigate('/ausencias');
    } else {
      navigate(`/oficina/${alert.oficinaId}`);
    }
  };

  return (
    <div
      className={`p-3.5 rounded-xl border ${config.border} shadow-2xs space-y-2 transition-all hover:shadow-xs`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon size={16} className="shrink-0 text-current" />
          <h5 className="text-xs font-bold leading-tight">{alert.titulo}</h5>
        </div>
        <span
          className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border shrink-0 ${config.badge}`}
        >
          {config.badgeText}
        </span>
      </div>

      <p className="text-xs text-slate-700 leading-relaxed">{alert.mensaje}</p>

      <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500">
        <span className="flex items-center gap-1">
          <Clock size={11} /> {alert.franja ? `Franja ${alert.franja}` : 'En tiempo real'}
        </span>

        <div className="flex items-center gap-2">
          <button
            onClick={() => dismissAlert(alert.id)}
            title="Descartar alerta"
            className="p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-white/80 transition-colors"
          >
            <Check size={13} />
          </button>

          <button
            onClick={handleAction}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-2xs transition-colors cursor-pointer"
          >
            <span>Acción</span>
            <ArrowRight size={11} />
          </button>
        </div>
      </div>
    </div>
  );
};
