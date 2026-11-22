import type { SlotStatus } from '../../types';

/** Estados de una casilla de la malla: orden, colores y textos (pantalla y exportaciones). */
export const ORDER: SlotStatus[] = [
  'atencion',
  'almuerzo',
  'apoyo_virtual',
  'apoyo_presencial',
  'pausa',
  'libre',
  'ausente',
];

export interface StateInfo {
  label: string;
  code: string;
  bg: string;
  fg: string;
  border: string;
  cuenta: boolean;
  short: string;
  desc: string;
}

export const ST: Record<SlotStatus, StateInfo> = {
  atencion: {
    label: 'Atención', code: 'AT', bg: '#1f6496', fg: '#ffffff', border: '#1f6496', cuenta: true,
    short: 'En su puesto atendiendo clientes.',
    desc: 'Está en su puesto atendiendo clientes en la oficina. Es el estado normal de trabajo.',
  },
  almuerzo: {
    label: 'Almuerzo', code: 'AL', bg: '#f7c548', fg: '#3d2a00', border: '#d9a521', cuenta: false,
    short: 'Hora de almuerzo (cada casilla = 30 min).',
    desc: 'Hora de almuerzo. El motor los escalona a partir de las 12:00, según la duración configurada, para que nunca salgan todos a la vez.',
  },
  apoyo_virtual: {
    label: 'Apoyo virtual', code: 'AV', bg: '#256f6d', fg: '#ffffff', border: '#256f6d', cuenta: true,
    short: 'Atiende remoto (video o chat) a esta oficina.',
    desc: 'Atiende de forma remota (video o chat). Se usa para reforzar horas pico o cubrir un almuerzo.',
  },
  apoyo_presencial: {
    label: 'Apoyo físico', code: 'AF', bg: '#2e3d82', fg: '#ffffff', border: '#2e3d82', cuenta: true,
    short: 'Se traslada a apoyar en otra sede.',
    desc: 'Se traslada físicamente a reforzar otra oficina durante esta franja.',
  },
  pausa: {
    label: 'Pausa', code: 'PA', bg: '#cfeefa', fg: '#0b4a66', border: '#7cc9ea', cuenta: false,
    short: 'Pausa activa corta, vuelve enseguida.',
    desc: 'Pausa corta (activa o de descanso). No atiende, pero vuelve en la siguiente franja.',
  },
  libre: {
    label: 'Libre', code: 'LI', bg: '#eef0f4', fg: '#3f4a5c', border: '#b4bccb', cuenta: false,
    short: 'Fuera de su horario de contrato.',
    desc: 'Fuera de su horario de contrato (llega tarde o sale temprano). No está en la oficina.',
  },
  ausente: {
    label: 'Ausente', code: 'AU',
    bg: 'repeating-linear-gradient(135deg, #fde2e1 0 5px, #f6c2bf 5px 10px)',
    fg: '#8a1414', border: '#e19995', cuenta: false,
    short: 'Incapacidad, permiso o licencia.',
    desc: 'No vino por incapacidad, permiso o licencia. Se registra desde la pantalla de Ausencias.',
  },
};
