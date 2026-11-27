import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { useAppStore } from '../../store/useAppStore';

export const LiveQueueChart: React.FC<{ bare?: boolean }> = ({ bare = false }) => {
  const { networkLoad } = useAppStore();

  const chartData = networkLoad.map((point) => ({
    franja: point.franja,
    'Demanda Pronosticada': point.demandaPronosticada,
    'Llegadas Digiturno': point.llegadasDigiturno,
    'Capacidad Operativa': point.capacidadOperativa,
  }));

  return (
    <div className={bare ? '' : 'bg-white rounded-2xl border border-slate-200 p-5'}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
            <span>Carga de la red vs. pronóstico</span>
            {!bare && (
              <span className="text-[10px] font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200">
                Red Surtigas (14 Oficinas)
              </span>
            )}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Llegadas por hora, franjas de 30 min, frente al modelo Erlang C.
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs font-medium text-slate-600 whitespace-nowrap">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#2D79AD]" /> Pronóstico
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#8BBF3F]" /> Llegadas Reales
          </span>
        </div>
      </div>

      <div className="h-60 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
            <defs>
              <linearGradient id="colorPronostico" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2D79AD" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#2D79AD" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="colorReal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8BBF3F" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#8BBF3F" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
            <XAxis dataKey="franja" tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#0F172A',
                borderRadius: '8px',
                border: 'none',
                color: '#FFFFFF',
                fontSize: '12px',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
              }}
              formatter={(value: any, name: any) => [`${value} clientes/h`, name]}
            />
            <Area
              type="monotone"
              dataKey="Demanda Pronosticada"
              stroke="#2D79AD"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorPronostico)"
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="Llegadas Digiturno"
              stroke="#8BBF3F"
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#colorReal)"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
