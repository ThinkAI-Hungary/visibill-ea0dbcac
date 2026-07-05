import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { PDFDocument } from 'https://esm.sh/pdf-lib@1.17.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_PDF_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB
const BATCH_SIZE = 20; // Process N invoices per batch before updating progress

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No authorization header');

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error('Authentication failed');

    const body = await req.json();
    const { companyId, dateFrom, dateTo, invoiceDirection } = body;

    if (!companyId || !dateFrom || !dateTo) {
      throw new Error('Missing required fields: companyId, dateFrom, dateTo');
    }

    console.log(`[PDF-EXPORT] Starting for company=${companyId}, range=${dateFrom}..${dateTo}, direction=${invoiceDirection || 'ALL'}`);

    // Verify user belongs to company
    const { data: membership } = await supabase
      .from('company_members')
      .select('id')
      .eq('company_id', companyId)
      .eq('user_id', user.id)
      .single();

    if (!membership) {
      throw new Error('User is not a member of this company');
    }

    // Count invoices in date range
    let invoiceQuery = supabase
      .from('invoices')
      .select('id, bizonylatsorszam, elado_nev, vevo_nev, image_url, melleklet_url, kibocsatas_datuma', { count: 'exact' })
      .eq('company_id', companyId)
      .gte('kibocsatas_datuma', dateFrom)
      .lte('kibocsatas_datuma', dateTo)
      .order('kibocsatas_datuma', { ascending: true });

    if (invoiceDirection) {
      // Filter by direction based on invoice type or available fields
      invoiceQuery = invoiceQuery.eq('invoice_direction', invoiceDirection);
    }

    const { data: invoices, error: queryError, count } = await invoiceQuery;
    if (queryError) throw new Error(`Invoice query failed: ${queryError.message}`);

    const totalInvoices = count || invoices?.length || 0;

    if (totalInvoices === 0) {
      return new Response(JSON.stringify({ error: 'Nincs számla a megadott időszakban' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create job record
    const { data: job, error: jobError } = await supabase
      .from('pdf_export_jobs')
      .insert({
        company_id: companyId,
        user_id: user.id,
        status: 'processing',
        date_from: dateFrom,
        date_to: dateTo,
        invoice_direction: invoiceDirection || null,
        total_invoices: totalInvoices,
        processed_invoices: 0,
      })
      .select('id')
      .single();

    if (jobError) throw new Error(`Job creation failed: ${jobError.message}`);

    const jobId = job.id;
    console.log(`[PDF-EXPORT] Job ${jobId} created, processing ${totalInvoices} invoices`);

    // Return immediately with job ID — processing continues in background
    // We use EdgeRuntime.waitUntil pattern if available, otherwise process inline
    const processPromise = processInvoices(supabase, jobId, companyId, invoices || [], totalInvoices, dateFrom, dateTo);

    // Try to use waitUntil for background processing
    try {
      // @ts-ignore - EdgeRuntime may not be available in all environments
      if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
        EdgeRuntime.waitUntil(processPromise);
      } else {
        // Fallback: process inline (blocks response but ensures completion)
        await processPromise;
      }
    } catch {
      // If waitUntil fails, process inline
      await processPromise;
    }

    return new Response(JSON.stringify({ success: true, jobId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[PDF-EXPORT] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// ─── Background Processing ────────────────────────────────────────

interface InvoiceRow {
  id: string;
  bizonylatsorszam?: string;
  elado_nev?: string;
  vevo_nev?: string;
  image_url?: string;
  melleklet_url?: string;
  kibocsatas_datuma?: string;
}

async function processInvoices(
  supabase: any,
  jobId: string,
  companyId: string,
  invoices: InvoiceRow[],
  totalInvoices: number,
  dateFrom: string,
  dateTo: string
) {
  const baseName = `${dateFrom}_${dateTo}_bekuldott_szamlak`;
  const pdfParts: { pdfBytes: Uint8Array; fileName: string }[] = [];
  let currentPdf = await PDFDocument.create();
  let currentPdfSize = 0;
  let partNumber = 1;
  let processed = 0;

  try {
    for (let i = 0; i < invoices.length; i++) {
      const invoice = invoices[i];
      const displayUrl = invoice.image_url || invoice.melleklet_url;

      if (!displayUrl) {
        processed++;
        continue;
      }

      const invoiceName = invoice.bizonylatsorszam || invoice.id.slice(0, 8);

      try {
        // Fetch the file
        const response = await fetch(displayUrl);
        if (!response.ok) {
          console.warn(`[PDF-EXPORT] Failed to fetch ${invoiceName}: ${response.status}`);
          processed++;
          continue;
        }

        const fileBytes = new Uint8Array(await response.arrayBuffer());
        const contentType = response.headers.get('content-type') || '';
        const isPdf = contentType.includes('pdf') || displayUrl.toLowerCase().endsWith('.pdf');

        if (isPdf) {
          // Merge PDF pages
          try {
            const srcPdf = await PDFDocument.load(fileBytes, { ignoreEncryption: true });
            const copiedPages = await currentPdf.copyPages(srcPdf, srcPdf.getPageIndices());
            for (const page of copiedPages) {
              currentPdf.addPage(page);
            }
            currentPdfSize += fileBytes.length;
          } catch (pdfErr) {
            console.warn(`[PDF-EXPORT] Could not merge PDF ${invoiceName}:`, pdfErr);
          }
        } else {
          // Embed image (JPG or PNG) on an A4 page
          try {
            let image;
            if (contentType.includes('png') || displayUrl.toLowerCase().endsWith('.png')) {
              image = await currentPdf.embedPng(fileBytes);
            } else {
              // Default to JPEG
              image = await currentPdf.embedJpg(fileBytes);
            }

            // A4 dimensions in points (595.28 x 841.89)
            const A4_WIDTH = 595.28;
            const A4_HEIGHT = 841.89;
            const MARGIN = 28; // ~1cm margin

            const maxWidth = A4_WIDTH - 2 * MARGIN;
            const maxHeight = A4_HEIGHT - 2 * MARGIN;

            const imgWidth = image.width;
            const imgHeight = image.height;
            const scale = Math.min(maxWidth / imgWidth, maxHeight / imgHeight, 1);

            const scaledWidth = imgWidth * scale;
            const scaledHeight = imgHeight * scale;

            const page = currentPdf.addPage([A4_WIDTH, A4_HEIGHT]);
            page.drawImage(image, {
              x: (A4_WIDTH - scaledWidth) / 2,
              y: A4_HEIGHT - MARGIN - scaledHeight, // top-aligned with margin
              width: scaledWidth,
              height: scaledHeight,
            });

            currentPdfSize += fileBytes.length;
          } catch (imgErr) {
            console.warn(`[PDF-EXPORT] Could not embed image ${invoiceName}:`, imgErr);
          }
        }

        // Check size limit — split if needed
        if (currentPdfSize > MAX_PDF_SIZE_BYTES && currentPdf.getPageCount() > 0) {
          const bytes = await currentPdf.save();
          pdfParts.push({
            pdfBytes: bytes,
            fileName: `${baseName}_${partNumber}.pdf`,
          });
          partNumber++;
          currentPdf = await PDFDocument.create();
          currentPdfSize = 0;
        }

      } catch (fetchErr) {
        console.warn(`[PDF-EXPORT] Error processing ${invoiceName}:`, fetchErr);
      }

      processed++;

      // Update progress every BATCH_SIZE invoices
      if (processed % BATCH_SIZE === 0 || processed === totalInvoices) {
        await supabase
          .from('pdf_export_jobs')
          .update({
            processed_invoices: processed,
            current_invoice_name: invoiceName,
          })
          .eq('id', jobId);
      }
    }

    // Save the last (or only) PDF
    if (currentPdf.getPageCount() > 0) {
      const bytes = await currentPdf.save();
      pdfParts.push({
        pdfBytes: bytes,
        fileName: pdfParts.length > 0
          ? `${baseName}_${partNumber}.pdf`
          : `${baseName}.pdf`,
      });
    }

    if (pdfParts.length === 0) {
      await supabase
        .from('pdf_export_jobs')
        .update({
          status: 'error',
          error_message: 'Nem sikerült egyetlen számlát sem feldolgozni',
          processed_invoices: processed,
        })
        .eq('id', jobId);
      return;
    }

    // Upload all PDF parts to Storage
    const resultUrls: string[] = [];
    const resultSizes: number[] = [];

    for (const part of pdfParts) {
      const storagePath = `${companyId}/${jobId}/${part.fileName}`;
      const { error: uploadError } = await supabase.storage
        .from('pdf-exports')
        .upload(storagePath, part.pdfBytes, {
          contentType: 'application/pdf',
          upsert: true,
        });

      if (uploadError) {
        console.error(`[PDF-EXPORT] Upload failed for ${part.fileName}:`, uploadError);
        continue;
      }

      resultUrls.push(storagePath);
      resultSizes.push(part.pdfBytes.length);
      console.log(`[PDF-EXPORT] Uploaded ${part.fileName} (${(part.pdfBytes.length / 1024 / 1024).toFixed(1)} MB)`);
    }

    // Mark job as completed
    await supabase
      .from('pdf_export_jobs')
      .update({
        status: 'completed',
        processed_invoices: processed,
        result_urls: resultUrls,
        result_sizes: resultSizes,
        completed_at: new Date().toISOString(),
        current_invoice_name: null,
      })
      .eq('id', jobId);

    console.log(`[PDF-EXPORT] Job ${jobId} completed: ${resultUrls.length} PDF(s), ${processed} invoices`);

  } catch (error: any) {
    console.error(`[PDF-EXPORT] Job ${jobId} failed:`, error);
    await supabase
      .from('pdf_export_jobs')
      .update({
        status: 'error',
        error_message: error.message || 'Unknown error during PDF generation',
        processed_invoices: processed,
      })
      .eq('id', jobId);
  }
}
