import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { unzip } from "npm:fflate@0.8.2";
import PostalMime from "npm:postal-mime@2.4.1";

// ── Inline error logger (self-contained, no _shared dependency) ──
// Mirrors supabase/functions/_shared/error-logger.ts. Writes to app_error_logs
// via service_role; non-blocking (never disrupts the main flow).
interface ErrorLogEntry {
  error_type: string;
  severity?: string;
  component: string;
  action: string;
  message: string;
  user_id?: string | null;
  company_id?: string | null;
  stack_trace?: string;
  context?: Record<string, unknown>;
}

async function logError(supabase: any, entry: ErrorLogEntry): Promise<void> {
  try {
    await supabase.from("app_error_logs").insert({
      error_type: entry.error_type,
      severity: entry.severity || "error",
      component: entry.component,
      action: entry.action,
      message: entry.message.substring(0, 2000),
      stack_trace: entry.stack_trace?.substring(0, 5000),
      user_id: entry.user_id || null,
      company_id: entry.company_id || null,
      context: entry.context || {},
      url: null,
      user_agent: null,
    });
  } catch (err) {
    console.error("[error-logger] Failed to write to app_error_logs:", err);
  }
}

// ── Unique-violation helper ──────────────────────────────────────────────────
// PostgreSQL error code 23505 = unique_violation. When the DB-level UNIQUE index
// on (company_id, file_name, mailgun_message_id) rejects a concurrent duplicate
// INSERT, we treat it as a graceful skip (not a real error).
const isUniqueViolation = (err: any): boolean =>
  err?.code === '23505' || err?.message?.includes('unique') || err?.message?.includes('duplicate key');

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

const KNOWN_REPORT_SENDERS = [
  'reports@gls-hungary.com',
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

// ── Archive support ────────────────────────────────────────────────────────
// Compressed archive extensions we handle.
// .zip is decompressed in-place via fflate.
// .rar, .7z, .tar.gz, .tgz are passed through as "deferred archives"
// and uploaded to storage for worker-side extraction.
const ZIP_EXTENSIONS = new Set(['.zip']);
const DEFERRED_ARCHIVE_EXTENSIONS = new Set(['.rar', '.7z', '.tar.gz', '.tgz']);
const ALL_ARCHIVE_EXTENSIONS = new Set([...ZIP_EXTENSIONS, ...DEFERRED_ARCHIVE_EXTENSIONS]);

/** Check if a filename (lowercased) is an archive we handle */
function isArchiveExt(filename: string): boolean {
  const ext = getExt(filename);
  if (ALL_ARCHIVE_EXTENSIONS.has(ext)) return true;
  // Handle compound extensions like .tar.gz
  const lower = filename.toLowerCase();
  return lower.endsWith('.tar.gz') || lower.endsWith('.tgz');
}

/** Check if a filename is a deferred (non-zip) archive */
function isDeferredArchive(filename: string): boolean {
  const ext = getExt(filename);
  if (DEFERRED_ARCHIVE_EXTENSIONS.has(ext)) return true;
  const lower = filename.toLowerCase();
  return lower.endsWith('.tar.gz') || lower.endsWith('.tgz');
}

interface ExpandedFile {
  /** The effective filename to classify and upload */
  name: string;
  /** Raw bytes of the file */
  bytes: Uint8Array;
  /** MIME type (best-effort) */
  contentType: string;
  /** Original archive filename this was extracted from (undefined for direct attachments) */
  extractedFromArchive?: string;
  /** True if this is a non-ZIP archive that the worker must decompress */
  isDeferredArchive?: boolean;
}

/**
 * Given a filename and its bytes, returns a flat list of ExpandedFile entries.
 * - If the file is a ZIP: recurse into its contents (up to maxDepth).
 * - Otherwise: return the file itself as a single-element list.
 *
 * Only files whose extension is in DIRECT_SUPPORTED_EXTS are yielded.
 */
const DIRECT_SUPPORTED_EXTS = new Set([
  '.pdf', '.png', '.jpg', '.jpeg', '.tiff', '.tif',
  '.xls', '.xlsx', '.csv', '.txt', '.mt940', '.sta',
]);

function getExt(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot !== -1 ? filename.slice(dot).toLowerCase() : '';
}

async function expandAttachments(
  name: string,
  bytes: Uint8Array,
  archiveName?: string,
  depth = 0,
): Promise<ExpandedFile[]> {
  const MAX_DEPTH = 2;
  const ext = getExt(name);

  // ── Deferred archives (.rar, .7z, .tar.gz, .tgz) ──
  // These cannot be decompressed in Edge Functions (no native bindings).
  // Pass them through as-is for worker-side extraction.
  if (isDeferredArchive(name)) {
    console.log(`[ARCHIVE] Deferred archive detected (worker will extract): ${name}`);
    const contentType = 'application/octet-stream';
    return [{ name, bytes, contentType, extractedFromArchive: archiveName, isDeferredArchive: true }];
  }

  // ── ZIP decompression (in-place via fflate) ──
  if (ZIP_EXTENSIONS.has(ext)) {
    if (depth >= MAX_DEPTH) {
      console.warn(`[ZIP] Max depth reached, skipping nested archive: ${name}`);
      return [];
    }
    // Decompress ZIP with fflate (Promise wrapper)
    let decompressed: Record<string, Uint8Array>;
    try {
      decompressed = await new Promise<Record<string, Uint8Array>>((resolve, reject) => {
        unzip(bytes, (err, data) => {
          if (err) reject(err); else resolve(data);
        });
      });
    } catch (e) {
      console.error(`[ZIP] Failed to decompress ${name}:`, e);
      return [];
    }

    const results: ExpandedFile[] = [];
    const topArchive = archiveName ?? name;

    for (const [innerPath, innerBytes] of Object.entries(decompressed)) {
      // Skip macOS metadata and directory entries (fflate includes empty dirs as 0-byte entries)
      if (innerPath.includes('__MACOSX') || innerPath.endsWith('/') || innerBytes.length === 0) continue;

      // Sanitize inner filename: strip directory prefixes (both Unix / and Windows \)
      const innerName = innerPath.split(/[\/\\]/).pop() ?? innerPath;
      const innerExt = getExt(innerName);

      if (ZIP_EXTENSIONS.has(innerExt)) {
        // Recurse into nested ZIP archive
        const nested = await expandAttachments(innerName, innerBytes, topArchive, depth + 1);
        results.push(...nested);
      } else if (isDeferredArchive(innerName)) {
        // Nested .rar/.7z/.tar.gz inside a ZIP — pass through for worker
        console.log(`[ZIP] Nested deferred archive inside ZIP: ${innerName}`);
        results.push({ name: innerName, bytes: innerBytes, contentType: 'application/octet-stream', extractedFromArchive: topArchive, isDeferredArchive: true });
      } else if (DIRECT_SUPPORTED_EXTS.has(innerExt)) {
        const contentType = getMimeType(innerName);
        results.push({ name: innerName, bytes: innerBytes, contentType, extractedFromArchive: topArchive });
      } else {
        console.log(`[ZIP] Skipping unsupported inner file: ${innerName}`);
      }
    }

    console.log(`[ZIP] Extracted ${results.length} supported file(s) from ${name}`);
    return results;
  }

  // Not a compressed file — return as-is if the extension is supported
  if (!DIRECT_SUPPORTED_EXTS.has(ext)) return [];
  const contentType = getMimeType(name);
  return [{ name, bytes, contentType, extractedFromArchive: archiveName }];
}

/** Best-effort MIME type from filename extension */
function getMimeType(filename: string): string {
  const ext = getExt(filename);
  const map: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.tiff': 'image/tiff',
    '.tif': 'image/tiff',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.xls': 'application/vnd.ms-excel',
    '.csv': 'text/csv',
    '.txt': 'text/plain',
    '.mt940': 'text/plain',
    '.sta': 'text/plain',
  };
  return map[ext] ?? 'application/octet-stream';
}

