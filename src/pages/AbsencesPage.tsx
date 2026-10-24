import React, { useState } from 'react';
import {
  UserX,
  Plus,
  ShieldCheck,
  Calendar,
  Clock,
  Trash2,
  AlertTriangle,
  Building2,
  Sparkles,
  Lock,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { useAuthStore } from '../store/useAuthStore';
import { Absence, AbsenceType } from '../types';
import { StatusBadge } from '../components/common/StatusBadge';
import { Modal } from '../components/common/Modal';
import { TooltipWhy } from '../components/common/TooltipWhy';

export const AbsencesPage: React.FC = () => {
  const {
    absences,
    staff,
    offices,
    createAbsence,
    removeAbsence,
    showToast,
  } = useAppStore();

  const { canViewHealthData, currentUser } = useAuthStore();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filterType, setFilterType] = useState<string>('todos');

  // Form State
  const [selectedStaffId, setSelectedStaffId] = useState<string>('st-01');
  const [tipo, setTipo] = useState<AbsenceType>('incapacidad_general');
  const [fechaInicio, setFechaInicio] = useState<string>('2026-10-15');
  const [fechaFin, setFechaFin] = useState<string>('2026-10-17');
  const [diagnostico, setDiagnostico] = useState<string>('CIE-10 J00: Rinofaringitis aguda con incapacidad médica');
  const [motivoDetalle, setMotivoDetalle] = useState<string>('Reposo domiciliario expedido por médico tratante EPS.');
  const [aprobadoPor, setAprobadoPor] = useState<string>('Dr. Andrés Restrepo (Salud Ocupacional Surtigas)');

  // Selected collaborator info for impact calculation preview
  const selectedColab = staff.find((s) => s.id === selectedStaffId);
  const selectedOffice = offices.find((o) => o.id === selectedColab?.oficinaBaseId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedColab || !selectedOffice) return;

    await createAbsence({
      colaboradorId: selectedStaffId,
      tipo,
      fechaInicio,
      fechaFin,
      diagnosticoSalud: diagnostico,
      motivoDetalle,
      aprobadoPor,
      estado: 'activa',
      impactoEstimado: {
        deficitHoras: 15,
        oficinasAfectadas: [selectedOffice.id],
      },
    });

    setIsModalOpen(false);
  };

  const filteredAbsences = absences.filter((a) => {
    if (filterType === 'todos') return true;
    return a.tipo === filterType;
  });

  return (
    <div className="space-y-6">
      {/* Title & Action */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Gestión de Ausencias y Salud Laboral
            </h1>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
              {absences.filter((a) => a.estado === 'activa').length} Activas Hoy
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Registro de incapacidades médicas y permisos con cálculo instantáneo de impacto en cobertura y reasignación de malla.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <TooltipWhy
            explanation="La información médica y diagnósticos CIE-10 está restringida bajo la Ley 1581 y directrices de Salud y Seguridad en el Trabajo. Solo usuarios Administradores y Coordinadores de Turnos tienen permiso de visualización."
            rule="Confidencialidad de Datos de Salud"
          />

          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all cursor-pointer"
          >
            <Plus size={16} />
            <span>Registrar Nueva Ausencia</span>
          </button>
        </div>
      </div>

      {/* Role Access Security Notice */}
      {!canViewHealthData() && (
        <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock size={16} className="text-amber-700 shrink-0" />
            <span>
              <strong>Vista Restringida (Rol Consulta):</strong> Los diagnósticos médicos están ocultos por confidencialidad. Solo el personal de Salud Ocupacional, Administrador y Coordinadores autorizados pueden visualizarlos.
            </span>
          </div>
          <span className="text-[11px] font-mono text-amber-700">Habeas Data Ley 1581</span>
        </div>
      )}

      {/* Filter and Summary Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-slate-500 font-semibold">Filtrar por Tipo:</span>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700 font-medium"
          >
            <option value="todos">Todos los tipos ({absences.length})</option>
            <option value="incapacidad_general">Incapacidad General</option>
            <option value="permiso_personal">Permiso Personal</option>
            <option value="capacitacion">Capacitación</option>
            <option value="licencia">Licencia</option>
          </select>
        </div>

        <div className="flex items-center gap-4 text-slate-600">
          <span>
            Total ausencias registradas: <strong>{absences.length}</strong>
          </span>
          <span>•</span>
          <span className="text-rose-600 font-semibold">
            Horas de déficit acumuladas:{' '}
            <strong>
              {absences.reduce(
                (acc, a) => acc + (a.impactoEstimado?.deficitHoras || 7.5),
                0
              )}{' '}
              horas
            </strong>
          </span>
        </div>
      </div>

      {/* Absences Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-500 border-b border-slate-200 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-4">Colaborador / Documento</th>
                <th className="p-4">Sede Base</th>
                <th className="p-4">Tipo</th>
                <th className="p-4">Vigencia</th>
                <th className="p-4">Diagnóstico Médico / Motivo</th>
                <th className="p-4">Aprobación</th>
                <th className="p-4">Impacto</th>
                <th className="p-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAbsences.map((abs) => {
                const colab = staff.find((s) => s.id === abs.colaboradorId);
                const office = offices.find((o) => o.id === colab?.oficinaBaseId);

                return (
                  <tr key={abs.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-slate-900">{colab?.nombre}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        C.C. {colab?.documento} • {colab?.cargo}
                      </div>
                    </td>

                    <td className="p-4">
                      <div className="font-semibold text-slate-800">{office?.nombre}</div>
                      <div className="text-[10px] text-slate-400">{office?.ciudad}</div>
                    </td>

                    <td className="p-4">
                      <StatusBadge
                        status="ausente"
                        label={abs.tipo.replace('_', ' ')}
                        size="sm"
                      />
                    </td>

                    <td className="p-4 font-mono text-slate-600">
                      <div>{abs.fechaInicio}</div>
                      <div className="text-[10px] text-slate-400">al {abs.fechaFin}</div>
                    </td>

                    <td className="p-4 max-w-xs">
                      {canViewHealthData() ? (
                        <div className="text-slate-800 leading-snug">
                          <div className="font-medium">{abs.diagnosticoSalud}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {abs.motivoDetalle}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-slate-400 italic">
                          <Lock size={12} className="shrink-0 text-slate-400" />
                          <span>Confidencial (Rol Consulta)</span>
                        </div>
                      )}
                    </td>

                    <td className="p-4 text-slate-600">
                      <div className="font-medium text-slate-800">{abs.aprobadoPor}</div>
                      <div className="text-[10px] text-emerald-600 flex items-center gap-1 mt-0.5">
                        <CheckCircle2 size={11} /> Validado en RRHH
                      </div>
                    </td>

                    <td className="p-4">
                      <span className="font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                        -{abs.impactoEstimado?.deficitHoras || 7.5} h
                      </span>
                    </td>

                    <td className="p-4 text-right">
                      <button
                        onClick={() => removeAbsence(abs.id)}
                        title="Eliminar ausencia y reincorporar colaborador"
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Registrar Nueva Ausencia */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Registrar Novedad de Ausencia o Salud"
        subtitle="El motor evaluará inmediatamente el impacto en la cobertura y ajustará la propuesta de malla"
        maxWidth="xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Colaborador */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Colaborador Afectado:
            </label>
            <select
              value={selectedStaffId}
              onChange={(e) => setSelectedStaffId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            >
              {staff.map((s) => {
                const off = offices.find((o) => o.id === s.oficinaBaseId);
                return (
                  <option key={s.id} value={s.id}>
                    {s.nombre} — {off?.nombre} ({s.cargo})
                  </option>
                );
              })}
            </select>
          </div>

          {/* Tipo y Fechas */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Tipo de Ausencia:</label>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value as AbsenceType)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 font-medium"
              >
                <option value="incapacidad_general">Incapacidad General (EPS)</option>
                <option value="permiso_personal">Permiso Personal</option>
                <option value="capacitacion">Capacitación Institucional</option>
                <option value="licencia">Licencia Remunerada</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Fecha Inicio:</label>
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-800 font-mono"
                required
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Fecha Fin:</label>
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-800 font-mono"
                required
              />
            </div>
          </div>

          {/* Diagnóstico Salud */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Diagnóstico CIE-10 / Concepto Médico (Confidencial):
            </label>
            <input
              type="text"
              value={diagnostico}
              onChange={(e) => setDiagnostico(e.target.value)}
              placeholder="Ej. CIE-10 M54.5: Lumbago no especificado"
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800"
              required
            />
          </div>

          {/* Motivo y Aprobador */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Detalle del Motivo:</label>
              <input
                type="text"
                value={motivoDetalle}
                onChange={(e) => setMotivoDetalle(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-800"
                required
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Aprobado Por:</label>
              <input
                type="text"
                value={aprobadoPor}
                onChange={(e) => setAprobadoPor(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-800"
                required
              />
            </div>
          </div>

          {/* Instant Impact Preview Box */}
          <div className="p-3.5 bg-orange-50/80 rounded-xl border border-orange-200 space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-orange-900">
              <Sparkles size={14} className="text-orange-600" />
              <span>Simulación Instantánea de Impacto del Motor:</span>
            </div>
            <p className="text-slate-700 leading-relaxed text-[11px]">
              Al confirmar esta ausencia, la oficina <strong>{selectedOffice?.nombre}</strong> perderá 1 puesto de atención durante el horario pico. El motor recalculará la malla y sugerirá refuerzo virtual automático para mantener el SLA en &ge;80%.
            </p>
          </div>

          <div className="pt-3 flex justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <CheckCircle2 size={15} />
              <span>Guardar y Recalcular Malla</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
