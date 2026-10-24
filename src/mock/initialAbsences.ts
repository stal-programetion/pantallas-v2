import type { Absence } from '../types';

export const INITIAL_ABSENCES: Absence[] = [
  {
    id: 'abs-001',
    colaboradorId: 'st-08', // Lina María Petro (Montería Centro)
    tipo: 'incapacidad_general',
    fechaInicio: '2026-10-14',
    fechaFin: '2026-10-18',
    diagnosticoSalud: 'CIE-10 J06.9: Infección respiratoria aguda bacteriana con fiebre alta',
    aprobadoPor: 'Dra. Martha Luz Gómez (Salud Ocupacional Surtigas)',
    motivoDetalle: 'Incapacidad médica EPS Sanitas por 4 días con reposo domiciliario.',
    estado: 'activa',
    impactoEstimado: {
      deficitHoras: 30,
      oficinasAfectadas: ['monteria-centro'],
    },
  },
  {
    id: 'abs-002',
    colaboradorId: 'st-15', // Kelly Johana Olivera (Sincelejo La Palma)
    tipo: 'permiso_personal',
    fechaInicio: '2026-10-15',
    fechaFin: '2026-10-16',
    diagnosticoSalud: 'Trámite personal / Familiar primer grado de consanguinidad',
    aprobadoPor: 'Carlos Arturo Hoyos (Coordinador de Gestión Humana Sucre)',
    motivoDetalle: 'Permiso personal remunerado reglamentario para diligencia notarial de vivienda.',
    estado: 'activa',
    impactoEstimado: {
      deficitHoras: 15,
      oficinasAfectadas: ['sincelejo-la-palma'],
    },
  },
  {
    id: 'abs-003',
    colaboradorId: 'st-28', // Daniela Marcela Durango (Caucasia)
    tipo: 'incapacidad_general',
    fechaInicio: '2026-10-15',
    fechaFin: '2026-10-19',
    diagnosticoSalud: 'CIE-10 M54.5: Lumbago agudo con restricción motora moderada',
    aprobadoPor: 'Dr. Jorge Hernando Ramos (EPS Sura)',
    motivoDetalle: 'Tratamiento analgésico y terapia física por esfuerzo muscular.',
    estado: 'activa',
    impactoEstimado: {
      deficitHoras: 30,
      oficinasAfectadas: ['caucasia'],
    },
  },
  {
    id: 'abs-004',
    colaboradorId: 'st-04', // Valentina Restrepo Torres (Cartagena Chambacú)
    tipo: 'capacitacion',
    fechaInicio: '2026-10-15',
    fechaFin: '2026-10-15',
    diagnosticoSalud: 'N/A - Comisión institucional de formación',
    aprobadoPor: 'Ing. Rodrigo Cárdenas (Gerencia de Operaciones Surtigas)',
    motivoDetalle: 'Seminario de actualización regulatoria CREG y protocolo de atención a usuarios.',
    estado: 'activa',
    impactoEstimado: {
      deficitHoras: 7.5,
      oficinasAfectadas: ['cartagena-chambacu'],
    },
  },
];
