import { describe, expect, it } from 'vitest';
import { getServiceOrderDraftError } from '@/lib/serviceOrderDraftValidation';
import type { ServiceOrderData } from '@/lib/serviceOrderGenerator';

const validDraft: ServiceOrderData = {
  file: 'CTF123456',
  guia: 'ANA',
  ref: '',
  nPax: '',
  hotel: '',
  services: [{ fecha: '14/09/2026', hora: '', servicio: 'TRF IN' }],
};

describe('getServiceOrderDraftError', () => {
  it('accepts a draft with a file, guide and service', () => {
    expect(getServiceOrderDraftError(validDraft)).toBeNull();
  });

  it('rejects an empty file or guide', () => {
    expect(getServiceOrderDraftError({ ...validDraft, file: ' ' })).toBe('Ingresa el número de file.');
    expect(getServiceOrderDraftError({ ...validDraft, guia: ' ' })).toBe('Selecciona una guía principal.');
  });

  it('rejects an order with no services', () => {
    expect(getServiceOrderDraftError({ ...validDraft, services: [] })).toContain('al menos un servicio');
  });

  it('points to the first service missing its date or activity', () => {
    expect(getServiceOrderDraftError({
      ...validDraft,
      services: [...validDraft.services, { fecha: '', hora: '', servicio: 'TRF OUT' }],
    })).toContain('servicio 2');
  });
});
