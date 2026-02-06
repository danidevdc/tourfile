import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Firebase modules
vi.mock('firebase/firestore', async () => await import('../test-utils/firestore-mock'));
vi.mock('@/lib/firebase', () => ({ db: {} }));

import { setCollectionDocs, resetMockFirestore } from '../test-utils/firestore-mock';
import {
  setIntermediateUserEmail,
  getIntermediateUserEmails,
} from '@/lib/appConfigService';

describe('appConfigService', () => {
  beforeEach(() => {
    resetMockFirestore();
  });

  describe('setIntermediateUserEmail', () => {
    it('should save a single email as allowed editor', async () => {
      const testEmail = 'editor@example.com';

      await setIntermediateUserEmail([testEmail]);

      const emails = await getIntermediateUserEmails();
      expect(emails).toContain(testEmail);
    });

    it('should save multiple emails', async () => {
      const testEmails = ['editor1@example.com', 'editor2@example.com', 'editor3@example.com'];

      await setIntermediateUserEmail(testEmails);

      const emails = await getIntermediateUserEmails();
      expect(emails).toHaveLength(3);
      testEmails.forEach(email => {
        expect(emails).toContain(email);
      });
    });

    it('should normalize emails to lowercase', async () => {
      const testEmails = ['EDITOR@EXAMPLE.COM', 'Editor2@Example.Com'];

      await setIntermediateUserEmail(testEmails);

      const emails = await getIntermediateUserEmails();
      expect(emails).toContain('editor@example.com');
      expect(emails).toContain('editor2@example.com');
      expect(emails).not.toContain('EDITOR@EXAMPLE.COM');
    });

    it('should trim whitespace from emails', async () => {
      const testEmails = ['  editor@example.com  ', ' editor2@example.com '];

      await setIntermediateUserEmail(testEmails);

      const emails = await getIntermediateUserEmails();
      expect(emails).toContain('editor@example.com');
      expect(emails).toContain('editor2@example.com');
    });

    it('should filter out empty strings', async () => {
      const testEmails = ['editor@example.com', '', '  ', 'editor2@example.com'];

      await setIntermediateUserEmail(testEmails);

      const emails = await getIntermediateUserEmails();
      expect(emails).toHaveLength(2);
      expect(emails).toContain('editor@example.com');
      expect(emails).toContain('editor2@example.com');
    });

    it('should clear editors when passing empty array', async () => {
      // First, set some emails
      await setIntermediateUserEmail(['editor@example.com']);
      let emails = await getIntermediateUserEmails();
      expect(emails).toHaveLength(1);

      // Then clear them
      await setIntermediateUserEmail([]);
      emails = await getIntermediateUserEmails();
      expect(emails).toHaveLength(0);
    });

    it('should update existing emails list', async () => {
      // First, set initial emails
      await setIntermediateUserEmail(['editor1@example.com', 'editor2@example.com']);

      // Then update to new list
      await setIntermediateUserEmail(['editor3@example.com', 'editor4@example.com']);

      const emails = await getIntermediateUserEmails();
      expect(emails).toHaveLength(2);
      expect(emails).toContain('editor3@example.com');
      expect(emails).toContain('editor4@example.com');
    });
  });

  describe('getIntermediateUserEmails', () => {
    it('should return empty array when no config exists', async () => {
      const emails = await getIntermediateUserEmails();
      expect(emails).toEqual([]);
    });

    it('should return saved emails', async () => {
      const testEmails = ['editor@example.com', 'another@example.com'];

      await setIntermediateUserEmail(testEmails);

      const emails = await getIntermediateUserEmails();
      expect(emails).toHaveLength(2);
      testEmails.forEach(email => {
        expect(emails).toContain(email);
      });
    });

    it('should support backward compatibility with old intermediateUserEmail field', async () => {
      // Mock the old data format in Firestore
      setCollectionDocs('appConfig', [
        {
          id: 'specialRoles',
          data: {
            intermediateUserEmail: 'oldformat@example.com',
            // allowedEditors (new format) doesn't exist
          },
        },
      ]);

      const emails = await getIntermediateUserEmails();
      expect(emails).toContain('oldformat@example.com');
    });

    it('should merge old and new format fields without duplicates', async () => {
      // Mock a document with both old and new formats
      setCollectionDocs('appConfig', [
        {
          id: 'specialRoles',
          data: {
            intermediateUserEmail: 'old@example.com',
            allowedEditors: ['new@example.com', 'old@example.com'], // Same email exists in both
          },
        },
      ]);

      const emails = await getIntermediateUserEmails();
      expect(emails).toHaveLength(2);
      expect(emails).toContain('old@example.com');
      expect(emails).toContain('new@example.com');
      // Should not have duplicates
      const count = emails.filter(e => e === 'old@example.com').length;
      expect(count).toBe(1);
    });
  });
});
