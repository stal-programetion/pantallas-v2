import React from 'react';
import {
  ArrowRight,
  MapPin,
  Laptop,
  Building,
  Clock,
  TrendingDown,
  Check,
  X,
  Compass,
} from 'lucide-react';
import { RedistributionRecommendation } from '../../types';

interface RecommendationCardProps {
  recommendation: RedistributionRecommendation;
  onAccept: () => void;
  onReject: () => void;
  isCompact?: boolean;
}

export const RecommendationCard: React.FC<RecommendationCardProps> = ({
  recommendation,
  onAccept,
  onReject,
  isCompact = false,
}) => {
  const isVirtual = recommendation.modalidad === 'virtual';
  const isAccepted = recommendation.estado === 'aceptada';
  const isRejected = recommendation.estado === 'rechazada';

  return (
    <div
      className={`p-4 rounded-xl border transition-all duration-200 ${
        isAccepted
          ? 'bg-emerald-50/60 border-emerald-300'
          : isRejected
          ? 'bg-slate-50 border-slate-200 opacity-60'
          : 'bg-white border-slate-200/90 shadow-2xs hover:shadow-xs'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Route Details */}
        <div className="space-y-1.5 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {/* Modalidad Badge */}
            <span
              className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                isVirtual
                  ? 'bg-purple-100 text-purple-800 border-purple-200'
                  : 'bg-sky-100 text-sky-800 border-sky-200'
              }`}
            >
              {isVirtual ? <Laptop size={12} /> : <Building size={12} />}
              <span>{isVirtual ? 'Apoyo Remoto Virtual' : 'Traslado Físico Presencial'}</span>
            </span>

            {/* Intermunicipal Badge */}
            {recommendation.esIntermunicipal && (
              <span className="text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-md">
                Intermunicipal ({recommendation.distanciaKm} km)
              </span>
            )}

            <span className="text-xs font-mono text-slate-500">
              Franja: {recommendation.franjaInicio} - {recommendation.franjaFin}
            </span>
          </div>

          {/* Colaborador and Offices Flow */}
          <div className="flex items-center gap-2 text-xs font-bold text-slate-900 pt-1">
            <span className="text-slate-700">{recommendation.colaboradorNombre}</span>
            <span className="text-slate-400 font-normal">:</span>
            <span className="text-slate-600 font-medium">
              {recommendation.oficinaOrigenNombre}
            </span>
            <ArrowRight size={13} className="text-orange-500 shrink-0" />
            <span className="text-blue-800 font-bold">
              {recommendation.oficinaDestinoNombre}
            </span>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            {recommendation.motivo}
          </p>
        </div>

        {/* Impact Metrics Pill */}
        <div className="flex items-center gap-3 shrink-0 p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
          <div>
            <span className="text-[10px] text-slate-500 uppercase tracking-wider block">
              Reducción Espera
            </span>
            <div className="font-bold text-emerald-700 flex items-center gap-0.5">
              <TrendingDown size={14} />
              <span>-{recommendation.impactoEstimado.reduccionEsperaMin} min</span>
            </div>
          </div>

          <div className="w-px h-7 bg-slate-200" />

          <div>
            <span className="text-[10px] text-slate-500 uppercase tracking-wider block">
              SLA Destino
            </span>
            <div className="font-bold text-blue-800">
              {Math.round(recommendation.impactoEstimado.slaProyectadoDestino * 100)}%
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {isAccepted ? (
            <span className="text-xs font-bold text-emerald-700 bg-emerald-100/80 px-3 py-1.5 rounded-lg flex items-center gap-1">
              <Check size={14} /> Aceptado
            </span>
          ) : isRejected ? (
            <span className="text-xs font-semibold text-slate-500 bg-slate-200 px-3 py-1.5 rounded-lg">
              Rechazado
            </span>
          ) : (
            <>
              <button
                onClick={onReject}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                title="Descartar recomendación"
                aria-label="Descartar recomendación de redistribución"
              >
                <X size={16} />
              </button>

              <button
                onClick={onAccept}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-800 hover:bg-blue-900 text-white text-xs font-bold rounded-lg shadow-2xs transition-colors cursor-pointer"
                title="Aceptar y aplicar a la malla"
              >
                <Check size={14} />
                <span>Aceptar</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
