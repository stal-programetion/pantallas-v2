import React, { useState } from 'react';
import { Office, RedistributionRecommendation } from '../../types';
import { TrafficLight } from '../common/TrafficLight';

interface GeographicRouteMapProps {
  offices: Office[];
  recommendations: RedistributionRecommendation[];
}

export const GeographicRouteMap: React.FC<GeographicRouteMapProps> = ({
  offices,
  recommendations,
}) => {
  const [selectedOffice, setSelectedOffice] = useState<Office | null>(null);

  // Rango de coordenadas de la zona de operación de Surtigas (Caribe Colombiano & Urabá)
  // Lat: ~7.5 a ~11.5
  // Lng: ~ -76.8 a ~ -73.8
  const minLat = 7.6;
  const maxLat = 11.4;
  const minLng = -76.8;
  const maxLng = -73.8;

  // Conversión de coordenadas geográficas a porcentajes relativos en el SVG/Canvas (con proyección Mercator básica)
  const getCoordinates = (lat: number, lng: number) => {
    const x = ((lng - minLng) / (maxLng - minLng)) * 100;
    const y = ((maxLat - lat) / (maxLat - minLat)) * 100;
    return { x: Math.max(5, Math.min(95, x)), y: Math.max(5, Math.min(95, y)) };
  };

  return (
    <div className="bg-slate-950 rounded-2xl p-5 border border-slate-800 text-white shadow-xl relative overflow-hidden select-none">
      {/* Map Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-800 relative z-10">
        <div>
          <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
            <span>Red Geográfica de Oficinas y Rutas de Apoyo</span>
            <span className="text-[10px] font-mono bg-blue-900/60 text-blue-300 border border-blue-700/60 px-2 py-0.5 rounded-full">
              Bolívar • Córdoba • Sucre • Antioquia • Magdalena
            </span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Visualización interactiva de proximidad territorial, traslados físicos (&lt;45 km) y enlaces virtuales.
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5 text-slate-300">
            <span className="w-3 h-0.5 bg-orange-500 rounded-full" /> Presencial
          </span>
          <span className="flex items-center gap-1.5 text-slate-300">
            <span className="w-3 h-0.5 bg-purple-400 border-b border-dashed border-purple-400" /> Virtual
          </span>
        </div>
      </div>

      {/* Interactive Map Visual Area */}
      <div className="relative w-full h-[460px] bg-slate-900/50 rounded-xl mt-4 overflow-hidden border border-slate-800/80">
        {/* Subtle background grid pattern */}
        <div
          className="absolute inset-0 opacity-15"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, #94a3b8 1px, transparent 0)',
            backgroundSize: '24px 24px',
          }}
        />

        {/* SVG Drawing for Connecting Routes */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
          <defs>
            <linearGradient id="gradientPresencial" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#8BBF3F" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#3DB4E6" stopOpacity="0.9" />
            </linearGradient>
            <linearGradient id="gradientVirtual" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#A855F7" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.8" />
            </linearGradient>
          </defs>

          {recommendations.map((rec) => {
            const originOffice = offices.find((o) => o.id === rec.oficinaOrigenId);
            const destOffice = offices.find((o) => o.id === rec.oficinaDestinoId);
            if (!originOffice || !destOffice) return null;

            const p1 = getCoordinates(
              originOffice.coordenadas.lat,
              originOffice.coordenadas.lng
            );
            const p2 = getCoordinates(
              destOffice.coordenadas.lat,
              destOffice.coordenadas.lng
            );

            // Curvatura del arco
            const midX = (p1.x + p2.x) / 2;
            const midY = (p1.y + p2.y) / 2 - (rec.modalidad === 'virtual' ? 6 : 3);

            const isPresencial = rec.modalidad === 'presencial';

            return (
              <g key={rec.id}>
                {/* Curved connecting line */}
                <path
                  d={`M ${p1.x}% ${p1.y}% Q ${midX}% ${midY}% ${p2.x}% ${p2.y}%`}
                  fill="none"
                  stroke={isPresencial ? 'url(#gradientPresencial)' : 'url(#gradientVirtual)'}
                  strokeWidth={isPresencial ? '2.5' : '2'}
                  strokeDasharray={isPresencial ? 'none' : '4 3'}
                  className="animate-pulse"
                />
                {/* Midpoint marker indicating km */}
                <circle cx={`${midX}%`} cy={`${midY}%`} r="3" fill="#FFFFFF" />
              </g>
            );
          })}
        </svg>

        {/* Office Location Markers (Pins) */}
        {offices.map((office) => {
          const { x, y } = getCoordinates(
            office.coordenadas.lat,
            office.coordenadas.lng
          );

          // Chequear si es origen o destino de redistribución
          const isOrigin = recommendations.some((r) => r.oficinaOrigenId === office.id);
          const isDest = recommendations.some((r) => r.oficinaDestinoId === office.id);
          const isSelected = selectedOffice?.id === office.id;

          let ringColor = 'bg-blue-600';
          if (isDest) ringColor = 'bg-rose-500 animate-ping';
          if (isOrigin) ringColor = 'bg-emerald-500';

          return (
            <div
              key={office.id}
              onClick={() => setSelectedOffice(office)}
              style={{ left: `${x}%`, top: `${y}%` }}
              className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer z-20 group"
            >
              {/* Outer halo */}
              <div className="relative flex items-center justify-center">
                <span className={`w-3.5 h-3.5 rounded-full ${ringColor} opacity-75`} />
                <span className="absolute w-2.5 h-2.5 rounded-full bg-white border-2 border-slate-900" />
              </div>

              {/* Text label */}
              <div
                className={`mt-1 px-2 py-0.5 rounded-md text-[10px] font-bold whitespace-nowrap transition-all shadow-md ${
                  isSelected
                    ? 'bg-orange-500 text-white scale-110 z-30'
                    : isDest
                    ? 'bg-rose-900/90 text-rose-200 border border-rose-700'
                    : isOrigin
                    ? 'bg-emerald-900/90 text-emerald-200 border border-emerald-700'
                    : 'bg-slate-800/90 text-slate-300 border border-slate-700 group-hover:bg-slate-700'
                }`}
              >
                {office.ciudad}
              </div>
            </div>
          );
        })}

        {/* Selected Office Detail Float Card */}
        {selectedOffice && (
          <div className="absolute bottom-4 left-4 z-30 bg-slate-900/95 backdrop-blur-md p-4 rounded-xl border border-slate-700 shadow-2xl max-w-xs text-xs animate-in fade-in duration-150">
            <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-800">
              <div>
                <h4 className="font-bold text-white">{selectedOffice.nombre}</h4>
                <span className="text-[11px] text-slate-400">
                  {selectedOffice.ciudad}, {selectedOffice.departamento}
                </span>
              </div>
              <button
                onClick={() => setSelectedOffice(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="mt-2 space-y-1 text-slate-300">
              <div className="flex justify-between">
                <span>Capacidad:</span>
                <span className="font-bold text-white">{selectedOffice.capacidadPuestos} puestos</span>
              </div>
              <div className="flex justify-between">
                <span>Horario:</span>
                <span className="font-mono text-slate-300">
                  {selectedOffice.horarioAtencion.inicio} - {selectedOffice.horarioAtencion.fin}
                </span>
              </div>
              <div className="flex justify-between">
                <span>SLA Objetivo:</span>
                <span className="font-bold text-emerald-400">
                  {Math.round(selectedOffice.slaObjetivo * 100)}% en &le; 10 min
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
