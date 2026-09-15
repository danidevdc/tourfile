import { describe, expect, it } from 'vitest';
import { previewImageWasSent, type PreviewImageResult } from '@/lib/copyPreview';

describe('previewImageWasSent', () => {
  it.each<PreviewImageResult>(['copied', 'shared'])(
    'marks %s as a completed send action',
    (result) => expect(previewImageWasSent(result)).toBe(true),
  );

  it.each<PreviewImageResult>(['downloaded', 'cancelled', 'failed'])(
    'does not mark %s as sent',
    (result) => expect(previewImageWasSent(result)).toBe(false),
  );
});
