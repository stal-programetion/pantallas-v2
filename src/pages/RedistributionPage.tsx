import React, { useState } from 'react';
import {
  ArrowLeftRight,
  TrendingDown,
  Building,
  Laptop,
  CheckCircle2,
  Clock,
  Sparkles,
  Compass,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { GeographicRouteMap } from '../components/redistribution/GeographicRouteMap';
import { RecommendationCard } from '../components/redistribution/RecommendationCard';
import { TooltipWhy } from '../components/common/TooltipWhy';
import { KpiCard } from '../components/common/KpiCard';

export const RedistributionPage: React.FC = () => {
  const {
    offices,
    recommendations,
    acceptRedistribution,
    rejectRedistribution,
  } = useAppStore();

  const [filterModality, setFilterModality] = useState<string>('todos');

  const filteredRecommendations = recommendations.filter((r) => {
    if (filterModality === 'todos') return true;
    return r.modalidad === filterModality;
  });

  const totalMinutosAhorrados = recommendations.reduce(
    (acc, r) => acc + (r.estado === 'aceptada' ? r.impactoEstimado.reduccionEsperaMin : 0),
    0
  );

  return (
    <div className="space-y-6">
      {/* Title & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Redistribución y Traslados Inteligentes
            </h1>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
              Heurística Territorial
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Detección automática de déficit y superávit de agentes. Propone compensaciones presenciales (&lt;45 km) o enlaces virtuales entre ciudades.
          </p>
        </div>

        <TooltipWhy
          explanation="El algoritmo calcula la distancia haversine entre las 14 oficinas. Si la sede con déficit está a menos de 45 km de una sede con superávit (ej. Corozal a Sincelejo: 15 km), propone traslado presencial. Para distancias mayores (ej. Cartagena a Montería), propone ventanilla remota Digiturno."
          rule="Modelo de Optimización Geográfica v2.4"
        />
      </div>

      {/* KPIs Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Propuestas Activas"
          value={recommendations.length}
          subtitle="Basadas en la franja pico"
          icon={ArrowLeftRight}
          iconBgColor="bg-purple-50"
          iconColor="text-purple-700"
          whyExplanation="Número de recomendaciones generadas para mitigar desbalances entre sedes."
          whyRule="Detección Déficit / Superávit"
        />

        <KpiCard
          title="Espera Reducida Estimada"
          value={`-${totalMinutosAhorrados > 0 ? totalMinutosAhorrados : 8.5} min`}
          subtitle="En sedes con déficit"
          icon={TrendingDown}
          iconBgColor="bg-emerald-50"
          iconColor="text-emerald-600"
          trend="bajando"
          isPositive={true}
          whyExplanation="Reducción neta estimada en el tiempo medio de espera de los clientes al incorporar el agente de refuerzo."
          whyRule="Impacto Erlang C (Delta Wq)"
        />

        <KpiCard
          title="Apoyo Virtual Remoto"
          value={recommendations.filter((r) => r.modalidad === 'virtual').length}
          subtitle="Ventanilla Digiturno Remota"
          icon={Laptop}
          iconBgColor="bg-blue-50"
          iconColor="text-blue-700"
          whyExplanation="Asesores que atienden la cola de otra oficina desde su puesto habitual vía enlace digital."
          whyRule="Ventanilla Virtual Surtigas"
        />

        <KpiCard
          title="Traslado Presencial"
          value={recommendations.filter((r) => r.modalidad === 'presencial').length}
          subtitle="Desplazamiento &lt;45 km"
          icon={Building}
          iconBgColor="bg-orange-50"
          iconColor="text-orange-600"
          whyExplanation="Colaboradores asignados físicamente a una oficina cercana dentro del mismo corredor vial."
          whyRule="Haversine &lt; 45 km"
        />
      </div>

      {/* Visual Geographic Map Component */}
      <GeographicRouteMap
        offices={offices}
        recommendations={recommendations}
      />

      {/* Recommendations List */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">
              Lista de Recomendaciones del Motor
            </h3>
            <span className="text-xs text-slate-500">
              Evalúa cada recomendación para aplicarla directamente a la malla de turnos
            </span>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500 font-medium">Modalidad:</span>
            <select
              value={filterModality}
              onChange={(e) => setFilterModality(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700 font-medium"
            >
              <option value="todos">Todas las modalidades</option>
              <option value="presencial">Solo Presencial (Físico)</option>
              <option value="virtual">Solo Virtual (Remoto)</option>
            </select>
          </div>
        </div>

        <div className="space-y-3">
          {filteredRecommendations.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              No se encontraron recomendaciones con el filtro seleccionado.
            </div>
          ) : (
            filteredRecommendations.map((rec) => (
              <RecommendationCard
                key={rec.id}
                recommendation={rec}
                onAccept={() => acceptRedistribution(rec.id)}
                onReject={() => rejectRedistribution(rec.id)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};
