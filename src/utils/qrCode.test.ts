import { describe, it, expect } from 'vitest';
import { getExtinguisherQRUrl, generateQRDataUrl } from './qrCode.ts';

describe('getExtinguisherQRUrl', () => {
  it('returns a URL with origin, orgId, and extId', () => {
    const url = getExtinguisherQRUrl('org123', 'ext456');
    expect(url).toContain('/qr/org123/ext456');
    expect(url).toMatch(/^https?:\/\//);
  });

  it('handles special characters in IDs', () => {
    const url = getExtinguisherQRUrl('org-abc', 'ext_123');
    expect(url).toContain('/qr/org-abc/ext_123');
  });
});

describe('generateQRDataUrl', () => {
  it('generates a PNG data URL', async () => {
    const dataUrl = await generateQRDataUrl('https://example.com');
    expect(dataUrl).toMatch(/^data:image\/png;base64,/);
  });

  it('accepts a custom size', async () => {
    const dataUrl = await generateQRDataUrl('https://example.com', 200);
    expect(dataUrl).toMatch(/^data:image\/png;base64,/);
  });

  it('generates different data for different inputs', async () => {
    const url1 = await generateQRDataUrl('https://example.com/a');
    const url2 = await generateQRDataUrl('https://example.com/b');
    expect(url1).not.toBe(url2);
  });
});
