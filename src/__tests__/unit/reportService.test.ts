import { describe, it, expect, beforeEach, vi } from 'vitest';
vi.mock('firebase/firestore', async () => await import('../test-utils/firestore-mock'));
vi.mock('@/lib/firebase', () => ({ db: {} }));

import { resetMockFirestore, setCollectionDocs } from '../test-utils/firestore-mock';
import { saveReportInfoToFirestore, saveBulkReportsToFirestore, getAllReportsFromFirestore, getRecentReportsFromFirestore, getAugustReports } from '@/lib/reportService';

describe('reportService', () => {
  beforeEach(() => resetMockFirestore());

  it('saveReportInfoToFirestore stores a report that getAllReportsFromFirestore can retrieve', async () => {
    setCollectionDocs('generatedReports', []);
    await saveReportInfoToFirestore({ fileNumber: '123', guideName: 'G1', groupName: 'G', paxCount: '10', generatedBy: 'u1' });
    const reports = await getAllReportsFromFirestore();
    expect(reports.length).toBeGreaterThanOrEqual(1);
    expect(reports[0].fileNumber).toBe('123');
  });

  it('saveBulkReportsToFirestore stores multiple reports', async () => {
    setCollectionDocs('generatedReports', []);
    const payload = [
      { fileNumber: '1', guideName: 'G', groupName: 'A', paxCount: '5', generatedBy: 'u' },
      { fileNumber: '2', guideName: 'G2', groupName: 'B', paxCount: '6', generatedBy: 'u' }
    ];
    await saveBulkReportsToFirestore(payload);
    const reports = await getAllReportsFromFirestore();
    expect(reports.length).toBe(2);
  });

  it('getRecentReportsFromFirestore returns reports within monthsBack range', async () => {
    // create two reports: one recent, one older than 24 months
    const now = Date.now();
    setCollectionDocs('generatedReports', [
      { id: 'r1', data: { fileNumber: 'now', guideName: 'G', groupName: 'A', paxCount: '1', generatedBy: 'u', generationDate: new Date(now) } },
      { id: 'r2', data: { fileNumber: 'old', guideName: 'G', groupName: 'B', paxCount: '2', generatedBy: 'u', generationDate: new Date(now - (1000 * 60 * 60 * 24 * 400)) } }
    ]);

    const recent = await getRecentReportsFromFirestore(12);
    expect(recent.some(r => r.fileNumber === 'now')).toBe(true);
  });

  it('getAugustReports filters by August 2024 range', async () => {
    // create reports with generationDate in August and September
    setCollectionDocs('generatedReports', [
      { id: 'a1', data: { fileNumber: 'aug', guideName: 'G', groupName: 'A', paxCount: '1', generatedBy: 'u', generationDate: new Date('2024-08-15T12:00:00Z') } },
      { id: 's1', data: { fileNumber: 'sep', guideName: 'G', groupName: 'B', paxCount: '2', generatedBy: 'u', generationDate: new Date('2024-09-02T12:00:00Z') } }
    ]);

    const august = await getAugustReports();
    expect(august.some(r => r.fileNumber === 'aug')).toBe(true);
    expect(august.every(r => r.fileNumber !== 'sep')).toBe(true);
  });
});
