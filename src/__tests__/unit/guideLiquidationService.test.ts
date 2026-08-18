import { describe, it, expect, beforeEach, vi } from 'vitest';
vi.mock('firebase/firestore', async () => await import('../test-utils/firestore-mock'));
vi.mock('@/lib/firebase', () => ({ db: {} }));

import { resetMockFirestore } from '../test-utils/firestore-mock';
import {
  saveLiquidation,
  updateLiquidation,
  getLiquidationById,
  getAllLiquidations,
  getLiquidationDisplayStatus,
  type LiquidationItem,
} from '@/lib/guideLiquidationService';

function makeItem(overrides: Partial<LiquidationItem> = {}): LiquidationItem {
  return {
    serviceOrderId: '',
    fileNumber: '0089',
    fecha: '10/01/26',
    hora: '09:00',
    servicio: 'CITY TOUR',
    paxName: 'JUAN PEREZ',
    paxCount: 2,
    monto: 100,
    checked: true,
    ...overrides,
  };
}

describe('saveLiquidation — TEST-prefixed liquidation numbering', () => {
  beforeEach(() => resetMockFirestore());

  it('assigns TEST-001 to the first liquidation created', async () => {
    const saved = await saveLiquidation({
      fileNumber: '0089',
      guideKey: 'MARIA GOMEZ',
      guideName: 'MARIA GOMEZ',
      paxName: 'JUAN PEREZ',
      paxCount: 2,
      items: [makeItem()],
      createdBy: 'tester@example.com',
    });

    expect(saved.liquidationNumber).toBe('TEST-001');
  });

  it('increments the number on each subsequent liquidation', async () => {
    const first = await saveLiquidation({
      fileNumber: '0089',
      guideKey: 'MARIA GOMEZ',
      guideName: 'MARIA GOMEZ',
      paxName: 'JUAN PEREZ',
      paxCount: 2,
      items: [makeItem()],
      createdBy: 'tester@example.com',
    });
    const second = await saveLiquidation({
      fileNumber: '0090',
      guideKey: 'CARLOS RUIZ',
      guideName: 'CARLOS RUIZ',
      paxName: 'ANA LOPEZ',
      paxCount: 3,
      items: [makeItem({ fileNumber: '0090' })],
      createdBy: 'tester@example.com',
    });

    expect(first.liquidationNumber).toBe('TEST-001');
    expect(second.liquidationNumber).toBe('TEST-002');
  });

  it('computes total from checked items only, matching what the UI displays', async () => {
    const saved = await saveLiquidation({
      fileNumber: '0089',
      guideKey: 'MARIA GOMEZ',
      guideName: 'MARIA GOMEZ',
      paxName: 'JUAN PEREZ',
      paxCount: 2,
      items: [
        makeItem({ monto: 100, checked: true }),
        makeItem({ monto: 999, checked: false }),
      ],
      createdBy: 'tester@example.com',
    });

    expect(saved.total).toBe(100);
  });

  it('persists the saved liquidation so getAllLiquidations returns it', async () => {
    await saveLiquidation({
      fileNumber: '0089',
      guideKey: 'MARIA GOMEZ',
      guideName: 'MARIA GOMEZ',
      paxName: 'JUAN PEREZ',
      paxCount: 2,
      items: [makeItem()],
      createdBy: 'tester@example.com',
    });

    const all = await getAllLiquidations();
    expect(all).toHaveLength(1);
    expect(all[0].liquidationNumber).toBe('TEST-001');
    expect(all[0].guideName).toBe('MARIA GOMEZ');
  });
});

describe('updateLiquidation — total recomputation', () => {
  beforeEach(() => resetMockFirestore());

  it('recomputes total from checked items only after an edit', async () => {
    const saved = await saveLiquidation({
      fileNumber: '0089',
      guideKey: 'MARIA GOMEZ',
      guideName: 'MARIA GOMEZ',
      paxName: 'JUAN PEREZ',
      paxCount: 2,
      items: [makeItem({ monto: 100, checked: true })],
      createdBy: 'tester@example.com',
    });

    await updateLiquidation(saved.id, {
      items: [
        makeItem({ monto: 100, checked: true }),
        makeItem({ monto: 999, checked: false }),
      ],
      paxName: 'JUAN PEREZ',
      paxCount: 2,
    });

    const updated = await getLiquidationById(saved.id);
    expect(updated?.total).toBe(100);
  });
});

describe('getLiquidationDisplayStatus', () => {
  it('is SOLICITADO for a saved liquidation with no paymentDate, even though status is "Liquidado"', () => {
    expect(getLiquidationDisplayStatus({ status: 'Liquidado', paymentDate: undefined })).toBe('SOLICITADO');
  });

  it('is PAGADO once paymentDate is set', () => {
    expect(getLiquidationDisplayStatus({ status: 'Liquidado', paymentDate: '10/01/2026' })).toBe('PAGADO');
  });

  it('is SIN LIQUIDAR when status is "Sin Liquidar"', () => {
    expect(getLiquidationDisplayStatus({ status: 'Sin Liquidar', paymentDate: undefined })).toBe('SIN LIQUIDAR');
  });

  it('is ANULADO when status is "Anulado", regardless of paymentDate', () => {
    expect(getLiquidationDisplayStatus({ status: 'Anulado', paymentDate: '10/01/2026' })).toBe('ANULADO');
  });
});
