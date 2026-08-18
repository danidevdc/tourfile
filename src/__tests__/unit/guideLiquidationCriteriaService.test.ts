import { describe, it, expect, vi } from 'vitest';
vi.mock('firebase/firestore', async () => await import('../test-utils/firestore-mock'));
vi.mock('@/lib/firebase', () => ({ db: {} }));

import {
  getTurno,
  getGrupo,
  applyBestCriteriaRule,
  type LiquidationCriteriaRule,
} from '@/lib/guideLiquidationCriteriaService';

function rule(overrides: Partial<LiquidationCriteriaRule>): LiquidationCriteriaRule {
  return {
    id: overrides.id ?? 'r1',
    actividad: '',
    idioma: '',
    turno: '',
    grupo: '',
    monto: 0,
    isActive: true,
    notes: '',
    ...overrides,
  };
}

describe('getTurno', () => {
  it('is DIURNO at the 07:00 boundary', () => {
    expect(getTurno('07:00')).toBe('DIURNO');
  });

  it('is NOCTURNO one minute before 07:00', () => {
    expect(getTurno('06:59')).toBe('NOCTURNO');
  });

  it('is NOCTURNO at the 21:00 boundary', () => {
    expect(getTurno('21:00')).toBe('NOCTURNO');
  });

  it('is DIURNO one minute before 21:00', () => {
    expect(getTurno('20:59')).toBe('DIURNO');
  });

  it('is NOCTURNO at midnight', () => {
    expect(getTurno('00:00')).toBe('NOCTURNO');
  });

  it('defaults to 00:00 (NOCTURNO) for an empty hora', () => {
    expect(getTurno('')).toBe('NOCTURNO');
  });
});

describe('getGrupo', () => {
  it('is INDIVIDUAL for 4 pax', () => {
    expect(getGrupo(4)).toBe('INDIVIDUAL');
  });

  it('is GRUPO at exactly 5 pax', () => {
    expect(getGrupo(5)).toBe('GRUPO');
  });

  it('is GRUPO above 5 pax', () => {
    expect(getGrupo(12)).toBe('GRUPO');
  });

  it('is INDIVIDUAL for 0 pax', () => {
    expect(getGrupo(0)).toBe('INDIVIDUAL');
  });
});

describe('applyBestCriteriaRule', () => {
  const item = { servicio: 'CITY TOUR LA PAZ', hora: '09:00', paxCount: 2 };

  it('returns null when no rule matches', () => {
    const rules = [rule({ actividad: 'MACHU PICCHU', monto: 100 })];
    expect(applyBestCriteriaRule(rules, item, 'INGLES')).toBeNull();
  });

  it('matches a fully-specific rule (actividad+idioma+turno+grupo)', () => {
    const rules = [
      rule({ id: 'specific', actividad: 'CITY TOUR', idioma: 'INGLES', turno: 'DIURNO', grupo: 'INDIVIDUAL', monto: 150 }),
    ];
    expect(applyBestCriteriaRule(rules, item, 'INGLES')).toBe(150);
  });

  it('prefers the more specific rule over a fallback when both match', () => {
    const rules = [
      rule({ id: 'fallback', actividad: 'CITY TOUR', monto: 50 }),
      rule({ id: 'specific', actividad: 'CITY TOUR', idioma: 'INGLES', monto: 150 }),
    ];
    expect(applyBestCriteriaRule(rules, item, 'INGLES')).toBe(150);
  });

  it('matches actividad as a case-insensitive substring', () => {
    const rules = [rule({ actividad: 'city tour', monto: 80 })];
    expect(applyBestCriteriaRule(rules, item, 'INGLES')).toBe(80);
  });

  it('ignores inactive rules', () => {
    const rules = [rule({ actividad: 'CITY TOUR', monto: 999, isActive: false })];
    expect(applyBestCriteriaRule(rules, item, 'INGLES')).toBeNull();
  });

  it('does not match when idioma differs', () => {
    const rules = [rule({ actividad: 'CITY TOUR', idioma: 'ALEMAN', monto: 150 })];
    expect(applyBestCriteriaRule(rules, item, 'INGLES')).toBeNull();
  });

  it('does not match when turno differs', () => {
    const rules = [rule({ actividad: 'CITY TOUR', turno: 'NOCTURNO', monto: 150 })];
    // item.hora = '09:00' → DIURNO
    expect(applyBestCriteriaRule(rules, item, 'INGLES')).toBeNull();
  });

  it('does not match when grupo differs', () => {
    const rules = [rule({ actividad: 'CITY TOUR', grupo: 'GRUPO', monto: 150 })];
    // item.paxCount = 2 → INDIVIDUAL
    expect(applyBestCriteriaRule(rules, item, 'INGLES')).toBeNull();
  });

  it('matches a wildcard rule (no actividad set) as last resort', () => {
    const rules = [rule({ actividad: '', idioma: 'INGLES', monto: 40 })];
    expect(applyBestCriteriaRule(rules, item, 'INGLES')).toBe(40);
  });
});
