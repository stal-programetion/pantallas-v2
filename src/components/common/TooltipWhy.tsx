import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, X, ChevronRight } from 'lucide-react';

interface TooltipWhyProps {
  title?: string;
  explanation: string;
  rule?: string;
  metricDetails?: {
    label: string;
    value: string | number;
  }[];
  align?: 'left' | 'right' | 'center';
  className?: string;
}

export const TooltipWhy: React.FC<TooltipWhyProps> = ({
  title = '¿Por qué tomó esta decisión el motor?',
  explanation,
  rule,
  metricDetails,
  align = 'right',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const alignmentClasses = {
    left: 'left-0',
    right: 'right-0',
    center: 'left-1/2 -translate-x-1/2',
  };

  return (
    <div className={`relative inline-block ${className}`} ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Ver justificación técnica del motor"
        aria-expanded={isOpen}
        className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-slate-700 bg-orange-50 hover:bg-orange-100 hover:text-orange-900 border border-orange-200/80 rounded-full transition-all duration-150 focus:outline-hidden focus:ring-2 focus:ring-orange-500/40 cursor-pointer shadow-2xs group"
      >
        <Sparkles size={11} className="text-orange-500 group-hover:scale-110 transition-transform" />
        <span>¿Por qué?</span>
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className={`absolute z-50 mt-2 w-80 sm:w-96 p-4 bg-white rounded-xl shadow-xl border border-slate-200/90 text-slate-800 text-xs animate-in fade-in zoom-in-95 duration-150 ${alignmentClasses[align]}`}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-100">
            <div className="flex items-center gap-1.5 text-orange-600 font-semibold">
              <Sparkles size={14} className="shrink-0" />
              <h4 className="text-xs font-bold text-slate-900">{title}</h4>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-slate-600 p-0.5 rounded-md hover:bg-slate-100 transition-colors"
              aria-label="Cerrar explicación"
            >
              <X size={14} />
            </button>
          </div>

          {/* Explicación en lenguaje natural */}
          <div className="py-2.5 leading-relaxed text-slate-700 font-normal">
            {explanation}
          </div>

          {/* Métricas o datos de apoyo */}
          {metricDetails && metricDetails.length > 0 && (
            <div className="grid grid-cols-2 gap-2 my-2 p-2 bg-slate-50 rounded-lg border border-slate-100">
              {metricDetails.map((m, idx) => (
                <div key={idx} className="flex flex-col">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider">
                    {m.label}
                  </span>
                  <span className="font-semibold text-slate-900 text-xs">
                    {m.value}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Regla algorítmica aplicada */}
          {rule && (
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              <span className="flex items-center gap-1">
                <ChevronRight size={12} className="text-orange-500" />
                <span className="font-medium text-slate-600">Regla:</span> {rule}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
