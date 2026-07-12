import { describe, it, expect } from 'vitest';
import { resolveApiBaseUrl } from './apiBaseUrl';

describe('resolveApiBaseUrl', () => {
  it('falls back to the current origin when no backend URL is configured', () => {
    const result = resolveApiBaseUrl({}, {
      protocol: 'https:',
      hostname: 'erp.example.com',
      host: 'erp.example.com',
      origin: 'https://erp.example.com'
    });

    expect(result).toBe('https://erp.example.com/api');
  });

  it('uses the configured backend URL when present', () => {
    const result = resolveApiBaseUrl({ VITE_API_BASE_URL: 'https://api.example.com' }, {
      protocol: 'https:',
      hostname: 'erp.example.com',
      host: 'erp.example.com',
      origin: 'https://erp.example.com'
    });

    expect(result).toBe('https://api.example.com/api');
  });
});
