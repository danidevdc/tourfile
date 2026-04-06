import jsPDF from 'jspdf';
import type { GuideLiquidation } from './guideLiquidationService';

const GRAY_DARK = [30, 30, 30] as const;
const GRAY_MID = [90, 90, 90] as const;
const GRAY_LIGHT = [160, 160, 160] as const;
const GRAY_BG = [240, 240, 240] as const;
const GRAY_ROW_ALT = [248, 248, 248] as const;
const GRAY_TABLE_HEADER = [110, 110, 110] as const;
const WHITE = [255, 255, 255] as const;
const BLACK = [0, 0, 0] as const;

// Table column widths
const COL_FECHA = 65;
const COL_HORA = 55;
const COL_SERVICIO = 150;

function setFill(doc: jsPDF, rgb: readonly [number, number, number]) {
  doc.setFillColor(rgb[0], rgb[1], rgb[2]);
}
function setTextColor(doc: jsPDF, rgb: readonly [number, number, number]) {
  doc.setTextColor(rgb[0], rgb[1], rgb[2]);
}
function setDrawColor(doc: jsPDF, rgb: readonly [number, number, number]) {
  doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
}

function drawTableHeader(doc: jsPDF, Y: number, PW: number, ML: number, MR: number, CW: number, COL_PAX_NAME: number, HEAD_H: number) {
  setFill(doc, GRAY_TABLE_HEADER);
  doc.rect(ML, Y, CW, HEAD_H, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  setTextColor(doc, WHITE);

  let cx = ML + 8;
  doc.text('FECHA', cx, Y + 16);
  cx += COL_FECHA;
  doc.text('HORA', cx, Y + 16);
  cx += COL_HORA;
  doc.text('SERVICIO', cx, Y + 16);
  cx += COL_SERVICIO;
  doc.text('NOMBRE PAX', cx, Y + 16);
  cx += COL_PAX_NAME;
  doc.text('NRO PAX', cx, Y + 16);
  doc.text('MONTO (Bs.)', PW - MR - 8, Y + 16, { align: 'right' });
}

export function generateLiquidationPDF(liquidation: GuideLiquidation): void {
  const url = buildLiquidationPDFUrl(liquidation);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Liquidacion-${liquidation.liquidationNumber}-${liquidation.guideName.replace(/\s+/g, '_')}.pdf`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/** Returns a blob URL for the PDF so it can be previewed before downloading. */
export function buildLiquidationPDFUrl(liquidation: GuideLiquidation): string {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });

  const PW = 595.28;
  const PH = 841.89;
  const ML = 36;
  const MR = 36;
  const CW = PW - ML - MR;

  // Filter only checked items
  const checkedItems = liquidation.items.filter(item => item.checked === true);

  const ROW_H = 24;
  const HEAD_H = 26;
  const FIXED_COLS = COL_FECHA + COL_HORA + COL_SERVICIO;
  const COL_NRO_PAX = 55;
  const COL_MONTO = 70;
  const COL_PAX_NAME_CALC = CW - FIXED_COLS - COL_NRO_PAX - COL_MONTO;

  // Page tracking helpers
  let pageNum = 1;

  // ── HEADER ──────────────────────────────────────────────────────────────
  const HEADER_H = 72;
  setFill(doc, GRAY_BG);
  doc.rect(0, 0, PW, HEADER_H, 'F');

  // Logo area
  setFill(doc, WHITE);
  doc.roundedRect(ML, 12, 130, 48, 3, 3, 'F');
  setDrawColor(doc, GRAY_LIGHT);
  doc.setLineWidth(0.5);
  doc.roundedRect(ML, 12, 130, 48, 3, 3, 'S');

  doc.setFont('helvetica', 'bold');
  setTextColor(doc, [180, 0, 0]);
  doc.setFontSize(13);
  doc.text('CRILLON', ML + 8, 38);
  setTextColor(doc, GRAY_DARK);
  doc.text('TOURS', ML + 8, 52);
  setTextColor(doc, GRAY_LIGHT);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.text('SINCE 1958', ML + 8, 58);

  // Title center
  doc.setFont('helvetica', 'bold');
  setTextColor(doc, GRAY_DARK);
  doc.setFontSize(16);
  doc.text('LIQUIDACIÓN DE GUÍAS', PW / 2, 34, { align: 'center' });

  // Num liquidation right
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  setTextColor(doc, GRAY_MID);
  doc.text('NÚM. LIQUIDACIÓN', PW - MR, 24, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  setTextColor(doc, GRAY_DARK);
  doc.text(liquidation.liquidationNumber, PW - MR, 46, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  setTextColor(doc, GRAY_LIGHT);
  const rawDate = liquidation.createdAt instanceof Date ? liquidation.createdAt : new Date();
  const dd = String(rawDate.getDate()).padStart(2, '0');
  const mm = String(rawDate.getMonth() + 1).padStart(2, '0');
  const yyyy = rawDate.getFullYear();
  const dateStr = `${dd}/${mm}/${yyyy}`;
  doc.text(dateStr, PW - MR, 60, { align: 'right' });

  // Divider under header
  setDrawColor(doc, GRAY_LIGHT);
  doc.setLineWidth(0.5);
  doc.line(ML, HEADER_H, PW - MR, HEADER_H);

  // ── INFO CARD ────────────────────────────────────────────────────────────
  let Y = HEADER_H + 16;
  const CARD_H = 90;

  setFill(doc, GRAY_BG);
  doc.roundedRect(ML, Y, CW, CARD_H, 4, 4, 'F');
  setDrawColor(doc, GRAY_LIGHT);
  doc.setLineWidth(0.5);
  doc.roundedRect(ML, Y, CW, CARD_H, 4, 4, 'S');

  // Section label
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  setTextColor(doc, GRAY_MID);
  doc.text('DATOS DE LA LIQUIDACIÓN', ML + 12, Y + 14);

  // Row 1
  const R1Y = Y + 28;
  const fields1 = [
    { label: 'Guía', value: liquidation.guideName },
    { label: 'Nro. de File', value: liquidation.fileNumber },
    { label: 'Fecha de Emisión', value: dateStr },
  ];
  let fx = ML + 12;
  fields1.forEach(({ label, value }) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    setTextColor(doc, GRAY_MID);
    doc.text(label, fx, R1Y);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    setTextColor(doc, GRAY_DARK);
    doc.text(value, fx, R1Y + 13);
    fx += 155;
  });

  // Row 2
  const R2Y = Y + 58;
  const fields2 = [
    { label: 'Nombre Pax', value: liquidation.paxName },
    { label: 'Nro. Pax', value: String(liquidation.paxCount) },
  ];
  fx = ML + 12;
  fields2.forEach(({ label, value }) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    setTextColor(doc, GRAY_MID);
    doc.text(label, fx, R2Y);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    setTextColor(doc, GRAY_DARK);
    doc.text(value, fx, R2Y + 13);
    fx += 155;
  });

  // Total panel right
  const TOTAL_W = 110;
  const TOTAL_X = ML + CW - TOTAL_W;
  setFill(doc, [220, 220, 220]);
  doc.roundedRect(TOTAL_X, Y + 4, TOTAL_W, CARD_H - 8, 3, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  setTextColor(doc, GRAY_MID);
  doc.text('TOTAL', TOTAL_X + TOTAL_W / 2, Y + 22, { align: 'center' });
  doc.setFontSize(8);
  setTextColor(doc, GRAY_DARK);
  doc.text('Bs.', TOTAL_X + TOTAL_W / 2, Y + 38, { align: 'center' });
  doc.setFontSize(22);
  setTextColor(doc, BLACK);
  doc.text(liquidation.total.toFixed(2), TOTAL_X + TOTAL_W / 2, Y + 60, { align: 'center' });

  // ── TABLE ────────────────────────────────────────────────────────────────
  Y += CARD_H + 16;

  // Track where the table started (for outer border)
  const TABLE_START_Y = Y;

  setDrawColor(doc, GRAY_LIGHT);
  doc.setLineWidth(0.5);

  // Draw initial header
  drawTableHeader(doc, Y, PW, ML, MR, CW, COL_PAX_NAME_CALC, HEAD_H);
  Y += HEAD_H;

  // Space reserved for nota + firmas below the table (~120pt)
  const BOTTOM_RESERVE = 120;

  // Data rows with pagination
  checkedItems.forEach((item, i) => {
    // Check if we need a new page
    if (Y + ROW_H > PH - BOTTOM_RESERVE) {
      // Draw outer border for current page table portion
      setDrawColor(doc, GRAY_LIGHT);
      doc.setLineWidth(0.5);
      doc.rect(ML, TABLE_START_Y, CW, Y - TABLE_START_Y, 'S');

      doc.addPage();
      pageNum++;

      // Redraw table header on new page
      Y = 36;
      drawTableHeader(doc, Y, PW, ML, MR, CW, COL_PAX_NAME_CALC, HEAD_H);
      Y += HEAD_H;
    }

    const rowY = Y;
    if (i % 2 === 1) {
      setFill(doc, GRAY_ROW_ALT);
      doc.rect(ML, rowY, CW, ROW_H, 'F');
    }

    // Bottom border
    setDrawColor(doc, [220, 220, 220]);
    doc.setLineWidth(0.3);
    doc.line(ML, rowY + ROW_H, ML + CW, rowY + ROW_H);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    setTextColor(doc, GRAY_DARK);

    let rx = ML + 8;
    const textY = rowY + ROW_H / 2 + 3;

    // Normalize fecha to dd/MM/yyyy
    const rawFecha = item.fecha ?? '';
    let fechaDisplay = rawFecha;
    const parts = rawFecha.split('/');
    if (parts.length === 3) {
      const [d, m, yr] = parts;
      const fullYear = yr.length === 2 ? '20' + yr : yr;
      fechaDisplay = `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${fullYear}`;
    }
    doc.text(fechaDisplay, rx, textY);
    rx += COL_FECHA;

    // Hora column
    const horaDisplay = (item as { hora?: string }).hora ?? '';
    doc.text(horaDisplay, rx, textY);
    rx += COL_HORA;

    // Truncate servicio if too long
    const svcText = item.servicio.length > 26 ? item.servicio.substring(0, 25) + '…' : item.servicio;
    doc.text(svcText, rx, textY);
    rx += COL_SERVICIO;

    doc.text(item.paxName, rx, textY);
    rx += COL_PAX_NAME_CALC;
    doc.text(String(item.paxCount), rx, textY);
    doc.text(item.monto > 0 ? item.monto.toFixed(2) : '—', PW - MR - 8, textY, { align: 'right' });

    Y += ROW_H;
  });

  // Total row
  const TOTAL_ROW_H = ROW_H + 4;
  const totalRowMidY = Y + TOTAL_ROW_H / 2 + 3.5;
  setFill(doc, [232, 232, 232]);
  doc.rect(ML, Y, CW, TOTAL_ROW_H, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  setTextColor(doc, GRAY_DARK);
  doc.setFontSize(11);
  setTextColor(doc, BLACK);
  const totalAmtText = `Bs. ${liquidation.total.toFixed(2)}`;
  const totalAmtWidth = doc.getTextWidth(totalAmtText);
  doc.text(totalAmtText, PW - MR - 8, totalRowMidY, { align: 'right' });
  doc.setFontSize(9);
  setTextColor(doc, GRAY_DARK);
  doc.text('TOTAL A LIQUIDAR', PW - MR - 8 - totalAmtWidth - 8, totalRowMidY, { align: 'right' });

  Y += TOTAL_ROW_H;

  // Table outer border
  setDrawColor(doc, GRAY_LIGHT);
  doc.setLineWidth(0.5);
  doc.rect(ML, TABLE_START_Y, CW, Y - TABLE_START_Y, 'S');

  // ── NOTA ─────────────────────────────────────────────────────────────────
  const notaY = Y + 12;
  setFill(doc, GRAY_BG);
  setDrawColor(doc, GRAY_LIGHT);
  doc.setLineWidth(0.5);
  doc.roundedRect(ML, notaY, CW, 32, 3, 3, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  setTextColor(doc, GRAY_MID);
  const nota = 'Este documento es un resumen oficial de los servicios prestados por el guía. Los montos indicados corresponden a la liquidación aprobada por el equipo de operaciones de Crillon Tours.';
  const notaLines = doc.splitTextToSize(nota, CW - 24);
  doc.text(notaLines, ML + 12, notaY + 11);

  // ── FIRMAS ───────────────────────────────────────────────────────────────
  const sigY = notaY + 32 + 28;
  const sigW = 140;
  const sigGap = (CW - sigW * 3) / 2;

  const sigs = [
    { label: 'Guía de Turismo', name: liquidation.guideName },
    { label: 'Jefe de Operaciones', name: 'Operaciones Crillon Tours' },
    { label: 'Gerencia / Administración', name: 'Visto Bueno' },
  ];

  sigs.forEach((sig, i) => {
    const sx = ML + i * (sigW + sigGap);
    setDrawColor(doc, GRAY_MID);
    doc.setLineWidth(0.5);
    doc.line(sx, sigY, sx + sigW, sigY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    setTextColor(doc, GRAY_DARK);
    doc.text(sig.name, sx + sigW / 2, sigY + 11, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    setTextColor(doc, GRAY_MID);
    doc.text(sig.label, sx + sigW / 2, sigY + 21, { align: 'center' });
  });

  return URL.createObjectURL(doc.output('blob'));
}
