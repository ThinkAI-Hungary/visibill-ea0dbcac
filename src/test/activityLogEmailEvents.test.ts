import { describe, it, expect } from 'vitest';
import {
  groupEmailTimelineItems,
  normalize,
  isProcessingComplete,
  isMailgunUpload,
  getDisplayName,
  decodeSenderEmail,
  type AuditLogRow,
  type TimelineItem,
} from '@/components/dashboard/ActivityLogSheet';

describe('ActivityLog Email Events, Deduplication and Processing Detection', () => {
  it('detects system invoice processing correctly', () => {
    const log1: AuditLogRow = {
      id: 'log-1',
      company_id: 'comp-1',
      user_id: null,
      action: 'módosítás',
      entity: 'dokumentum',
      entity_name: 'Invoice-FL1RRUFZ-0002.pdf',
      details: {
        is_system: true,
        processing_type: 'invoice_processed',
        upload_source: 'email_alias',
      },
      created_at: '2026-09-17T18:00:00Z',
    };

    const log2: AuditLogRow = {
      id: 'log-2',
      company_id: 'comp-1',
      user_id: null,
      action: 'feltöltés',
      entity: 'számla',
      entity_name: 'INV-2026-001',
      details: {},
      created_at: '2026-09-17T18:00:00Z',
    };

    const logManual: AuditLogRow = {
      id: 'log-3',
      company_id: 'comp-1',
      user_id: 'user-123',
      action: 'módosítás',
      entity: 'számla',
      entity_name: 'INV-2026-001',
      details: {},
      created_at: '2026-09-17T18:00:00Z',
    };

    expect(isProcessingComplete(log1)).toBe(true);
    expect(isProcessingComplete(log2)).toBe(true);
    expect(isProcessingComplete(logManual)).toBe(false);
  });

  it('detects email uploads correctly via metadata or system user', () => {
    const emailLogWithSource: AuditLogRow = {
      id: 'log-email-1',
      company_id: 'comp-1',
      user_id: null,
      action: 'feltöltés',
      entity: 'dokumentum',
      entity_name: 'Invoice-FL1RRUFZ-0002.pdf',
      details: {
        upload_source: 'email_alias',
        sender: 'marco.mauroni@gmail.com',
        subject: '[VB] Your receipt from Anthropic',
      },
      created_at: '2026-09-17T17:59:56Z',
    };

    const emailLogLegacy: AuditLogRow = {
      id: 'log-email-2',
      company_id: 'comp-1',
      user_id: null,
      action: 'feltöltés',
      entity: 'dokumentum',
      entity_name: 'scan.pdf',
      details: {
        table: 'invoice_uploads',
      },
      created_at: '2026-09-17T17:59:56Z',
    };

    const manualUpload: AuditLogRow = {
      id: 'log-manual',
      company_id: 'comp-1',
      user_id: 'user-1',
      action: 'feltöltés',
      entity: 'dokumentum',
      entity_name: 'manual_invoice.pdf',
      details: {
        upload_source: 'manual',
      },
      created_at: '2026-09-17T17:59:56Z',
    };

    expect(isMailgunUpload(emailLogWithSource)).toBe(true);
    expect(isMailgunUpload(emailLogLegacy)).toBe(true);
    expect(isMailgunUpload(manualUpload)).toBe(false);
  });

  it('enriches email metadata and enables searching by sender, subject and invoice number', () => {
    const logs: AuditLogRow[] = [
      {
        id: '1',
        company_id: 'comp-1',
        user_id: null,
        action: 'feltöltés',
        entity: 'dokumentum',
        entity_name: 'Invoice-FL1RRUFZ-0002.pdf',
        details: {
          upload_source: 'email_alias',
          sender: 'marco.mauroni@gmail.com',
          subject: '[VB] Your receipt from Anthropic, PBC',
        },
        created_at: '2026-09-17T17:59:56Z',
      },
      {
        id: '2',
        company_id: 'comp-1',
        user_id: null,
        action: 'módosítás',
        entity: 'dokumentum',
        entity_name: 'Invoice-FL1RRUFZ-0002.pdf',
        details: {
          is_system: true,
          processing_type: 'invoice_processed',
          sender: 'marco.mauroni@gmail.com',
          ai_invoice_number: 'FL1RRUFZ-0002',
        },
        created_at: '2026-09-17T18:00:10Z',
      },
    ];

    const linkedInvoice = {
      id: 'inv-1',
      bizonylatsorszam: 'FL1RRUFZ-0002',
      elado_nev: 'Anthropic, PBC',
      brutto_vegosszeg: 180,
      penznem: 'EUR',
    };

    // Test Search Matching
    const searchMatch = (log: AuditLogRow, query: string) => {
      const q = normalize(query);
      const name = normalize(log.entity_name || '');
      const sender = normalize(log.details?.sender || '');
      const subject = normalize(log.details?.subject || '');
      const invNum = normalize(linkedInvoice.bizonylatsorszam);
      const supplier = normalize(linkedInvoice.elado_nev);

      return (
        name.includes(q) ||
        sender.includes(q) ||
        subject.includes(q) ||
        invNum.includes(q) ||
        supplier.includes(q)
      );
    };

    // Query for sender
    expect(searchMatch(logs[0], 'marco.mauroni')).toBe(true);
    // Query for subject
    expect(searchMatch(logs[0], 'receipt from Anthropic')).toBe(true);
    // Query for invoice number
    expect(searchMatch(logs[1], 'FL1RRUFZ')).toBe(true);
    // Query for supplier
    expect(searchMatch(logs[1], 'Anthropic')).toBe(true);
    // Non-matching query
    expect(searchMatch(logs[0], 'random string 12345')).toBe(false);
  });

  it('deduplicates identical fallback uploads and aggregates multi-attachment emails into a single card', () => {
    // Simulated scenario from the user screenshot:
    // Email arrives at 17:19 from 'biztosito@allianz.hu' with 2 attachments:
    // 'Assistance tájékoztató.pdf' and '1. sz. Feltételrendszer melléklet.pdf'
    // Due to the fallback pipeline (A-035), each generated multiple fallback audit rows
    const rawLogs: AuditLogRow[] = [
      // 4 fallback rows for Assistance tájékoztató:
      {
        id: 'fb-ast-4',
        company_id: 'comp-1',
        user_id: null,
        action: 'feltöltés',
        entity: 'dokumentum',
        entity_name: 'Assistance tájékoztató.pdf',
        details: { upload_source: 'email_alias', sender: 'biztosito@allianz.hu', subject: 'Biztosítási kötvény és tájékoztatók' },
        created_at: '2026-09-17T17:19:35Z',
      },
      {
        id: 'fb-ast-3',
        company_id: 'comp-1',
        user_id: null,
        action: 'feltöltés',
        entity: 'dokumentum',
        entity_name: 'Assistance tájékoztató.pdf',
        details: { upload_source: 'email_alias', sender: 'biztosito@allianz.hu', subject: 'Biztosítási kötvény és tájékoztatók' },
        created_at: '2026-09-17T17:19:33Z',
      },
      {
        id: 'fb-ast-2',
        company_id: 'comp-1',
        user_id: null,
        action: 'feltöltés',
        entity: 'dokumentum',
        entity_name: 'Assistance tájékoztató.pdf',
        details: { upload_source: 'email_alias', sender: 'biztosito@allianz.hu', subject: 'Biztosítási kötvény és tájékoztatók' },
        created_at: '2026-09-17T17:19:31Z',
      },
      {
        id: 'fb-ast-1',
        company_id: 'comp-1',
        user_id: null,
        action: 'feltöltés',
        entity: 'dokumentum',
        entity_name: 'Assistance tájékoztató.pdf',
        details: { upload_source: 'email_alias', sender: 'biztosito@allianz.hu', subject: 'Biztosítási kötvény és tájékoztatók' },
        created_at: '2026-09-17T17:19:30Z',
      },

      // 3 fallback rows for 1. sz. Feltételrendszer melléklet:
      {
        id: 'fb-mel-3',
        company_id: 'comp-1',
        user_id: null,
        action: 'feltöltés',
        entity: 'dokumentum',
        entity_name: '1. sz. Feltételrendszer melléklet.pdf',
        details: { upload_source: 'email_alias', sender: 'biztosito@allianz.hu', subject: 'Biztosítási kötvény és tájékoztatók' },
        created_at: '2026-09-17T17:20:10Z',
      },
      {
        id: 'fb-mel-2',
        company_id: 'comp-1',
        user_id: null,
        action: 'feltöltés',
        entity: 'dokumentum',
        entity_name: '1. sz. Feltételrendszer melléklet.pdf',
        details: { upload_source: 'email_alias', sender: 'biztosito@allianz.hu', subject: 'Biztosítási kötvény és tájékoztatók' },
        created_at: '2026-09-17T17:20:05Z',
      },
      {
        id: 'fb-mel-1',
        company_id: 'comp-1',
        user_id: null,
        action: 'feltöltés',
        entity: 'dokumentum',
        entity_name: '1. sz. Feltételrendszer melléklet.pdf',
        details: { upload_source: 'email_alias', sender: 'biztosito@allianz.hu', subject: 'Biztosítási kötvény és tájékoztatók' },
        created_at: '2026-09-17T17:20:00Z',
      },

      // Separate email from another sender 1 hour later:
      {
        id: 'other-email-1',
        company_id: 'comp-1',
        user_id: null,
        action: 'feltöltés',
        entity: 'dokumentum',
        entity_name: 'Invoice-2026-999.pdf',
        details: { upload_source: 'email_alias', sender: 'supplier@telekom.hu', subject: 'Telekom számla 2026/09' },
        created_at: '2026-09-17T18:30:00Z',
      },

      // Separate step 2: processed invoice for the telekom invoice
      {
        id: 'proc-1',
        company_id: 'comp-1',
        user_id: null,
        action: 'módosítás',
        entity: 'dokumentum',
        entity_name: 'Invoice-2026-999.pdf',
        details: { is_system: true, processing_type: 'invoice_processed', ai_invoice_number: 'TEL-2026-999' },
        created_at: '2026-09-17T18:30:15Z',
      },
    ];

    const getEmailInfo = (log: AuditLogRow) => ({
      isEmail: isMailgunUpload(log),
      sender: log.details?.sender || null,
      subject: log.details?.subject || null,
    });

    const getLinkedInvoice = (log: AuditLogRow) => {
      if (log.entity_name === 'Invoice-2026-999.pdf' || log.details?.ai_invoice_number === 'TEL-2026-999') {
        return {
          id: 'inv-tel-1',
          bizonylatsorszam: 'TEL-2026-999',
          elado_nev: 'Magyar Telekom Nyrt.',
          vevo_nev: 'Példa Kft.',
          brutto_vegosszeg: 45000,
          penznem: 'HUF',
          invoice_uploads_id: null,
        };
      }
      return null;
    };

    // Run groupEmailTimelineItems
    const timeline = groupEmailTimelineItems(
      rawLogs,
      getEmailInfo,
      getLinkedInvoice,
      isProcessingComplete,
      getDisplayName
    );

    // 7 raw fallback logs from the Allianz email should collapse into EXACTLY 1 grouped email item!
    // 1 Telekom email upload
    // 1 Telekom processed event (kept as distinct Step 2)
    // Total items on timeline: 3 (instead of 9 raw logs!)
    expect(timeline.length).toBe(3);

    // Check the Allianz grouped item:
    const allianzGroup = timeline.find(
      t => t.isGroupedEmail && t.sender === 'biztosito@allianz.hu'
    ) as Extract<TimelineItem, { isGroupedEmail: true }>;

    expect(allianzGroup).toBeDefined();
    expect(allianzGroup.isGroupedEmail).toBe(true);
    expect(allianzGroup.sender).toBe('biztosito@allianz.hu');
    expect(allianzGroup.subject).toBe('Biztosítási kötvény és tájékoztatók');

    // Both unique attachments should be present:
    expect(allianzGroup.files.length).toBe(2);
    const fileNames = allianzGroup.files.map(f => f.displayName);
    expect(fileNames).toContain('Assistance tájékoztató.pdf');
    expect(fileNames).toContain('1. sz. Feltételrendszer melléklet.pdf');

    // Check the Telekom email:
    const telekomEmail = timeline.find(
      t => t.isGroupedEmail && t.sender === 'supplier@telekom.hu'
    ) as Extract<TimelineItem, { isGroupedEmail: true }>;

    expect(telekomEmail).toBeDefined();
    expect(telekomEmail.files.length).toBe(1);
    expect(telekomEmail.files[0].linkedInvoice?.bizonylatsorszam).toBe('TEL-2026-999');

    // Check the Processed step:
    const processedStep = timeline.find(t => t.isProcessedDoc) as Extract<TimelineItem, { isProcessedDoc: true }>;
    expect(processedStep).toBeDefined();
    expect(processedStep.isProcessedDoc).toBe(true);
    expect(processedStep.displayName).toBe('Invoice-2026-999.pdf');
    expect(processedStep.linkedInvoice?.bizonylatsorszam).toBe('TEL-2026-999');
  });

  it('generates a separate processed_doc entry for processed attachments when no explicit processing audit log exists', () => {
    // Historical email upload where the invoice was processed, but no audit log row was written for the UPDATE
    const rawLogs: AuditLogRow[] = [
      {
        id: 'hist-email-1',
        company_id: 'comp-1',
        user_id: null,
        action: 'feltöltés',
        entity: 'dokumentum',
        entity_name: 'Invoice-LYUID39R-0018.pdf',
        details: {
          upload_source: 'email_alias',
          sender: 'billing@stripe.com',
          subject: 'Your receipt from 0CodeKit',
        },
        created_at: '2026-09-15T15:43:00Z',
      },
    ];

    const getEmailInfo = (log: AuditLogRow) => ({
      isEmail: isMailgunUpload(log),
      sender: log.details?.sender || null,
      subject: log.details?.subject || null,
    });

    const getLinkedInvoice = (log: AuditLogRow) => ({
      id: 'inv-lyu-1',
      bizonylatsorszam: 'LYUID39R-0018',
      elado_nev: '0CodeKit by relyon AG',
      vevo_nev: 'Példa Kft.',
      brutto_vegosszeg: 10,
      penznem: 'USD',
      invoice_uploads_id: null,
    });

    const timeline = groupEmailTimelineItems(
      rawLogs,
      getEmailInfo,
      getLinkedInvoice,
      isProcessingComplete,
      getDisplayName
    );

    // Should produce 2 entries:
    // 1: Incoming email (grouped_email)
    // 2: Processing complete (processed_doc)
    expect(timeline.length).toBe(2);

    const emailEntry = timeline.find(t => t.isGroupedEmail) as Extract<TimelineItem, { isGroupedEmail: true }>;
    expect(emailEntry).toBeDefined();
    expect(emailEntry.files[0].displayName).toBe('Invoice-LYUID39R-0018.pdf');

    const processedEntry = timeline.find(t => t.isProcessedDoc) as Extract<TimelineItem, { isProcessedDoc: true }>;
    expect(processedEntry).toBeDefined();
    expect(processedEntry.displayName).toBe('Invoice-LYUID39R-0018.pdf');
    expect(processedEntry.linkedInvoice?.bizonylatsorszam).toBe('LYUID39R-0018');
    expect(processedEntry.linkedInvoice?.elado_nev).toBe('0CodeKit by relyon AG');
    expect(processedEntry.linkedInvoice?.brutto_vegosszeg).toBe(10);
  });

  it('aggregates multi-attachment email into 1 card with sender and subject even when fallback attachments lack metadata', () => {
    // Exact user scenario: 1 email with 7 attachments.
    // 1 attachment is an invoice with known sender & subject (Kezdő bérleti díj.pdf).
    // The other 6 non-invoice attachments have fallback retries and null sender/subject.
    const rawLogs: AuditLogRow[] = [
      // Fallback retries (arriving between 15:22 and 15:20) without sender:
      {
        id: 'fb-1',
        company_id: 'comp-thinkai',
        user_id: null,
        action: 'feltöltés',
        entity: 'dokumentum',
        entity_name: '1. sz. Feltételrendszer melléklet.pdf',
        details: { upload_source: 'email_alias', table: 'transaction_uploads' },
        created_at: '2026-09-15T15:22:27Z',
      },
      {
        id: 'fb-2',
        company_id: 'comp-thinkai',
        user_id: null,
        action: 'feltöltés',
        entity: 'dokumentum',
        entity_name: 'Assistance tájékoztató.pdf',
        details: { upload_source: 'email_alias', table: 'transaction_uploads' },
        created_at: '2026-09-15T15:20:14Z',
      },
      {
        id: 'fb-3',
        company_id: 'comp-thinkai',
        user_id: null,
        action: 'feltöltés',
        entity: 'dokumentum',
        entity_name: 'Egyedi Gepjarmu Be rleti Szerződés.pdf',
        details: { upload_source: 'email_alias', table: 'transaction_uploads' },
        created_at: '2026-09-15T15:20:01Z',
      },
      {
        id: 'fb-4',
        company_id: 'comp-thinkai',
        user_id: null,
        action: 'feltöltés',
        entity: 'dokumentum',
        entity_name: '2. sz. Rendeltetesszeru használat melléklet.pdf',
        details: { upload_source: 'email_alias', table: 'transaction_uploads' },
        created_at: '2026-09-15T15:19:46Z',
      },
      {
        id: 'fb-5',
        company_id: 'comp-thinkai',
        user_id: null,
        action: 'feltöltés',
        entity: 'dokumentum',
        entity_name: '4. sz. Visszabirtoklás melléklet.pdf',
        details: { upload_source: 'email_alias', table: 'transaction_uploads' },
        created_at: '2026-09-15T15:19:38Z',
      },
      {
        id: 'fb-6',
        company_id: 'comp-thinkai',
        user_id: null,
        action: 'feltöltés',
        entity: 'dokumentum',
        entity_name: '5. sz. Díjak kondíciók melléklet.pdf',
        details: { upload_source: 'email_alias', table: 'transaction_uploads' },
        created_at: '2026-09-15T15:19:11Z',
      },
      // Original upload at 15:18 with full metadata and invoice linking:
      {
        id: 'inv-upload-1',
        company_id: 'comp-thinkai',
        user_id: null,
        action: 'feltöltés',
        entity: 'dokumentum',
        entity_name: 'Kezdő bérleti díj.pdf',
        details: {
          upload_source: 'email_alias',
          sender: 'balazs@thinkai.hu',
          subject: 'Fwd: Tesla lejárat Rapid Rent',
        },
        created_at: '2026-09-15T15:18:34Z',
      },
    ];

    const getEmailInfo = (log: AuditLogRow) => ({
      isEmail: isMailgunUpload(log),
      sender: log.details?.sender || null,
      subject: log.details?.subject || null,
    });

    const getLinkedInvoice = (log: AuditLogRow) => {
      if (log.entity_name === 'Kezdő bérleti díj.pdf') {
        return {
          id: 'inv-rapid-1',
          bizonylatsorszam: 'GENO-2026/02695',
          elado_nev: 'Rapid Rent Autó Kft.',
          vevo_nev: 'THINK AI KFT.',
          brutto_vegosszeg: 2286000,
          penznem: 'HUF',
          invoice_uploads_id: null,
        };
      }
      return null;
    };

    const timeline = groupEmailTimelineItems(
      rawLogs,
      getEmailInfo,
      getLinkedInvoice,
      isProcessingComplete,
      getDisplayName
    );

    // All 7 attachments merge into EXACTLY 1 grouped email item + 1 processed doc item = 2 items
    expect(timeline.length).toBe(2);

    const emailGroup = timeline.find(t => t.isGroupedEmail) as Extract<TimelineItem, { isGroupedEmail: true }>;
    expect(emailGroup).toBeDefined();
    expect(emailGroup.sender).toBe('balazs@thinkai.hu');
    expect(emailGroup.subject).toBe('Fwd: Tesla lejárat Rapid Rent');
    expect(emailGroup.files.length).toBe(7);

    const fileNames = emailGroup.files.map(f => f.displayName);
    expect(fileNames).toContain('Kezdő bérleti díj.pdf');
    expect(fileNames).toContain('Assistance tájékoztató.pdf');
    expect(fileNames).toContain('1. sz. Feltételrendszer melléklet.pdf');
    expect(fileNames).toContain('Egyedi Gepjarmu Be rleti Szerződés.pdf');
    expect(fileNames).toContain('2. sz. Rendeltetesszeru használat melléklet.pdf');
    expect(fileNames).toContain('4. sz. Visszabirtoklás melléklet.pdf');
    expect(fileNames).toContain('5. sz. Díjak kondíciók melléklet.pdf');

    const processedDoc = timeline.find(t => t.isProcessedDoc) as Extract<TimelineItem, { isProcessedDoc: true }>;
    expect(processedDoc).toBeDefined();
    expect(processedDoc.displayName).toBe('Kezdő bérleti díj.pdf');
    expect(processedDoc.linkedInvoice?.bizonylatsorszam).toBe('GENO-2026/02695');
    expect(processedDoc.linkedInvoice?.elado_nev).toBe('Rapid Rent Autó Kft.');
    expect(processedDoc.sender).toBe('balazs@thinkai.hu');
    expect(processedDoc.subject).toBe('Fwd: Tesla lejárat Rapid Rent');
  });

  it('decodes SRS forwarded addresses to clean human-readable sender emails', () => {
    // Exact address from user screenshot:
    expect(decodeSenderEmail('SRS0=z+7H=FJ=taxology.hu=david.jambor@srs.websupport.sk'))
      .toBe('david.jambor@taxology.hu');

    // Balázs forwarded address from earlier incident:
    expect(decodeSenderEmail('SRS0=XiaJ=HH=skyrocketgroup.hu=balazs.lederer@srs.websupport.sk'))
      .toBe('balazs.lederer@skyrocketgroup.hu');

    // Normal email address unchanged:
    expect(decodeSenderEmail('support@websupport.hu'))
      .toBe('support@websupport.hu');

    // Friendly from format:
    expect(decodeSenderEmail('Jámbor Dávid <SRS0=z+7H=FJ=taxology.hu=david.jambor@srs.websupport.sk>'))
      .toBe('david.jambor@taxology.hu');

    // Null or empty handling:
    expect(decodeSenderEmail(null)).toBeNull();
    expect(decodeSenderEmail('')).toBeNull();
  });

  it('hierarchically sorts rapid successive emails without synthetic timestamp offsets (Option A)', () => {
    // Scenario:
    // Email 1 arrives at 15:00:00 with invoice inv-1.pdf
    // Email 2 arrives 5 seconds later at 15:00:05 with attachment notice.pdf
    // Under Option A, Email 1's processed card must appear above Email 1's upload card,
    // but MUST NOT leapfrog Email 2 (which arrived at 15:00:05).
    const rawLogs: AuditLogRow[] = [
      {
        id: 'email-1',
        company_id: 'comp-1',
        user_id: null,
        action: 'feltöltés',
        entity: 'dokumentum',
        entity_name: 'inv-1.pdf',
        details: { upload_source: 'email_alias', sender: 'sender1@example.com', subject: 'Invoice 1' },
        created_at: '2026-09-17T15:00:00Z',
      },
      {
        id: 'email-2',
        company_id: 'comp-1',
        user_id: null,
        action: 'feltöltés',
        entity: 'dokumentum',
        entity_name: 'notice.pdf',
        details: { upload_source: 'email_alias', sender: 'sender2@example.com', subject: 'Notice 2' },
        created_at: '2026-09-17T15:00:05Z',
      },
    ];

    const getEmailInfo = (log: AuditLogRow) => ({
      isEmail: isMailgunUpload(log),
      sender: log.details?.sender || null,
      subject: log.details?.subject || null,
    });

    const getLinkedInvoice = (log: AuditLogRow) => {
      if (log.entity_name === 'inv-1.pdf') {
        return {
          id: 'inv-real-1',
          bizonylatsorszam: 'INV-001',
          elado_nev: 'Supplier 1',
          vevo_nev: 'Buyer',
          brutto_vegosszeg: 10000,
          penznem: 'HUF',
          invoice_uploads_id: null,
        };
      }
      return null;
    };

    const timeline = groupEmailTimelineItems(
      rawLogs,
      getEmailInfo,
      getLinkedInvoice,
      isProcessingComplete,
      getDisplayName
    );

    // Timeline items should be in exact chronological order:
    // 1. Email 2 upload (15:00:05)
    // 2. Email 1 processed doc (15:00:00, step_type priority = 2)
    // 3. Email 1 upload (15:00:00, step_type priority = 1)
    expect(timeline.length).toBe(3);
    expect(timeline[0].type).toBe('grouped_email');
    expect((timeline[0] as any).sender).toBe('sender2@example.com');

    expect(timeline[1].type).toBe('processed_doc');
    expect((timeline[1] as any).displayName).toBe('inv-1.pdf');
    expect((timeline[1] as any).linkedInvoice?.bizonylatsorszam).toBe('INV-001');

    expect(timeline[2].type).toBe('grouped_email');
    expect((timeline[2] as any).sender).toBe('sender1@example.com');
  });
});
