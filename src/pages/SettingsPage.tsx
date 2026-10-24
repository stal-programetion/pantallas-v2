import React, { useState } from 'react';
import {
  Settings,
  Database,
  Building2,
  Users,
  Shield,
  Activity,
  CheckCircle2,
  AlertCircle,
  Wifi,
  WifiOff,
  RefreshCw,
  Plus,
  Edit2,
  Save,
  Flame,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { useAuthStore } from '../store/useAuthStore';
import { digiturnoService, DigiturnoConnectionStatus } from '../services';
import { Office, Staff } from '../types';
import { Modal } from '../components/common/Modal';

export const SettingsPage: React.FC = () => {
  const { offices, staff, sourceMode, setSourceMode, showToast } = useAppStore();
  const { canEditSettings } = useAuthStore();

  const [activeTab, setActiveTab] = useState<'digiturno' | 'oficinas' | 'colaboradores' | 'reglas'>('digiturno');

  // Connection testing state
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<DigiturnoConnectionStatus | null>(null);

  // SLA and rule parameters
  const [targetSla, setTargetSla] = useState(80);
  const [maxWaitMin, setMaxWaitMin] = useState(10);
  const [maxPresencialKm, setMaxPresencialKm] = useState(45);
  const [lunchDuration, setLunchDuration] = useState(60);

  // Edit Office Modal
  const [editingOffice, setEditingOffice] = useState<Office | null>(null);

  const handleTestConnection = async () => {
    setTestingConnection(true);
    try {
      const status = await digiturnoService.testConnection();
      setConnectionStatus(status);
      showToast(status.connected ? 'Conexión con Digiturno verificada exitosamente' : 'Fallo de conexión', status.connected ? 'success' : 'error');
    } catch {
      showToast('Error de comunicación con el servicio', 'error');
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSaveOffice = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingOffice) {
      showToast(`Oficina ${editingOffice.nombre} actualizada correctamente`, 'success');
      setEditingOffice(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Configuración y Parámetros del Sistema
            </h1>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-800">
              Administración
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Gestión de catálogos de sedes y personal, conector con Digiturno y umbrales de SLA CREG.
          </p>
        </div>

        {!canEditSettings() && (
          <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl">
            Modo Consulta: Solo el Administrador puede persistir cambios en esta sección
          </span>
        )}
      </div>

      {/* Tabs Bar */}
      <div className="flex border-b border-slate-200 bg-white rounded-xl p-1 shadow-2xs gap-1">
        <button
          onClick={() => setActiveTab('digiturno')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'digiturno'
              ? 'bg-blue-800 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Database size={15} />
          <span>Conector Digiturno</span>
        </button>

        <button
          onClick={() => setActiveTab('oficinas')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'oficinas'
              ? 'bg-blue-800 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Building2 size={15} />
          <span>Oficinas ({offices.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('colaboradores')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'colaboradores'
              ? 'bg-blue-800 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Users size={15} />
          <span>Colaboradores ({staff.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('reglas')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'reglas'
              ? 'bg-blue-800 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Shield size={15} />
          <span>Reglas Laborales y SLA</span>
        </button>
      </div>

      {/* Tab 1: Conector Digiturno */}
      {activeTab === 'digiturno' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="flex items-start justify-between pb-4 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Database size={18} className="text-blue-700" />
                <span>Estado de la Integración con Digiturno API</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Configura el origen de datos. Las pantallas de la plataforma consumen la capa de servicios sin requerir cambios al conectar la API real.
              </p>
            </div>

            <button
              onClick={handleTestConnection}
              disabled={testingConnection}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-800 hover:bg-blue-900 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <RefreshCw size={14} className={testingConnection ? 'animate-spin' : ''} />
              <span>{testingConnection ? 'Probando...' : 'Probar Conexión'}</span>
            </button>
          </div>

          {/* Mode Switcher */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
            <span className="text-xs font-bold text-slate-700 block">
              Modo de Operación del Conector:
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label
                onClick={() => setSourceMode('mock')}
                className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                  sourceMode === 'mock'
                    ? 'border-blue-700 bg-blue-50/80 ring-2 ring-blue-500/20'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="sourceMode"
                  checked={sourceMode === 'mock'}
                  onChange={() => setSourceMode('mock')}
                  className="mt-1"
                />
                <div>
                  <div className="font-bold text-slate-900 text-xs">
                    Datos Simulados Reproducibles (Piloto TRL 6)
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Generador pseudo-aleatorio con semilla fija Mulberry32 y 3 meses de histórico verosímil.
                  </p>
                </div>
              </label>

              <label
                onClick={() => setSourceMode('real')}
                className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                  sourceMode === 'real'
                    ? 'border-blue-700 bg-blue-50/80 ring-2 ring-blue-500/20'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="sourceMode"
                  checked={sourceMode === 'real'}
                  onChange={() => setSourceMode('real')}
                  className="mt-1"
                />
                <div>
                  <div className="font-bold text-slate-900 text-xs">
                    API REST / WebSocket Digiturno (Producción)
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Endpoint corporativo Surtigas: https://api-digiturno.surtigas.com.co/v2.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Connection Test Results Box */}
          {connectionStatus && (
            <div
              className={`p-4 rounded-xl border text-xs space-y-2 ${
                connectionStatus.connected
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                  : 'bg-amber-50 border-amber-300 text-amber-950'
              }`}
            >
              <div className="flex items-center gap-2 font-bold">
                {connectionStatus.connected ? (
                  <CheckCircle2 size={16} className="text-emerald-600" />
                ) : (
                  <AlertCircle size={16} className="text-amber-600" />
                )}
                <span>{connectionStatus.message}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 font-mono text-[11px] pt-1">
                <div>Endpoint: {connectionStatus.endpointUrl}</div>
                <div>Latencia: {connectionStatus.latencyMs} ms</div>
                <div>Versión API: {connectionStatus.version}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Oficinas CRUD */}
      {activeTab === 'oficinas' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                Catálogo de Oficinas y Sedes Surtigas ({offices.length})
              </h3>
              <p className="text-xs text-slate-500">
                Puestos de atención físicos instalados y coordenadas de localización.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-200">
                <tr>
                  <th className="p-3.5">Nombre Sede</th>
                  <th className="p-3.5">Ciudad</th>
                  <th className="p-3.5">Departamento</th>
                  <th className="p-3.5">Capacidad Puestos</th>
                  <th className="p-3.5">Horario</th>
                  <th className="p-3.5">Coordenadas</th>
                  <th className="p-3.5 text-right">Editar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {offices.map((off) => (
                  <tr key={off.id} className="hover:bg-slate-50/80">
                    <td className="p-3.5 font-bold text-slate-900">{off.nombre}</td>
                    <td className="p-3.5 text-slate-700">{off.ciudad}</td>
                    <td className="p-3.5 font-medium text-slate-700">{off.departamento}</td>
                    <td className="p-3.5 font-bold text-blue-900">{off.capacidadPuestos} puestos</td>
                    <td className="p-3.5 font-mono text-slate-600">
                      {off.horarioAtencion.inicio} - {off.horarioAtencion.fin}
                    </td>
                    <td className="p-3.5 font-mono text-[11px] text-slate-400">
                      {off.coordenadas.lat.toFixed(2)}, {off.coordenadas.lng.toFixed(2)}
                    </td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => setEditingOffice(off)}
                        className="p-1 text-slate-400 hover:text-blue-700 rounded-md hover:bg-slate-100 transition-colors"
                      >
                        <Edit2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Colaboradores CRUD */}
      {activeTab === 'colaboradores' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                Colaboradores de Atención al Cliente ({staff.length})
              </h3>
              <p className="text-xs text-slate-500">
                Jornada contractual, ventana de almuerzo y modalidad de operación.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-200">
                <tr>
                  <th className="p-3.5">Nombre / Cédula</th>
                  <th className="p-3.5">Sede Base</th>
                  <th className="p-3.5">Cargo</th>
                  <th className="p-3.5">Modalidad</th>
                  <th className="p-3.5">Ventana Almuerzo</th>
                  <th className="p-3.5">Competencias</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {staff.map((colab) => {
                  const off = offices.find((o) => o.id === colab.oficinaBaseId);
                  return (
                    <tr key={colab.id} className="hover:bg-slate-50/80">
                      <td className="p-3.5">
                        <div className="font-bold text-slate-900">{colab.nombre}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {colab.documento}
                        </div>
                      </td>
                      <td className="p-3.5 font-medium text-slate-700">{off?.nombre}</td>
                      <td className="p-3.5 text-slate-600">{colab.cargo}</td>
                      <td className="p-3.5 font-semibold capitalize text-blue-800">
                        {colab.modalidad}
                      </td>
                      <td className="p-3.5 font-mono text-slate-600">
                        {colab.ventanaAlmuerzo.inicio} - {colab.ventanaAlmuerzo.fin} (60m)
                      </td>
                      <td className="p-3.5 text-slate-500 max-w-xs truncate">
                        {colab.competencias.join(', ')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Reglas Laborales y SLA */}
      {activeTab === 'reglas' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="pb-3 border-b border-slate-100">
            <h3 className="font-bold text-slate-900 text-sm">
              Reglas Laborales y Parámetros del Motor de Optimización
            </h3>
            <p className="text-xs text-slate-500">
              Ajusta los umbrales utilizados por Erlang C para generar las mallas y alertas.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2">
              <label className="font-bold text-slate-800 block">
                Nivel de Servicio Objetivo (SLA CREG):
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="60"
                  max="99"
                  value={targetSla}
                  onChange={(e) => setTargetSla(Number(e.target.value))}
                  className="w-24 bg-white border border-slate-300 rounded-lg p-2 font-bold text-slate-900"
                />
                <span className="text-slate-500">% atendidos en menos del tiempo máximo</span>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2">
              <label className="font-bold text-slate-800 block">
                Tiempo Máximo de Espera en Fila:
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="5"
                  max="30"
                  value={maxWaitMin}
                  onChange={(e) => setMaxWaitMin(Number(e.target.value))}
                  className="w-24 bg-white border border-slate-300 rounded-lg p-2 font-bold text-slate-900"
                />
                <span className="text-slate-500">minutos (umbral regulatorio)</span>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2">
              <label className="font-bold text-slate-800 block">
                Distancia Máxima para Traslados Presenciales:
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="10"
                  max="100"
                  value={maxPresencialKm}
                  onChange={(e) => setMaxPresencialKm(Number(e.target.value))}
                  className="w-24 bg-white border border-slate-300 rounded-lg p-2 font-bold text-slate-900"
                />
                <span className="text-slate-500">km (más allá se asigna modalidad virtual)</span>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2">
              <label className="font-bold text-slate-800 block">
                Duración del Turno de Almuerzo:
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="30"
                  max="90"
                  step="30"
                  value={lunchDuration}
                  onChange={(e) => setLunchDuration(Number(e.target.value))}
                  className="w-24 bg-white border border-slate-300 rounded-lg p-2 font-bold text-slate-900"
                />
                <span className="text-slate-500">minutos (2 franjas de 30 min)</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-3">
            <button
              onClick={() => showToast('Parámetros guardados correctamente', 'success')}
              className="px-5 py-2.5 bg-blue-800 hover:bg-blue-900 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer flex items-center gap-2"
            >
              <Save size={15} />
              <span>Guardar Reglas Laborales</span>
            </button>
          </div>
        </div>
      )}

      {/* Edit Office Modal */}
      {editingOffice && (
        <Modal
          isOpen={true}
          onClose={() => setEditingOffice(null)}
          title={`Editar Sede: ${editingOffice.nombre}`}
          maxWidth="md"
        >
          <form onSubmit={handleSaveOffice} className="space-y-4 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Nombre Oficina:</label>
              <input
                type="text"
                value={editingOffice.nombre}
                onChange={(e) => setEditingOffice({ ...editingOffice, nombre: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-800"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Puestos de Capacidad:</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={editingOffice.capacidadPuestos}
                  onChange={(e) =>
                    setEditingOffice({
                      ...editingOffice,
                      capacidadPuestos: parseInt(e.target.value, 10),
                    })
                  }
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-800"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Ciudad:</label>
                <input
                  type="text"
                  value={editingOffice.ciudad}
                  onChange={(e) => setEditingOffice({ ...editingOffice, ciudad: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-800"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingOffice(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-800 hover:bg-blue-900 text-white rounded-lg font-bold"
              >
                Guardar Cambios
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
