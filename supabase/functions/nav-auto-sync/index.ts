import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { sha3_512 } from 'https://esm.sh/@noble/hashes@1.3.0/sha3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NavCredentials {
  nav_username: string;
  nav_password: string;
  nav_tax_number: string;
  nav_sign_key: string;
  nav_exchange_key: string;
  software_id: string;
  software_dev_name: string;
  software_dev_contact: string;
  is_test_environment: boolean;
}

interface UserWithCredentials {
  user_id: string;
  nav_username: string;
}

interface InvoiceLineItem {
  lineNumber: number;
  lineDescription?: string;
  quantity?: number;
  unitOfMeasure?: string;
  unitPrice?: number;
  netAmount?: number;
  vatRate?: string;
  vatAmount?: number;
  grossAmount?: number;
  productCode?: string;
  lineDeliveryPeriodFrom?: string;
  lineDeliveryPeriodTo?: string;
}

interface InvoiceDetails {
  supplierName?: string;
  supplierAddress?: string;
  customerName?: string;
  customerAddress?: string;
  paymentDate?: string;
  invoiceGrossAmount?: number;
  lineItems?: InvoiceLineItem[];
  isCashAccounting?: boolean;
}

// Rate limiting helper
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Parallel execution with concurrency limit
async function parallelLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  const executing: Promise<void>[] = [];
  
  for (const item of items) {
    const p = fn(item).then(result => {
      results.push(result);
    });
    executing.push(p);
    
    if (executing.length >= limit) {
      await Promise.race(executing);
      // Remove completed promises
      for (let i = executing.length - 1; i >= 0; i--) {
        const status = await Promise.race([executing[i], Promise.resolve('pending')]);
        if (status !== 'pending') {
          executing.splice(i, 1);
        }
      }
    }
  }
  
  await Promise.all(executing);
  return results;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth guard: only allow pg_cron and self-reinvocation that send the shared secret.
  const cronSecret = Deno.env.get('CRON_SECRET');
  const providedSecret = req.headers.get('x-cron-secret');
  if (!cronSecret || providedSecret !== cronSecret) {
    return new Response(
      JSON.stringify({ error: 'Forbidden' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }



  try {
    // Parse request body for optional parameters
    let requestBody: any = {};
    try { requestBody = await req.json(); } catch { /* empty body is fine */ }
    
    const depth = requestBody.depth || 0;
    const detailsOnly = requestBody.detailsOnly || false;
    const MAX_DEPTH = 10; // Safety cap: max 10 self-reinvocations

    if (depth >= MAX_DEPTH) {
      console.log(`🛑 Max reinvocation depth (${MAX_DEPTH}) reached. Stopping.`);
      return new Response(
        JSON.stringify({ success: true, message: `Max depth ${MAX_DEPTH} reached`, depth }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🤖 Starting automatic NAV synchronization (depth: ${depth}, detailsOnly: ${detailsOnly})`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { data: companiesWithCreds, error: companiesError } = await supabase
      .from('user_nav_credentials')
      .select('user_id, company_id, nav_username')
      .eq('validation_status', 'valid')
      .not('company_id', 'is', null);

    if (companiesError) {
      throw new Error(`Failed to fetch companies: ${companiesError.message}`);
    }

    if (!companiesWithCreds || companiesWithCreds.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No companies to sync', companies_processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📊 Found ${companiesWithCreds.length} companies to sync`);

    const results = {
      total_companies: companiesWithCreds.length,
      successful: 0,
      failed: 0,
      details: [] as any[]
    };

    const dateTo = new Date();
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - 90);
    const dateToStr = dateTo.toISOString().split('T')[0];
    const dateFromStr = dateFrom.toISOString().split('T')[0];

    const webhookUrl = Deno.env.get('NAV_INVOICES_KATEGORIZALAS_WEBHOOK_URL');
    if (!detailsOnly) {
      console.log(`📤 Webhook URL: ${webhookUrl ? `SET (ends: ...${webhookUrl.slice(-30)})` : 'NOT SET'}`);
    }

    for (const company of companiesWithCreds) {
      console.log(`\n👤 Processing company: ${company.company_id} (user: ${company.user_id})`);

      try {
        const { data: credsData, error: credsError } = await supabase.rpc('get_nav_credentials', {
          p_user_id: company.user_id,
          p_company_id: company.company_id
        });

        if (credsError || !credsData) {
          throw new Error(`Failed to get credentials: ${credsError?.message || 'No data'}`);
        }
        if (credsData.error) {
          throw new Error(`Credentials lookup failed: ${credsData.error}`);
        }

        const credentials = credsData as NavCredentials;

        if (detailsOnly) {
          // ===== DETAILS-ONLY MODE: skip digest, just fetch remaining details =====
          const navApiUrl = 'https://api.onlineszamla.nav.gov.hu/invoiceService/v3';
          const token = await getNavToken(credentials, navApiUrl);

          for (const direction of ['OUTBOUND', 'INBOUND'] as const) {
            const count = await fetchInvoiceDetails(
              supabase, company.user_id, company.company_id,
              credentials, token, navApiUrl, direction
            );
            console.log(`🔍 Detail-only ${direction}: ${count} invoices processed`);
          }

          results.successful++;
          results.details.push({
            company_id: company.company_id,
            status: 'success',
            mode: 'details_only'
          });

        } else {
          // ===== FULL SYNC MODE: digest + details + webhook =====
          const outboundInvoiceNumbers = await syncInvoices(supabase, company.user_id, company.company_id, credentials, 'OUTBOUND', dateFromStr, dateToStr);
          console.log(`✅ OUTBOUND sync completed for company ${company.company_id}: ${outboundInvoiceNumbers?.length || 0} invoices`);

          const inboundInvoiceNumbers = await syncInvoices(supabase, company.user_id, company.company_id, credentials, 'INBOUND', dateFromStr, dateToStr);
          console.log(`✅ INBOUND sync completed for company ${company.company_id}: ${inboundInvoiceNumbers?.length || 0} invoices`);

          // Trigger webhook for uncategorized invoices
          const allInvoiceNumbers = [...(outboundInvoiceNumbers || []), ...(inboundInvoiceNumbers || [])];
          
          if (webhookUrl && webhookUrl.startsWith('http') && allInvoiceNumbers.length > 0) {
            try {
              const { data: invoicesWithItems } = await supabase
                .from('nav_invoices')
                .select(`
                  id, invoice_number, invoice_direction, supplier_name, customer_name,
                  company_id, category_id, project_id,
                  nav_invoice_items ( line_description, product_code, net_amount )
                `)
                .in('invoice_number', allInvoiceNumbers)
                .eq('user_id', company.user_id)
                .eq('company_id', company.company_id)
                .or('category_id.is.null,project_id.is.null');
              
              if (invoicesWithItems && invoicesWithItems.length > 0) {
                fetch(webhookUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    syncType: 'automatic', userId: company.user_id, companyId: company.company_id,
                    invoiceDirections: ['OUTBOUND', 'INBOUND'],
                    outboundCount: outboundInvoiceNumbers?.length || 0,
                    inboundCount: inboundInvoiceNumbers?.length || 0,
                    totalCount: invoicesWithItems.length,
                    filteredMessage: 'Only uncategorized invoices sent',
                    invoices: invoicesWithItems
                  })
                }).catch(err => console.error(`📤 N8N webhook failed:`, err));
                console.log(`📤 N8N webhook: ${invoicesWithItems.length} uncategorized invoices sent`);
              } else {
                console.log(`⏭️ N8N webhook skipped: all invoices already categorized`);
              }
            } catch (webhookError) {
              console.error('Webhook prep failed:', webhookError);
            }
          }

          results.successful++;
          results.details.push({
            company_id: company.company_id,
            status: 'success',
            outbound_count: outboundInvoiceNumbers?.length || 0,
            inbound_count: inboundInvoiceNumbers?.length || 0
          });
        }

      } catch (error) {
        console.error(`❌ Error syncing company ${company.company_id}:`, error);
        results.failed++;
        results.details.push({
          company_id: company.company_id,
          status: 'failed',
          error: error.message
        });
      }

      await delay(200);
    }

    // ===== SELF-REINVOCATION: check if more details need fetching =====
    const { count: remainingDetails } = await supabase
      .from('nav_invoices')
      .select('id', { count: 'exact', head: true })
      .or('details_fetched.is.null,details_fetched.eq.false');

    if (remainingDetails && remainingDetails > 0) {
      console.log(`🔄 ${remainingDetails} invoices still need details. Re-invoking (depth ${depth + 1})...`);
      
      // Fire-and-forget: call ourselves again after 5 seconds
      const selfUrl = `${supabaseUrl}/functions/v1/nav-auto-sync`;
      setTimeout(() => {
        fetch(selfUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceRoleKey}`,
            'x-cron-secret': cronSecret
          },
          body: JSON.stringify({ depth: depth + 1, detailsOnly: true })
        }).catch(err => console.error('Self-reinvocation failed:', err));
      }, 5000);
    } else {
      console.log('✅ All invoice details are up to date.');
    }

    console.log('\n📈 Sync Summary:', results);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: detailsOnly ? 'Details-only sync completed' : 'Automatic sync completed',
        results,
        depth,
        remainingDetails: remainingDetails || 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('💥 Unexpected error during automatic sync:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Helper function to split date range into 35-day chunks (NAV API limit)
function splitDateRange(startDateStr: string, endDateStr: string, maxDays: number = 35): Array<{from: string, to: string}> {
  const chunks: Array<{from: string, to: string}> = [];
  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);
  let currentStart = new Date(startDate);
  
  while (currentStart < endDate) {
    const chunkEnd = new Date(currentStart);
    chunkEnd.setDate(chunkEnd.getDate() + maxDays - 1);
    
    const actualEnd = chunkEnd > endDate ? endDate : chunkEnd;
    
    chunks.push({
      from: currentStart.toISOString().split('T')[0],
      to: actualEnd.toISOString().split('T')[0]
    });
    
    currentStart = new Date(actualEnd);
    currentStart.setDate(currentStart.getDate() + 1);
  }
  
  return chunks;
}

async function syncInvoices(
  supabase: any,
  userId: string,
  companyId: string,
  credentials: NavCredentials,
  direction: 'OUTBOUND' | 'INBOUND',
  dateFrom: string,
  dateTo: string
) {
  const startTime = Date.now();

  // Create sync log entry
  const { data: logData, error: logError } = await supabase
    .from('nav_sync_logs')
    .insert({
      user_id: userId,
      company_id: companyId,
      sync_type: 'automatic',
      invoice_direction: direction,
      date_from: dateFrom,
      date_to: dateTo,
      status: 'in_progress',
      started_at: new Date().toISOString()
    })
    .select()
    .single();

  if (logError) {
    console.error('Error creating sync log:', logError);
    throw new Error(`Failed to create sync log: ${logError.message}`);
  }

  const syncLogId = logData.id;

  try {
    const navApiUrl = 'https://api.onlineszamla.nav.gov.hu/invoiceService/v3';
    
    // Get NAV token
    const token = await getNavToken(credentials, navApiUrl);
    console.log(`🔑 Got NAV token for ${direction} sync`);

    // Split date range into 35-day chunks (NAV API limit)
    const dateChunks = splitDateRange(dateFrom, dateTo, 35);
    console.log(`📅 Split ${dateFrom} to ${dateTo} into ${dateChunks.length} chunks`);

    // Query invoices from all chunks
    let allInvoices: any[] = [];

    for (const chunk of dateChunks) {
      console.log(`📆 Processing chunk: ${chunk.from} to ${chunk.to}`);
      
      let currentPage = 1;
      const MAX_SAFETY_PAGES = 50; // Safety cap to prevent infinite loops

      while (currentPage <= MAX_SAFETY_PAGES) {
        const invoices = await queryInvoiceDigest(
          credentials,
          token,
          navApiUrl,
          direction,
          chunk.from,
          chunk.to,
          currentPage
        );

        if (!invoices || invoices.length === 0) {
          break;
        }

        allInvoices = [...allInvoices, ...invoices];
        console.log(`📄 Chunk ${chunk.from}-${chunk.to}, Page ${currentPage}: ${invoices.length} invoices`);

        // If we got fewer than 100 invoices, this is the last page
        if (invoices.length < 100) {
          break;
        }

        currentPage++;
        await delay(100); // Small delay between pages
      }

      if (currentPage > MAX_SAFETY_PAGES) {
        console.warn(`⚠️ Hit safety page limit (${MAX_SAFETY_PAGES}) for chunk ${chunk.from}-${chunk.to} ${direction}`);
      }
      
      // Small delay between chunks to avoid rate limiting
      await delay(200);
    }

    console.log(`📊 Total invoices fetched: ${allInvoices.length}`);

    // Upsert invoices to database (details_fetched defaults to false for new records)
    if (allInvoices.length > 0) {
      const invoicesToInsertRaw = allInvoices.map(inv => ({
        user_id: userId,
        company_id: companyId,
        invoice_number: inv.invoiceNumber,
        invoice_direction: direction,
        invoice_issue_date: inv.invoiceIssueDate,
        invoice_delivery_date: inv.invoiceDeliveryDate,
        supplier_tax_number: inv.supplierTaxNumber,
        customer_tax_number: inv.customerTaxNumber,
        invoice_operation: inv.invoiceOperation,
        invoice_net_amount: inv.invoiceNetAmount,
        invoice_vat_amount: inv.invoiceVatAmount,
        invoice_gross_amount: inv.invoiceGrossAmount,
        payment_method: inv.paymentMethod,
        currency: inv.currency || 'HUF',
        fetched_at: new Date().toISOString(),
        // Include names from digest if available
        supplier_name: inv.supplierName || null,
        customer_name: inv.customerName || null
      }));

      // Deduplicate by invoice_number to prevent
      // "ON CONFLICT DO UPDATE command cannot affect row a second time" error.
      // Normalize keys: trim whitespace + case-insensitive to match PostgreSQL collation.
      // NAV API can return the same invoice in overlapping date chunks or pages.
      const seenNumbers = new Map<string, typeof invoicesToInsertRaw[0]>();
      let skippedEmpty = 0;
      for (const inv of invoicesToInsertRaw) {
        const raw = (inv.invoice_number || '').trim();
        if (!raw) {
          skippedEmpty++;
          continue;
        }
        inv.invoice_number = raw; // store trimmed version
        const normalizedKey = raw.toUpperCase();
        seenNumbers.set(normalizedKey, inv); // last occurrence wins
      }
      const invoicesToInsert = Array.from(seenNumbers.values());

      if (skippedEmpty > 0) {
        console.warn(`⚠️ Skipped ${skippedEmpty} invoices with empty invoice_number`);
      }
      if (invoicesToInsertRaw.length !== invoicesToInsert.length + skippedEmpty) {
        console.log(`⚠️ Deduplicated ${invoicesToInsertRaw.length - invoicesToInsert.length - skippedEmpty} duplicate invoice numbers`);
      }

      // Upsert in batches to avoid PostgreSQL batch-level conflicts
      const UPSERT_BATCH_SIZE = 100;
      let upsertError: any = null;
      for (let i = 0; i < invoicesToInsert.length; i += UPSERT_BATCH_SIZE) {
        const batch = invoicesToInsert.slice(i, i + UPSERT_BATCH_SIZE);
        const { error } = await supabase
          .from('nav_invoices')
          .upsert(batch, {
            onConflict: 'company_id,invoice_number',
            ignoreDuplicates: false
          });
        if (error) {
          upsertError = error;
          break;
        }
      }

      if (upsertError) {
        throw new Error(`Failed to upsert invoices: ${upsertError.message}`);
      }

      // Cache partners from NAV data
      await cachePartnersFromInvoices(supabase, userId, companyId, allInvoices, direction);
    }

    // Fetch details for invoices that don't have them yet (incremental)
    const detailsFetchedCount = await fetchInvoiceDetails(
      supabase,
      userId,
      companyId,
      credentials,
      token,
      navApiUrl,
      direction
    );
    
    console.log(`🔍 Fetched details for ${detailsFetchedCount} invoices`);

    // Update sync log with success
    const duration = Date.now() - startTime;
    await supabase
      .from('nav_sync_logs')
      .update({
        status: 'completed',
        invoices_fetched: allInvoices.length,
        completed_at: new Date().toISOString(),
        duration_ms: duration
      })
      .eq('id', syncLogId);

    console.log(`✅ ${direction} sync completed: ${allInvoices.length} invoices in ${duration}ms`);

    // Return invoice numbers for consolidated webhook call
    return allInvoices.map(inv => inv.invoiceNumber);

  } catch (error) {
    console.error(`Error during ${direction} sync:`, error);

    // Update sync log with failure
    const duration = Date.now() - startTime;
    await supabase
      .from('nav_sync_logs')
      .update({
        status: 'failed',
        error_message: error.message,
        completed_at: new Date().toISOString(),
        duration_ms: duration
      })
      .eq('id', syncLogId);

    throw error;
  }
}

// Fetch detailed invoice data for ALL invoices without details (no limit - required for VAT breakdown)
async function fetchInvoiceDetails(
  supabase: any,
  userId: string,
  companyId: string,
  credentials: NavCredentials,
  token: string,
  navApiUrl: string,
  direction: 'OUTBOUND' | 'INBOUND'
): Promise<number> {
  // Get ALL invoices that need details fetched (no limit - required for VAT breakdown)
  const { data: invoicesNeedingDetails, error: fetchError } = await supabase
    .from('nav_invoices')
    .select('id, invoice_number')
    .eq('user_id', userId)
    .eq('company_id', companyId)
    .eq('invoice_direction', direction)
    .or('details_fetched.is.null,details_fetched.eq.false');

  if (fetchError) {
    console.error('Error fetching invoices needing details:', fetchError);
    return 0;
  }

  if (!invoicesNeedingDetails || invoicesNeedingDetails.length === 0) {
    console.log(`📋 No invoices need detail fetch for ${direction}`);
    return 0;
  }

  console.log(`🔍 Fetching details for ${invoicesNeedingDetails.length} ${direction} invoices (time-budgeted)`);

  let successCount = 0;
  const detailFetchStart = Date.now();
  const DETAIL_FETCH_TIME_BUDGET_MS = 60_000; // Max 60 seconds for detail fetching

  // Process invoices with limited parallelism (max 3 concurrent)
  // and rate limiting (500ms between batches)
  const batchSize = 3;
  
  for (let i = 0; i < invoicesNeedingDetails.length; i += batchSize) {
    // Check time budget before starting a new batch
    if (Date.now() - detailFetchStart > DETAIL_FETCH_TIME_BUDGET_MS) {
      const remaining = invoicesNeedingDetails.length - i;
      console.log(`⏱️ Detail fetch time budget exhausted (${DETAIL_FETCH_TIME_BUDGET_MS / 1000}s). ${remaining} invoices deferred to next sync.`);
      break;
    }

    const batch = invoicesNeedingDetails.slice(i, i + batchSize);
    
    const batchPromises = batch.map(async (invoice: any) => {
      try {
        const details = await queryInvoiceData(
          credentials,
          token,
          navApiUrl,
          invoice.invoice_number,
          direction
        );

        if (details) {
          // Update invoice with details
          const updateData: any = {
            details_fetched: true
          };

          if (details.supplierName) updateData.supplier_name = details.supplierName;
          if (details.supplierAddress) updateData.supplier_address = details.supplierAddress;
          if (details.customerName) updateData.customer_name = details.customerName;
          if (details.customerAddress) updateData.customer_address = details.customerAddress;
          if (details.paymentDate) updateData.payment_date = details.paymentDate;
          if (details.invoiceGrossAmount && details.invoiceGrossAmount > 0) {
            updateData.invoice_gross_amount = details.invoiceGrossAmount;
          }
          if (details.isCashAccounting) {
            updateData.is_cash_accounting = true;
          }

          const { error: updateError } = await supabase
            .from('nav_invoices')
            .update(updateData)
            .eq('id', invoice.id);

          if (updateError) {
            console.error(`Error updating invoice ${invoice.invoice_number}:`, updateError);
          } else {
            // Save line items if available
            if (details.lineItems && details.lineItems.length > 0) {
              // Delete existing line items first (in case of re-fetch)
              await supabase
                .from('nav_invoice_items')
                .delete()
                .eq('nav_invoice_id', invoice.id);

              // Insert new line items
              const lineItemsToInsert = details.lineItems.map(item => ({
                nav_invoice_id: invoice.id,
                line_number: item.lineNumber,
                line_description: item.lineDescription,
                quantity: item.quantity,
                unit_of_measure: item.unitOfMeasure,
                unit_price: item.unitPrice,
                net_amount: item.netAmount,
                vat_rate: item.vatRate,
                vat_amount: item.vatAmount,
                gross_amount: item.grossAmount,
                product_code: item.productCode,
                line_delivery_period_from: item.lineDeliveryPeriodFrom || null,
                line_delivery_period_to: item.lineDeliveryPeriodTo || null
              }));

              const { error: itemsError } = await supabase
                .from('nav_invoice_items')
                .insert(lineItemsToInsert);

              if (itemsError) {
                console.error(`Error inserting line items for ${invoice.invoice_number}:`, itemsError);
              } else {
                console.log(`📦 Saved ${details.lineItems.length} line items for ${invoice.invoice_number}`);
              }
            }
            successCount++;
          }
        }
      } catch (error) {
        console.error(`Error fetching details for ${invoice.invoice_number}:`, error.message);
        // Mark as fetched anyway to avoid retry loops on permanent errors
        await supabase
          .from('nav_invoices')
          .update({ details_fetched: true })
          .eq('id', invoice.id);
      }
    });

    await Promise.all(batchPromises);
    
    // Rate limiting between batches
    if (i + batchSize < invoicesNeedingDetails.length) {
      await delay(500);
    }
  }

  const elapsed = Math.round((Date.now() - detailFetchStart) / 1000);
  console.log(`🔍 Detail fetch completed: ${successCount}/${invoicesNeedingDetails.length} in ${elapsed}s`);

  return successCount;
}

// Query detailed invoice data from NAV
async function queryInvoiceData(
  credentials: NavCredentials,
  token: string,
  navApiUrl: string,
  invoiceNumber: string,
  direction: string
): Promise<InvoiceDetails | null> {
  const requestId = generateRequestId();
  const now = new Date();
  const timestamp = now.toISOString().replace(/\.\d{3}Z$/, 'Z');
  const compactTimestamp = getCompactTimestamp(now);

  const passwordHash = await sha512Hash(credentials.nav_password);
  const signatureInput = `${requestId}${compactTimestamp}${credentials.nav_sign_key}`;
  const signature = sha3Hash(signatureInput);

  const queryXml = buildQueryInvoiceDataXML(
    credentials.nav_username,
    passwordHash,
    credentials.nav_tax_number,
    signature,
    requestId,
    timestamp,
    token,
    credentials.software_id,
    credentials.software_dev_name || '',
    credentials.software_dev_contact || '',
    invoiceNumber,
    direction
  );

  const response = await fetch(`${navApiUrl}/queryInvoiceData`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/xml',
      'Accept': 'application/xml'
    },
    body: queryXml
  });

  const responseText = await response.text();

  if (!response.ok) {
    const errorCode = extractTag(responseText, 'funcCode') || extractTag(responseText, 'resultCode');
    const errorMessage = extractTag(responseText, 'message') || extractTag(responseText, 'errorDetail');
    console.error(`NAV queryInvoiceData error for ${invoiceNumber}: ${errorCode} - ${errorMessage}`);
    throw new Error(`NAV queryInvoiceData failed: ${errorCode || 'UNKNOWN'} - ${errorMessage || 'No details'}`);
  }

  return parseInvoiceDataFromXML(responseText);
}

function buildQueryInvoiceDataXML(
  username: string,
  passwordHash: string,
  taxNumber: string,
  signature: string,
  requestId: string,
  timestamp: string,
  token: string,
  softwareId: string,
  devName: string,
  devContact: string,
  invoiceNumber: string,
  direction: string
): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<QueryInvoiceDataRequest xmlns="http://schemas.nav.gov.hu/OSA/3.0/api" xmlns:common="http://schemas.nav.gov.hu/NTCA/1.0/common">
  <common:header>
    <common:requestId>${requestId}</common:requestId>
    <common:timestamp>${timestamp}</common:timestamp>
    <common:requestVersion>3.0</common:requestVersion>
    <common:headerVersion>1.0</common:headerVersion>
  </common:header>
  <common:user>
    <common:login>${username}</common:login>
    <common:passwordHash cryptoType="SHA-512">${passwordHash}</common:passwordHash>
    <common:taxNumber>${taxNumber}</common:taxNumber>
    <common:requestSignature cryptoType="SHA3-512">${signature}</common:requestSignature>
  </common:user>
  <software>
    <softwareId>${softwareId}</softwareId>
    <softwareName>Visibill</softwareName>
    <softwareOperation>ONLINE_SERVICE</softwareOperation>
    <softwareMainVersion>1.0</softwareMainVersion>
    <softwareDevName>${devName || 'Visibill'}</softwareDevName>
    <softwareDevContact>${devContact || 'support@visibill.hu'}</softwareDevContact>
  </software>
  <invoiceNumberQuery>
    <invoiceNumber>${invoiceNumber}</invoiceNumber>
    <invoiceDirection>${direction}</invoiceDirection>
  </invoiceNumberQuery>
</QueryInvoiceDataRequest>`;
}

// Parse detailed invoice data from queryInvoiceData response
function parseInvoiceDataFromXML(xml: string): InvoiceDetails | null {
  // The invoiceData is Base64 encoded in the response
  const invoiceDataMatch = xml.match(/<(?:\w+:)?invoiceData>([^<]+)<\/(?:\w+:)?invoiceData>/);
  
  if (!invoiceDataMatch) {
    console.log('No invoiceData found in response');
    return null;
  }

  try {
    // Decode Base64 with proper UTF-8 handling
    const base64Data = invoiceDataMatch[1];
    const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    const decodedData = new TextDecoder('utf-8').decode(binaryData);
    
    // Parse the decoded invoice XML
    const details: InvoiceDetails = {};

    // Extract supplier info
    const supplierName = extractTag(decodedData, 'supplierName');
    if (supplierName) details.supplierName = supplierName;

    // Extract supplier address
    const supplierAddress = buildAddressString(decodedData, 'supplierAddress');
    if (supplierAddress) details.supplierAddress = supplierAddress;

    // Extract customer info
    const customerName = extractTag(decodedData, 'customerName');
    if (customerName) details.customerName = customerName;

    // Extract customer address
    const customerAddress = buildAddressString(decodedData, 'customerAddress');
    if (customerAddress) details.customerAddress = customerAddress;

    // Extract payment date
    const paymentDate = extractTag(decodedData, 'paymentDate');
    if (paymentDate) details.paymentDate = paymentDate;

    // Extract gross amount from summary
    const invoiceGrossAmount = extractTag(decodedData, 'invoiceGrossAmount');
    if (invoiceGrossAmount) {
      details.invoiceGrossAmount = parseFloat(invoiceGrossAmount);
    }

    // Extract invoice line items
    details.lineItems = parseInvoiceLines(decodedData);

    // Detect cash accounting (pénzforgalmi elszámolás) — resilient, never fails
    // 1. Try: NAV API cashAccountingIndicator field
    try {
      const cashAccountingIndicator = extractTag(decodedData, 'cashAccountingIndicator');
      if (cashAccountingIndicator === 'true' || cashAccountingIndicator === 'CASH_ACCOUNTING') {
        details.isCashAccounting = true;
      }
    } catch { /* silent — fallback below */ }

    // 2. Fallback: text-based search in the decoded invoice XML
    if (!details.isCashAccounting) {
      try {
        const upperXml = decodedData.toUpperCase();
        if (upperXml.includes('PÉNZFORGALMI ELSZÁMOLÁS') ||
            upperXml.includes('PENZFORGALMI ELSZAMOLAS')) {
          details.isCashAccounting = true;
        }
      } catch { /* silent */ }
    }

    return details;
  } catch (error) {
    console.error('Error parsing invoice data:', error);
    return null;
  }
}

// Parse invoice line items from XML
function parseInvoiceLines(xml: string): InvoiceLineItem[] {
  const lineItems: InvoiceLineItem[] = [];
  
  // Find all line elements - NAV uses <line> tags within <invoiceLines>
  const lineRegex = /<line>[\s\S]*?<\/line>/gi;
  const lineMatches = xml.match(lineRegex);
  
  if (!lineMatches) {
    return lineItems;
  }

  lineMatches.forEach((lineXml, index) => {
    const item: InvoiceLineItem = {
      lineNumber: index + 1
    };

    // Extract line number from XML if available
    const lineNumberStr = extractTag(lineXml, 'lineNumber');
    if (lineNumberStr) {
      item.lineNumber = parseInt(lineNumberStr, 10);
    }

    // Extract line description (lineDescription or lineNatureIndicator or lineExpressionIndicator)
    const lineDescription = extractTag(lineXml, 'lineDescription') || 
                           extractTag(lineXml, 'lineNatureIndicator') ||
                           extractTag(lineXml, 'productFeeSummary');
    if (lineDescription) item.lineDescription = lineDescription;

    // Extract quantity
    const quantity = extractTag(lineXml, 'quantity');
    if (quantity) item.quantity = parseFloat(quantity);

    // Extract unit of measure
    const unitOfMeasure = extractTag(lineXml, 'unitOfMeasure') || extractTag(lineXml, 'unitOfMeasureOwn');
    if (unitOfMeasure) item.unitOfMeasure = unitOfMeasure;

    // Extract unit price
    const unitPrice = extractTag(lineXml, 'unitPrice') || extractTag(lineXml, 'unitPriceHUF');
    if (unitPrice) item.unitPrice = parseFloat(unitPrice);

    // Extract net amount
    const netAmount = extractTag(lineXml, 'lineNetAmount') || extractTag(lineXml, 'lineNetAmountData');
    if (netAmount) item.netAmount = parseFloat(netAmount);

    // Extract VAT rate
    const vatRate = extractTag(lineXml, 'vatPercentage') || extractTag(lineXml, 'vatRate') || extractTag(lineXml, 'vatExemption');
    if (vatRate) item.vatRate = vatRate;

    // Extract VAT amount
    const vatAmount = extractTag(lineXml, 'lineVatAmount') || extractTag(lineXml, 'lineVatAmountHUF');
    if (vatAmount) item.vatAmount = parseFloat(vatAmount);

    // Extract gross amount
    const grossAmount = extractTag(lineXml, 'lineGrossAmount') || extractTag(lineXml, 'lineGrossAmountData');
    if (grossAmount) item.grossAmount = parseFloat(grossAmount);

    // Extract product code
    const productCode = extractTag(lineXml, 'productCodeValue') || extractTag(lineXml, 'productCodeOwnValue');
    if (productCode) item.productCode = productCode;

    // Extract line delivery period (NAV v3.0: lineDeliveryDate or lineDeliveryPeriod)
    const periodFrom = extractTag(lineXml, 'lineDeliveryPeriodFrom') || extractTag(lineXml, 'deliveryPeriodFrom');
    const periodTo = extractTag(lineXml, 'lineDeliveryPeriodTo') || extractTag(lineXml, 'deliveryPeriodTo');
    if (periodFrom) item.lineDeliveryPeriodFrom = periodFrom;
    if (periodTo) item.lineDeliveryPeriodTo = periodTo;

    lineItems.push(item);
  });

  return lineItems;
}

// Build address string from XML address block
function buildAddressString(xml: string, addressTag: string): string {
  // Try to find the address block
  const addressBlockMatch = xml.match(new RegExp(`<${addressTag}[^>]*>([\\s\\S]*?)<\\/${addressTag}>`, 'i'));
  if (!addressBlockMatch) return '';

  const addressBlock = addressBlockMatch[1];

  // Try detailed address first
  const postalCode = extractTag(addressBlock, 'postalCode');
  const city = extractTag(addressBlock, 'city');
  const streetName = extractTag(addressBlock, 'streetName');
  const publicPlaceCategory = extractTag(addressBlock, 'publicPlaceCategory');
  const number = extractTag(addressBlock, 'number');

  if (postalCode && city) {
    let address = `${postalCode} ${city}`;
    if (streetName) {
      address += `, ${streetName}`;
      if (publicPlaceCategory) address += ` ${publicPlaceCategory}`;
      if (number) address += ` ${number}`;
    }
    return address;
  }

  // Try simple address
  const simpleAddress = extractTag(addressBlock, 'simpleAddress') || extractTag(addressBlock, 'additionalAddressDetail');
  if (simpleAddress) return simpleAddress;

  return '';
}

async function getNavToken(credentials: NavCredentials, navApiUrl: string): Promise<string> {
  const requestId = generateRequestId();
  const now = new Date();
  const timestamp = now.toISOString().replace(/\.\d{3}Z$/, 'Z');
  const compactTimestamp = getCompactTimestamp(now);

  const passwordHash = await sha512Hash(credentials.nav_password);
  const signatureInput = `${requestId}${compactTimestamp}${credentials.nav_sign_key}`;
  const signature = sha3Hash(signatureInput);

  const tokenXml = buildTokenXML(
    credentials.nav_username,
    passwordHash,
    credentials.nav_tax_number,
    signature,
    requestId,
    timestamp,
    credentials.software_id,
    credentials.software_dev_name || '',
    credentials.software_dev_contact || ''
  );

  const response = await fetch(`${navApiUrl}/tokenExchange`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/xml',
      'Accept': 'application/xml'
    },
    body: tokenXml
  });

  const responseText = await response.text();
  
  if (!response.ok) {
    // Parse NAV error details from response
    const errorCode = extractTag(responseText, 'funcCode') || extractTag(responseText, 'resultCode');
    const errorMessage = extractTag(responseText, 'message') || extractTag(responseText, 'errorDetail');
    console.error(`NAV token error response: ${responseText.substring(0, 500)}`);
    throw new Error(`NAV token request failed (${response.status}): ${errorCode || 'UNKNOWN'} - ${errorMessage || 'No details'}`);
  }

  // Handle both prefixed and non-prefixed token tag
  const tokenMatch = responseText.match(/<(?:\w+:)?encodedExchangeToken>([^<]+)<\/(?:\w+:)?encodedExchangeToken>/);

  if (!tokenMatch) {
    console.error(`NAV response without token: ${responseText.substring(0, 500)}`);
    throw new Error('Failed to extract token from NAV response');
  }

  return tokenMatch[1];
}

async function queryInvoiceDigest(
  credentials: NavCredentials,
  token: string,
  navApiUrl: string,
  direction: string,
  dateFrom: string,
  dateTo: string,
  page: number
): Promise<any[]> {
  const requestId = generateRequestId();
  const now = new Date();
  const timestamp = now.toISOString().replace(/\.\d{3}Z$/, 'Z');
  const compactTimestamp = getCompactTimestamp(now);

  const passwordHash = await sha512Hash(credentials.nav_password);
  const signatureInput = `${requestId}${compactTimestamp}${credentials.nav_sign_key}`;
  const signature = sha3Hash(signatureInput);

  const queryXml = buildQueryXML(
    credentials.nav_username,
    passwordHash,
    credentials.nav_tax_number,
    signature,
    requestId,
    timestamp,
    token,
    credentials.software_id,
    credentials.software_dev_name || '',
    credentials.software_dev_contact || '',
    direction,
    dateFrom,
    dateTo,
    page
  );

  const response = await fetch(`${navApiUrl}/queryInvoiceDigest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/xml',
      'Accept': 'application/xml'
    },
    body: queryXml
  });

  const responseText = await response.text();

  if (!response.ok) {
    const errorCode = extractTag(responseText, 'funcCode') || extractTag(responseText, 'resultCode');
    const errorMessage = extractTag(responseText, 'message') || extractTag(responseText, 'errorDetail');
    console.error(`NAV query error response: ${responseText.substring(0, 500)}`);
    throw new Error(`NAV query failed (${response.status}): ${errorCode || 'UNKNOWN'} - ${errorMessage || 'No details'}`);
  }

  return parseInvoicesFromXML(responseText);
}

function buildTokenXML(
  username: string,
  passwordHash: string,
  taxNumber: string,
  signature: string,
  requestId: string,
  timestamp: string,
  softwareId: string,
  devName: string,
  devContact: string
): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<TokenExchangeRequest xmlns="http://schemas.nav.gov.hu/OSA/3.0/api" xmlns:common="http://schemas.nav.gov.hu/NTCA/1.0/common">
  <common:header>
    <common:requestId>${requestId}</common:requestId>
    <common:timestamp>${timestamp}</common:timestamp>
    <common:requestVersion>3.0</common:requestVersion>
    <common:headerVersion>1.0</common:headerVersion>
  </common:header>
  <common:user>
    <common:login>${username}</common:login>
    <common:passwordHash cryptoType="SHA-512">${passwordHash}</common:passwordHash>
    <common:taxNumber>${taxNumber}</common:taxNumber>
    <common:requestSignature cryptoType="SHA3-512">${signature}</common:requestSignature>
  </common:user>
  <software>
    <softwareId>${softwareId}</softwareId>
    <softwareName>Visibill</softwareName>
    <softwareOperation>ONLINE_SERVICE</softwareOperation>
    <softwareMainVersion>1.0</softwareMainVersion>
    <softwareDevName>${devName || 'Visibill'}</softwareDevName>
    <softwareDevContact>${devContact || 'support@visibill.hu'}</softwareDevContact>
  </software>
</TokenExchangeRequest>`;
}

function buildQueryXML(
  username: string,
  passwordHash: string,
  taxNumber: string,
  signature: string,
  requestId: string,
  timestamp: string,
  token: string,
  softwareId: string,
  devName: string,
  devContact: string,
  direction: string,
  dateFrom: string,
  dateTo: string,
  page: number
): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<QueryInvoiceDigestRequest xmlns="http://schemas.nav.gov.hu/OSA/3.0/api" xmlns:common="http://schemas.nav.gov.hu/NTCA/1.0/common">
  <common:header>
    <common:requestId>${requestId}</common:requestId>
    <common:timestamp>${timestamp}</common:timestamp>
    <common:requestVersion>3.0</common:requestVersion>
    <common:headerVersion>1.0</common:headerVersion>
  </common:header>
  <common:user>
    <common:login>${username}</common:login>
    <common:passwordHash cryptoType="SHA-512">${passwordHash}</common:passwordHash>
    <common:taxNumber>${taxNumber}</common:taxNumber>
    <common:requestSignature cryptoType="SHA3-512">${signature}</common:requestSignature>
  </common:user>
  <software>
    <softwareId>${softwareId}</softwareId>
    <softwareName>Visibill</softwareName>
    <softwareOperation>ONLINE_SERVICE</softwareOperation>
    <softwareMainVersion>1.0</softwareMainVersion>
    <softwareDevName>${devName || 'Visibill'}</softwareDevName>
    <softwareDevContact>${devContact || 'support@visibill.hu'}</softwareDevContact>
  </software>
  <page>${page}</page>
  <invoiceDirection>${direction}</invoiceDirection>
  <invoiceQueryParams>
    <mandatoryQueryParams>
      <invoiceIssueDate>
        <dateFrom>${dateFrom}</dateFrom>
        <dateTo>${dateTo}</dateTo>
      </invoiceIssueDate>
    </mandatoryQueryParams>
  </invoiceQueryParams>
</QueryInvoiceDigestRequest>`;
}

function parseInvoicesFromXML(xml: string): any[] {
  const invoices: any[] = [];
  
  // Handle both prefixed and non-prefixed tags (e.g., <ns2:invoiceDigest> or <invoiceDigest>)
  const invoiceDigestRegex = /<(?:\w+:)?invoiceDigest>([\s\S]*?)<\/(?:\w+:)?invoiceDigest>/g;
  let match;

  while ((match = invoiceDigestRegex.exec(xml)) !== null) {
    const digest = match[1];
    
    const invoice: any = {
      invoiceNumber: extractTag(digest, 'invoiceNumber'),
      invoiceIssueDate: extractTag(digest, 'invoiceIssueDate'),
      invoiceDeliveryDate: extractTag(digest, 'invoiceDeliveryDate'),
      supplierTaxNumber: extractTag(digest, 'supplierTaxNumber'),
      supplierName: extractTag(digest, 'supplierName'),
      customerTaxNumber: extractTag(digest, 'customerTaxNumber'),
      customerName: extractTag(digest, 'customerName'),
      invoiceOperation: extractTag(digest, 'invoiceOperation'),
      invoiceNetAmount: parseFloat(extractTag(digest, 'invoiceNetAmount') || '0'),
      invoiceVatAmount: parseFloat(extractTag(digest, 'invoiceVatAmount') || '0'),
      paymentMethod: extractTag(digest, 'paymentMethod'),
      currency: extractTag(digest, 'currency') || 'HUF'
    };

    // Fallback: ha a gross 0 vagy hiányzik, számítsuk ki net + vat-ból
    const rawGrossAmount = parseFloat(extractTag(digest, 'invoiceGrossAmount') || '0');
    invoice.invoiceGrossAmount = rawGrossAmount > 0 ? rawGrossAmount : (invoice.invoiceNetAmount + invoice.invoiceVatAmount);

    invoices.push(invoice);
  }

  return invoices;
}

async function cachePartnersFromInvoices(
  supabase: any,
  userId: string,
  companyId: string,
  invoices: any[],
  direction: 'OUTBOUND' | 'INBOUND'
) {
  try {
    // Collect unique partners from invoices
    const partnersMap = new Map<string, { taxNumber: string; name: string; type: 'customer' | 'supplier' }>();

    for (const inv of invoices) {
      // For OUTBOUND invoices, the customer is the partner
      // For INBOUND invoices, the supplier is the partner
      if (direction === 'OUTBOUND' && inv.customerTaxNumber) {
        const taxNumber = inv.customerTaxNumber;
        if (!partnersMap.has(taxNumber) && inv.customerName) {
          partnersMap.set(taxNumber, {
            taxNumber,
            name: inv.customerName,
            type: 'customer'
          });
        }
      } else if (direction === 'INBOUND' && inv.supplierTaxNumber) {
        const taxNumber = inv.supplierTaxNumber;
        if (!partnersMap.has(taxNumber) && inv.supplierName) {
          partnersMap.set(taxNumber, {
            taxNumber,
            name: inv.supplierName,
            type: 'supplier'
          });
        }
      }
    }

    if (partnersMap.size === 0) {
      console.log('📋 No new partners to cache from NAV data');
      return;
    }

    // Fetch existing partners for prefix-based deduplication
    const { data: existingPartners } = await supabase
      .from('partners')
      .select('id, tax_number, partner_type, address')
      .eq('company_id', companyId);

    // Build prefix map: first 8 digits → existing partner record
    const prefixMap = new Map<string, { id: string; partner_type: string; address: string | null; tax_number: string }>();
    for (const p of (existingPartners || [])) {
      const digits = (p.tax_number || '').replace(/[^0-9]/g, '');
      if (digits.length >= 8) {
        prefixMap.set(digits.substring(0, 8), p);
      }
    }

    const trulyNew: Array<{ user_id: string; company_id: string; tax_number: string; name: string; partner_type: string }> = [];
    let updatedCount = 0;

    for (const p of partnersMap.values()) {
      const digits = p.taxNumber.replace(/[^0-9]/g, '');
      const prefix = digits.length >= 8 ? digits.substring(0, 8) : null;
      const existing = prefix ? prefixMap.get(prefix) : null;

      if (existing) {
        // Partner already exists by prefix — update address if null + auto-upgrade partner_type to 'both'
        const updates: Record<string, any> = {};
        if (!existing.address) {
          // No address update here (nav-auto-sync doesn't have address data)
        }
        if (existing.partner_type && existing.partner_type !== 'both' && existing.partner_type !== p.type) {
          updates.partner_type = 'both';
        }
        if (Object.keys(updates).length > 0) {
          await supabase.from('partners').update(updates).eq('id', existing.id);
          updatedCount++;
        }
      } else {
        // Truly new partner — queue for insert
        trulyNew.push({
          user_id: userId,
          company_id: companyId,
          tax_number: p.taxNumber,
          name: p.name,
          partner_type: p.type
        });
        // Register in prefix map to prevent duplicates within the same batch
        if (prefix) {
          prefixMap.set(prefix, { id: '', partner_type: p.type, address: null, tax_number: p.taxNumber });
        }
      }
    }

    // Batch insert truly new partners
    if (trulyNew.length > 0) {
      const { error: insertError } = await supabase.from('partners').insert(trulyNew);
      if (insertError) {
        console.error('Error inserting new partners:', insertError);
      }
    }

    console.log(`📋 Partners from ${direction}: ${trulyNew.length} new, ${updatedCount} updated, ${partnersMap.size - trulyNew.length - updatedCount} skipped`);
  } catch (error) {
    // Don't fail the sync if partner caching fails
    console.error('Error in partner caching:', error);
  }
}

function extractTag(xml: string, tagName: string): string {
  // Handle both prefixed and non-prefixed tags
  const regex = new RegExp(`<(?:\\w+:)?${tagName}>([^<]*)<\\/(?:\\w+:)?${tagName}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1] : '';
}

function generateRequestId(): string {
  return 'RID' + Date.now().toString() + Math.random().toString(36).substring(2, 15);
}

async function sha512Hash(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-512', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

function sha3Hash(input: string): string {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashArray = Array.from(sha3_512(data));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

function getCompactTimestamp(date: Date): string {
  return date.getUTCFullYear().toString()
    + (date.getUTCMonth() + 1).toString().padStart(2, '0')
    + date.getUTCDate().toString().padStart(2, '0')
    + date.getUTCHours().toString().padStart(2, '0')
    + date.getUTCMinutes().toString().padStart(2, '0')
    + date.getUTCSeconds().toString().padStart(2, '0');
}
