import React, { useState } from 'react';
import {
  BarChart3,
  Flame,
  Calendar,
  Clock,
  Building2,
  TrendingUp,
  Download,
  Sparkles,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
} from 'recharts';
import { useAppStore } from '../store/useAppStore';
import { OPERATING_SLOTS, predictArrivals } from '../engine/forecast';
import { TooltipWhy } from '../components/common/TooltipWhy';

export const DemandAnalysisPage: React.FC = () => {
  const { offices } = useAppStore();
  const [selectedOfficeId, setSelectedOfficeId] = useState<string>('cartagena-chambacu');
  const [compareOfficeId, setCompareOfficeId] = useState<string>('monteria-centro');

  const daysOfWeek = [
    { num: 1, name: 'Lunes' },
    { num: 2, name: 'Martes' },
    { num: 3, name: 'Miércoles' },
    { num: 4, name: 'Jueves' },
    { num: 5, name: 'Viernes' },
  ];

  // Generar datos para el mapa de calor (Día x Franja)
  const heatmapData = daysOfWeek.map((day) => {
    return {
      dayName: day.name,
      dayNum: day.num,
      slots: OPERATING_SLOTS.map((slot) => {
        const forecast = predictArrivals(selectedOfficeId, day.num, slot, false);
        return {
          slot,
          demand: forecast.llegadasEsperadas,
          isPeak: forecast.esPico,
        };
      }),
    };
  });

  // Comparativa de franjas: Día Estándar vs Día de Quincena
  const fortnightComparisonData = OPERATING_SLOTS.map((slot) => {
    const normal = predictArrivals(selectedOfficeId, 1, slot, false);
    const fortnight = predictArrivals(selectedOfficeId, 1, slot, true);

    return {
      franja: slot,
      'Día Estándar': normal.llegadasEsperadas,
      'Día de Quincena (+32%)': fortnight.llegadasEsperadas,
    };
  });

  // Comparativa entre dos oficinas
  const officeComparisonData = OPERATING_SLOTS.map((slot) => {
    const off1 = predictArrivals(selectedOfficeId, 1, slot, true);
    const off2 = predictArrivals(compareOfficeId, 1, slot, true);

    const name1 = offices.find((o) => o.id === selectedOfficeId)?.ciudad || 'Oficina 1';
    const name2 = offices.find((o) => o.id === compareOfficeId)?.ciudad || 'Oficina 2';

    return {
      franja: slot,
      [name1]: off1.llegadasEsperadas,
      [name2]: off2.llegadasEsperadas,
    };
  });

  const getHeatmapColor = (demand: number) => {
    if (demand >= 18) return 'bg-orange-600 text-white font-bold';
    if (demand >= 14) return 'bg-orange-500 text-white font-bold';
    if (demand >= 10) return 'bg-amber-400 text-slate-900 font-semibold';
    if (demand >= 7) return 'bg-blue-200 text-blue-900';
    if (demand >= 4) return 'bg-blue-100 text-blue-800';
    return 'bg-slate-100 text-slate-600';
  };

  const selectedOfficeName = offices.find((o) => o.id === selectedOfficeId)?.nombre;
  const compareOfficeName = offices.find((o) => o.id === compareOfficeId)?.nombre;

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Análisis Histórico de Demanda y Patrones Digiturno
            </h1>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
              3 Meses Histórico
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Mapas de calor día × franja, comportamiento de quincena y picos recurrentes detectados automáticamente.
          </p>
        </div>

        <TooltipWhy
          explanation="El pronóstico calcula la demanda histórica ponderando los últimos 90 días de atención en ventanilla Digiturno, ajustando por estacionalidad de pagos quincenales (+32%) y distribución horaria."
          rule="Modelo Predictivo Ponderado Surtigas"
        />
      </div>

      {/* Selectors Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <Building2 size={16} className="text-blue-800" />
          <span className="font-bold text-slate-800">Oficina Principal de Análisis:</span>
          <select
            value={selectedOfficeId}
            onChange={(e) => setSelectedOfficeId(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-slate-800 font-semibold"
          >
            {offices.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nombre} ({o.ciudad})
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-500 font-medium">Comparar con:</span>
          <select
            value={compareOfficeId}
            onChange={(e) => setCompareOfficeId(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-slate-800 font-semibold"
          >
            {offices.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nombre} ({o.ciudad})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Heatmap: Día de la Semana x Franja Horaria */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">
              Mapa de Calor de Afluencia: {selectedOfficeName}
            </h3>
            <p className="text-xs text-slate-500">
              Llegadas esperadas por franja de 30 minutos a lo largo de los días laborales
            </p>
          </div>

          {/* Scale Legend */}
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600">
            <span>Baja</span>
            <span className="w-4 h-3 rounded-xs bg-slate-100" />
            <span className="w-4 h-3 rounded-xs bg-blue-100" />
            <span className="w-4 h-3 rounded-xs bg-blue-200" />
            <span className="w-4 h-3 rounded-xs bg-amber-400" />
            <span className="w-4 h-3 rounded-xs bg-orange-600" />
            <span>Crítica (Pico)</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[900px]">
            {/* Header Slots */}
            <div className="grid grid-cols-[100px_repeat(17,1fr)] gap-1 text-[11px] font-bold text-slate-600 mb-1 text-center font-mono">
              <div className="text-left font-sans pl-2">Día</div>
              {OPERATING_SLOTS.map((s) => (
                <div key={s}>{s}</div>
              ))}
            </div>

            {/* Heatmap Grid */}
            <div className="space-y-1">
              {heatmapData.map((row) => (
                <div
                  key={row.dayName}
                  className="grid grid-cols-[100px_repeat(17,1fr)] gap-1 items-center text-xs"
                >
                  <div className="font-bold text-slate-800 text-xs pl-2">{row.dayName}</div>
                  {row.slots.map((cell) => (
                    <div
                      key={cell.slot}
                      title={`${row.dayName} ${cell.slot}: ${cell.demand} clientes esperados`}
                      className={`h-9 rounded-md flex items-center justify-center font-mono text-[11px] cursor-pointer transition-transform hover:scale-105 ${getHeatmapColor(
                        cell.demand
                      )}`}
                    >
                      {cell.demand}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Two Comparison Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Fortnight Impact */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
          <div>
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Flame size={16} className="text-orange-500" />
              <span>Patrón de Quincena vs. Día Estándar</span>
            </h3>
            <p className="text-xs text-slate-500">
              Impacto del ciclo de cobro (días 14-16 y 29-31) sobre la afluencia en {selectedOfficeName}.
            </p>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={fortnightComparisonData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="franja" tick={{ fontSize: 10, fill: '#64748B' }} />
                <YAxis tick={{ fontSize: 10, fill: '#64748B' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0F172A',
                    borderRadius: '8px',
                    border: 'none',
                    color: '#FFFFFF',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Bar dataKey="Día Estándar" fill="#2D79AD" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Día de Quincena (+32%)" fill="#8BBF3F" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Office vs Office */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
          <div>
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Building2 size={16} className="text-blue-700" />
              <span>Comparación de Carga entre Oficinas</span>
            </h3>
            <p className="text-xs text-slate-500">
              Curva de llegadas horarias comparando {selectedOfficeName} vs. {compareOfficeName}.
            </p>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={officeComparisonData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="franja" tick={{ fontSize: 10, fill: '#64748B' }} />
                <YAxis tick={{ fontSize: 10, fill: '#64748B' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0F172A',
                    borderRadius: '8px',
                    border: 'none',
                    color: '#FFFFFF',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Line
                  type="monotone"
                  dataKey={offices.find((o) => o.id === selectedOfficeId)?.ciudad || 'Oficina 1'}
                  stroke="#1F2B6B"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey={offices.find((o) => o.id === compareOfficeId)?.ciudad || 'Oficina 2'}
                  stroke="#8BBF3F"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
