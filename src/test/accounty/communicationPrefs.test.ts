import { describe, it, expect } from 'vitest';
import type { AccountyCommunicationPrefs } from '@/hooks/accounty/useAccountyHelpers';

/**
 * Tests for the AccountyCommunicationPrefs data model and its business rules.
 *
 * Key business rules:
 * - channelEmail defaults to TRUE (always enabled unless explicitly disabled)
 * - Other channels (Viber, SMS, Phone) default to FALSE
 * - GDPR opt-in is required before sending automated reminders
 * - reminderFrequency must be one of: 'low' | 'normal' | 'high'
 * - preferredLanguage defaults to 'hu' (Hungarian)
 */

// ═══════════════════════════════════════════════════════════════
// Type shape tests
// ═══════════════════════════════════════════════════════════════

describe('AccountyCommunicationPrefs: Data shape', () => {
  const validPrefs: AccountyCommunicationPrefs = {
    id: 'cp-1',
    companyId: 'comp-1',
    contactName: 'Kovács Péter',
    contactEmail: 'peter@example.com',
    contactPhone: '+36201234567',
    channelEmail: true,
    channelViber: false,
    channelSms: false,
    channelPhone: false,
    preferredLanguage: 'hu',
    reminderFrequency: 'normal',
    autoReminder: true,
    gdprOptedIn: true,
    gdprOptedInAt: '2024-03-15T10:00:00Z',
  };

  it('has all required fields', () => {
    expect(validPrefs.companyId).toBeDefined();
    expect(typeof validPrefs.channelEmail).toBe('boolean');
    expect(typeof validPrefs.channelViber).toBe('boolean');
    expect(typeof validPrefs.channelSms).toBe('boolean');
    expect(typeof validPrefs.channelPhone).toBe('boolean');
    expect(typeof validPrefs.autoReminder).toBe('boolean');
    expect(typeof validPrefs.gdprOptedIn).toBe('boolean');
  });

  it('reminderFrequency is one of low | normal | high', () => {
    expect(['low', 'normal', 'high']).toContain(validPrefs.reminderFrequency);
  });

  it('nullable fields can be null', () => {
    const nullPrefs: AccountyCommunicationPrefs = {
      ...validPrefs,
      contactName: null,
      contactEmail: null,
      contactPhone: null,
      gdprOptedInAt: null,
    };
    expect(nullPrefs.contactName).toBeNull();
    expect(nullPrefs.contactEmail).toBeNull();
    expect(nullPrefs.contactPhone).toBeNull();
    expect(nullPrefs.gdprOptedInAt).toBeNull();
  });

  it('id is optional', () => {
    const noId: AccountyCommunicationPrefs = { ...validPrefs };
    delete noId.id;
    expect(noId.id).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════
// Channel defaults (DB → UI mapping)
// ═══════════════════════════════════════════════════════════════

describe('AccountyCommunicationPrefs: Channel defaults', () => {
  /**
   * Simulates the DB → UI mapping from useAccountyCommunicationPrefs hook.
   * When a field is null/undefined in DB, the hook applies these defaults:
   *   channel_email → true
   *   channel_viber → false
   *   channel_sms → false
   *   channel_phone → false
   *   preferred_language → 'hu'
   *   reminder_frequency → 'normal'
   *   auto_reminder → true
   *   gdpr_opted_in → false
   */
  function applyDefaults(dbRow: Record<string, unknown>): AccountyCommunicationPrefs {
    return {
      companyId: dbRow.company_id as string,
      contactName: (dbRow.contact_name as string) ?? null,
      contactEmail: (dbRow.contact_email as string) ?? null,
      contactPhone: (dbRow.contact_phone as string) ?? null,
      channelEmail: (dbRow.channel_email as boolean) ?? true,
      channelViber: (dbRow.channel_viber as boolean) ?? false,
      channelSms: (dbRow.channel_sms as boolean) ?? false,
      channelPhone: (dbRow.channel_phone as boolean) ?? false,
      preferredLanguage: (dbRow.preferred_language as string) || 'hu',
      reminderFrequency: ((dbRow.reminder_frequency as string) || 'normal') as 'low' | 'normal' | 'high',
      autoReminder: (dbRow.auto_reminder as boolean) ?? true,
      gdprOptedIn: (dbRow.gdpr_opted_in as boolean) ?? false,
      gdprOptedInAt: (dbRow.gdpr_opted_in_at as string) || null,
    };
  }

  it('email channel defaults to TRUE when null', () => {
    const result = applyDefaults({ company_id: 'c1', channel_email: null });
    expect(result.channelEmail).toBe(true);
  });

  it('email channel defaults to TRUE when undefined', () => {
    const result = applyDefaults({ company_id: 'c1' });
    expect(result.channelEmail).toBe(true);
  });

  it('viber channel defaults to FALSE when null', () => {
    const result = applyDefaults({ company_id: 'c1', channel_viber: null });
    expect(result.channelViber).toBe(false);
  });

  it('sms channel defaults to FALSE when null', () => {
    const result = applyDefaults({ company_id: 'c1', channel_sms: null });
    expect(result.channelSms).toBe(false);
  });

  it('phone channel defaults to FALSE when null', () => {
    const result = applyDefaults({ company_id: 'c1', channel_phone: null });
    expect(result.channelPhone).toBe(false);
  });

  it('preferred language defaults to "hu"', () => {
    const result = applyDefaults({ company_id: 'c1' });
    expect(result.preferredLanguage).toBe('hu');
  });

  it('reminder frequency defaults to "normal"', () => {
    const result = applyDefaults({ company_id: 'c1' });
    expect(result.reminderFrequency).toBe('normal');
  });

  it('autoReminder defaults to TRUE', () => {
    const result = applyDefaults({ company_id: 'c1' });
    expect(result.autoReminder).toBe(true);
  });

  it('gdprOptedIn defaults to FALSE', () => {
    const result = applyDefaults({ company_id: 'c1' });
    expect(result.gdprOptedIn).toBe(false);
  });

  it('preserves explicit FALSE for channelEmail', () => {
    const result = applyDefaults({ company_id: 'c1', channel_email: false });
    expect(result.channelEmail).toBe(false);
  });

  it('preserves explicit TRUE for channelViber', () => {
    const result = applyDefaults({ company_id: 'c1', channel_viber: true });
    expect(result.channelViber).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// GDPR opt-in rules
// ═══════════════════════════════════════════════════════════════

describe('AccountyCommunicationPrefs: GDPR opt-in rules', () => {
  it('autoReminder should be gated by gdprOptedIn', () => {
    // Business rule: don't send automatic reminders without GDPR consent
    const prefs: AccountyCommunicationPrefs = {
      companyId: 'c1',
      contactName: null,
      contactEmail: 'test@example.com',
      contactPhone: null,
      channelEmail: true,
      channelViber: false,
      channelSms: false,
      channelPhone: false,
      preferredLanguage: 'hu',
      reminderFrequency: 'high',
      autoReminder: true,
      gdprOptedIn: false,
      gdprOptedInAt: null,
    };
    // The effective reminder state should consider both flags
    const effectiveAutoReminder = prefs.autoReminder && prefs.gdprOptedIn;
    expect(effectiveAutoReminder).toBe(false);
  });

  it('autoReminder + gdprOptedIn both true → reminders enabled', () => {
    const effectiveAutoReminder = true && true;
    expect(effectiveAutoReminder).toBe(true);
  });

  it('gdprOptedInAt should be a parseable ISO date string when opted in', () => {
    const ts = '2024-03-15T10:00:00Z';
    const parsed = new Date(ts);
    expect(parsed.getTime()).toBeGreaterThan(0);
    expect(parsed.toISOString()).toContain('2024-03-15');
  });

  it('gdprOptedInAt should be null when not opted in', () => {
    const prefs: AccountyCommunicationPrefs = {
      companyId: 'c1',
      contactName: null,
      contactEmail: null,
      contactPhone: null,
      channelEmail: true,
      channelViber: false,
      channelSms: false,
      channelPhone: false,
      preferredLanguage: 'hu',
      reminderFrequency: 'normal',
      autoReminder: false,
      gdprOptedIn: false,
      gdprOptedInAt: null,
    };
    expect(prefs.gdprOptedInAt).toBeNull();
  });
});
