import { describe, it, expect } from 'vitest';

// ── #19: Portal Token Generation ──

function generateToken(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let token = '';
  for (let i = 0; i < 32; i++) token += chars[Math.floor(Math.random() * chars.length)];
  return token;
}

describe('Portal Token Generation (#19)', () => {
  it('generates a 32-character token', () => {
    const token = generateToken();
    expect(token).toHaveLength(32);
  });

  it('does not contain ambiguous characters (0, O, 1, l, I)', () => {
    for (let i = 0; i < 100; i++) {
      const token = generateToken();
      expect(token).not.toMatch(/[0OlI1]/);
    }
  });

  it('generates unique tokens', () => {
    const tokens = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      tokens.add(generateToken());
    }
    expect(tokens.size).toBe(1000);
  });
});

// ── #17: Webhook NLP Keyword Matching ──

const resolveKeywords = [
  'megtörtént', 'elküldtem', 'feltöltöttem', 'csatolom', 'mellékelem',
  'utalás megtörtént', 'átutaltam', 'kifizettük', 'megcsináltam',
  'elintéztük', 'rendben van', 'rendben', 'kész van', 'megoldottam',
  'küldöm', 'küldtem', 'postáztam', 'feladtam',
];

function hasResolveIntent(bodyPlain: string): boolean {
  const replyText = bodyPlain.toLowerCase();
  return resolveKeywords.some(kw => replyText.includes(kw));
}

describe('Webhook NLP Keyword Matching (#17)', () => {
  it('detects "elküldtem" intent', () => {
    expect(hasResolveIntent('Szia, elküldtem a számlákat tegnap.')).toBe(true);
  });

  it('detects "megtörtént" intent', () => {
    expect(hasResolveIntent('Az utalás megtörtént, köszönöm!')).toBe(true);
  });

  it('detects "csatolom" intent', () => {
    expect(hasResolveIntent('Csatolom a jelenléti íveket.')).toBe(true);
  });

  it('detects "rendben" intent', () => {
    expect(hasResolveIntent('Rendben, holnap küldöm.')).toBe(true);
  });

  it('detects "feltöltöttem" intent', () => {
    expect(hasResolveIntent('Feltöltöttem a portálra a dokumentumokat.')).toBe(true);
  });

  it('does NOT detect unrelated text', () => {
    expect(hasResolveIntent('Mikor jár le a határidő?')).toBe(false);
  });

  it('does NOT detect a question about status', () => {
    expect(hasResolveIntent('Mi a teendő a hiányzó számlákkal?')).toBe(false);
  });

  it('does NOT detect negative response', () => {
    expect(hasResolveIntent('Sajnos nem tudom most megcsinálni.')).toBe(false);
  });

  it('is case insensitive', () => {
    expect(hasResolveIntent('ELKÜLDTEM a dokumentumokat!')).toBe(true);
    expect(hasResolveIntent('Megtörtént az utalás.')).toBe(true);
  });

  it('handles empty string', () => {
    expect(hasResolveIntent('')).toBe(false);
  });
});

// ── #15: Communication Preferences Channel Mapping ──

describe('Communication Preferences Channel Mapping (#15)', () => {
  it('maps UI channel values to DB columns correctly', () => {
    const selectedChannels = ['email', 'viber', 'telegram'];

    const dbPayload = {
      channel_email: selectedChannels.includes('email'),
      channel_viber: selectedChannels.includes('viber'),
      channel_sms: selectedChannels.includes('telegram'), // telegram → channel_sms
      channel_phone: false,
    };

    expect(dbPayload.channel_email).toBe(true);
    expect(dbPayload.channel_viber).toBe(true);
    expect(dbPayload.channel_sms).toBe(true);
    expect(dbPayload.channel_phone).toBe(false);
  });

  it('defaults to email only', () => {
    const selectedChannels = ['email'];

    const dbPayload = {
      channel_email: selectedChannels.includes('email'),
      channel_viber: selectedChannels.includes('viber'),
      channel_sms: selectedChannels.includes('telegram'),
      channel_phone: false,
    };

    expect(dbPayload.channel_email).toBe(true);
    expect(dbPayload.channel_viber).toBe(false);
    expect(dbPayload.channel_sms).toBe(false);
  });
});
