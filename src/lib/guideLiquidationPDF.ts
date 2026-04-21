import jsPDF from 'jspdf';
import type { GuideLiquidation } from './guideLiquidationService';
import { CRILLON_LOGO_B64 } from './crillonLogo';

// ── Nothing Design System — Print / Light Mode tokens ──────────────────────
// "Printed technical manual. Off-white paper, black ink."
const ND_BLACK:   readonly [number, number, number] = [0,   0,   0  ];
const ND_TEXT_PRIMARY:  readonly [number, number, number] = [26,  26,  26 ]; // #1A1A1A
const ND_TEXT_SECONDARY: readonly [number, number, number] = [102, 102, 102]; // #666666
const ND_TEXT_DISABLED:  readonly [number, number, number] = [153, 153, 153]; // #999999
const ND_BORDER:         readonly [number, number, number] = [220, 220, 220]; // #DCDCDC
const ND_BORDER_VISIBLE: readonly [number, number, number] = [180, 180, 180]; // #B4B4B4
const ND_SURFACE:        readonly [number, number, number] = [245, 245, 245]; // #F5F5F5 off-white

// Table column widths
const COL_FECHA    = 62;
const COL_HORA     = 48;
const COL_SERVICIO = 148;
const COL_NRO_PAX  = 48;
const COL_MONTO    = 72;

function fill(doc: jsPDF, rgb: readonly [number, number, number]) {
  doc.setFillColor(rgb[0], rgb[1], rgb[2]);
}
function text(doc: jsPDF, rgb: readonly [number, number, number]) {
  doc.setTextColor(rgb[0], rgb[1], rgb[2]);
}
function draw(doc: jsPDF, rgb: readonly [number, number, number]) {
  doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
}

function spaceMonoLabel(doc: jsPDF, str: string, x: number, y: number, opts?: { align?: 'left' | 'center' | 'right' }) {
  doc.setFont('courier', 'normal');
  doc.setFontSize(7);
  text(doc, ND_TEXT_SECONDARY);
  doc.text(str.toUpperCase(), x, y, opts);
}

function spaceMonoValue(doc: jsPDF, str: string, x: number, y: number, size: number, opts?: { align?: 'left' | 'center' | 'right' }) {
  doc.setFont('courier', 'bold');
  doc.setFontSize(size);
  text(doc, ND_TEXT_PRIMARY);
  doc.text(str, x, y, opts);
}

function drawTableHeader(
  doc: jsPDF,
  Y: number,
  ML: number,
  CW: number,
  COL_PAX_NAME: number,
  HEAD_H: number,
  PW: number,
  MR: number
) {
  // Header background — gris medio bajo
  fill(doc, [210, 210, 210]);
  doc.rect(ML, Y, CW, HEAD_H, 'F');

  doc.setFont('courier', 'bold');
  doc.setFontSize(6.5);
  text(doc, ND_TEXT_PRIMARY);

  const leftCols = [
    { label: 'FECHA',      x: ML + 8 },
    { label: 'HORA',       x: ML + 8 + COL_FECHA },
    { label: 'SERVICIO',   x: ML + 8 + COL_FECHA + COL_HORA },
    { label: 'NOMBRE PAX', x: ML + 8 + COL_FECHA + COL_HORA + COL_SERVICIO },
  ];
  leftCols.forEach(({ label, x }) => doc.text(label, x, Y + HEAD_H / 2 + 2.5));

  // NRO PAX — alineado a la derecha de su columna
  const nroPaxHeaderX = ML + COL_FECHA + COL_HORA + COL_SERVICIO + COL_PAX_NAME + COL_NRO_PAX - 4;
  doc.text('NRO PAX', nroPaxHeaderX, Y + HEAD_H / 2 + 2.5, { align: 'right' });

  doc.text('MONTO (Bs.)', PW - MR - 8, Y + HEAD_H / 2 + 2.5, { align: 'right' });
}

function loadGrayscaleLogo(): Promise<{ b64: string; w: number; h: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.filter = 'grayscale(100%)';
      ctx.drawImage(img, 0, 0);
      resolve({
        b64: canvas.toDataURL('image/png').split(',')[1],
        w: img.naturalWidth,
        h: img.naturalHeight,
      });
    };
    img.onerror = () => resolve({ b64: '', w: 0, h: 0 });
    img.src = `data:image/png;base64,${CRILLON_LOGO_B64}`;
  });
}

