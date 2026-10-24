import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sliders,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Users,
  RotateCcw,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { useAppStore } from '../store/useAppStore';
import { motorService, SimulationResult } from '../services';
import { TooltipWhy } from '../components/common/TooltipWhy';
import { evaluateErlangC } from '../engine/erlangC';

export const SimulatorPage: React.FC = () => {
  const navigate = useNavigate();
  const { offices, staff, absences, showToast } = useAppStore();

  // Simulation Parameters
  const [demandMultiplier, setDemandMultiplier] = useState<number>(1.2); // +20%
  const [additionalAbsences, setAdditionalAbsences] = useState<number>(2);
  const [targetSla, setTargetSla] = useState<number>(0.8);
  const [selectedOfficeFilter, setSelectedOfficeFilter] = useState<string>('cartagena-chambacu');

  const [simResult, setSimResult] = useState<SimulationResult | null>(null);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  const runSimulationAsync = async () => {
    setIsSimulating(true);
    const res = await motorService.runSimulation(
      {
        additionalAbsences,
        demandMultiplier,
        targetSla,
        officeIdFilter: selectedOfficeFilter === 'todos' ? undefined : selectedOfficeFilter,
      },
      offices,
      staff,
      absences
    );
    setSimResult(res);
    setIsSimulating(false);
  };

  useEffect(() => {
    runSimulationAsync();
  }, [demandMultiplier, additionalAbsences, targetSla, selectedOfficeFilter]);

  // Curva teórica Erlang C (SL vs Agentes) para la oficina seleccionada
  const officeForCurve = offices.find((o) => o.id === selectedOfficeFilter) || offices[0];
  const lambdaSim = 26 * demandMultiplier; // base lambda
  const erlangCurveData = Array.from({ length: 8 }, (_, i) => {
    const agents = i + 1;
    const res = evaluateErlangC(lambdaSim, 8.5, agents, 10);
    return {
      agentes: `${agents} Agentes`,
      c: agents,
      nivelServicio: Math.round(res.nivelServicio * 100),
      esperaMin: Number(res.tiempoEsperaPromedioMin.toFixed(1)),
    };
  });

  const handleApplyScenario = () => {
    showToast(
      `Escenario aplicado: Demanda multiplicada por ${Math.round(
        demandMultiplier * 100
      )}% y SLA objetivo ${Math.round(targetSla * 100)}%. Redirigiendo a Plan del Día...`,
      'success'
    );
    navigate('/plan-dia');
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Simulador de Escenarios What-If (Erlang C)
            </h1>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-orange-100 text-orange-800 border border-orange-200">
              Modelo M/M/c
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Simula fluctuaciones de afluencia masiva, contingencias de incapacidades y evalúa la capacidad requerida en segundos.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <TooltipWhy
            explanation="El simulador resuelve las ecuaciones de Erlang C en tiempo real recalculando la probabilidad de demora P(W>0) y el tiempo medio de espera Wq para cada combinación de parámetros."
            rule="Motor de Simulación Estocástica Erlang C"
          />

          <button
            onClick={handleApplyScenario}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-700 to-blue-900 hover:from-blue-800 hover:to-blue-950 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all cursor-pointer"
          >
            <Sparkles size={15} className="text-orange-400" />
            <span>Convertir en Propuesta de Plan</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Parameters on Left, Results on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Interactive Parameters Panel */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Sliders size={16} className="text-orange-600" />
              <span>Parámetros de Simulación</span>
            </h3>

            <button
              onClick={() => {
                setDemandMultiplier(1.0);
                setAdditionalAbsences(0);
                setTargetSla(0.8);
              }}
              className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw size={12} />
              <span>Reset</span>
            </button>
          </div>

          {/* Sede selector */}
          <div className="space-y-1.5 text-xs">
            <label className="font-bold text-slate-700 block">Alcance del Escenario:</label>
            <select
              value={selectedOfficeFilter}
              onChange={(e) => setSelectedOfficeFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 font-semibold"
            >
              <option value="todos">Toda la Red (14 Oficinas)</option>
              {offices.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nombre} ({o.ciudad})
                </option>
              ))}
            </select>
          </div>

          {/* Slider 1: Demand Multiplier */}
          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <label className="font-bold text-slate-700">Incremento de Demanda:</label>
              <span className="font-mono font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-md border border-orange-200">
                {demandMultiplier >= 1 ? `+${Math.round((demandMultiplier - 1) * 100)}%` : `-${Math.round((1 - demandMultiplier) * 100)}%`} ({Math.round(demandMultiplier * 100)}%)
              </span>
            </div>
            <input
              type="range"
              min="0.7"
              max="1.6"
              step="0.05"
              value={demandMultiplier}
              onChange={(e) => setDemandMultiplier(parseFloat(e.target.value))}
              className="w-full accent-orange-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>-30% (Baja afluencia)</span>
              <span>Normal (100%)</span>
              <span>+60% (Corte masivo)</span>
            </div>
          </div>

          {/* Slider 2: Additional Absences */}
          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <label className="font-bold text-slate-700">Ausencias Adicionales:</label>
              <span className="font-mono font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                +{additionalAbsences} colaboradores
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="5"
              step="1"
              value={additionalAbsences}
              onChange={(e) => setAdditionalAbsences(parseInt(e.target.value, 10))}
              className="w-full accent-rose-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>0 ausencias</span>
              <span>+3 ausencias</span>
              <span>+5 ausencias</span>
            </div>
          </div>

          {/* Slider 3: Target SLA */}
          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <label className="font-bold text-slate-700">Nivel de Servicio Objetivo:</label>
              <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                {Math.round(targetSla * 100)}% en &le; 10 min
              </span>
            </div>
            <input
              type="range"
              min="0.7"
              max="0.95"
              step="0.05"
              value={targetSla}
              onChange={(e) => setTargetSla(parseFloat(e.target.value))}
              className="w-full accent-blue-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>70% (Mínimo CREG)</span>
              <span>80% (Estándar Surtigas)</span>
              <span>95% (Exigente)</span>
            </div>
          </div>
        </div>

        {/* Right 2 Columns: Side-by-Side Comparison & Erlang Curve */}
        <div className="lg:col-span-2 space-y-6">
          {/* Side-by-Side Results Panel */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">
                Resultados Comparativos: Escenario Base vs. Simulado
              </h3>
              <span className="text-xs font-mono text-slate-400">
                {isSimulating ? 'Recalculando colas...' : 'Simulación sincronizada'}
              </span>
            </div>

            {/* Side-by-Side Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Base Scenario */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Escenario Base Actual
                </span>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Nivel de Servicio (SLA):</span>
                    <span className="font-extrabold text-base text-blue-800">
                      {Math.round((simResult?.slaActualPonderado || 0.82) * 100)}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Espera Promedio:</span>
                    <span className="font-extrabold text-base text-slate-900">
                      {simResult?.esperaActualMin || 6.8} min
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Agentes Activos:</span>
                    <span className="font-bold text-slate-800">
                      {simResult?.totalAgentesActuales || 32} puestos
                    </span>
                  </div>
                </div>
              </div>

              {/* Simulated Scenario */}
              <div className="p-4 rounded-xl border-2 border-orange-300 bg-orange-50/40 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-orange-700 uppercase tracking-wider block">
                    Escenario Simulado What-If
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-200 text-orange-900">
                    Proyectado
                  </span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-700 font-semibold">Nivel de Servicio (SLA):</span>
                    <span
                      className={`font-extrabold text-base ${
                        (simResult?.slaSimuladoPonderado || 0) < targetSla
                          ? 'text-rose-600'
                          : 'text-emerald-600'
                      }`}
                    >
                      {Math.round((simResult?.slaSimuladoPonderado || 0.74) * 100)}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-700 font-semibold">Espera Promedio Proyectada:</span>
                    <span className="font-extrabold text-base text-slate-900">
                      {simResult?.esperaSimuladaMin || 11.4} min
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-700 font-semibold">Agentes Requeridos (Erlang C):</span>
                    <span className="font-bold text-blue-900">
                      {simResult?.totalAgentesSimulados || 36} puestos
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Erlang C Curve Chart */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-slate-800">
                  Curva de Capacidad Erlang C: Nivel de Servicio vs. Número de Agentes
                </h4>
                <span className="text-[11px] text-slate-400 font-mono">
                  Sede: {officeForCurve.nombre}
                </span>
              </div>

              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={erlangCurveData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="agentes" tick={{ fontSize: 10, fill: '#64748B' }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#64748B' }} unit="%" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0F172A',
                        borderRadius: '8px',
                        border: 'none',
                        color: '#FFFFFF',
                        fontSize: '12px',
                      }}
                      formatter={(val: any) => [`${val}%`, 'Nivel de Servicio']}
                    />
                    <ReferenceLine
                      y={Math.round(targetSla * 100)}
                      stroke="#8BBF3F"
                      strokeDasharray="4 4"
                      label={{
                        value: `Meta ${Math.round(targetSla * 100)}%`,
                        fill: '#8BBF3F',
                        fontSize: 10,
                        position: 'insideBottomRight',
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="nivelServicio"
                      stroke="#1F2B6B"
                      strokeWidth={3}
                      dot={{ r: 4, fill: '#2D79AD' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
