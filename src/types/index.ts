export type Department = 'Bolívar' | 'Córdoba' | 'Sucre' | 'Antioquia' | 'Magdalena';

export type UserRole = 'ADMIN' | 'COORDINADOR' | 'CONSULTA';

export interface User {
  id: string;
  nombre: string;
  email: string;
  rol: UserRole;
  cargo: string;
  avatarUrl?: string;
}

export interface Office {
  id: string;
  nombre: string;
  ciudad: string;
  departamento: Department;
  coordenadas: {
    lat: number;
    lng: number;
  };
  capacidadPuestos: number;
  estado: 'abierta' | 'cerrada' | 'mantenimiento';
  horarioAtencion: {
    inicio: string; // "08:00"
    fin: string;    // "16:30"
  };
  slaObjetivo: number; // e.g. 0.80 (80%)
  tiempoEsperaMaxMin: number; // e.g. 10 minutes
  telefono: string;
  direccion: string;
}

export type WorkShiftType = 'completa' | 'media_jornada';
export type WorkModality = 'presencial' | 'virtual';

export interface Staff {
  id: string;
  nombre: string;
  documento: string;
  oficinaBaseId: string;
  cargo: string;
  jornada: WorkShiftType;
  horarioContrato: {
    entrada: string;
    salida: string;
  };
  ventanaAlmuerzo: {
    inicio: string; // e.g. "12:00"
    fin: string;    // e.g. "14:30"
    duracionMinutos: number; // 60 min
  };
  modalidad: WorkModality;
  competencias: string[];
  estadoHoy: 'disponible' | 'almuerzo' | 'ausente' | 'en_atencion' | 'trasladado';
  oficinaActualId: string;
}

export type AbsenceType = 'incapacidad_general' | 'permiso_personal' | 'licencia' | 'capacitacion';

export interface Absence {
  id: string;
  colaboradorId: string;
  tipo: AbsenceType;
  fechaInicio: string; // YYYY-MM-DD
  fechaFin: string;    // YYYY-MM-DD
  diagnosticoSalud?: string; // Solo visible para ADMIN y COORDINADOR
  aprobadoPor: string;
  motivoDetalle: string;
  estado: 'activa' | 'finalizada' | 'programada';
  impactoEstimado?: {
    deficitHoras: number;
    oficinasAfectadas: string[];
  };
}

export type SlotStatus = 'atencion' | 'almuerzo' | 'pausa' | 'libre' | 'apoyo_virtual' | 'apoyo_presencial' | 'ausente';

export interface ShiftSlot {
  franja: string; // "08:00", "08:30", etc.
  estado: SlotStatus;
  oficinaAsignadaId: string;
  esModificadoManual?: boolean;
  nota?: string;
}

export interface ColaboradorShift {
  colaboradorId: string;
  oficinaBaseId: string;
  slots: Record<string, ShiftSlot>; // key: "08:00", "08:30", ...
  horasTotales: number;
}

export interface DayPlanJustification {
  id: string;
  franja: string;
  oficinaId: string;
  razon: string;
  regla: string;
  tipo: 'pico_demanda' | 'cobertura_ausencia' | 'escalonamiento_almuerzo' | 'redistribucion';
}

export interface DayPlanAudit {
  aprobadoPor: string;
  aprobadoEn: string;
  version: number;
  totalCambiosManuales: number;
}

export interface DayPlan {
  id: string;
  fecha: string;
  estado: 'borrador' | 'propuesto' | 'aprobado';
  auditoria?: DayPlanAudit;
  tiempoAhorradoMinutos: number; // vs 90 min en Excel manual
  turnos: Record<string, ColaboradorShift>; // key: colaboradorId
  justificaciones: DayPlanJustification[];
}

export interface HistoricalTicketSummary {
  franja: string;
  diaSemana: number; // 0=Domingo, 1=Lunes, ... 6=Sábado
  oficinaId: string;
  llegadasPromedio: number;
  tiempoEsperaPromedioSeg: number;
  tiempoAtencionPromedioSeg: number;
  tramitePrincipal: string;
  esQuincena: boolean;
}

export interface ErlangCResult {
  tasaLlegadasHora: number;      // lambda
  tiempoAtencionMinutos: number; // 1/mu en minutos
  intensidadTrafico: number;     // A = lambda * t_atencion_horas
  agentesAsignados: number;      // c
  probabilidadEspera: number;    // P(W > 0)
  nivelServicio: number;         // P(W <= T_sla)
  tiempoEsperaPromedioMin: number; // Wq en minutos
  esEstable: boolean;            // c > A
}

export interface RedistributionRecommendation {
  id: string;
  colaboradorId: string;
  colaboradorNombre: string;
  oficinaOrigenId: string;
  oficinaOrigenNombre: string;
  oficinaDestinoId: string;
  oficinaDestinoNombre: string;
  modalidad: WorkModality;
  distanciaKm: number;
  esIntermunicipal: boolean;
  franjaInicio: string;
  franjaFin: string;
  motivo: string;
  impactoEstimado: {
    reduccionEsperaMin: number;
    slaProyectadoDestino: number;
    slaOrigenResultante: number;
  };
  estado: 'pendiente' | 'aceptada' | 'rechazada';
}

export type AlertSeverity = 'info' | 'advertencia' | 'critica';
export type AlertType = 'pico_inminente' | 'ausencia_sin_cubrir' | 'sla_en_riesgo' | 'almuerzo_descubierto';

export interface Alert {
  id: string;
  tipo: AlertType;
  severidad: AlertSeverity;
  oficinaId: string;
  oficinaNombre: string;
  titulo: string;
  mensaje: string;
  franja?: string;
  accionSugerida: string;
  accionTipo?: 'redistribuir' | 'ajustar_almuerzo' | 'cubrir_ausencia' | 'revisar_malla';
  timestamp: string;
  leida: boolean;
}

export interface OfficeRealtimeMetrics {
  oficinaId: string;
  clientesEnFila: number;
  esperaPromedioMin: number;
  slaActual: number; // 0 - 1
  agentesActivos: number;
  agentesRequeridos: number;
  capacidadUtilizada: number; // porcentaje
  estadoSla: 'optimo' | 'alerta' | 'critico';
  tendencia: 'subiendo' | 'estable' | 'bajando';
}