async function processBillingoAndSzamlazzLinks(
  supabase: any,
  alias: { user_id: string; company_id: string; company_name: string },
  subject: string | null,
  bodyPlain: string | null,
  bodyHtml: string | null,
  sender: string | null,
  messageId: string | null,
): Promise<number> {
  let downloadedCount = 0;
  const combinedText = `${subject || ''}\n${bodyPlain || ''}\n${bodyHtml || ''}`;

  // 1. ── Billingo Link Extraction ──
  const billingoUrlRegex = /https?:\/\/(?:app|www)\.billingo\.hu\/[^\s"'<>]+/gi;
  const billingoUrls = Array.from(new Set(combinedText.match(billingoUrlRegex) || []));
  const processedBillingoUrls = new Set<string>();

  for (const rawUrl of billingoUrls) {
    const cleanUrl = rawUrl.replace(/[.,;)]+$/, '');
    if (processedBillingoUrls.has(cleanUrl)) continue;
    processedBillingoUrls.add(cleanUrl);

    // Convert document-access/default -> document-access/download if needed
    const downloadUrl = cleanUrl.includes('/document-access/default/')
      ? cleanUrl.replace('/document-access/default/', '/document-access/download/')
      : cleanUrl;

    console.log(`[LINK-INGEST] Billingo URL detected: ${downloadUrl}`);

    try {
      const res = await fetch(downloadUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Visibill-Invoice-Fetcher/1.0',
          'Accept': 'application/pdf,application/xhtml+xml,text/html;q=0.9,*/*;q=0.8',
        },
      });

      if (!res.ok) {
        console.warn(`[LINK-INGEST] Billingo download failed with status ${res.status} for ${downloadUrl}`);
        continue;
      }

      const bytes = new Uint8Array(await res.arrayBuffer());
      const headerStr = new TextDecoder().decode(bytes.slice(0, 10));

      if (headerStr.includes('%PDF')) {
        const tokenMatch = downloadUrl.match(/\/([a-zA-Z0-9_-]{10,})/);
        const token = tokenMatch ? tokenMatch[1] : `billingo_${Date.now()}`;
        const fileName = `${token}.pdf`;
        const storagePath = `${alias.user_id}/${Date.now()}-${sanitizeFileName(fileName)}`;

        const { error: uploadErr } = await supabase.storage
          .from('invoice-uploads')
          .upload(storagePath, bytes, { contentType: 'application/pdf', upsert: false });

        if (!uploadErr) {
          const { data: { publicUrl } } = supabase.storage.from('invoice-uploads').getPublicUrl(storagePath);

          const emailMetadata = {
            source: 'email_alias_billingo_link',
            billingo_url: downloadUrl,
            company_name: alias.company_name,
            sender,
            subject,
            received_at: new Date().toISOString(),
            ...(messageId ? { mailgun_message_id: messageId } : {}),
          };

          const { error: dbErr } = await supabase.from('invoice_uploads').insert({
            user_id: alias.user_id,
            company_id: alias.company_id,
            file_name: fileName,
            file_type: 'application/pdf',
            file_size: bytes.length,
            file_url: publicUrl,
            upload_status: 'uploaded',
            processing_status: 'pending',
            metadata: emailMetadata,
            notes: [{ timestamp: new Date().toISOString(), event: 'downloaded_from_billingo_link', detail: downloadUrl }],
          });

          if (!dbErr) {
            downloadedCount++;
            console.log(`[LINK-INGEST] Billingo PDF successfully downloaded and ingested: ${downloadUrl}`);
          }
        }
      } else {
        console.log(`[LINK-INGEST] Response from Billingo URL ${downloadUrl} was not a PDF directly.`);
      }
    } catch (err) {
      console.error(`[LINK-INGEST] Error fetching Billingo PDF link ${downloadUrl}:`, err);
    }
  }

  // 2. ── Számlázz.hu Agent API PDF Fetcher ──
  const szamlazzLinkDetected = /szamlazz\.hu/i.test(combinedText);

  // Extract candidate invoice numbers using multiple regex patterns
  const foundCandidates = new Set<string>();

  // Pattern A: standard Hungarian invoice format (e.g. E-SZAMLA-2026-102, ABC/2026/123)
  const patternA = /\b([a-zA-Z0-9]{1,12}[-/]\d{4}[-/]\d+)\b/g;
  for (const m of combinedText.matchAll(patternA)) foundCandidates.add(m[1]);

  // Pattern B: prefixed invoice format (e.g. E-SZAMLA-102, SZAMLA-12345, INV-2026)
  const patternB = /\b([a-zA-Z0-9]{2,12}[-/]\d+)\b/g;
  for (const m of combinedText.matchAll(patternB)) foundCandidates.add(m[1]);

  // Pattern C: labeled format requiring colon/equals/hash delimiter (e.g. "számlaszám: E-SZ-2026-1", "sorszám #12345", "Invoice No: INV-101")
  const patternC = /(?:számla\s*sorszáma|számlaszám|sorszám|invoice\s*no\.?)\s*[:=#]\s*([a-zA-Z0-9/_-]{3,30})/gi;
  for (const m of combinedText.matchAll(patternC)) {
    const candidate = m[1].trim();
    if (candidate.length >= 3 && !candidate.toLowerCase().includes('http')) {
      foundCandidates.add(candidate);
    }
  }

  const invoiceNumbers = Array.from(foundCandidates).filter(inv => {
    // Exclude copyright year ranges like 2005-2026 or 2020-2026
    if (/^\d{4}[-/]\d{4}$/.test(inv)) return false;
    return true;
  });

  if (szamlazzLinkDetected || invoiceNumbers.length > 0) {
    console.log(`[LINK-INGEST] Számlázz.hu signal detected. Candidate invoice numbers: [${invoiceNumbers.join(', ')}]`);

    const { data: keyData } = await supabase.rpc('get_szamlazz_agent_key', { p_company_id: alias.company_id });
    const agentKey = (keyData as string)?.trim() || alias.mailgun_route_id?.trim();

    if (agentKey && agentKey.length >= 30) {
      if (invoiceNumbers.length === 0) {
        console.warn(`[LINK-INGEST] Számlázz.hu signal detected, but no candidate invoice numbers could be parsed from email text.`);
      }

      for (const invNum of invoiceNumbers) {
        console.log(`[LINK-INGEST] Calling Számlázz.hu Agent pdfDownload API for invoice ${invNum}...`);

        const xmlBody = `<?xml version="1.0" encoding="UTF-8"?>
<xmlszamlapdf xmlns="http://www.szamlazz.hu/xmlszamlapdf">
  <beallitasok>
    <szamlaAgentKulcs>${agentKey}</szamlaAgentKulcs>
    <pdfValasz>true</pdfValasz>
  </beallitasok>
  <fejlec>
    <szamlaszam>${invNum}</szamlaszam>
  </fejlec>
</xmlszamlapdf>`;

        try {
          const form = new FormData();
          form.append('action-xmlszamlapdf', xmlBody);

          const apiRes = await fetch('https://www.szamlazz.hu/szamla/', {
            method: 'POST',
            body: form,
          });

          if (apiRes.ok) {
            const bytes = new Uint8Array(await apiRes.arrayBuffer());
            const textResponse = new TextDecoder().decode(bytes.slice(0, 1000));

            if (textResponse.includes('%PDF')) {
              const fileName = `szamlazz_${invNum.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
              const storagePath = `${alias.user_id}/${Date.now()}-${sanitizeFileName(fileName)}`;

              const { error: uploadErr } = await supabase.storage
                .from('invoice-uploads')
                .upload(storagePath, bytes, { contentType: 'application/pdf', upsert: false });

              if (!uploadErr) {
                const { data: { publicUrl } } = supabase.storage.from('invoice-uploads').getPublicUrl(storagePath);

                const emailMetadata = {
                  source: 'email_alias_szamlazz_agent',
                  szamlazz_invoice_number: invNum,
                  company_name: alias.company_name,
                  sender,
                  subject,
                  received_at: new Date().toISOString(),
                  ...(messageId ? { mailgun_message_id: messageId } : {}),
                };

                const { error: dbErr } = await supabase.from('invoice_uploads').insert({
                  user_id: alias.user_id,
                  company_id: alias.company_id,
                  file_name: fileName,
                  file_type: 'application/pdf',
                  file_size: bytes.length,
                  file_url: publicUrl,
                  upload_status: 'uploaded',
                  processing_status: 'pending',
                  metadata: emailMetadata,
                  notes: [{ timestamp: new Date().toISOString(), event: 'downloaded_via_szamlazz_agent_api', detail: invNum }],
                });

                if (!dbErr) {
                  downloadedCount++;
                  console.log(`[LINK-INGEST] Számlázz.hu PDF downloaded via Agent API and ingested for invoice ${invNum}`);
                }
              }
            } else {
              const errMatch = textResponse.match(/<hibauzenet>(.*?)<\/hibauzenet>/i);
              const errMsg = errMatch ? errMatch[1] : textResponse.substring(0, 200);
              console.warn(`[LINK-INGEST] Számlázz.hu API returned non-PDF response for invoice ${invNum}: ${errMsg}`);
            }
          }
        } catch (err: any) {
          console.error(`[LINK-INGEST] Error calling Számlázz Agent API for ${invNum}:`, err);
        }
      }
    } else {
      console.log(`[LINK-INGEST] Számlázz.hu signal present but no Számla Agent Key configured for company ${alias.company_id}`);
    }
  }

  // 3. ── Számlázz.hu Direct Link PDF Fetcher (for supplier emails with "LETÖLTÖM A SZÁMLÁT" link) ──
  const szamlazzUrlRegex = /https?:\/\/(?:www\.)?szamlazz\.hu\/[^\s"'<>]+/gi;
  const szamlazzUrls = Array.from(new Set(combinedText.match(szamlazzUrlRegex) || []));

  if (szamlazzUrls.length > 0) {
    console.log(`[LINK-INGEST] Detected ${szamlazzUrls.length} Számlázz.hu link(s) in email HTML/text.`);
    for (const linkUrl of szamlazzUrls) {
      const cleanUrl = linkUrl.replace(/[.,;)]+$/, '');
      try {
        console.log(`[LINK-INGEST] Trying direct fetch from Számlázz.hu link: ${cleanUrl}...`);
        const res = await fetch(cleanUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Visibill-Invoice-Fetcher/1.0',
            'Accept': 'application/pdf,application/xhtml+xml,text/html;q=0.9,*/*;q=0.8',
          },
        });

        if (res.ok) {
          const bytes = new Uint8Array(await res.arrayBuffer());
          const headerStr = new TextDecoder().decode(bytes.slice(0, 10));

          let finalBytes: Uint8Array | null = null;
          let finalUrl = cleanUrl;

          if (headerStr.includes('%PDF')) {
            finalBytes = bytes;
          } else {
            console.log(`[LINK-INGEST] Response from ${cleanUrl} was HTML. Parsing HTML for embedded PDF link...`);
            const htmlText = new TextDecoder().decode(bytes);
            
            const subLinkMatch = htmlText.match(/href=["'](\/action-xmlszamlapdf[^\s"'>]+|https?:\/\/[^\s"'>]+action-xmlszamlapdf[^\s"'>]+|\/szamla\/pdf[^\s"'>]+|https?:\/\/[^\s"'>]+\.pdf)/i) ||
                                 htmlText.match(/src=["'](\/action-xmlszamlapdf[^\s"'>]+|https?:\/\/[^\s"'>]+action-xmlszamlapdf[^\s"'>]+|\/szamla\/pdf[^\s"'>]+|\/action-pdf[^\s"'>]+)/i);

            if (subLinkMatch) {
              let secondaryUrl = subLinkMatch[1];
              if (secondaryUrl.startsWith('/')) {
                secondaryUrl = `https://www.szamlazz.hu${secondaryUrl}`;
              }
              console.log(`[LINK-INGEST] Found secondary PDF URL in HTML: ${secondaryUrl}`);
              try {
                const subRes = await fetch(secondaryUrl, {
                  headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Visibill-Invoice-Fetcher/1.0',
                    'Accept': 'application/pdf,application/xhtml+xml,text/html;q=0.9,*/*;q=0.8',
                  },
                });
                if (subRes.ok) {
                  const subBytes = new Uint8Array(await subRes.arrayBuffer());
                  const subHeader = new TextDecoder().decode(subBytes.slice(0, 10));
                  if (subHeader.includes('%PDF')) {
                    finalBytes = subBytes;
                    finalUrl = secondaryUrl;
                  }
                }
              } catch (subErr) {
                console.error(`[LINK-INGEST] Error fetching secondary URL ${secondaryUrl}:`, subErr);
              }
            }
          }

          if (finalBytes && finalBytes.length > 500) {
            const fileName = `szamlazz_link_${Date.now()}.pdf`;
            const storagePath = `${alias.user_id}/${Date.now()}-${sanitizeFileName(fileName)}`;

            const { error: uploadErr } = await supabase.storage
              .from('invoice-uploads')
              .upload(storagePath, finalBytes, { contentType: 'application/pdf', upsert: false });

            if (!uploadErr) {
              const { data: { publicUrl } } = supabase.storage.from('invoice-uploads').getPublicUrl(storagePath);

              const emailMetadata = {
                source: 'email_alias_szamlazz_link',
                szamlazz_url: finalUrl,
                company_name: alias.company_name,
                sender,
                subject,
                received_at: new Date().toISOString(),
                ...(messageId ? { mailgun_message_id: messageId } : {}),
              };

              const { error: dbErr } = await supabase.from('invoice_uploads').insert({
                user_id: alias.user_id,
                company_id: alias.company_id,
                file_name: fileName,
                file_type: 'application/pdf',
                file_size: finalBytes.length,
                file_url: publicUrl,
                upload_status: 'uploaded',
                processing_status: 'pending',
                metadata: emailMetadata,
                notes: [{ timestamp: new Date().toISOString(), event: 'downloaded_from_szamlazz_link', detail: finalUrl }],
              });

              if (!dbErr) {
                downloadedCount++;
                console.log(`[LINK-INGEST] Számlázz.hu PDF successfully downloaded from link: ${finalUrl}`);
              }
            }
          }
        }
      } catch (err: any) {
        console.error(`[LINK-INGEST] Error fetching Számlázz.hu link ${cleanUrl}:`, err);
      }
    }
  }

  return downloadedCount;
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
    let bodyHtml: string | null = null;
    let timestamp: string | null = null;
    let token: string | null = null;
    let signature: string | null = null;
    let attachments: File[] = [];
    let attachmentCount = 0;
    let messageId: string | null = null;
    let originalFrom: string | null = null;
    let parsedHeaders: [string, string][] = [];
    let bodyMime: string | null = null;  // Raw RFC822 MIME body for fallback parsing

    // Robust, fail-safe Content-Type and body parsing
    const lowerContentType = (contentType || '').toLowerCase();

    if (lowerContentType.includes('multipart') || lowerContentType.includes('form-data')) {
      try {
        console.log('Parsing as multipart/form-data');
        const formData = await req.formData();
        
        recipient = formData.get('recipient') as string;
        sender = formData.get('sender') as string;
        subject = formData.get('subject') as string;
        bodyPlain = formData.get('body-plain') as string;
        bodyHtml = formData.get('body-html') as string;
        timestamp = formData.get('timestamp') as string;
        token = formData.get('token') as string;
        signature = formData.get('signature') as string;
        attachmentCount = parseInt(formData.get('attachment-count') as string || '0');
        bodyMime = formData.get('body-mime') as string;
        originalFrom = formData.get('from') as string;

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
        
        for (let i = 1; i <= attachmentCount; i++) {
          const attachment = formData.get(`attachment-${i}`);
          if (attachment instanceof File) {
            attachments.push(attachment);
          }
        }
      } catch (err) {
        console.warn('Failed to parse formData directly, will attempt body text fallback:', err);
      }
    } else if (lowerContentType.includes('application/x-www-form-urlencoded')) {
      try {
        console.log('Parsing as application/x-www-form-urlencoded');
        const text = await req.text();
        const params = new URLSearchParams(text);
        
        recipient = params.get('recipient');
        sender = params.get('sender');
        subject = params.get('subject');
        bodyPlain = params.get('body-plain');
        bodyHtml = params.get('body-html');
        timestamp = params.get('timestamp');
        token = params.get('token');
        signature = params.get('signature');
        attachmentCount = parseInt(params.get('attachment-count') || '0');
        bodyMime = params.get('body-mime');
      } catch (err) {
        console.warn('Failed to parse urlencoded body:', err);
      }
    } else if (lowerContentType.includes('json')) {
      try {
        console.log('Parsing as application/json');
        const json = await req.json();
        recipient = json.recipient || json['event-data']?.message?.headers?.to;
        sender = json.sender || json['event-data']?.message?.headers?.from;
        subject = json.subject || json['event-data']?.message?.headers?.subject;
        bodyPlain = json['body-plain'] || json.bodyPlain;
        bodyHtml = json['body-html'] || json.bodyHtml;
        timestamp = json.timestamp?.toString();
        token = json.token;
        signature = json.signature;
        attachmentCount = json['attachment-count'] || json.attachmentCount || 0;
      } catch (err) {
        console.warn('Failed to parse JSON body:', err);
      }
    }

    // Universal fallback if recipient was not populated by previous steps
    if (!recipient) {
      console.log('Recipient empty after primary parsing, running universal body fallback...');
      try {
        const text = await req.text();
        if (text) {
          if (text.trim().startsWith('{')) {
            const json = JSON.parse(text);
            recipient = json.recipient || json['event-data']?.message?.headers?.to;
            sender = json.sender || json['event-data']?.message?.headers?.from;
            subject = json.subject || json['event-data']?.message?.headers?.subject;
            bodyPlain = json['body-plain'] || json.bodyPlain;
            bodyHtml = json['body-html'] || json.bodyHtml;
          } else {
            const params = new URLSearchParams(text);
            recipient = params.get('recipient');
            sender = params.get('sender');
            subject = params.get('subject');
            bodyPlain = params.get('body-plain');
            bodyHtml = params.get('body-html');
          }
        }
      } catch (fallbackErr) {
        console.warn('Universal body fallback parsing failed:', fallbackErr);
      }
    }

    if (recipient) {
      recipient = recipient.toLowerCase().trim();
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

    // Clean and normalize recipient email
    // e.g. "Think AI <thinkaikft2@in.visibill.hu>" or "<thinkaikft2@in.visibill.hu>" or uppercase "THINKAIKFT2@IN.VISIBILL.HU"
    const extractEmail = (str: string | null): string | null => {
      if (!str) return null;
      const match = str.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      return match ? match[1].trim().toLowerCase() : str.trim().toLowerCase();
    };

    const targetAliasEmail = extractEmail(recipient) || recipient.trim().toLowerCase();

    // Explicitly ignore legacy test company address to silence logs
    if (targetAliasEmail === 'think-ai@in.visibill.hu') {
      console.log(`[skip] Legacy test recipient: ${targetAliasEmail}. Skipping silently.`);
      return new Response(JSON.stringify({ skipped: true, reason: 'legacy_test_company', recipient: targetAliasEmail }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Get the alias from database
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Looking up alias for recipient:', targetAliasEmail, '(raw:', recipient, ')');

    let { data: alias, error: aliasError } = await supabase
      .from('email_aliases')
      .select('user_id, company_name, company_id, mailgun_route_id')
      .eq('alias_email', targetAliasEmail)
      .eq('status', 'active')
      .maybeSingle();

    if (!alias && targetAliasEmail.includes('@')) {
      // Fallback: try matching prefix if domain is in.visibill.hu
      const prefix = targetAliasEmail.split('@')[0];
      const { data: fallbackAlias } = await supabase
        .from('email_aliases')
        .select('user_id, company_name, company_id, mailgun_route_id')
        .ilike('alias_email', `${prefix}%`)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();

      if (fallbackAlias) {
        alias = fallbackAlias;
      }
    }

    if (!alias) {
      console.warn(`[lookup_alias] Alias not found for: ${targetAliasEmail} (raw: ${recipient}, sender: ${sender}). Logging error.`);
      await logError(supabase, {
        error_type: 'email_alias',
        severity: 'warning',
        component: 'process-mailgun-webhook',
        action: 'alias_not_found',
        message: `Ismeretlen alias címre érkezett e-mail: ${targetAliasEmail} (Küldő: ${sender || 'Ismeretlen'})`,
        context: { rawRecipient: recipient, sender, subject },
      });

      return new Response(JSON.stringify({ skipped: true, reason: 'alias_not_found', recipient: targetAliasEmail }), {
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
        // Hungarian equivalents (accent-sensitive — fileName is lowercased but not normalized)
        'aláírás', 'alairas', 'szignó', 'szigno',        // signature
        'fejléc', 'fejlec', 'lábléc', 'lablec',           // header / footer
        'arculat',                                          // branding/corporate identity
        'szórólap', 'szorolap', 'plakát', 'plakat',        // flyer / poster
        'hírlevél', 'hirlevel',                            // newsletter
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
      senderEmail: string | null = null,
    ): { classification: 'invoice' | 'transaction' | 'report'; bankHint: string | null; reportType: string | null; reason: string } => {
      const fn = attachmentName.toLowerCase();
      const ext = fn.includes('.') ? fn.substring(fn.lastIndexOf('.')) : '';

      // 00. Specific sender override -> REPORT (courier report pipeline)
      if (senderEmail && KNOWN_REPORT_SENDERS.includes(senderEmail.toLowerCase())) {
        const reportType = detectCourierReportType(senderDom);
        return { classification: 'report', bankHint: null, reportType: reportType || 'gls', reason: `Known report sender: ${senderEmail}` };
      }

      // 00a. Image File Check: Exclude images from transaction pipeline entirely.
      // Images (.png, .jpg, .jpeg, .tiff, .tif, .webp, .heic, .bmp, .gif) are never bank statements.
      // E.g., photo of an invoice/receipt, or a scanned shipment document (CMR/POD).
      const isImage = ['.png', '.jpg', '.jpeg', '.tiff', '.tif', '.webp', '.heic', '.bmp', '.gif'].includes(ext);
      if (isImage) {
        if (isShipmentDomain(senderDom)) {
          const reportType = detectCourierReportType(senderDom);
          return { classification: 'report', bankHint: null, reportType: reportType || 'gls', reason: `Image from shipment domain (${senderDom}) → report` };
        }
        const fnNorm = fn.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (fnNorm.includes('gls')) {
          return { classification: 'report', bankHint: null, reportType: 'gls', reason: 'GLS image file → report' };
        }
        if (fnNorm.includes('mpl') || fnNorm.includes('posta')) {
          return { classification: 'report', bankHint: null, reportType: 'mpl', reason: 'MPL/Posta image file → report' };
        }
        if (fnNorm.includes('mixpack')) {
          return { classification: 'report', bankHint: null, reportType: 'mixpack', reason: 'Mixpack image file → report' };
        }
        return { classification: 'invoice', bankHint: null, reportType: null, reason: 'Image file default → invoice' };
      }

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
        // ── Archive detection: expand or defer ──────────────────────────────
        const archiveDetected = isArchiveExt(attachment.name);

        let expandedFiles: ExpandedFile[];
        if (archiveDetected) {
          // Archives bypass isValidInvoiceAttachment (they are not invoices themselves)
          const rawBytes = new Uint8Array(await attachment.arrayBuffer());
          expandedFiles = await expandAttachments(attachment.name, rawBytes);
          if (expandedFiles.length === 0) {
            console.log(`[ARCHIVE] Archive has no supported files, skipping: ${attachment.name}`);
            // Log to app_error_logs for admin visibility
            await logError(supabase, {
              error_type: 'archive_empty',
              severity: 'warning',
              component: 'process-mailgun-webhook',
              action: 'expand_archive',
              message: `Archive attachment yielded 0 supported files: ${attachment.name}`,
              user_id: alias.user_id,
              company_id: alias.company_id,
              context: { fileName: attachment.name, fileSize: rawBytes.length, sender, recipient },
            });
            continue;
          }
          console.log(`[ARCHIVE] ${attachment.name} expanded/deferred to ${expandedFiles.length} file(s)`);
        } else {
          // Regular (non-archive) attachment
          if (!isValidInvoiceAttachment(attachment)) {
            continue;
          }
          const rawBytes = new Uint8Array(await attachment.arrayBuffer());
          expandedFiles = [{ name: attachment.name, bytes: rawBytes, contentType: attachment.type || getMimeType(attachment.name) }];
        }

        // ── Process each (potentially extracted) file ──────────────────────
        for (const ef of expandedFiles) {
          const { classification, bankHint, reportType, reason } = classifyAttachment(ef.name, subject, senderDomain, sender);
          console.log(`Processing file: ${ef.name} → ${classification} (reason: ${reason})${bankHint ? ` (bank: ${bankHint})` : ''}${reportType ? ` (report: ${reportType})` : ''}${ef.extractedFromArchive ? ` [from: ${ef.extractedFromArchive}]` : ''}`);

          // ── Mailgun retry idempotency check ──
          // If we have a Message-Id, check if this exact attachment from this
          // email has already been processed. Prevents duplicate processing
          // when Mailgun retries the webhook (e.g. due to timeout).
          //
          // Strategy (two-layer):
          // 1. Check upload tables (invoice/transaction/report_uploads) — covers the common case.
          // 2. Check llm_koltsegek — NEVER deleted, survives sibling-cleanup. This closes
          //    the race-condition window where a parallel Mailgun retry fires AFTER
          //    cleanup_email_file_siblings has already removed the original upload row
          //    (which made the upload-table check miss it).
          if (messageId) {
            let hasBeenProcessed = false;

            // Layer 1: upload tables (fast, most cases)
            const tablesToCheck = ['transaction_uploads', 'invoice_uploads', 'report_uploads'];
            for (const table of tablesToCheck) {
              const { data: existingUpload } = await supabase
                .from(table)
                .select('id')
                .eq('company_id', alias.company_id)
                .eq('file_name', ef.name)
                .contains('metadata', { mailgun_message_id: messageId })
                .limit(1);

              if (existingUpload && existingUpload.length > 0) {
                hasBeenProcessed = true;
                break;
              }
            }

            // Layer 2: llm_koltsegek — permanent audit log, survives cleanup
            // Catches the race where uploads were cleaned up between webhook retries.
            if (!hasBeenProcessed) {
              const { data: llmRow } = await supabase
                .from('llm_koltsegek')
                .select('id')
                .eq('company_id', alias.company_id)
                .eq('file_name', ef.name)
                .contains('metadata', { mailgun_message_id: messageId })
                .limit(1);

              if (llmRow && llmRow.length > 0) {
                hasBeenProcessed = true;
                console.log(`[IDEMPOTENCY-L2] Skipping duplicate attachment: ${ef.name} ` +
                  `(found in llm_koltsegek after upload rows were cleaned up)`);
              }
            }

            if (hasBeenProcessed) {
              console.log(`[IDEMPOTENCY] Skipping duplicate attachment: ${ef.name} ` +
                `(Message-Id already processed: ${messageId})`);
              continue;
            }
          } else {
            // ── Fallback idempotency (no Message-Id available) ──
            // Some senders (e.g. Canon scanner firmware) omit the Message-Id header,
            // so the per-email check above cannot run. To avoid duplicate processing
            // on Mailgun redelivery, dedup on (company_id, file_name, email_alias)
            // across all three upload tables within a 24h window. Any existing row
            // (any status) means the file is already tracked / was already attempted.
            const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
            let hasRecentEmailUpload = false;
            const tablesToCheckNoMsgId = ['transaction_uploads', 'invoice_uploads', 'report_uploads'];
            for (const table of tablesToCheckNoMsgId) {
              const { data: recentUpload } = await supabase
                .from(table)
                .select('id, processing_status')
                .eq('company_id', alias.company_id)
                .eq('file_name', ef.name)
                .eq('metadata->>source', 'email_alias')
                .gt('created_at', sinceIso)
                .limit(1);

              if (recentUpload && recentUpload.length > 0) {
                hasRecentEmailUpload = true;
                break;
              }
            }

            if (hasRecentEmailUpload) {
              console.log(`[IDEMPOTENCY] Skipping duplicate attachment (no Message-Id): ${ef.name} ` +
                `(email_alias row already exists within 24h for company ${alias.company_id})`);
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

          const sanitizedAttachmentName = sanitizeFileName(ef.name);
          const storagePath = `${alias.user_id}/${Date.now()}-${sanitizedAttachmentName}`;

          // Upload to Supabase storage
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from(storageBucket)
            .upload(storagePath, ef.bytes, {
              contentType: ef.contentType,
              upsert: false,
            });

          if (uploadError) {
            console.error('Upload error:', uploadError);
            await logError(supabase, {
              error_type: 'upload',
              severity: 'error',
              component: 'process-mailgun-webhook',
              action: 'storage_upload',
              message: `File upload failed: ${ef.name}`,
              user_id: alias.user_id,
              company_id: alias.company_id,
              context: { fileName: ef.name, fileType: ef.contentType, fileSize: ef.bytes.length, uploadError: uploadError.message, classification, extractedFromArchive: ef.extractedFromArchive },
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
            // Track archive source for debugging
            ...(ef.extractedFromArchive ? { extracted_from_archive: ef.extractedFromArchive } : {}),
            // Flag deferred archives so worker knows to decompress them
            ...(ef.isDeferredArchive ? {
              is_deferred_archive: true,
              archive_format: getExt(ef.name) || ef.name.toLowerCase().endsWith('.tar.gz') ? '.tar.gz' : '.tgz',
            } : {}),
          };

          // Initial note for processing journey tracking
          const initialNote = [{
            timestamp: new Date().toISOString(),
            event: `classified_as_${classification}`,
            detail: reason,
            sender_domain: senderDomain,
            original_from: originalFrom,
            ...(ef.extractedFromArchive ? { extracted_from_archive: ef.extractedFromArchive } : {}),
          }];

          if (classification === 'report') {
            // ── Courier report upload (GLS/MPL/DPD etc.) ──
            const { data: reportRecord, error: reportError } = await supabase
              .from('report_uploads')
              .insert({
                user_id: alias.user_id,
                company_id: alias.company_id,
                file_name: ef.name,
                file_type: ef.contentType,
                file_size: ef.bytes.length,
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
              if (isUniqueViolation(reportError)) {
                // DB-level dedup: concurrent webhook sent the same attachment — graceful skip
                console.log(`[IDEMPOTENCY-DB] report_uploads duplicate skipped (unique_violation): ${ef.name}`);
              } else {
                console.error('Error creating report upload record:', reportError);
                await logError(supabase, {
                  error_type: 'db_query',
                  component: 'process-mailgun-webhook',
                  action: 'create_report_upload_record',
                  message: `Failed to create report upload record for: ${ef.name}`,
                  user_id: alias.user_id,
                  company_id: alias.company_id,
                  context: { fileName: ef.name, recordError: reportError.message, reportType },
                });
              }
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
                file_name: ef.name,
                file_type: ef.contentType,
                file_size: ef.bytes.length,
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
              if (isUniqueViolation(txError)) {
                // DB-level dedup: concurrent webhook sent the same attachment — graceful skip
                console.log(`[IDEMPOTENCY-DB] transaction_uploads duplicate skipped (unique_violation): ${ef.name}`);
              } else {
                console.error('Error creating transaction upload record:', txError);
                await logError(supabase, {
                  error_type: 'db_query',
                  component: 'process-mailgun-webhook',
                  action: 'create_transaction_upload_record',
                  message: `Failed to create transaction upload record for: ${ef.name}`,
                  user_id: alias.user_id,
                  company_id: alias.company_id,
                  context: { fileName: ef.name, recordError: txError.message, bankHint },
                });
              }
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
                file_name: ef.name,
                file_type: ef.contentType,
                file_size: ef.bytes.length,
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
              if (isUniqueViolation(recordError)) {
                // DB-level dedup: concurrent webhook sent the same attachment — graceful skip
                console.log(`[IDEMPOTENCY-DB] invoice_uploads duplicate skipped (unique_violation): ${ef.name}`);
              } else {
                console.error('Error creating invoice upload record:', recordError);
                await logError(supabase, {
                  error_type: 'db_query',
                  component: 'process-mailgun-webhook',
                  action: 'create_upload_record',
                  message: `Failed to create invoice upload record for: ${ef.name}`,
                  user_id: alias.user_id,
                  company_id: alias.company_id,
                  context: { fileName: ef.name, recordError: recordError.message },
                });
              }
            } else {
              console.log('Invoice upload record created:', uploadRecord.id);
              // Processing is handled automatically by the DB trigger (trg_enqueue_invoice)
              // which enqueues the job to the PGMQ invoice_jobs queue on INSERT.
              console.log('Job enqueued via DB trigger for PGMQ worker processing.');
            }
          }
        } // end for (const ef of expandedFiles)
      } // end for (const attachment of attachments)
    } else {
      console.log('No attachments to process (attachmentCount:', attachmentCount, ')');
      
      // ── body-mime fallback: parse RFC822 MIME to extract embedded attachments ──
      // When Mailgun sends application/x-www-form-urlencoded (or multipart but with
      // no File objects), attachments may be embedded in the body-mime field as raw
      // RFC822 MIME content. This happens with forwarded emails.
      if (attachmentCount > 0 && bodyMime) {
        console.log('[BODY-MIME-FALLBACK] Attempting to parse body-mime for embedded attachments...');
        console.log('[BODY-MIME-FALLBACK] body-mime length:', bodyMime.length);
        
        try {
          const parsed = await PostalMime.parse(bodyMime);
          console.log('[BODY-MIME-FALLBACK] Parsed email - subject:', parsed.subject, 'attachments:', parsed.attachments?.length || 0);
          
          if (parsed.attachments && parsed.attachments.length > 0) {
            console.log('[BODY-MIME-FALLBACK] Found', parsed.attachments.length, 'attachments in body-mime');
            
            for (const mimeAttachment of parsed.attachments) {
              const attachName = mimeAttachment.filename || `attachment-${Date.now()}`;
              const attachBytes = new Uint8Array(mimeAttachment.content);
              const attachContentType = mimeAttachment.mimeType || 'application/octet-stream';
              
              console.log('[BODY-MIME-FALLBACK] Processing embedded attachment:', attachName, 'type:', attachContentType, 'size:', attachBytes.length);
              
              // Check if it's an archive
              const archiveDetected = isArchiveExt(attachName);
              
              let expandedFiles: ExpandedFile[];
              if (archiveDetected) {
                expandedFiles = await expandAttachments(attachName, attachBytes);
                if (expandedFiles.length === 0) {
                  console.log(`[BODY-MIME-FALLBACK] Archive has no supported files, skipping: ${attachName}`);
                  continue;
                }
              } else if (!isValidInvoiceAttachment(attachName, attachContentType)) {
                console.log(`[BODY-MIME-FALLBACK] Skipping unsupported attachment: ${attachName}`);
                continue;
              } else {
                expandedFiles = [{ name: attachName, bytes: attachBytes, contentType: attachContentType }];
              }
              
              // Process each expanded file (same logic as the main attachment loop)
              for (const ef of expandedFiles) {
                const classification = classifyAttachment(ef.name, senderDomain, sender);
                const reason = getClassificationReason(ef.name, senderDomain, sender);
                
                console.log(`[BODY-MIME-FALLBACK] Classification for ${ef.name}: ${classification} (${reason})`);
                
                const storageBucket = classification === 'transaction'
                  ? 'transactions'
                  : classification === 'report'
                    ? 'report-uploads'
                    : 'invoice-uploads';
                
                const sanitizedName = sanitizeFileName(ef.name);
                const storagePath = `${alias.user_id}/${Date.now()}-${sanitizedName}`;
                
                const { data: uploadData, error: uploadError } = await supabase.storage
                  .from(storageBucket)
                  .upload(storagePath, ef.bytes, {
                    contentType: ef.contentType,
                    upsert: false,
                  });
                
                if (uploadError) {
                  console.error('[BODY-MIME-FALLBACK] Upload error:', uploadError);
                  continue;
                }
                
                console.log(`[BODY-MIME-FALLBACK] File uploaded to ${storageBucket}:`, storagePath);
                
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
                  extracted_from_body_mime: true,
                  ...(ef.extractedFromArchive ? { extracted_from_archive: ef.extractedFromArchive } : {}),
                  ...(ef.isDeferredArchive ? {
                    is_deferred_archive: true,
                    archive_format: getExt(ef.name),
                  } : {}),
                };
                
                const initialNote = [{
                  timestamp: new Date().toISOString(),
                  event: `classified_as_${classification}`,
                  detail: `${reason} (extracted from body-mime)`,
                  sender_domain: senderDomain,
                  original_from: originalFrom,
                }];
                
                if (classification === 'report') {
                  const { error: reportError } = await supabase
                    .from('report_uploads')
                    .insert({
                      user_id: alias.user_id,
                      company_id: alias.company_id,
                      file_name: ef.name,
                      file_url: publicUrl,
                      file_size: ef.bytes.length,
                      upload_status: 'uploaded',
                      processing_status: 'pending',
                      report_type: detectReportType(ef.name, senderDomain),
                      metadata: emailMetadata,
                      notes: initialNote,
                    });
                  if (reportError) console.error('[BODY-MIME-FALLBACK] Report insert error:', reportError);
                  else console.log('[BODY-MIME-FALLBACK] Report upload created for:', ef.name);
                } else if (classification === 'transaction') {
                  const { error: txError } = await supabase
                    .from('transaction_uploads')
                    .insert({
                      user_id: alias.user_id,
                      company_id: alias.company_id,
                      file_name: ef.name,
                      file_url: publicUrl,
                      file_size: ef.bytes.length,
                      processing_status: 'pending',
                      bank_hint: detectBankHint(ef.name, senderDomain, bodyPlain),
                      metadata: emailMetadata,
                      notes: initialNote,
                    });
                  if (txError) console.error('[BODY-MIME-FALLBACK] Transaction insert error:', txError);
                  else console.log('[BODY-MIME-FALLBACK] Transaction upload created for:', ef.name);
                } else {
                  const { error: invError } = await supabase
                    .from('invoice_uploads')
                    .insert({
                      user_id: alias.user_id,
                      company_id: alias.company_id,
                      file_name: ef.name,
                      file_url: publicUrl,
                      file_size: ef.bytes.length,
                      processing_status: 'pending',
                      document_category: 'invoice',
                      metadata: emailMetadata,
                      notes: initialNote,
                    });
                  if (invError) console.error('[BODY-MIME-FALLBACK] Invoice insert error:', invError);
                  else console.log('[BODY-MIME-FALLBACK] Invoice upload created for:', ef.name);
                }
              }
            }
          } else {
            console.log('[BODY-MIME-FALLBACK] No attachments found in parsed body-mime');
          }
        } catch (mimeError) {
          console.error('[BODY-MIME-FALLBACK] Failed to parse body-mime:', mimeError);
          await logError(supabase, {
            error_type: 'body_mime_parse_failed',
            severity: 'warning',
            component: 'process-mailgun-webhook',
            action: 'parse_body_mime',
            message: `Failed to parse body-mime for embedded attachments: ${mimeError}`,
            user_id: alias?.user_id,
            company_id: alias?.company_id,
            context: { recipient, sender, subject, contentType, attachmentCount, bodyMimeLength: bodyMime?.length },
          });
        }
      } else if (attachmentCount > 0) {
        // Expected attachments but no body-mime available either
        console.warn('[ATTACHMENT-MISSING] Attachments expected but neither File objects nor body-mime available.');
        await logError(supabase, {
          error_type: 'attachment_missing',
          severity: 'warning',
          component: 'process-mailgun-webhook',
          action: 'parse_attachments',
          message: `Expected ${attachmentCount} attachment(s) but received 0 and no body-mime field available (content-type: ${contentType}).`,
          user_id: alias?.user_id,
          company_id: alias?.company_id,
          context: { recipient, sender, subject, contentType, attachmentCount, hasBodyMime: !!bodyMime },
        });
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

    // ── Billingo & Számlázz.hu link & API PDF extraction ──
    const linkInvoicesCount = await processBillingoAndSzamlazzLinks(
      supabase,
      alias,
      subject,
      bodyPlain,
      bodyHtml,
      sender,
      messageId
    );
    if (linkInvoicesCount > 0) {
      console.log(`[LINK-INGEST] Successfully processed ${linkInvoicesCount} invoice(s) from Billingo/Számlázz links or API.`);
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
