import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { logError } from "../_shared/error-logger.ts";

// Helper function to verify Mailgun webhook signature using Web Crypto API
async function verifySignature(timestamp: string, token: string, signature: string, signingKey: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const data = encoder.encode(timestamp + token);
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(signingKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, data);
  const hashArray = Array.from(new Uint8Array(signatureBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return hashHex === signature;
}

// ── Sender domain whitelists ──────────────────────────────────
const KNOWN_SHIPMENT_DOMAINS = [
  'gls-hungary.com', 'gls-group.eu',  // GLS (gls-hungary.com = actual production sender)
  'dpd.hu', 'foxpost.hu',
  'posta.hu', 'mpl.posta.hu',
  'dhl.com', 'ups.com', 'tnt.com',
  'sprinter.hu', 'trans-o-flex.com',
];

const KNOWN_BANK_DOMAINS: Record<string, string> = {
  'otpbank.hu': 'otp', 'cib.hu': 'cib',
  'erstebank.hu': 'erste', 'raiffeisen.hu': 'raiffeisen',
  'kh.hu': 'kh', 'unicreditbank.hu': 'unicredit',
  'mkb.hu': 'mkb', 'magnetbank.hu': 'magnet',
  'granitbank.hu': 'granit', 'mbhbank.hu': 'mbh',
  'binx.hu': 'binx',
};

const isShipmentDomain = (d: string | null) =>
  d ? KNOWN_SHIPMENT_DOMAINS.some(sd => d === sd || d.endsWith('.' + sd)) : false;

const getBankFromDomain = (d: string | null): string | null => {
  if (!d) return null;
  for (const [domain, bank] of Object.entries(KNOWN_BANK_DOMAINS)) {
    if (d === domain || d.endsWith('.' + domain)) return bank;
  }
  return null;
};


function sanitizeFileName(fileName: string): string {
  const clean = fileName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .replace(/__+/g, '_');
  return clean;
}


serve(async (req) => {
  try {
    console.log('=== Mailgun Webhook Received ===');
    
    const contentType = req.headers.get('content-type') || '';
    console.log('Content-Type:', contentType);
    console.log('Method:', req.method);
    
    // Initialize variables for parsed data
    let recipient: string | null = null;
    let sender: string | null = null;
    let subject: string | null = null;
    let bodyPlain: string | null = null;
    let timestamp: string | null = null;
    let token: string | null = null;
    let signature: string | null = null;
    let attachments: File[] = [];
    let attachmentCount = 0;
    let messageId: string | null = null;
    let originalFrom: string | null = null;
    let parsedHeaders: [string, string][] = [];

    // Parse based on content type
    if (contentType.includes('multipart/form-data')) {
      console.log('Parsing as multipart/form-data');
      const formData = await req.formData();
      
      // Log all form fields for debugging
      console.log('Form fields received:');
      for (const [key, value] of formData.entries()) {
        if (value instanceof File) {
          console.log(`  ${key}: [File] ${value.name} (${value.type}, ${value.size} bytes)`);
        } else {
          console.log(`  ${key}: ${String(value).substring(0, 100)}${String(value).length > 100 ? '...' : ''}`);
        }
      }
      
      recipient = formData.get('recipient') as string;
      sender = formData.get('sender') as string;
      subject = formData.get('subject') as string;
      bodyPlain = formData.get('body-plain') as string;
      timestamp = formData.get('timestamp') as string;
      token = formData.get('token') as string;
      signature = formData.get('signature') as string;
      attachmentCount = parseInt(formData.get('attachment-count') as string || '0');

      // ── Extract original sender (From header, not the forwarder) ──
      originalFrom = formData.get('from') as string;

      // Extract message-headers for Message-Id, Return-Path, DKIM, etc.
      // Mailgun sends message-headers as a JSON string: [["Header-Name", "value"], ...]
      const messageHeadersRaw = formData.get('message-headers') as string;
      if (messageHeadersRaw) {
        try {
          parsedHeaders = JSON.parse(messageHeadersRaw);
          const msgIdHeader = parsedHeaders.find(([name]) =>
            name.toLowerCase() === 'message-id'
          );
          if (msgIdHeader) {
            messageId = msgIdHeader[1];
          }
        } catch (e) {
          console.warn('Failed to parse message-headers:', e);
        }
      }
      console.log('Message-Id:', messageId);
      console.log('Original From:', originalFrom);
      
      // Collect attachments
      for (let i = 1; i <= attachmentCount; i++) {
        const attachment = formData.get(`attachment-${i}`);
        if (attachment instanceof File) {
          attachments.push(attachment);
        }
      }
      
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      console.log('Parsing as application/x-www-form-urlencoded');
      const text = await req.text();
      console.log('Raw body (first 500 chars):', text.substring(0, 500));
      
      const params = new URLSearchParams(text);
      
      recipient = params.get('recipient');
      sender = params.get('sender');
      subject = params.get('subject');
      bodyPlain = params.get('body-plain');
      timestamp = params.get('timestamp');
      token = params.get('token');
      signature = params.get('signature');
      attachmentCount = parseInt(params.get('attachment-count') || '0');
      
      console.log('Parsed URL-encoded data - recipient:', recipient, 'sender:', sender);
      
    } else if (contentType.includes('application/json')) {
      console.log('Parsing as application/json');
      const json = await req.json();
      console.log('JSON body:', JSON.stringify(json).substring(0, 500));
      
      // Mailgun JSON format can vary - handle both flat and nested structures
      recipient = json.recipient || json['event-data']?.message?.headers?.to;
      sender = json.sender || json['event-data']?.message?.headers?.from;
      subject = json.subject || json['event-data']?.message?.headers?.subject;
      bodyPlain = json['body-plain'] || json.bodyPlain;
      timestamp = json.timestamp?.toString();
      token = json.token;
      signature = json.signature;
      attachmentCount = json['attachment-count'] || json.attachmentCount || 0;
      
      console.log('Parsed JSON data - recipient:', recipient, 'sender:', sender);
      
    } else {
      // Unknown content type - log and attempt to read as text for debugging
      console.log('Unknown content type, attempting to read body for debugging');
      try {
        const text = await req.text();
        console.log('Raw body (first 1000 chars):', text.substring(0, 1000));
      } catch (e) {
        console.log('Could not read body as text');
      }
      throw new Error(`Unsupported content type: ${contentType}`);
    }

    console.log('Parsed email data:', { recipient, sender, subject, attachmentCount, originalFrom });

    // ── Sender domain extraction ──────────────────────────────────
    // Smart resolution: check ALL candidate domains against known
    // shipment/bank whitelists. If a known domain is found in ANY
    // source, use it. Otherwise, fall back to priority order.
    // This is critical for forwarded emails where `from` is the
    // forwarder but `sender` (SMTP envelope) is the original sender.
    const extractDomain = (addr: string | null): string | null => {
      if (!addr) return null;
      const match = addr.match(/@([a-z0-9.-]+)/i);
      return match ? match[1].toLowerCase() : null;
    };

    const returnPath = parsedHeaders.find(([h]) => h.toLowerCase() === 'return-path')?.[1] || null;
    const dkimHeader = parsedHeaders.find(([h]) => h.toLowerCase() === 'dkim-signature')?.[1] || null;
    const dkimDomain = dkimHeader?.match(/d=([^;\s]+)/)?.[1] || null;

    // Collect ALL possible sender domains from every available source
    const candidateDomains = [
      extractDomain(originalFrom),    // from header (may be forwarding user)
      extractDomain(sender),          // SMTP envelope sender (often original!)
      extractDomain(returnPath),      // Return-Path header
      dkimDomain?.toLowerCase(),      // DKIM signing domain
    ].filter(Boolean) as string[];

    // Try to find a KNOWN domain first (bank or shipment) in ANY source
    const knownDomain = candidateDomains.find(d =>
      isShipmentDomain(d) || getBankFromDomain(d) !== null
    );

    // If a known domain was found in any source, prefer it.
    // Otherwise, fall back to first available domain.
    const senderDomain = knownDomain || candidateDomains[0] || null;

    console.log('Sender domain resolved:', senderDomain, '(known:', knownDomain, 'from:', extractDomain(originalFrom), 'sender:', extractDomain(sender), 'return-path:', extractDomain(returnPath), 'dkim:', dkimDomain, ')');

    // Verify webhook signature if signing key is configured.
    // NOTE: If MAILGUN_SIGNING_KEY is not set, verification is skipped with a warning.
    // To enable: set MAILGUN_SIGNING_KEY in Supabase Edge Function secrets.
    const mailgunSigningKey = Deno.env.get('MAILGUN_SIGNING_KEY');
    if (mailgunSigningKey && timestamp && token && signature) {
      const isValid = await verifySignature(timestamp, token, signature, mailgunSigningKey);
      if (!isValid) {
        console.error('Invalid webhook signature');
        await logError(supabase, {
          error_type: 'webhook',
          component: 'process-mailgun-webhook',
          action: 'verify_signature',
          message: 'Invalid webhook signature — potential spoofing attempt',
          context: { recipient, sender },
        });
        return new Response('Invalid signature', { status: 401 });
      }
      console.log('Webhook signature verified');
    } else {
      console.warn('WARNING: Signature verification skipped — MAILGUN_SIGNING_KEY not configured or signature fields missing');
    }

    // Validate required fields
    if (!recipient) {
      console.error('No recipient found in webhook data');
      return new Response(JSON.stringify({ error: 'No recipient specified' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Explicitly ignore legacy test company address to silence logs
    if (recipient === 'think-ai@in.visibill.hu') {
      console.log(`[skip] Legacy test recipient: ${recipient}. Skipping silently.`);
      return new Response(JSON.stringify({ skipped: true, reason: 'legacy_test_company', recipient }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Get the alias from database
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Looking up alias for recipient:', recipient);

    const { data: alias, error: aliasError } = await supabase
      .from('email_aliases')
      .select('user_id, company_name, company_id')
      .eq('alias_email', recipient)
      .eq('status', 'active')
      .single();

    if (aliasError || !alias) {
      // Alias not found — this is expected for deactivated/deleted companies.
      // Return 200 so Mailgun does NOT retry. Only log to console (not app_error_logs).
      console.warn(`[lookup_alias] Alias not found for: ${recipient} (sender: ${sender}). Skipping.`);
      return new Response(JSON.stringify({ skipped: true, reason: 'alias_not_found', recipient }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    console.log('Found alias for user:', alias.user_id, 'company:', alias.company_name, 'company_id:', alias.company_id);

    // Helper: Érvényes számla csatolmány-e?
    const isValidInvoiceAttachment = (file: File): boolean => {
      const fileName = file.name.toLowerCase();
      const fileType = file.type.toLowerCase();
      
      // Minimális fájlméret (1KB) - túl kicsi fájlok kiszűrése (pl üres txt)
      if (file.size < 1024) {
        console.log(`Skipping too small file: ${file.name} (${file.size} bytes)`);
        return false;
      }
      
      // Képek esetében (png, jpg) szigorúbb méretkorlát (100KB)
      // Branding logók tipikusan 1-90KB, lefotózott számlák 200KB-5MB
      const isImage = fileType.startsWith('image/') || fileName.endsWith('.png') || fileName.endsWith('.jpg') || fileName.endsWith('.jpeg');
      if (isImage && file.size < 100 * 1024) {
        console.log(`Skipping small image (likely branding/signature): ${file.name} (${file.size} bytes)`);
        return false;
      }

      // Fájlnév heurisztika - tipikus aláírás, branding és social media logók kiszűrése
      const junkKeywords = [
        'logo', 'signature', 'facebook', 'twitter', 'instagram', 'linkedin',
        'youtube', 'banner', 'spacer', 'icon', 'footer', 'pixel', 'tracking',
        'badge', 'visa', 'mastercard', 'paypal', 'amex', 'diners',
        'header', 'button', 'social', 'branding', 'template',
        'unsubscribe', 'emailbg', 'bg_', 'divider', 'receipt',
      ];
      if (junkKeywords.some(keyword => fileName.includes(keyword))) {
        console.log(`Skipping file with junk keyword in name: ${file.name}`);
        return false;
      }

      // Inline email images: image001.png, image002.jpg, etc. (Outlook / Exchange pattern)
      if (/^image\d{1,4}\.(png|jpe?g|gif|bmp)$/.test(fileName)) {
        console.log(`Skipping inline email image: ${file.name}`);
        return false;
      }

      // Generic unnamed attachments: attachment-1, attachment-2, etc. (email client default names)
      // These are typically inline images or embedded content without meaningful filenames
      if (/^attachment-\d+(\.\w+)?$/.test(fileName)) {
        console.log(`Skipping generic attachment: ${file.name}`);
        return false;
      }

      // Engedélyezett fájltípusok: dokumentumok + képek (lefotózott számlákhoz) + tranzakciós listák
      const allowedTypes = [
        'application/pdf',
        'image/jpeg',
        'image/jpg',
        'image/png',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
        'application/vnd.ms-excel', // xls
        'text/csv',
      ];
      
      const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.xlsx', '.xls', '.csv', '.sta', '.mt940'];
      
      const hasAllowedType = allowedTypes.includes(fileType);
      const hasAllowedExtension = allowedExtensions.some(ext => fileName.endsWith(ext));
      
      if (!hasAllowedType && !hasAllowedExtension) {
        console.log(`Skipping unsupported file: ${file.name} (type: ${fileType})`);
        return false;
      }
      
      return true;
    };



    // ── Classify attachment as invoice, transaction, or report ──
    // Rules (in priority order):
    //   0. Shipment sender domain + tabular file → 'report' (courier report)
    //   0b. Shipment sender + non-tabular → 'invoice'
    //   1. .mt940/.sta → always 'transaction'
    //   2. Bank sender + xlsx/xls/csv → 'transaction'
    //   2b-2e. xlsx with bank keyword/IBAN/subject → 'transaction'
    //   2f. GLS filename pattern (forwarded without GLS sender) → 'report'
    //   3-6. PDF filename/subject keywords → 'transaction'
    //   7. Default → 'invoice'
    const TRANSACTION_FILENAME_KEYWORDS = [
      'tranzakci', 'bankszámlakivonat', 'számlakivonat', 'kivonat',
      'forgalmi', 'statement', 'account_statement', 'bank_statement',
    ];
    const TRANSACTION_SUBJECT_KEYWORDS = [
      'tranzakció', 'tranzakciós', 'kivonat', 'számlakivonat',
      'forgalmi', 'bank statement', 'account statement',
    ];

    // GLS filename patterns (detected from production data):
    //   COD daily:     18196_HUF_20260703_081056.xlsx  (NNN_HUF_YYYYMMDD_HHMMSS)
    //   Pcl statuses:  20260703_093611_7871277_134275377714665885.xlsx
    // Supports optional prefix (like timestamp and dash: '1783059276111-')
    const GLS_FILENAME_PATTERNS = [
      /^(?:\d+-)?\d+_huf_\d{8}_\d{6}\.xlsx$/i,          // COD daily: NNN_HUF_YYYYMMDD_HHMMSS
      /^(?:\d+-)?\d{8}_\d{6}_\d{7}_\d{15,}\.xlsx$/i,    // Pcl statuses: YYYYMMDD_HHMMSS_NNN_LONGID
    ];
    const isGlsFilename = (fn: string): boolean =>
      GLS_FILENAME_PATTERNS.some(p => p.test(fn));

    // Detect courier report type from sender domain
    const detectCourierReportType = (senderDom: string | null): string | null => {
      if (!senderDom) return null;
      if (senderDom.includes('gls')) return 'gls';
      if (senderDom.includes('posta') || senderDom.includes('mpl')) return 'mpl';
      if (senderDom.includes('mixpack')) return 'mixpack';
      if (senderDom.includes('dpd')) return 'dpd';
      if (senderDom.includes('foxpost')) return 'foxpost';
      return null;
    };

    const classifyAttachment = (
      attachmentName: string,
      emailSubject: string | null,
      senderDom: string | null,
    ): { classification: 'invoice' | 'transaction' | 'report'; bankHint: string | null; reportType: string | null; reason: string } => {
      const fn = attachmentName.toLowerCase();
      const ext = fn.includes('.') ? fn.substring(fn.lastIndexOf('.')) : '';

      // Sender-based bank hint (available for all file types)
      const senderBank = getBankFromDomain(senderDom);

      // 0. Shipment sender + tabular file → REPORT (courier report pipeline)
      if (isShipmentDomain(senderDom) && ['.xlsx', '.xls', '.csv'].includes(ext)) {
        const reportType = detectCourierReportType(senderDom);
        return { classification: 'report', bankHint: null, reportType, reason: `Shipment sender (${senderDom}) + tabular file → courier report` };
      }

      // 0b. Shipment sender + non-tabular file → invoice default
      if (isShipmentDomain(senderDom)) {
        return { classification: 'invoice', bankHint: null, reportType: null, reason: `Shipment sender: ${senderDom} + non-tabular → invoice default` };
      }

      // 1. Certain bank formats
      if (['.mt940', '.sta'].includes(ext)) {
        return { classification: 'transaction', bankHint: senderBank || detectBankHint(attachmentName), reportType: null, reason: 'Bank format extension' };
      }

      // 2. xlsx/xls/csv → transaction ONLY if a banking signal exists
      //    (sender bank domain, filename keyword, IBAN, or subject keyword).
      //    Otherwise check for GLS filename pattern, then → invoice.
      if (['.xlsx', '.xls', '.csv'].includes(ext)) {
        // 2a. Sender is a known bank
        if (senderBank) {
          return { classification: 'transaction', bankHint: senderBank, reportType: null, reason: `Bank sender: ${senderDom}` };
        }
        // 2b. Filename contains banking keywords
        const fnNormXls = fn.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (TRANSACTION_FILENAME_KEYWORDS.some(kw => {
          const kwNorm = kw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          return fnNormXls.includes(kwNorm);
        })) {
          return { classification: 'transaction', bankHint: detectBankHint(attachmentName), reportType: null, reason: 'Transaction keyword in xlsx filename' };
        }

        // 2c. IBAN pattern in filename
        if (/hu\d{24,26}/i.test(fn.replace(/[^a-z0-9]/gi, ''))) {
          return { classification: 'transaction', bankHint: detectBankHint(attachmentName), reportType: null, reason: 'IBAN in xlsx filename' };
        }

        // 2d. Bank hint detected from filename (otp, cib, kh, etc.)
        const fileBank = detectBankHint(attachmentName);
        if (fileBank) {
          return { classification: 'transaction', bankHint: fileBank, reportType: null, reason: `Bank keyword in filename: ${fileBank}` };
        }

        // 2e. Email subject contains banking keywords
        if (emailSubject) {
          const subj = emailSubject.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          if (TRANSACTION_SUBJECT_KEYWORDS.some(kw => {
            const kwNorm = kw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            return subj.includes(kwNorm);
          })) {
            return { classification: 'transaction', bankHint: null, reportType: null, reason: 'Transaction keyword in subject + xlsx' };
          }
        }

        // 2f. GLS filename pattern (forwarded without GLS sender domain)
        if (isGlsFilename(fn)) {
          return { classification: 'report', bankHint: null, reportType: 'gls', reason: 'GLS filename pattern detected (no GLS sender)' };
        }

        // 2g. Other courier keywords in forwarded tabular filename
        const fnNormReport = fn.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (fnNormReport.includes('gls')) {
          return { classification: 'report', bankHint: null, reportType: 'gls', reason: 'GLS keyword in forwarded tabular filename' };
        }
        if (fnNormReport.includes('mpl') || fnNormReport.includes('posta')) {
          return { classification: 'report', bankHint: null, reportType: 'mpl', reason: 'MPL/Posta keyword in forwarded tabular filename' };
        }
        if (fnNormReport.includes('mixpack')) {
          return { classification: 'report', bankHint: null, reportType: 'mixpack', reason: 'Mixpack keyword in forwarded tabular filename' };
        }

        // No bank signal -> default tabular files to transaction (invoices cannot be csv/xlsx)
        return { classification: 'transaction', bankHint: null, reportType: null, reason: 'xlsx/csv without bank signal -> transaction default' };
      }

      // 3. Filename keywords (normalized — remove diacritics for matching)
      const fnNorm = fn.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (TRANSACTION_FILENAME_KEYWORDS.some(kw => {
        const kwNorm = kw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return fnNorm.includes(kwNorm);
      })) {
        return { classification: 'transaction', bankHint: senderBank || detectBankHint(attachmentName), reportType: null, reason: 'Transaction keyword in filename' };
      }

      // 4. IBAN pattern in filename (HU + 24-26 digits)
      if (/hu\d{24,26}/i.test(fn.replace(/[^a-z0-9]/gi, ''))) {
        return { classification: 'transaction', bankHint: senderBank || detectBankHint(attachmentName), reportType: null, reason: 'IBAN in filename' };
      }

      // 5. OTP numeric pattern: long digits + __NNN-YYYY
      if (/^\d{10,}.*__\d{3}-\d{4}/.test(fn)) {
        return { classification: 'transaction', bankHint: 'otp', reportType: null, reason: 'OTP numeric pattern' };
      }

      // 6. Email subject keywords (fallback for PDFs)
      if (emailSubject) {
        const subj = emailSubject.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (TRANSACTION_SUBJECT_KEYWORDS.some(kw => {
          const kwNorm = kw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          return subj.includes(kwNorm);
        })) {
          return { classification: 'transaction', bankHint: senderBank || detectBankHint(attachmentName), reportType: null, reason: 'Transaction keyword in email subject' };
        }
      }

      // 7. Default
      return { classification: 'invoice', bankHint: null, reportType: null, reason: 'Default → invoice' };
    };

    // ── Detect bank hint from filename ──
    const detectBankHint = (attachmentName: string): string | null => {
      const fn = attachmentName.toLowerCase();
      if (fn.includes('otp')) return 'otp';
      if (fn.includes('cib')) return 'cib';
      if (fn.includes('k&h') || fn.includes('kh_') || fn.includes('k_h')) return 'kh';
      if (fn.includes('raiffeisen')) return 'raiffeisen';
      if (fn.includes('erste')) return 'erste';
      if (fn.includes('mkb')) return 'mkb';
      if (fn.includes('unicredit')) return 'unicredit';
      if (fn.includes('gránit') || fn.includes('granit')) return 'granit';
      if (fn.includes('budapest bank') || fn.includes('bb_')) return 'budapest_bank';
      // OTP-specific pattern: long numeric filename with __NNN-YYYY
      if (/^\d{10,}.*__\d{3}-\d{4}/.test(fn)) return 'otp';
      // Fallback: IBAN-based detection (HUkk + 3-digit GIRO routing code)
      const ibanMatch = attachmentName.match(/HU\d{2}(\d{3})/i);
      if (ibanMatch) {
        const GIRO_MAP: Record<string, string> = {
          '117': 'otp', '116': 'erste', '107': 'cib',
          '104': 'kh', '120': 'raiffeisen', '103': 'mbh',
          '108': 'mkb', '109': 'unicredit', '121': 'magnet',
          '112': 'granit',
        };
        const detected = GIRO_MAP[ibanMatch[1]];
        if (detected) {
          console.log(`Bank detected from IBAN GIRO code ${ibanMatch[1]}: ${detected}`);
          return detected;
        }
      }
      return null;
    };

    // Process attachments (only available with multipart/form-data)
    if (attachments.length > 0) {
      console.log('Processing', attachments.length, 'attachments');
      
      for (const attachment of attachments) {
        // Szűrés: csak releváns formátumok és min 1KB méret
        if (!isValidInvoiceAttachment(attachment)) {
          continue;
        }
        
        const { classification, bankHint, reportType, reason } = classifyAttachment(attachment.name, subject, senderDomain);
        console.log(`Processing attachment: ${attachment.name} → ${classification} (reason: ${reason})${bankHint ? ` (bank: ${bankHint})` : ''}${reportType ? ` (report: ${reportType})` : ''}`);

        // ── Mailgun retry idempotency check ──
        // If we have a Message-Id, check if this exact attachment from this
        // email has already been processed. Prevents duplicate processing
        // when Mailgun retries the webhook (e.g. due to timeout).
        // Checks all three tables because fallback redirection moves/deletes original records.
        if (messageId) {
          let hasBeenProcessed = false;
          const tablesToCheck = ['transaction_uploads', 'invoice_uploads', 'report_uploads'];
          for (const table of tablesToCheck) {
            const { data: existingUpload } = await supabase
              .from(table)
              .select('id')
              .eq('company_id', alias.company_id)
              .eq('file_name', attachment.name)
              .contains('metadata', { mailgun_message_id: messageId })
              .limit(1);

            if (existingUpload && existingUpload.length > 0) {
              hasBeenProcessed = true;
              break;
            }
          }

          if (hasBeenProcessed) {
            console.log(`[IDEMPOTENCY] Skipping duplicate attachment: ${attachment.name} ` +
              `(Message-Id already processed: ${messageId})`);
            continue;
          }
        }

        // Choose storage bucket based on classification
        const storageBucket = 
          classification === 'transaction' 
            ? 'transactions' 
            : classification === 'report' 
              ? 'report-uploads' 
              : 'invoice-uploads';

        const sanitizedAttachmentName = sanitizeFileName(attachment.name);
        const storagePath = `${alias.user_id}/${Date.now()}-${sanitizedAttachmentName}`;

        // Upload to Supabase storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from(storageBucket)
          .upload(storagePath, attachment, {
            contentType: attachment.type,
            upsert: false,
          });

        if (uploadError) {
          console.error('Upload error:', uploadError);
          await logError(supabase, {
            error_type: 'upload',
            severity: 'error',
            component: 'process-mailgun-webhook',
            action: 'storage_upload',
            message: `File upload failed: ${attachment.name}`,
            user_id: alias.user_id,
            company_id: alias.company_id,
            context: { fileName: attachment.name, fileType: attachment.type, fileSize: attachment.size, uploadError: uploadError.message, classification },
          });
          continue;
        }

        console.log(`File uploaded to ${storageBucket}:`, storagePath);

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from(storageBucket)
          .getPublicUrl(storagePath);

        const emailMetadata = {
          source: 'email_alias',
          company_name: alias.company_name,
          sender,
          subject,
          received_at: new Date().toISOString(),
          ...(messageId ? { mailgun_message_id: messageId } : {}),
        };

        // Initial note for processing journey tracking
        const initialNote = [{
          timestamp: new Date().toISOString(),
          event: `classified_as_${classification}`,
          detail: reason,
          sender_domain: senderDomain,
          original_from: originalFrom,
        }];

        if (classification === 'report') {
          // ── Courier report upload (GLS/MPL/DPD etc.) ──
          const { data: reportRecord, error: reportError } = await supabase
            .from('report_uploads')
            .insert({
              user_id: alias.user_id,
              company_id: alias.company_id,
              file_name: attachment.name,
              file_type: attachment.type,
              file_size: attachment.size,
              file_url: publicUrl,
              report_type: reportType || 'gls',
              upload_status: 'uploaded',
              processing_status: 'pending',
              metadata: emailMetadata,
              notes: initialNote,
              email_sender_domain: senderDomain,
            })
            .select()
            .single();

          if (reportError) {
            console.error('Error creating report upload record:', reportError);
            await logError(supabase, {
              error_type: 'db_query',
              component: 'process-mailgun-webhook',
              action: 'create_report_upload_record',
              message: `Failed to create report upload record for: ${attachment.name}`,
              user_id: alias.user_id,
              company_id: alias.company_id,
              context: { fileName: attachment.name, recordError: reportError.message, reportType },
            });
          } else {
            console.log('Report upload record created:', reportRecord.id, `(type: ${reportType})`);
            // Processing is handled automatically by the DB trigger (enqueue_report_job)
            // which enqueues the job to the PGMQ report_jobs queue on INSERT.
            console.log('Report job enqueued via DB trigger for PGMQ worker processing.');
          }
        } else if (classification === 'transaction') {
          // ── Transaction upload ──
          const { data: txRecord, error: txError } = await supabase
            .from('transaction_uploads')
            .insert({
              user_id: alias.user_id,
              company_id: alias.company_id,
              file_name: attachment.name,
              file_type: attachment.type,
              file_size: attachment.size,
              file_url: publicUrl,
              upload_status: 'uploaded',
              processing_status: 'pending',
              ...(bankHint ? { bank_hint: bankHint } : {}),
              metadata: emailMetadata,
              notes: initialNote,
              email_sender_domain: senderDomain,
            })
            .select()
            .single();

          if (txError) {
            console.error('Error creating transaction upload record:', txError);
            await logError(supabase, {
              error_type: 'db_query',
              component: 'process-mailgun-webhook',
              action: 'create_transaction_upload_record',
              message: `Failed to create transaction upload record for: ${attachment.name}`,
              user_id: alias.user_id,
              company_id: alias.company_id,
              context: { fileName: attachment.name, recordError: txError.message, bankHint },
            });
          } else {
            console.log('Transaction upload record created:', txRecord.id, bankHint ? `(bank: ${bankHint})` : '');
            // Processing is handled automatically by the DB trigger (trg_enqueue_transaction)
            // which enqueues the job to the PGMQ transaction_jobs queue on INSERT.
            console.log('Transaction job enqueued via DB trigger for PGMQ worker processing.');
          }
        } else {
          // ── Invoice upload (original behavior) ──
          const { data: uploadRecord, error: recordError } = await supabase
            .from('invoice_uploads')
            .insert({
              user_id: alias.user_id,
              company_id: alias.company_id,
              file_name: attachment.name,
              file_type: attachment.type,
              file_size: attachment.size,
              file_url: publicUrl,
              upload_status: 'uploaded',
              processing_status: 'pending',
              metadata: emailMetadata,
              notes: initialNote,
              email_sender_domain: senderDomain,
            })
            .select()
            .single();

          if (recordError) {
            console.error('Error creating invoice upload record:', recordError);
            await logError(supabase, {
              error_type: 'db_query',
              component: 'process-mailgun-webhook',
              action: 'create_upload_record',
              message: `Failed to create invoice upload record for: ${attachment.name}`,
              user_id: alias.user_id,
              company_id: alias.company_id,
              context: { fileName: attachment.name, recordError: recordError.message },
            });
          } else {
            console.log('Invoice upload record created:', uploadRecord.id);
            // Processing is handled automatically by the DB trigger (trg_enqueue_invoice)
            // which enqueues the job to the PGMQ invoice_jobs queue on INSERT.
            console.log('Job enqueued via DB trigger for PGMQ worker processing.');
          }
        }
      }
    } else {
      console.log('No attachments to process (attachmentCount:', attachmentCount, ')');
      
      // Log if we expected attachments but didn't get any files
      if (attachmentCount > 0 && !contentType.includes('multipart/form-data')) {
        console.log('WARNING: Attachments expected but content-type is not multipart/form-data. Attachments may need to be fetched separately.');
      }
    }

    // ── Accounty NLP: Auto-resolve missing_items based on reply text ──
    if (bodyPlain && alias.company_id) {
      const replyText = bodyPlain.toLowerCase();

      // Keywords that indicate the issue has been resolved
      const resolveKeywords = [
        'megtörtént', 'elküldtem', 'feltöltöttem', 'csatolom', 'mellékelem',
        'utalás megtörtént', 'átutaltam', 'kifizettük', 'megcsináltam',
        'elintéztük', 'rendben van', 'rendben', 'kész van', 'megoldottam',
        'küldöm', 'küldtem', 'postáztam', 'feladtam',
      ];

      const hasResolveIntent = resolveKeywords.some(kw => replyText.includes(kw));

      if (hasResolveIntent || attachments.length > 0) {
        console.log('[ACCOUNTY-NLP] Resolve intent detected or attachments present. Auto-resolving missing items for company:', alias.company_id);

        const { data: resolved, error: resolveError } = await supabase
          .from('accounty_missing_items')
          .update({
            status: 'resolved',
            resolved_at: new Date().toISOString(),
          })
          .eq('company_id', alias.company_id)
          .in('status', ['open', 'notified'])
          .select('id');

        if (resolveError) {
          console.error('[ACCOUNTY-NLP] Resolve error:', resolveError);
          await logError(supabase, {
            error_type: 'db_query',
            component: 'process-mailgun-webhook',
            action: 'auto_resolve_missing_items',
            message: `Failed to auto-resolve missing items for company`,
            company_id: alias.company_id,
            user_id: alias.user_id,
            context: { resolveError: resolveError.message },
          });
        } else {
          console.log(`[ACCOUNTY-NLP] Auto-resolved ${resolved?.length || 0} missing items`);
        }
      } else {
        console.log('[ACCOUNTY-NLP] No resolve intent detected in reply text.');
      }
    }

    console.log('=== Webhook processing completed successfully ===');

    return new Response(JSON.stringify({ 
      success: true,
      recipient,
      attachmentsProcessed: attachments.length
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: any) {
    console.error('=== Error in process-mailgun-webhook ===');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    // Best-effort logging — create a fresh service client for this
    try {
      const svc = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      await logError(svc, {
        error_type: 'webhook',
        severity: 'error',
        component: 'process-mailgun-webhook',
        action: 'unhandled_exception',
        message: error.message || 'Unknown webhook error',
        stack_trace: error.stack,
      });
    } catch { /* ignore logging failure */ }
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
