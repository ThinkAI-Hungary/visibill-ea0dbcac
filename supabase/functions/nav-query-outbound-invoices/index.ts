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
}

interface InvoiceDetails {
  supplierName?: string;
  supplierAddress?: string;
  customerName?: string;
  customerAddress?: string;
  paymentDate?: string;
  invoiceGrossAmount?: number;
  lineItems?: InvoiceLineItem[];
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[NAV-QUERY-OUTBOUND] Function started (v164 - removed exchangeToken from QueryInvoiceDigestRequest)');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await userClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[NAV-QUERY-OUTBOUND] User authenticated:', user.id);

    const { dateFrom, dateTo, additionalFilters, invoiceDirection = 'OUTBOUND', companyId } = await req.json();
    
    if (!dateFrom || !dateTo) {
      return new Response(
        JSON.stringify({ error: 'dateFrom and dateTo are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!companyId) {
      return new Response(
        JSON.stringify({ error: 'companyId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!['INBOUND', 'OUTBOUND'].includes(invoiceDirection)) {
      return new Response(
        JSON.stringify({ error: 'invoiceDirection must be INBOUND or OUTBOUND' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const fromDate = new Date(dateFrom);
    const toDate = new Date(dateTo);
    const daysDiff = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysDiff > 35) {
      return new Response(
        JSON.stringify({ error: 'Date range cannot exceed 35 days' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[NAV-QUERY-OUTBOUND] Date range:', { dateFrom, dateTo, daysDiff, companyId });

    const startTime = Date.now();

    const { data: logEntry, error: logError } = await serviceClient
      .from('nav_sync_logs')
      .insert({
        user_id: user.id,
        company_id: companyId,
        sync_type: 'manual',
        invoice_direction: invoiceDirection,
        date_from: dateFrom,
        date_to: dateTo,
        status: 'running',
        started_at: new Date().toISOString()
      })
      .select()
      .single();

    if (logError) {
      console.error('[NAV-QUERY-OUTBOUND] Failed to create sync log:', logError);
    }

    const syncLogId = logEntry?.id;

    const { data: credsData, error: credsError } = await serviceClient
      .from('user_nav_credentials')
      .select('*')
      .eq('company_id', companyId)
      .single();

    if (credsError || !credsData) {
      console.error('[NAV-QUERY-OUTBOUND] Failed to get credentials:', credsError);
      if (syncLogId) {
        await serviceClient.from('nav_sync_logs').update({
          status: 'failed',
          error_message: 'Failed to retrieve NAV credentials for company',
          completed_at: new Date().toISOString(),
          duration_ms: Date.now() - startTime
        }).eq('id', syncLogId);
      }
      return new Response(
        JSON.stringify({ error: 'Failed to retrieve NAV credentials for company' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: decryptedCreds, error: decryptError } = await serviceClient.rpc('get_nav_credentials', {
      p_user_id: user.id,
      p_company_id: companyId
    });

    if (decryptError || !decryptedCreds || decryptedCreds.error) {
      console.error('[NAV-QUERY-OUTBOUND] Failed to decrypt credentials:', decryptError || decryptedCreds?.error);
      if (syncLogId) {
        await serviceClient.from('nav_sync_logs').update({
          status: 'failed',
          error_message: 'Failed to decrypt NAV credentials',
          completed_at: new Date().toISOString(),
          duration_ms: Date.now() - startTime
        }).eq('id', syncLogId);
      }
      return new Response(
        JSON.stringify({ error: 'Failed to decrypt NAV credentials' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const credentials: NavCredentials = decryptedCreds;
    console.log('[NAV-QUERY-OUTBOUND] Credentials retrieved, tax:', credentials.nav_tax_number);

    const navApiUrl = 'https://api.onlineszamla.nav.gov.hu/invoiceService/v3';
    const endpoint = `${navApiUrl}/queryInvoiceDigest`;

    // NOTE: In NAV v3.0, QueryInvoiceDigestRequest does NOT use exchangeToken.
    // Authentication is done via user block with passwordHash and requestSignature.
    // The tokenExchange endpoint is only needed for operations that require it.

    const allInvoices: any[] = [];
    let currentPage = 1;
    let availablePage = 1;
    const maxPages = 3;

    while (currentPage <= maxPages && currentPage <= availablePage) {
      console.log(`[NAV-QUERY-OUTBOUND] Fetching page ${currentPage}/${availablePage}`);

      const requestId = generateRequestId();
      const now = new Date();
      const timestamp = now.toISOString().replace(/\.\d{3}Z$/, 'Z');
      const compactTimestamp = getCompactTimestamp(now);

      const passwordHash = await sha512Hash(credentials.nav_password);
      const signatureInput = requestId + compactTimestamp + credentials.nav_sign_key;
      const encoder = new TextEncoder();
      const data = encoder.encode(signatureInput);
      const hash = sha3_512(data);
      const requestSignature = Array.from(hash)
        .map((b: any) => b.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase();

      const xmlBody = buildQueryXML({
        requestId,
        timestamp,
        credentials,
        passwordHash,
        requestSignature,
        page: currentPage,
        dateFrom,
        dateTo,
        additionalFilters,
        invoiceDirection
      });

      console.log('[NAV-QUERY-OUTBOUND] Sending queryInvoiceDigest, requestId:', requestId);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/xml; charset=UTF-8',
          'Accept': 'application/xml'
        },
        body: xmlBody
      });

      const responseText = await response.text();
      
      console.log('[NAV-QUERY-OUTBOUND] HTTP Status:', response.status);

      if (!response.ok) {
        console.error('[NAV-QUERY-OUTBOUND] NAV API error:', responseText);
        const errorMsg = parseNAVError(responseText);
        
        if (syncLogId) {
          await serviceClient.from('nav_sync_logs').update({
            status: 'failed',
            error_message: `NAV API request failed (HTTP ${response.status}): ${errorMsg} | RAW: ${responseText.substring(0, 2000)}`,
            completed_at: new Date().toISOString(),
            duration_ms: Date.now() - startTime
          }).eq('id', syncLogId);
        }
        
        return new Response(
          JSON.stringify({ 
            error: 'NAV API request failed',
            details: errorMsg,
            rawResponse: responseText.substring(0, 1000),
            httpStatus: response.status,
            page: currentPage
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const pageData = parseQueryResponse(responseText);
      
      if (pageData.funcCode !== 'OK') {
        console.error('[NAV-QUERY-OUTBOUND] NAV returned error:', pageData.errorMessage);
        if (syncLogId) {
          await serviceClient.from('nav_sync_logs').update({
            status: 'failed',
            error_message: `NAV query failed: ${pageData.errorMessage}`,
            completed_at: new Date().toISOString(),
            duration_ms: Date.now() - startTime
          }).eq('id', syncLogId);
        }
        return new Response(
          JSON.stringify({ error: 'NAV query failed', details: pageData.errorMessage, page: currentPage }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      availablePage = pageData.availablePage || 1;
      
      if (pageData.invoices && pageData.invoices.length > 0) {
        allInvoices.push(...pageData.invoices);
        console.log(`[NAV-QUERY-OUTBOUND] Page ${currentPage}: ${pageData.invoices.length} invoices`);
      }

      currentPage++;
    }

    console.log(`[NAV-QUERY-OUTBOUND] Query complete. Total invoices: ${allInvoices.length}, Pages fetched: ${currentPage - 1}`);

    if (allInvoices.length > 0) {
      const invoicesToInsert = allInvoices.map(inv => ({
        user_id: user.id,
        company_id: companyId,
        invoice_number: inv.invoiceNumber,
        invoice_direction: invoiceDirection,
        supplier_tax_number: inv.supplierTaxNumber,
        customer_tax_number: inv.customerTaxNumber,
        invoice_issue_date: inv.invoiceIssueDate,
        invoice_delivery_date: null,
        invoice_net_amount: parseFloat(inv.invoiceNetAmount || '0'),
        invoice_vat_amount: parseFloat(inv.invoiceVatAmount || '0'),
        invoice_gross_amount: parseFloat(inv.invoiceNetAmount || '0') + parseFloat(inv.invoiceVatAmount || '0'),
        currency: inv.currency || 'HUF',
        payment_method: inv.paymentMethod,
        invoice_operation: inv.invoiceOperation,
        fetched_at: new Date().toISOString(),
        supplier_name: inv.supplierName || null,
        customer_name: inv.customerName || null
      }));

      const { error: insertError } = await serviceClient
        .from('nav_invoices')
        .upsert(invoicesToInsert, { onConflict: 'company_id,invoice_number', ignoreDuplicates: false });

      if (insertError) {
        console.error('[NAV-QUERY-OUTBOUND] Failed to store invoices:', insertError);
        if (syncLogId) {
          await serviceClient.from('nav_sync_logs').update({
            status: 'failed',
            error_message: `Failed to store invoices: ${insertError.message}`,
            invoices_fetched: allInvoices.length,
            completed_at: new Date().toISOString(),
            duration_ms: Date.now() - startTime
          }).eq('id', syncLogId);
        }
        return new Response(
          JSON.stringify({ error: 'Failed to store invoices', details: insertError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('[NAV-QUERY-OUTBOUND] Invoices stored successfully');
      await cachePartnersFromInvoices(serviceClient, user.id, companyId, allInvoices, invoiceDirection);
    }

    console.log('[NAV-QUERY-OUTBOUND] Fetching detailed invoice data...');
    const detailsFetchedCount = await fetchInvoiceDetails(
      serviceClient, user.id, companyId, credentials, navApiUrl, invoiceDirection
    );
    console.log(`[NAV-QUERY-OUTBOUND] Fetched details for ${detailsFetchedCount} invoices`);

    if (detailsFetchedCount > 0) {
      await updatePartnerAddresses(serviceClient, companyId);
    }

    if (syncLogId) {
      await serviceClient.from('nav_sync_logs').update({
        status: 'completed',
        invoices_fetched: allInvoices.length,
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - startTime
      }).eq('id', syncLogId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        invoices: allInvoices,
        totalInvoices: allInvoices.length,
        pagesFetched: currentPage - 1,
        totalPagesAvailable: availablePage,
        detailsFetched: detailsFetchedCount
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[NAV-QUERY-OUTBOUND] Unexpected error:', error);
    
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const authHeader = req.headers.get('Authorization');
      
      if (authHeader) {
        const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
          global: { headers: { Authorization: authHeader } }
        });
        const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
        const token = authHeader.replace('Bearer ', '');
        const { data: { user } } = await userClient.auth.getUser(token);
        
        if (user) {
          const { data: runningLogs } = await serviceClient
            .from('nav_sync_logs')
            .select('id')
            .eq('user_id', user.id)
            .eq('status', 'running')
            .order('started_at', { ascending: false })
            .limit(1);
          
          if (runningLogs && runningLogs.length > 0) {
            await serviceClient.from('nav_sync_logs').update({
              status: 'failed',
              error_message: `Unexpected error: ${error.message}`,
              completed_at: new Date().toISOString()
            }).eq('id', runningLogs[0].id);
          }
        }
      }
    } catch (logError) {
      console.error('[NAV-QUERY-OUTBOUND] Failed to update error log:', logError);
    }
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function fetchInvoiceDetails(
  supabase: any, userId: string, companyId: string,
  credentials: NavCredentials, navApiUrl: string, direction: string
): Promise<number> {
  const { data: invoicesNeedingDetails, error: fetchError } = await supabase
    .from('nav_invoices')
    .select('id, invoice_number')
    .eq('user_id', userId)
    .eq('company_id', companyId)
    .eq('invoice_direction', direction)
    .or('details_fetched.is.null,details_fetched.eq.false');

  if (fetchError) { console.error('[NAV-QUERY-OUTBOUND] Error fetching invoices needing details:', fetchError); return 0; }
  if (!invoicesNeedingDetails || invoicesNeedingDetails.length === 0) { return 0; }

  console.log(`[NAV-QUERY-OUTBOUND] Fetching details for ${invoicesNeedingDetails.length} ${direction} invoices`);
  let successCount = 0;
  const batchSize = 3;
  
  for (let i = 0; i < invoicesNeedingDetails.length; i += batchSize) {
    const batch = invoicesNeedingDetails.slice(i, i + batchSize);
    const batchPromises = batch.map(async (invoice: any) => {
      try {
        const details = await queryInvoiceData(credentials, navApiUrl, invoice.invoice_number, direction);
        if (details) {
          const updateData: any = { details_fetched: true };
          if (details.supplierName) updateData.supplier_name = details.supplierName;
          if (details.supplierAddress) updateData.supplier_address = details.supplierAddress;
          if (details.customerName) updateData.customer_name = details.customerName;
          if (details.customerAddress) updateData.customer_address = details.customerAddress;
          if (details.paymentDate) updateData.payment_date = details.paymentDate;
          if (details.invoiceGrossAmount && details.invoiceGrossAmount > 0) {
            updateData.invoice_gross_amount = details.invoiceGrossAmount;
          }
          const { error: updateError } = await supabase.from('nav_invoices').update(updateData).eq('id', invoice.id);
          if (updateError) {
            console.error(`[NAV-QUERY-OUTBOUND] Error updating invoice ${invoice.invoice_number}:`, updateError);
          } else {
            if (details.lineItems && details.lineItems.length > 0) {
              await supabase.from('nav_invoice_items').delete().eq('nav_invoice_id', invoice.id);
              const lineItemsToInsert = details.lineItems.map(item => ({
                nav_invoice_id: invoice.id, line_number: item.lineNumber,
                line_description: item.lineDescription, quantity: item.quantity,
                unit_of_measure: item.unitOfMeasure, unit_price: item.unitPrice,
                net_amount: item.netAmount, vat_rate: item.vatRate,
                vat_amount: item.vatAmount, gross_amount: item.grossAmount,
                product_code: item.productCode
              }));
              const { error: itemsError } = await supabase.from('nav_invoice_items').insert(lineItemsToInsert);
              if (itemsError) console.error(`[NAV-QUERY-OUTBOUND] Error inserting line items for ${invoice.invoice_number}:`, itemsError);
            }
            successCount++;
          }
        }
      } catch (error: any) {
        console.error(`[NAV-QUERY-OUTBOUND] Error fetching details for ${invoice.invoice_number}:`, error.message);
        await supabase.from('nav_invoices').update({ details_fetched: true }).eq('id', invoice.id);
      }
    });
    await Promise.all(batchPromises);
    if (i + batchSize < invoicesNeedingDetails.length) await delay(500);
  }
  return successCount;
}

async function queryInvoiceData(
  credentials: NavCredentials, navApiUrl: string, invoiceNumber: string,
  direction: string
): Promise<InvoiceDetails | null> {
  const requestId = generateRequestId();
  const now = new Date();
  const timestamp = now.toISOString().replace(/\.\d{3}Z$/, 'Z');
  const compactTimestamp = getCompactTimestamp(now);
  const passwordHash = await sha512Hash(credentials.nav_password);
  const signatureInput = `${requestId}${compactTimestamp}${credentials.nav_sign_key}`;
  const signature = sha3Hash(signatureInput);

  const queryXml = `<?xml version="1.0" encoding="UTF-8"?>
<QueryInvoiceDataRequest xmlns="http://schemas.nav.gov.hu/OSA/3.0/api" xmlns:common="http://schemas.nav.gov.hu/NTCA/1.0/common">
  <common:header>
    <common:requestId>${requestId}</common:requestId>
    <common:timestamp>${timestamp}</common:timestamp>
    <common:requestVersion>3.0</common:requestVersion>
    <common:headerVersion>1.0</common:headerVersion>
  </common:header>
  <common:user>
    <common:login>${credentials.nav_username}</common:login>
    <common:passwordHash cryptoType="SHA-512">${passwordHash}</common:passwordHash>
    <common:taxNumber>${credentials.nav_tax_number}</common:taxNumber>
    <common:requestSignature cryptoType="SHA3-512">${signature}</common:requestSignature>
  </common:user>
  <software>
    <softwareId>${credentials.software_id}</softwareId>
    <softwareName>Visibill</softwareName>
    <softwareOperation>ONLINE_SERVICE</softwareOperation>
    <softwareMainVersion>1.0</softwareMainVersion>
    <softwareDevName>${credentials.software_dev_name || 'Visibill'}</softwareDevName>
    <softwareDevContact>${credentials.software_dev_contact || 'support@visibill.hu'}</softwareDevContact>
  </software>
  <invoiceNumberQuery>
    <invoiceNumber>${invoiceNumber}</invoiceNumber>
    <invoiceDirection>${direction}</invoiceDirection>
  </invoiceNumberQuery>
</QueryInvoiceDataRequest>`;

  const response = await fetch(`${navApiUrl}/queryInvoiceData`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/xml; charset=UTF-8', 'Accept': 'application/xml' },
    body: queryXml
  });
  const responseText = await response.text();
  if (!response.ok) {
    const errorCode = extractTag(responseText, 'funcCode') || extractTag(responseText, 'resultCode');
    const errorMessage = extractTag(responseText, 'message') || extractTag(responseText, 'errorDetail');
    console.error(`[NAV-QUERY-OUTBOUND] queryInvoiceData error for ${invoiceNumber}: ${errorCode} - ${errorMessage}`);
    throw new Error(`NAV queryInvoiceData failed: ${errorCode || 'UNKNOWN'} - ${errorMessage || 'No details'}`);
  }
  return parseInvoiceDataFromXML(responseText);
}

function parseInvoiceDataFromXML(xml: string): InvoiceDetails | null {
  const invoiceDataMatch = xml.match(/<(?:\w+:)?invoiceData>([^<]+)<\/(?:\w+:)?invoiceData>/);
  if (!invoiceDataMatch) { return null; }
  try {
    const base64Data = invoiceDataMatch[1];
    const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    const decodedData = new TextDecoder('utf-8').decode(binaryData);
    const details: InvoiceDetails = {};
    const supplierName = extractTag(decodedData, 'supplierName');
    if (supplierName) details.supplierName = supplierName;
    const supplierAddress = buildAddressString(decodedData, 'supplierAddress');
    if (supplierAddress) details.supplierAddress = supplierAddress;
    const customerName = extractTag(decodedData, 'customerName');
    if (customerName) details.customerName = customerName;
    const customerAddress = buildAddressString(decodedData, 'customerAddress');
    if (customerAddress) details.customerAddress = customerAddress;
    const paymentDate = extractTag(decodedData, 'paymentDate');
    if (paymentDate) details.paymentDate = paymentDate;
    const invoiceGrossAmount = extractTag(decodedData, 'invoiceGrossAmount');
    if (invoiceGrossAmount) details.invoiceGrossAmount = parseFloat(invoiceGrossAmount);
    details.lineItems = parseInvoiceLines(decodedData);
    return details;
  } catch (error) {
    console.error('[NAV-QUERY-OUTBOUND] Error parsing invoice data:', error);
    return null;
  }
}

function parseInvoiceLines(xml: string): InvoiceLineItem[] {
  const lineItems: InvoiceLineItem[] = [];
  const lineRegex = /<line>[\s\S]*?<\/line>/gi;
  const lineMatches = xml.match(lineRegex);
  if (!lineMatches) return lineItems;
  lineMatches.forEach((lineXml, index) => {
    const item: InvoiceLineItem = { lineNumber: index + 1 };
    const lineNumberStr = extractTag(lineXml, 'lineNumber');
    if (lineNumberStr) item.lineNumber = parseInt(lineNumberStr, 10);
    const lineDescription = extractTag(lineXml, 'lineDescription') || extractTag(lineXml, 'lineNatureIndicator');
    if (lineDescription) item.lineDescription = lineDescription;
    const quantity = extractTag(lineXml, 'quantity');
    if (quantity) item.quantity = parseFloat(quantity);
    const unitOfMeasure = extractTag(lineXml, 'unitOfMeasure') || extractTag(lineXml, 'unitOfMeasureOwn');
    if (unitOfMeasure) item.unitOfMeasure = unitOfMeasure;
    const unitPrice = extractTag(lineXml, 'unitPrice') || extractTag(lineXml, 'unitPriceHUF');
    if (unitPrice) item.unitPrice = parseFloat(unitPrice);
    const netAmount = extractTag(lineXml, 'lineNetAmount') || extractTag(lineXml, 'lineNetAmountData');
    if (netAmount) item.netAmount = parseFloat(netAmount);
    const vatRate = extractTag(lineXml, 'vatPercentage') || extractTag(lineXml, 'vatRate') || extractTag(lineXml, 'vatExemption');
    if (vatRate) item.vatRate = vatRate;
    const vatAmount = extractTag(lineXml, 'lineVatAmount') || extractTag(lineXml, 'lineVatAmountHUF');
    if (vatAmount) item.vatAmount = parseFloat(vatAmount);
    const grossAmount = extractTag(lineXml, 'lineGrossAmount') || extractTag(lineXml, 'lineGrossAmountData');
    if (grossAmount) item.grossAmount = parseFloat(grossAmount);
    const productCode = extractTag(lineXml, 'productCodeValue') || extractTag(lineXml, 'productCodeOwnValue');
    if (productCode) item.productCode = productCode;
    lineItems.push(item);
  });
  return lineItems;
}

function buildAddressString(xml: string, addressTag: string): string {
  const addressBlockMatch = xml.match(new RegExp(`<${addressTag}[^>]*>([\\s\\S]*?)<\\/${addressTag}>`, 'i'));
  if (!addressBlockMatch) return '';
  const addressBlock = addressBlockMatch[1];
  const postalCode = extractTag(addressBlock, 'postalCode');
  const city = extractTag(addressBlock, 'city');
  const streetName = extractTag(addressBlock, 'streetName');
  const publicPlaceCategory = extractTag(addressBlock, 'publicPlaceCategory');
  const number = extractTag(addressBlock, 'number');
  if (postalCode && city) {
    let address = `${postalCode} ${city}`;
    if (streetName) { address += `, ${streetName}`; if (publicPlaceCategory) address += ` ${publicPlaceCategory}`; if (number) address += ` ${number}`; }
    return address;
  }
  const simpleAddress = extractTag(addressBlock, 'simpleAddress') || extractTag(addressBlock, 'additionalAddressDetail');
  if (simpleAddress) return simpleAddress;
  return '';
}

function extractTag(xml: string, tagName: string): string {
  const regex = new RegExp(`<(?:\\w+:)?${tagName}>([^<]*)<\\/(?:\\w+:)?${tagName}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1] : '';
}

function generateRequestId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'RID';
  for (let i = 0; i < 27; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function getCompactTimestamp(date: Date): string {
  return date.getUTCFullYear().toString()
    + (date.getUTCMonth() + 1).toString().padStart(2, '0')
    + date.getUTCDate().toString().padStart(2, '0')
    + date.getUTCHours().toString().padStart(2, '0')
    + date.getUTCMinutes().toString().padStart(2, '0')
    + date.getUTCSeconds().toString().padStart(2, '0');
}

function sha3Hash(input: string): string {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashArray = Array.from(sha3_512(data));
  return hashArray.map((b: any) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

async function sha512Hash(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-512', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b: any) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

// buildQueryXML - NAV v3.0 QueryInvoiceDigestRequest
// NOTE: No exchangeToken - it is NOT part of the v3.0 XSD schema
// Element order must match XSD: header, user, software, page, invoiceDirection, invoiceQueryParams
function buildQueryXML(params: {
  requestId: string; timestamp: string; credentials: NavCredentials;
  passwordHash: string; requestSignature: string;
  page: number; dateFrom: string; dateTo: string; additionalFilters?: any;
  invoiceDirection: string;
}): string {
  const { requestId, timestamp, credentials, passwordHash, requestSignature, page, dateFrom, dateTo, additionalFilters, invoiceDirection } = params;

  let additionalParamsXML = '';
  if (additionalFilters) {
    additionalParamsXML = '<additionalQueryParams>';
    if (additionalFilters.currency) additionalParamsXML += `<currency>${additionalFilters.currency}</currency>`;
    if (additionalFilters.taxNumber) additionalParamsXML += `<taxNumber>${additionalFilters.taxNumber}</taxNumber>`;
    additionalParamsXML += '</additionalQueryParams>';
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<QueryInvoiceDigestRequest xmlns="http://schemas.nav.gov.hu/OSA/3.0/api" xmlns:common="http://schemas.nav.gov.hu/NTCA/1.0/common">
  <common:header>
    <common:requestId>${requestId}</common:requestId>
    <common:timestamp>${timestamp}</common:timestamp>
    <common:requestVersion>3.0</common:requestVersion>
    <common:headerVersion>1.0</common:headerVersion>
  </common:header>
  <common:user>
    <common:login>${credentials.nav_username}</common:login>
    <common:passwordHash cryptoType="SHA-512">${passwordHash}</common:passwordHash>
    <common:taxNumber>${credentials.nav_tax_number}</common:taxNumber>
    <common:requestSignature cryptoType="SHA3-512">${requestSignature}</common:requestSignature>
  </common:user>
  <software>
    <softwareId>${credentials.software_id}</softwareId>
    <softwareName>Visibill</softwareName>
    <softwareOperation>ONLINE_SERVICE</softwareOperation>
    <softwareMainVersion>1.0</softwareMainVersion>
    <softwareDevName>${credentials.software_dev_name || 'Visibill'}</softwareDevName>
    <softwareDevContact>${credentials.software_dev_contact || 'support@visibill.hu'}</softwareDevContact>
  </software>
  <page>${page}</page>
  <invoiceDirection>${invoiceDirection}</invoiceDirection>
  <invoiceQueryParams>
    <mandatoryQueryParams>
      <invoiceIssueDate>
        <dateFrom>${dateFrom}</dateFrom>
        <dateTo>${dateTo}</dateTo>
      </invoiceIssueDate>
    </mandatoryQueryParams>
    ${additionalParamsXML}
  </invoiceQueryParams>
</QueryInvoiceDigestRequest>`;
}

function parseQueryResponse(xml: string): any {
  const funcCodeMatch = xml.match(/<(?:\w+:)?funcCode>([^<]+)<\/(?:\w+:)?funcCode>/);
  const funcCode = funcCodeMatch ? funcCodeMatch[1] : null;
  if (funcCode !== 'OK') {
    const errorMessage = parseNAVError(xml);
    return { funcCode, errorMessage };
  }
  const currentPageMatch = xml.match(/<(?:\w+:)?currentPage>(\d+)<\/(?:\w+:)?currentPage>/);
  const availablePageMatch = xml.match(/<(?:\w+:)?availablePage>(\d+)<\/(?:\w+:)?availablePage>/);
  const currentPage = currentPageMatch ? parseInt(currentPageMatch[1]) : 1;
  const availablePage = availablePageMatch ? parseInt(availablePageMatch[1]) : 1;
  const invoices: any[] = [];
  const invoiceDigestRegex = /<(?:\w+:)?invoiceDigest>([\s\S]*?)<\/(?:\w+:)?invoiceDigest>/g;
  let match;
  while ((match = invoiceDigestRegex.exec(xml)) !== null) {
    const digestXML = match[1];
    const invoice: any = {};
    const extractField = (fieldName: string) => {
      const regex = new RegExp(`<(?:\\w+:)?${fieldName}>([^<]*)<\\/(?:\\w+:)?${fieldName}>`);
      const match = digestXML.match(regex);
      return match ? match[1] : null;
    };
    invoice.invoiceNumber = extractField('invoiceNumber');
    invoice.invoiceOperation = extractField('invoiceOperation');
    invoice.invoiceCategory = extractField('invoiceCategory');
    invoice.invoiceIssueDate = extractField('invoiceIssueDate');
    invoice.supplierTaxNumber = extractField('supplierTaxNumber');
    invoice.supplierName = extractField('supplierName');
    invoice.customerTaxNumber = extractField('customerTaxNumber');
    invoice.customerName = extractField('customerName');
    invoice.paymentMethod = extractField('paymentMethod');
    invoice.invoiceAppearance = extractField('invoiceAppearance');
    invoice.currency = extractField('currency');
    invoice.invoiceNetAmount = extractField('invoiceNetAmount');
    invoice.invoiceNetAmountHUF = extractField('invoiceNetAmountHUF');
    invoice.invoiceVatAmount = extractField('invoiceVatAmount');
    invoice.invoiceVatAmountHUF = extractField('invoiceVatAmountHUF');
    invoice.transactionId = extractField('transactionId');
    invoice.index = extractField('index');
    invoice.insDate = extractField('insDate');
    invoices.push(invoice);
  }
  return { funcCode, currentPage, availablePage, invoices };
}

function parseNAVError(xml: string): string {
  const errorCodeMatch = xml.match(/<errorCode>([^<]+)<\/errorCode>/);
  const messageMatch = xml.match(/<message>([^<]+)<\/message>/);
  const funcCodeMatch = xml.match(/<funcCode>([^<]+)<\/funcCode>/);
  const resultCodeMatch = xml.match(/<resultCode>([^<]+)<\/resultCode>/);
  const errorDetailMatch = xml.match(/<errorDetail>([^<]+)<\/errorDetail>/);
  const errorCode = errorCodeMatch?.[1] || funcCodeMatch?.[1] || resultCodeMatch?.[1] || 'UNKNOWN';
  const message = messageMatch?.[1] || errorDetailMatch?.[1] || 'No error message';
  return `${errorCode}: ${message}`;
}

async function cachePartnersFromInvoices(
  supabase: any, userId: string, companyId: string, invoices: any[],
  direction: 'OUTBOUND' | 'INBOUND'
) {
  try {
    const partnersMap = new Map<string, { taxNumber: string; name: string; type: 'customer' | 'supplier' }>();
    for (const inv of invoices) {
      if (direction === 'OUTBOUND' && inv.customerTaxNumber) {
        if (!partnersMap.has(inv.customerTaxNumber) && inv.customerName) {
          partnersMap.set(inv.customerTaxNumber, { taxNumber: inv.customerTaxNumber, name: inv.customerName, type: 'customer' });
        }
      } else if (direction === 'INBOUND' && inv.supplierTaxNumber) {
        if (!partnersMap.has(inv.supplierTaxNumber) && inv.supplierName) {
          partnersMap.set(inv.supplierTaxNumber, { taxNumber: inv.supplierTaxNumber, name: inv.supplierName, type: 'supplier' });
        }
      }
    }
    if (partnersMap.size === 0) return;
    const taxNumbers = Array.from(partnersMap.keys());
    const addressField = direction === 'OUTBOUND' ? 'customer_address' : 'supplier_address';
    const taxField = direction === 'OUTBOUND' ? 'customer_tax_number' : 'supplier_tax_number';
    const { data: invoicesWithAddresses } = await supabase.from('nav_invoices')
      .select(`${taxField}, ${addressField}`).eq('company_id', companyId)
      .in(taxField, taxNumbers).not(addressField, 'is', null);
    const addressMap = new Map<string, string>();
    if (invoicesWithAddresses) {
      for (const inv of invoicesWithAddresses) {
        const taxNum = inv[taxField]; const address = inv[addressField];
        if (taxNum && address && !addressMap.has(taxNum)) addressMap.set(taxNum, address);
      }
    }
    const partnersToUpsert = Array.from(partnersMap.values()).map(p => ({
      user_id: userId, company_id: companyId, tax_number: p.taxNumber,
      name: p.name, partner_type: p.type, address: addressMap.get(p.taxNumber) || null
    }));
    const { error: partnerError } = await supabase.from('partners')
      .upsert(partnersToUpsert, { onConflict: 'company_id,tax_number', ignoreDuplicates: false });
    if (partnerError) console.error('[NAV-QUERY-OUTBOUND] Error caching partners:', partnerError);
    else console.log(`[NAV-QUERY-OUTBOUND] Cached ${partnersMap.size} partners`);
  } catch (error) {
    console.error('[NAV-QUERY-OUTBOUND] Error in partner caching:', error);
  }
}

async function updatePartnerAddresses(supabase: any, companyId: string) {
  try {
    const { data: invoicesWithAddresses, error: fetchError } = await supabase.from('nav_invoices')
      .select('supplier_tax_number, supplier_address, customer_tax_number, customer_address')
      .eq('company_id', companyId)
      .or('supplier_address.not.is.null,customer_address.not.is.null');
    if (fetchError || !invoicesWithAddresses) return;
    const supplierAddresses = new Map<string, string>();
    const customerAddresses = new Map<string, string>();
    for (const inv of invoicesWithAddresses) {
      if (inv.supplier_tax_number && inv.supplier_address)
        supplierAddresses.set(inv.supplier_tax_number, inv.supplier_address);
      if (inv.customer_tax_number && inv.customer_address)
        customerAddresses.set(inv.customer_tax_number, inv.customer_address);
    }
    for (const [taxNumber, address] of supplierAddresses) {
      await supabase.from('partners').update({ address })
        .eq('company_id', companyId).eq('tax_number', taxNumber).is('address', null);
    }
    for (const [taxNumber, address] of customerAddresses) {
      await supabase.from('partners').update({ address })
        .eq('company_id', companyId).eq('tax_number', taxNumber).is('address', null);
    }
  } catch (error) {
    console.error('[NAV-QUERY-OUTBOUND] Error updating partner addresses:', error);
  }
}
