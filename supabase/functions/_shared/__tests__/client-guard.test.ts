import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { checkAutomationShield, corsHeaders } from '../client-guard';

describe('Client Guard / Automation Shield (Edge Functions)', () => {
  const originalDeno = (globalThis as any).Deno;

  beforeEach(() => {
    (globalThis as any).Deno = {
      env: {
        get: (key: string) => {
          if (key === 'SUPABASE_SERVICE_ROLE_KEY') return 'test-service-role-secret-key-12345';
          return undefined;
        },
      },
    };
  });

  afterEach(() => {
    (globalThis as any).Deno = originalDeno;
  });

  it('bypasses shield when Authorization header contains the service role key', () => {
    const req = new Request('https://vxxgvdlqvvchtlmqnrqf.supabase.co/functions/v1/test', {
      headers: {
        authorization: 'Bearer test-service-role-secret-key-12345',
        'user-agent': 'python-requests/2.28.1',
      },
    });

    const result = checkAutomationShield(req);
    expect(result).toBeNull();
  });

  it('blocks known script user agents (curl, python, node, axios, postman)', async () => {
    const blockedAgents = [
      'curl/7.88.1',
      'python-requests/2.31.0',
      'node-fetch/3.3.0',
      'axios/1.6.2',
      'PostmanRuntime/7.32.3',
      'PowerShell/7.4.0',
      'Go-http-client/1.1',
    ];

    for (const agent of blockedAgents) {
      const req = new Request('https://vxxgvdlqvvchtlmqnrqf.supabase.co/functions/v1/test', {
        headers: {
          authorization: 'Bearer user-jwt-token',
          'user-agent': agent,
          origin: 'https://app.visibill.hu',
        },
      });

      const response = checkAutomationShield(req);
      expect(response).not.toBeNull();
      expect(response?.status).toBe(403);

      const body = await response?.json();
      expect(body.code).toBe('AUTOMATION_BLOCKED');
      expect(body.error).toContain('közvetlen szkript-alapú automatizáció le van tiltva');
    }
  });

  it('blocks requests identifying as supabase-js-node in x-client-info', async () => {
    const req = new Request('https://vxxgvdlqvvchtlmqnrqf.supabase.co/functions/v1/test', {
      headers: {
        authorization: 'Bearer user-jwt-token',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'x-client-info': 'supabase-js-node/2.45.0',
        origin: 'https://app.visibill.hu',
      },
    });

    const response = checkAutomationShield(req);
    expect(response).not.toBeNull();
    expect(response?.status).toBe(403);
    const body = await response?.json();
    expect(body.code).toBe('AUTOMATION_BLOCKED');
  });

  it('blocks requests missing both Origin and Referer unless Deno user-agent', async () => {
    const req = new Request('https://vxxgvdlqvvchtlmqnrqf.supabase.co/functions/v1/test', {
      headers: {
        authorization: 'Bearer user-jwt-token',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        // No origin or referer header
      },
    });

    const response = checkAutomationShield(req);
    expect(response).not.toBeNull();
    expect(response?.status).toBe(403);
  });

  it('allows legitimate browser webapp requests with Origin header', () => {
    const req = new Request('https://vxxgvdlqvvchtlmqnrqf.supabase.co/functions/v1/test', {
      headers: {
        authorization: 'Bearer user-jwt-token',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        origin: 'https://app.visibill.hu',
      },
    });

    const response = checkAutomationShield(req);
    expect(response).toBeNull();
  });

  it('allows internal Deno service-to-service calls without Origin header', () => {
    const req = new Request('https://vxxgvdlqvvchtlmqnrqf.supabase.co/functions/v1/test', {
      headers: {
        authorization: 'Bearer user-jwt-token',
        'user-agent': 'Deno/1.40.2',
      },
    });

    const response = checkAutomationShield(req);
    expect(response).toBeNull();
  });

  it('provides open CORS headers in corsHeaders export', () => {
    expect(corsHeaders['Access-Control-Allow-Origin']).toBe('*');
    expect(corsHeaders['Access-Control-Allow-Headers']).toContain('authorization');
    expect(corsHeaders['Access-Control-Allow-Headers']).toContain('apikey');
  });
});