export async function generateLiquidationPDF(liquidation: GuideLiquidation): Promise<void> {
  const url = await buildLiquidationPDFUrl(liquidation);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Liquidacion-${liquidation.liquidationNumber}-${liquidation.fileNumber}-${liquidation.guideName.replace(/\s+/g, '_')}.pdf`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export async function buildLiquidationPDFUrl(liquidation: GuideLiquidation): Promise<string> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });

  const PW = 595.28;
  const PH = 841.89;
  const ML = 40;
  const MR = 40;
  const CW = PW - ML - MR;

  const checkedItems = liquidation.items.filter(item => item.checked === true);

  const ROW_H    = 22;
  const HEAD_H   = 22;
  const COL_PAX_NAME = CW - COL_FECHA - COL_HORA - COL_SERVICIO - COL_NRO_PAX - COL_MONTO;

  // Date formatting
  const rawDate = liquidation.createdAt instanceof Date ? liquidation.createdAt : new Date();
  const dd   = String(rawDate.getDate()).padStart(2, '0');
  const mm   = String(rawDate.getMonth() + 1).padStart(2, '0');
  const yyyy = rawDate.getFullYear();
  const dateStr = `${dd}/${mm}/${yyyy}`;

    // (sin barra negra arriba)

  const HEADER_H = 70;

  // ── LOGO BLOCK (left) — imagen real en escala de grises ──────────────────
  const LOGO_X = ML;
  const LOGO_Y = 14;
  const LOGO_W = 110;
  const LOGO_H = 36;

  const logo = await loadGrayscaleLogo();
  if (logo.b64) {
    // Mantener proporción original, ajustar al ancho máximo deseado
    const maxW = 110;
    const ratio = logo.h / logo.w;
    const drawW = Math.min(maxW, logo.w);
    const drawH = drawW * ratio;
    doc.addImage(logo.b64, 'PNG', LOGO_X, LOGO_Y + (LOGO_H - drawH) / 2, drawW, drawH);
  }

  // Thin vertical divider after logo
  draw(doc, ND_BORDER_VISIBLE);
  doc.setLineWidth(0.5);
  doc.line(LOGO_X + LOGO_W + 10, LOGO_Y, LOGO_X + LOGO_W + 10, LOGO_Y + LOGO_H);

  // ── TITLE (center-left of header) ─────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  text(doc, ND_TEXT_PRIMARY);
  doc.text('LIQUIDACIÓN DE GUÍAS', LOGO_X + LOGO_W + 22, LOGO_Y + 18);

  // Subtitle — Space Mono style
  doc.setFont('courier', 'normal');
  doc.setFontSize(7);
  text(doc, ND_TEXT_SECONDARY);
  doc.text('DOCUMENTO OFICIAL · CRILLON TOURS', LOGO_X + LOGO_W + 22, LOGO_Y + 30);

  // ── LIQ NUMBER hero (right) ───────────────────────────────────────────────
  // Label
  spaceMonoLabel(doc, 'Núm. Liquidación', PW - MR, LOGO_Y + 10, { align: 'right' });

  // Number — hero moment (big, courier bold)
  doc.setFont('courier', 'bold');
  doc.setFontSize(24);
  text(doc, ND_BLACK);
  doc.text(liquidation.liquidationNumber, PW - MR, LOGO_Y + 34, { align: 'right' });

  // Date below number
  spaceMonoLabel(doc, dateStr, PW - MR, LOGO_Y + 46, { align: 'right' });

  // ── DIVIDER under header ──────────────────────────────────────────────────
  draw(doc, ND_TEXT_PRIMARY);
  doc.setLineWidth(1);
  doc.line(ML, HEADER_H + 6, PW - MR, HEADER_H + 6);

  // ── INFO SECTION ─────────────────────────────────────────────────────────
  let Y = HEADER_H + 22;

  // Two-column info grid
  const INFO_COL_W = (CW - 120) / 2; // two equal cols, space for total panel

  const infoFields = [
    { label: 'Guía',              value: liquidation.guideName },
    { label: 'Nro. de File',      value: liquidation.fileNumber },
    { label: 'Nombre Pax',        value: liquidation.paxName },
    { label: 'Nro. Pax',          value: String(liquidation.paxCount) },
    { label: 'Fecha de Emisión',  value: dateStr },
    { label: 'Estado',            value: liquidation.status ?? 'Liquidado' },
  ];

  // Draw 2-col grid (3 rows × 2 cols)
  infoFields.forEach((field, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const fx = ML + col * INFO_COL_W;
    const fy = Y + row * 28;

    spaceMonoLabel(doc, field.label, fx, fy);
    spaceMonoValue(doc, field.value, fx, fy + 12, 10);
  });

  // ── TOTAL PANEL (right, vertically centered with info) ───────────────────
  const TOTAL_W  = 108;
  const TOTAL_X  = PW - MR - TOTAL_W;
  const TOTAL_Y  = Y - 4;
  const TOTAL_H  = 80;

  // Outer border
  draw(doc, ND_BORDER_VISIBLE);
  doc.setLineWidth(0.5);
  doc.rect(TOTAL_X, TOTAL_Y, TOTAL_W, TOTAL_H, 'S');

  // Top accent bar — gris medio
  fill(doc, [210, 210, 210]);
  doc.rect(TOTAL_X, TOTAL_Y, TOTAL_W, 14, 'F');

  // "TOTAL" label — negro
  doc.setFont('courier', 'bold');
  doc.setFontSize(6.5);
  text(doc, ND_TEXT_PRIMARY);
  doc.text('TOTAL A LIQUIDAR', TOTAL_X + TOTAL_W / 2, TOTAL_Y + 9.5, { align: 'center' });

  // "Bs." unit label
  spaceMonoLabel(doc, 'Bs.', TOTAL_X + TOTAL_W / 2, TOTAL_Y + 30, { align: 'center' });

  // Amount — secondary hero
  doc.setFont('courier', 'bold');
  doc.setFontSize(20);
  text(doc, ND_BLACK);
  doc.text(liquidation.total.toFixed(2), TOTAL_X + TOTAL_W / 2, TOTAL_Y + 56, { align: 'center' });

  // ── THIN DIVIDER before table ─────────────────────────────────────────────
  Y += 3 * 28 + 14;
  draw(doc, ND_BORDER);
  doc.setLineWidth(0.3);
  doc.line(ML, Y, PW - MR, Y);
  Y += 12;

  // ── TABLE ─────────────────────────────────────────────────────────────────
  const TABLE_START_Y = Y;
  const BOTTOM_RESERVE = 110;

  drawTableHeader(doc, Y, ML, CW, COL_PAX_NAME, HEAD_H, PW, MR);
  Y += HEAD_H;

  checkedItems.forEach((item, i) => {
    if (Y + ROW_H > PH - BOTTOM_RESERVE) {
      // Border around table portion
      draw(doc, ND_BORDER_VISIBLE);
      doc.setLineWidth(0.3);
      doc.rect(ML, TABLE_START_Y, CW, Y - TABLE_START_Y, 'S');

      doc.addPage();
      Y = 36;
      drawTableHeader(doc, Y, ML, CW, COL_PAX_NAME, HEAD_H, PW, MR);
      Y += HEAD_H;
    }

    const rowY = Y;

    // Alt row — very subtle
    if (i % 2 === 1) {
      fill(doc, ND_SURFACE);
      doc.rect(ML, rowY, CW, ROW_H, 'F');
    }

    // Row bottom border
    draw(doc, ND_BORDER);
    doc.setLineWidth(0.2);
    doc.line(ML, rowY + ROW_H, ML + CW, rowY + ROW_H);

    const textY = rowY + ROW_H / 2 + 3;

    // Fecha
    const rawFecha = item.fecha ?? '';
    let fechaDisplay = rawFecha;
    const parts = rawFecha.split('/');
    if (parts.length === 3) {
      const [d, m, yr] = parts;
      const fullYear = yr.length === 2 ? '20' + yr : yr;
      fechaDisplay = `${d.padStart(2,'0')}/${m.padStart(2,'0')}/${fullYear}`;
    }
    doc.setFont('courier', 'normal');
    doc.setFontSize(8);
    text(doc, ND_TEXT_PRIMARY);
    doc.text(fechaDisplay, ML + 8, textY);

    // Hora
    text(doc, ND_TEXT_SECONDARY);
    doc.text((item as { hora?: string }).hora ?? '', ML + 8 + COL_FECHA, textY);

    // Servicio
    doc.setFont('courier', 'normal');
    doc.setFontSize(8);
    text(doc, ND_TEXT_PRIMARY);
    const svcText = item.servicio.length > 26 ? item.servicio.substring(0, 25) + '…' : item.servicio;
    doc.text(svcText, ML + 8 + COL_FECHA + COL_HORA, textY);

    // Pax Name
    doc.setFont('courier', 'normal');
    doc.setFontSize(8);
    text(doc, ND_TEXT_SECONDARY);
    doc.text(item.paxName, ML + 8 + COL_FECHA + COL_HORA + COL_SERVICIO, textY);

    // Nro Pax — alineado derecha dentro de su columna
    doc.setFont('courier', 'bold');
    doc.setFontSize(8);
    text(doc, ND_TEXT_PRIMARY);
    const nroPaxX = ML + COL_FECHA + COL_HORA + COL_SERVICIO + COL_PAX_NAME + COL_NRO_PAX - 4;
    doc.text(String(item.paxCount), nroPaxX, textY, { align: 'right' });

    // Monto — right aligned, accent if has value
    doc.setFont('courier', 'bold');
    doc.setFontSize(8.5);
    text(doc, item.monto > 0 ? ND_TEXT_PRIMARY : ND_TEXT_DISABLED);
    doc.text(item.monto > 0 ? item.monto.toFixed(2) : '—', PW - MR - 8, textY, { align: 'right' });

    Y += ROW_H;
  });

  // ── TOTAL ROW ─────────────────────────────────────────────────────────────
  const TOTAL_ROW_H = 26;
  fill(doc, [210, 210, 210]);
  doc.rect(ML, Y, CW, TOTAL_ROW_H, 'F');

  const totalMidY = Y + TOTAL_ROW_H / 2 + 3.5;

  // "TOTAL A LIQUIDAR" label
  doc.setFont('courier', 'bold');
  doc.setFontSize(7);
  text(doc, ND_TEXT_PRIMARY);
  doc.text('TOTAL A LIQUIDAR', ML + 8, totalMidY);

  // Amount value
  doc.setFont('courier', 'bold');
  doc.setFontSize(12);
  text(doc, ND_BLACK);
  doc.text(`Bs. ${liquidation.total.toFixed(2)}`, PW - MR - 8, totalMidY, { align: 'right' });

  Y += TOTAL_ROW_H;

  // Table outer border
  draw(doc, ND_BORDER_VISIBLE);
  doc.setLineWidth(0.3);
  doc.rect(ML, TABLE_START_Y, CW, Y - TABLE_START_Y, 'S');

  // ── NOTA ──────────────────────────────────────────────────────────────────
  Y += 14;
  draw(doc, ND_BORDER);
  doc.setLineWidth(0.3);
  doc.rect(ML, Y, CW, 30, 'S');

  doc.setFont('courier', 'normal');
  doc.setFontSize(6.5);
  text(doc, ND_TEXT_SECONDARY);
  const nota = 'Este documento es un resumen oficial de los servicios prestados por el guía. Los montos indicados corresponden a la liquidación aprobada por el equipo de operaciones de Crillon Tours.';
  const notaLines = doc.splitTextToSize(nota, CW - 20);
  doc.text(notaLines, ML + 10, Y + 10);

  // ── FIRMAS ────────────────────────────────────────────────────────────────
  Y += 30 + 28;
  const sigW  = 138;
  const sigGap = (CW - sigW * 3) / 2;

  const sigs = [
    { label: 'Guía de Turismo',          name: liquidation.guideName },
    { label: 'Jefe de Operaciones',       name: 'Operaciones Crillon Tours' },
    { label: 'Gerencia / Administración', name: 'Visto Bueno' },
  ];

  sigs.forEach((sig, i) => {
    const sx = ML + i * (sigW + sigGap);
    draw(doc, ND_TEXT_PRIMARY);
    doc.setLineWidth(0.5);
    doc.line(sx, Y, sx + sigW, Y);

    doc.setFont('courier', 'bold');
    doc.setFontSize(7.5);
    text(doc, ND_TEXT_PRIMARY);
    doc.text(sig.name, sx + sigW / 2, Y + 12, { align: 'center' });

    doc.setFont('courier', 'normal');
    doc.setFontSize(6.5);
    text(doc, ND_TEXT_SECONDARY);
    doc.text(sig.label.toUpperCase(), sx + sigW / 2, Y + 22, { align: 'center' });
  });

  // (sin barra negra abajo)

  return URL.createObjectURL(doc.output('blob'));
}
