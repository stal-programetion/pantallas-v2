import { ORDER, ST } from '../components/shiftGrid/slotStates';
import { nombreArchivo, resumenReglas, type DatosMalla } from './mallaData';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const celdaCobertura = (n: number, req: number) => {
  const cls = n === 0 ? 'cero' : n < req ? 'falta' : 'ok';
  return `<td class="cob ${cls}">${n}/${req}</td>`;
};

/** Construye el documento HTML imprimible (carta horizontal) de la malla. */
export function htmlImprimible(d: DatosMalla, origen: string): string {
  const cabeceraFranjas = d.franjas.map((t) => `<th>${t}</th>`).join('');

  const secciones = d.bloques
    .map((b) => {
      const filas = b.filas
        .map(
          (f) => `<tr>
            <td class="nombre">${esc(f.nombre)}<span>${esc(f.cargo)}</span></td>
            ${f.estados
              .map(
                (e, i) =>
                  `<td class="estado e-${e}${f.manuales[i] ? ' manual' : ''}">${ST[e].code}</td>`
              )
              .join('')}
            <td class="horas">${f.horas}</td>
          </tr>`
        )
        .join('');
      const cobertura = b.atendiendo.map((n, i) => celdaCobertura(n, b.requeridos[i])).join('');
      return `<section class="oficina">
        <table>
          <thead>
            <tr><th class="titulo-oficina" colspan="${d.franjas.length + 2}">${esc(b.oficina.nombre)} · ${esc(
              b.oficina.ciudad
            )}</th></tr>
            <tr><th class="nombre">Colaborador</th>${cabeceraFranjas}<th>Horas</th></tr>
          </thead>
          <tbody>
            ${filas}
            <tr class="fila-cob"><td class="nombre">Cobertura <span>atendiendo / requeridos</span></td>${cobertura}<td></td></tr>
          </tbody>
        </table>
      </section>`;
    })
    .join('');

  const leyenda = ORDER.map(
    (e) => `<span class="ley"><b class="estado e-${e}">${ST[e].code}</b> ${ST[e].label}</span>`
  ).join('');

  const estilosEstados = ORDER.map(
    (e) =>
      `.e-${e}{background:${ST[e].bg};color:${ST[e].fg};}`
  ).join('\n');

  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8">
<title>${nombreArchivo(d.fecha, 'pdf')}</title>
<style>
  @page { size: letter landscape; margin: 10mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #0f1b2d; margin: 0; font-size: 9px; }
  header { display: flex; align-items: center; justify-content: space-between; gap: 16px;
           border-bottom: 2px solid #1F2B6B; padding-bottom: 8px; margin-bottom: 8px; }
  header img { height: 34px; }
  header h1 { margin: 0; font-size: 16px; color: #1F2B6B; }
  header p { margin: 2px 0 0; font-size: 10px; color: #3d4c63; }
  .meta { text-align: right; font-size: 10px; line-height: 1.5; }
  .badge { display: inline-block; padding: 1px 8px; border-radius: 10px; font-weight: 700;
           background: ${d.aprobacion ? '#dcf2e3' : '#fff4d6'}; color: ${d.aprobacion ? '#14532d' : '#7a5300'}; }
  .leyenda { display: flex; flex-wrap: wrap; gap: 10px; margin: 6px 0 10px; }
  .ley b { display: inline-block; min-width: 20px; text-align: center; padding: 1px 3px; border-radius: 3px; }
  section.oficina { break-inside: avoid; margin-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  th, td { border: 1px solid #d6dfeb; padding: 2px 1px; text-align: center; }
  th { background: #eef2f8; font-weight: 600; font-size: 8px; }
  th.titulo-oficina { background: #1F2B6B; color: #fff; text-align: left; font-size: 10px; padding: 3px 6px; }
  .nombre { width: 150px; text-align: left; padding-left: 4px; }
  td.nombre span { display: block; color: #5a6b82; font-size: 7px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .estado { font-weight: 600; font-size: 8px; }
  .manual { outline: 2px solid #1b9ad2; outline-offset: -2px; font-weight: 800; }
  .horas { width: 34px; font-weight: 600; }
  .fila-cob td { font-size: 8px; }
  .cob.ok { background: #dcf2e3; color: #14532d; }
  .cob.falta { background: #ffe4cc; color: #7a2b05; font-weight: 700; }
  .cob.cero { background: #9b1c1c; color: #fff; font-weight: 700; }
  .firmas { display: flex; gap: 40px; margin-top: 22px; break-inside: avoid; }
  .firma { flex: 1; border-top: 1px solid #0f1b2d; padding-top: 4px; font-size: 9px; }
  .firma b { display: block; font-size: 10px; min-height: 13px; }
  footer { margin-top: 10px; font-size: 8px; color: #5a6b82; }
  ${estilosEstados}
</style></head>
<body>
  <header>
    <div style="display:flex;align-items:center;gap:12px">
      <img src="${origen}/logo-surtigas.png" alt="Surtigas">
      <div>
        <h1>Malla de turnos</h1>
        <p>${esc(d.fechaLarga)}${d.quincena ? ' · Día de quincena' : ''}</p>
      </div>
    </div>
    <div class="meta">
      <span class="badge">${esc(d.estadoPlan)}</span><br>
      ${esc(resumenReglas(d.reglas))}
    </div>
  </header>
  <div class="leyenda">${leyenda}<span class="ley"><b class="estado manual" style="background:#fff">AT</b> Cambiado a mano</span></div>
  ${secciones}
  <div class="firmas">
    <div class="firma"><b></b>Elaboró (coordinación de turnos)</div>
    <div class="firma"><b>${d.aprobacion ? esc(d.aprobacion) : ''}</b>Aprobó</div>
  </div>
  <footer>Generado el ${esc(new Date().toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' }))} · Sistema de Optimización de Turnos Surtigas S.A. E.S.P.</footer>
</body></html>`;
}

/**
 * Abre el diálogo de impresión con la malla lista para imprimir o
 * "Guardar como PDF". Usa un iframe oculto para no abrir ventanas emergentes.
 */
export function imprimirMalla(d: DatosMalla): void {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  Object.assign(iframe.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
  document.body.appendChild(iframe);

  const limpiar = () => setTimeout(() => iframe.remove(), 1000);
  iframe.onload = () => {
    const win = iframe.contentWindow;
    if (!win) return limpiar();
    const imprimir = () => {
      win.focus();
      win.print();
    };
    // Esperar a que cargue el logo antes de imprimir
    const logo = win.document.querySelector('img');
    if (logo && !logo.complete) {
      logo.addEventListener('load', imprimir, { once: true });
      logo.addEventListener('error', imprimir, { once: true });
    } else {
      imprimir();
    }
    win.addEventListener('afterprint', limpiar, { once: true });
  };
  iframe.srcdoc = htmlImprimible(d, window.location.origin);
}
