import { describe, it, expect } from 'vitest';
import { generatePayrollRequestEmail, generatePayrollReminderEmail } from '../emailTemplates';

describe('generatePayrollRequestEmail', () => {
  const baseInput = {
    companyName: 'Teszt Kft.',
    contactName: 'Kiss János',
    year: 2026,
    month: 6,
    dueDate: '2026-06-15',
    senderName: 'Nagy Éva',
    senderCompany: 'Könyvelő Iroda Kft.',
  };

  it('should generate valid subject line', () => {
    const result = generatePayrollRequestEmail(baseInput);
    expect(result.subject).toContain('2026');
    expect(result.subject).toContain('június');
    expect(result.subject).toContain('Teszt Kft.');
  });

  it('should generate HTML with all required sections', () => {
    const result = generatePayrollRequestEmail(baseInput);
    expect(result.htmlBody).toContain('Kiss János');
    expect(result.htmlBody).toContain('Teszt Kft.');
    expect(result.htmlBody).toContain('Jelenléti ív');
    expect(result.htmlBody).toContain('Túlóra');
    expect(result.htmlBody).toContain('Táppénz');
    expect(result.htmlBody).toContain('Nagy Éva');
    expect(result.htmlBody).toContain('Könyvelő Iroda Kft.');
  });

  it('should generate valid plain text', () => {
    const result = generatePayrollRequestEmail(baseInput);
    expect(result.plainText).toContain('Kiss János');
    expect(result.plainText).toContain('június');
    expect(result.plainText).toContain('Jelenléti ív');
  });

  it('should include new employee checklist item when flagged', () => {
    const result = generatePayrollRequestEmail({ ...baseInput, hasNewEmployees: true });
    expect(result.htmlBody).toContain('Új belépők');
    expect(result.plainText).toContain('Új belépők');
  });

  it('should include termination checklist item when flagged', () => {
    const result = generatePayrollRequestEmail({ ...baseInput, hasTerminations: true });
    expect(result.htmlBody).toContain('Kilépők');
  });

  it('should include salary change checklist item when flagged', () => {
    const result = generatePayrollRequestEmail({ ...baseInput, hasSalaryChanges: true });
    expect(result.htmlBody).toContain('Bérmódosítás');
  });

  it('should include portal link when provided', () => {
    const result = generatePayrollRequestEmail({ ...baseInput, portalLink: 'https://portal.test.com/upload' });
    expect(result.htmlBody).toContain('https://portal.test.com/upload');
    expect(result.htmlBody).toContain('Feltöltés');
  });

  it('should include extra requests', () => {
    const result = generatePayrollRequestEmail({ ...baseInput, extraRequests: ['Gépjármű nyilvántartás'] });
    expect(result.htmlBody).toContain('Gépjármű nyilvántartás');
  });

  it('should escape HTML in names', () => {
    const result = generatePayrollRequestEmail({ ...baseInput, contactName: '<script>alert("xss")</script>' });
    expect(result.htmlBody).not.toContain('<script>');
    expect(result.htmlBody).toContain('&lt;script&gt;');
  });
});

describe('generatePayrollReminderEmail', () => {
  const reminderInput = {
    companyName: 'Teszt Kft.',
    contactName: 'Kiss János',
    year: 2026,
    month: 6,
    dueDate: '2026-06-15',
    senderName: 'Nagy Éva',
    senderCompany: 'Könyvelő Iroda Kft.',
    reminderNumber: 2,
    originalSentDate: '2026-06-01',
  };

  it('should generate reminder subject with number', () => {
    const result = generatePayrollReminderEmail(reminderInput);
    expect(result.subject).toContain('Emlékeztető');
    expect(result.subject).toContain('2.');
    expect(result.subject).toContain('június');
  });

  it('should include urgency when overdue', () => {
    const overdueInput = { ...reminderInput, dueDate: '2020-01-01' };
    const result = generatePayrollReminderEmail(overdueInput);
    expect(result.htmlBody).toContain('LEJÁRT');
  });

  it('should show non-urgent message when not overdue', () => {
    const futureInput = { ...reminderInput, dueDate: '2030-12-31' };
    const result = generatePayrollReminderEmail(futureInput);
    expect(result.htmlBody).not.toContain('LEJÁRT');
    expect(result.htmlBody).toContain('mielőbb');
  });
});
