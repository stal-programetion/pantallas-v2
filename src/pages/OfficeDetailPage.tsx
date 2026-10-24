import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Building2,
  Users,
  Clock,
  Phone,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  UserCheck,
  Send,
  UserPlus,
  ShieldAlert,
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
} from 'recharts';
import { useAppStore } from '../store/useAppStore';
import { TrafficLight } from '../components/common/TrafficLight';
import { StatusBadge } from '../components/common/StatusBadge';
import { OPERATING_SLOTS, predictArrivals } from '../engine/forecast';
import { TooltipWhy } from '../components/common/TooltipWhy';

export const OfficeDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    offices,
    staff,
    liveMetrics,
    alerts,
    currentPlan,
    currentSlotTime,
    showToast,
  } = useAppStore();

  const office = offices.find((o) => o.id === id) || offices[0];
  const metrics = liveMetrics.find((m) => m.oficinaId === office.id);
  const officeStaff = staff.filter((s) => s.oficinaBaseId === office.id);
  const officeAlerts = alerts.filter((a) => a.oficinaId === office.id);

  // Pronóstico de las próximas 4 franjas horarias
  const currentSlotIndex = OPERATING_SLOTS.indexOf(currentSlotTime);
  const next4Slots = OPERATING_SLOTS.slice(
    Math.max(0, currentSlotIndex),
    Math.min(OPERATING_SLOTS.length, currentSlotIndex + 4)
  );

  const forecastNextHours = next4Slots.map((slot) => {
    const f = predictArrivals(office.id, 1, slot, false);
    return {
      franja: slot,
      llegadas: f.llegadasEsperadas,
      esPico: f.esPico,
      tramite: f.tramitePredominante,
    };
  });

  // Datos simulados de actividad del día
  const dailyActivityData = OPERATING_SLOTS.slice(0, Math.max(1, currentSlotIndex + 1)).map(
    (slot) => {
      const f = predictArrivals(office.id, 1, slot, false);
      return {
        franja: slot,
        Atendidos: Math.round(f.llegadasEsperadas * 0.95),
        EnEspera: Math.max(1, Math.round(f.llegadasEsperadas * 0.2)),
      };
    }
  );

  const handleRequestSupport = () => {
    showToast(
      `Solicitud de refuerzo virtual enviada para ${office.nombre}. El motor ha generado una propuesta de apoyo remoto.`,
      'info'
    );
    navigate('/redistribucion');
  };

  const handleReleaseStaff = () => {
    showToast(
      `Capacidad liberada en ${office.nombre}: 1 puesto puesto a disposición para apoyo a sedes con déficit.`,
      'success'
    );
  };

  return (
    <div className="space-y-6">
      {/* Office Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-800 flex items-center justify-center font-bold">
              <Building2 size={22} />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 leading-tight">
                {office.nombre}
              </h1>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-0.5">
                <span className="flex items-center gap-1">
                  <MapPin size={12} className="text-slate-400" />
                  {office.direccion}, {office.ciudad} ({office.departamento})
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Phone size={12} className="text-slate-400" />
                  {office.telefono}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Office Status & Quick Selector */}
        <div className="flex items-center gap-3">
          <TrafficLight
            status={metrics?.estadoSla || 'optimo'}
            value={metrics ? Math.round(metrics.slaActual * 100) : 82}
            size="md"
          />

          <select
            value={office.id}
            onChange={(e) => navigate(`/oficina/${e.target.value}`)}
            className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 font-semibold"
          >
            {offices.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nombre} ({o.ciudad})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Realtime KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-slate-500 font-medium block">Clientes en Fila</span>
          <div className="text-2xl font-extrabold text-slate-900 mt-1 flex items-baseline gap-1">
            <span>{metrics?.clientesEnFila || 4}</span>
            <span className="text-[11px] text-slate-400 font-normal">tickets activos</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-slate-500 font-medium block">Tiempo Medio de Espera</span>
          <div className="text-2xl font-extrabold text-orange-600 mt-1 flex items-baseline gap-1">
            <span>{Math.round(metrics?.esperaPromedioMin || 6.2)} min</span>
            <span className="text-[11px] text-slate-400 font-normal">meta &le; 10 min</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-slate-500 font-medium block">Personal en Ventanilla</span>
          <div className="text-2xl font-extrabold text-blue-800 mt-1 flex items-baseline gap-1">
            <span>
              {metrics?.agentesActivos || office.capacidadPuestos} / {office.capacidadPuestos}
            </span>
            <span className="text-[11px] text-slate-400 font-normal">puestos</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-slate-500 font-medium block">Horario de Operación</span>
          <div className="text-lg font-extrabold text-slate-800 mt-1 font-mono">
            {office.horarioAtencion.inicio} - {office.horarioAtencion.fin}
          </div>
        </div>
      </div>

      {/* Main Grid: Staff Assigned & Forecast */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Staff in this Office & Live Daily Chart */}
        <div className="lg:col-span-2 space-y-6">
          {/* Staff Assigned Table */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Users size={16} className="text-blue-800" />
                <span>Colaboradores Asignados a la Sede ({officeStaff.length})</span>
              </h3>
              <span className="text-xs text-slate-400">
                Franja actual: {currentSlotTime}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-2.5">Colaborador</th>
                    <th className="p-2.5">Cargo</th>
                    <th className="p-2.5">Estado Ahora</th>
                    <th className="p-2.5">Ventana Almuerzo</th>
                    <th className="p-2.5">Modalidad</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {officeStaff.map((colab) => {
                    const currentSlotState =
                      currentPlan?.turnos[colab.id]?.slots[currentSlotTime]?.estado || 'atencion';

                    return (
                      <tr key={colab.id} className="hover:bg-slate-50">
                        <td className="p-2.5 font-bold text-slate-900">
                          {colab.nombre}
                        </td>
                        <td className="p-2.5 text-slate-600">{colab.cargo}</td>
                        <td className="p-2.5">
                          <StatusBadge status={currentSlotState} size="sm" />
                        </td>
                        <td className="p-2.5 font-mono text-slate-500">
                          {colab.ventanaAlmuerzo.inicio} - {colab.ventanaAlmuerzo.fin}
                        </td>
                        <td className="p-2.5 font-medium text-slate-700 capitalize">
                          {colab.modalidad}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Daily Hourly Activity Chart */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
            <h3 className="font-bold text-slate-900 text-sm">
              Tickets Atendidos vs. En Espera Hoy
            </h3>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyActivityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
                  <Bar dataKey="Atendidos" fill="#1F2B6B" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="EnEspera" fill="#8BBF3F" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Next 4 Hours Forecast & Quick Actions */}
        <div className="space-y-6">
          {/* Quick Actions Panel */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
            <h3 className="font-bold text-slate-900 text-sm">
              Acciones Operativas Inmediatas
            </h3>
            <p className="text-xs text-slate-500">
              Solicita refuerzo o cede capacidad según la demanda en tiempo real.
            </p>

            <div className="space-y-2 pt-2">
              <button
                onClick={handleRequestSupport}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-blue-200 bg-blue-50/70 hover:bg-blue-100/70 text-blue-900 font-bold text-xs transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <UserPlus size={16} className="text-blue-700" />
                  <span>Pedir Refuerzo Virtual</span>
                </div>
                <ArrowRight size={14} />
              </button>

              <button
                onClick={handleReleaseStaff}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Send size={16} className="text-slate-500" />
                  <span>Liberar Personal para Red</span>
                </div>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>

          {/* Forecast for Next 4 Hours */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">
                Pronóstico Próximas 4 Franjas
              </h3>
              <span className="text-[10px] font-mono text-slate-400">Erlang C</span>
            </div>

            <div className="space-y-2">
              {forecastNextHours.map((slot) => (
                <div
                  key={slot.franja}
                  className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                    slot.esPico
                      ? 'bg-orange-50 border-orange-200 text-orange-950 font-bold'
                      : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}
                >
                  <div>
                    <span className="font-mono">{slot.franja}</span>
                    <span className="text-[10px] block font-normal text-slate-500 truncate max-w-[170px]">
                      {slot.tramite}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-extrabold">{slot.llegadas} cli</span>
                    <span className="text-[10px] block font-normal text-slate-400">
                      {slot.esPico ? '🔥 Franja Pico' : 'Normal'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
