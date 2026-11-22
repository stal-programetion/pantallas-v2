import type { SlotStatus } from '../types';
import { ORDER, ST } from '../components/shiftGrid/slotStates';
import { nombreArchivo, resumenReglas, type DatosMalla } from './mallaData';

/** Color sólido para Excel (el estado "ausente" usa un rayado en pantalla). */
const fondo = (e: SlotStatus) => (ST[e].bg.startsWith('#') ? ST[e].bg : '#fde2e1');
const argb = (hex: string) => `FF${hex.replace('#', '').toUpperCase()}`;

const AZUL_SURTIGAS = '#1F2B6B';
const ROJO = '#9B1C1C';
const NARANJA = '#FFE4CC';
const VERDE = '#DCF2E3';

/**
 * Genera y descarga la malla del día como libro de Excel (.xlsx) con tres hojas:
 * Malla (por colaborador), Cobertura (atendiendo vs. requeridos) y Convenciones.
 * ExcelJS se carga solo al exportar para no aumentar el peso inicial de la app.
 */
export async function exportarMallaExcel(datos: DatosMalla): Promise<void> {
  const { default: ExcelJS } = await import('exceljs');
  const libro = new ExcelJS.Workbook();
  libro.creator = 'Surtigas · Sistema de Optimización de Turnos';
  libro.created = new Date();

  const { franjas } = datos;
  const ultimaCol = 3 + franjas.length + 1; // Oficina, Colaborador, Cargo, franjas…, Horas

  /* ===== Hoja 1: Malla ===== */
  const hoja = libro.addWorksheet('Malla', {
    views: [{ state: 'frozen', xSplit: 3, ySplit: 6 }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
  });

  hoja.columns = [
    { width: 26 },
    { width: 30 },
    { width: 26 },
    ...franjas.map(() => ({ width: 6.5 })),
    { width: 8 },
  ];

  const encabezado = [
    `Surtigas S.A. E.S.P. — Malla de turnos`,
    `${datos.fechaLarga}${datos.quincena ? ' · Día de quincena' : ''}`,
    `Estado del plan: ${datos.estadoPlan}${datos.aprobacion ? ` — aprobado por ${datos.aprobacion}` : ''}`,
    `Reglas aplicadas: ${resumenReglas(datos.reglas)}`,
  ];
  encabezado.forEach((texto, i) => {
    const fila = hoja.getRow(i + 1);
    fila.getCell(1).value = texto;
    hoja.mergeCells(i + 1, 1, i + 1, ultimaCol);
    fila.font = i === 0 ? { bold: true, size: 14, color: { argb: argb(AZUL_SURTIGAS) } } : { size: 10 };
  });

  const titulos = hoja.getRow(6);
  ['Oficina', 'Colaborador', 'Cargo', ...franjas, 'Horas'].forEach((t, i) => {
    const c = titulos.getCell(i + 1);
    c.value = t;
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(AZUL_SURTIGAS) } };
    c.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  titulos.height = 20;

  const borde = { style: 'thin' as const, color: { argb: 'FFD6DFEB' } };
  let r = 7;

  datos.bloques.forEach((b) => {
    b.filas.forEach((f) => {
      const fila = hoja.getRow(r++);
      fila.getCell(1).value = b.oficina.nombre;
      fila.getCell(2).value = f.nombre;
      fila.getCell(3).value = f.cargo;
      f.estados.forEach((e, i) => {
        const c = fila.getCell(4 + i);
        c.value = ST[e].code;
        c.alignment = { horizontal: 'center' };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(fondo(e)) } };
        c.font = { bold: f.manuales[i], color: { argb: argb(ST[e].fg) } };
        c.border = { top: borde, bottom: borde, left: borde, right: borde };
        if (f.manuales[i]) c.note = 'Cambiado a mano sobre la propuesta del motor';
      });
      fila.getCell(ultimaCol).value = f.horas;
      fila.getCell(ultimaCol).alignment = { horizontal: 'center' };
    });

    // Fila de cobertura de la oficina: atendiendo / requeridos
    const cob = hoja.getRow(r++);
    cob.getCell(2).value = 'Cobertura (atendiendo / requeridos)';
    cob.getCell(2).font = { italic: true, size: 9 };
    b.atendiendo.forEach((n, i) => {
      const req = b.requeridos[i];
      const c = cob.getCell(4 + i);
      c.value = `${n}/${req}`;
      c.alignment = { horizontal: 'center' };
      c.font = { size: 9, bold: n < req, color: { argb: n === 0 ? 'FFFFFFFF' : 'FF0F1B2D' } };
      c.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: argb(n === 0 ? ROJO : n < req ? NARANJA : VERDE) },
      };
    });
    r++; // espacio entre oficinas
  });

  /* ===== Hoja 2: Cobertura ===== */
  const cobHoja = libro.addWorksheet('Cobertura', { views: [{ state: 'frozen', xSplit: 1, ySplit: 2 }] });
  cobHoja.columns = [{ width: 28 }, ...franjas.map(() => ({ width: 7 })), { width: 16 }];
  cobHoja.getCell(1, 1).value = `Cobertura por oficina — ${datos.fechaLarga} (atendiendo / requeridos por Erlang C)`;
  cobHoja.getRow(1).font = { bold: true };
  const t2 = cobHoja.getRow(2);
  ['Oficina', ...franjas, 'Franjas en déficit'].forEach((t, i) => {
    const c = t2.getCell(i + 1);
    c.value = t;
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(AZUL_SURTIGAS) } };
    c.alignment = { horizontal: 'center' };
  });
  datos.bloques.forEach((b, k) => {
    const fila = cobHoja.getRow(3 + k);
    fila.getCell(1).value = b.oficina.nombre;
    let deficit = 0;
    b.atendiendo.forEach((n, i) => {
      const req = b.requeridos[i];
      if (n < req) deficit++;
      const c = fila.getCell(2 + i);
      c.value = `${n}/${req}`;
      c.alignment = { horizontal: 'center' };
      c.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: argb(n === 0 ? ROJO : n < req ? NARANJA : VERDE) },
      };
      if (n === 0) c.font = { color: { argb: 'FFFFFFFF' }, bold: true };
    });
    fila.getCell(2 + franjas.length).value = deficit;
    fila.getCell(2 + franjas.length).alignment = { horizontal: 'center' };
  });

  /* ===== Hoja 3: Convenciones ===== */
  const conv = libro.addWorksheet('Convenciones');
  conv.columns = [{ width: 8 }, { width: 18 }, { width: 80 }];
  conv.addRow(['Código', 'Estado', 'Significado']).font = { bold: true };
  ORDER.forEach((e) => {
    const fila = conv.addRow([ST[e].code, ST[e].label, ST[e].desc]);
    fila.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(fondo(e)) } };
    fila.getCell(1).font = { bold: true, color: { argb: argb(ST[e].fg) } };
    fila.getCell(1).alignment = { horizontal: 'center' };
  });
  conv.addRow([]);
  conv.addRow(['', 'Negrilla', 'Casilla cambiada a mano sobre la propuesta del motor (tiene una nota).']);
  conv.addRow(['', 'Cobertura', 'Verde: suficiente · Naranja: falta personal · Rojo: nadie atendiendo.']);

  /* ===== Descarga ===== */
  const buffer = await libro.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo(datos.fecha, 'xlsx');
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
