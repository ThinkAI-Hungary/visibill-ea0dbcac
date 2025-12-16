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

// Rate limiting helper
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🤖 Starting automatic NAV synchronization');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Create admin client with service role
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Get all companies with validated NAV credentials
    const { data: companiesWithCreds, error: companiesError } = await supabase
      .from('user_nav_credentials')
      .select('user_id, company_id, nav_username')
      .eq('validation_status', 'valid')
      .not('company_id', 'is', null);

    if (companiesError) {
      console.error('Error fetching companies with credentials:', companiesError);
      throw new Error(`Failed to fetch companies: ${companiesError.message}`);
    }

    if (!companiesWithCreds || companiesWithCreds.length === 0) {
      console.log('ℹ️ No companies with valid NAV credentials found');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No companies to sync',
          companies_processed: 0 
        }),
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

    // Calculate date range (last 30 days)
    const dateTo = new Date();
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - 30);

    const dateToStr = dateTo.toISOString().split('T')[0];
    const dateFromStr = dateFrom.toISOString().split('T')[0];

    // Process each company with rate limiting
    for (const company of companiesWithCreds) {
      console.log(`\n👤 Processing company: ${company.company_id} (user: ${company.user_id})`);

      try {
        // Get credentials via RPC - pass company_id for multi-tenant lookup
        const { data: credsData, error: credsError } = await supabase.rpc('get_nav_credentials', {
          p_user_id: company.user_id,
          p_company_id: company.company_id
        });

        if (credsError || !credsData) {
          throw new Error(`Failed to get credentials: ${credsError?.message || 'No data'}`);
        }

        // Check if credentials lookup returned an error
        if (credsData.error) {
          throw new Error(`Credentials lookup failed: ${credsData.error}`);
        }

        const credentials = credsData as NavCredentials;

        // Sync OUTBOUND invoices
        await syncInvoices(supabase, company.user_id, company.company_id, credentials, 'OUTBOUND', dateFromStr, dateToStr);
        console.log(`✅ OUTBOUND sync completed for company ${company.company_id}`);

        // Sync INBOUND invoices
        await syncInvoices(supabase, company.user_id, company.company_id, credentials, 'INBOUND', dateFromStr, dateToStr);
        console.log(`✅ INBOUND sync completed for company ${company.company_id}`);

        results.successful++;
        results.details.push({
          company_id: company.company_id,
          user_id: company.user_id,
          username: company.nav_username,
          status: 'success'
        });

      } catch (error) {
        console.error(`❌ Error syncing company ${company.company_id}:`, error);
        results.failed++;
        results.details.push({
          company_id: company.company_id,
          user_id: company.user_id,
          username: company.nav_username,
          status: 'failed',
          error: error.message
        });
      }

      // Rate limiting: 200ms delay between companies (max 5/second)
      await delay(200);
    }

    console.log('\n📈 Sync Summary:', results);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Automatic sync completed',
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('💥 Unexpected error during automatic sync:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

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

    // Query invoices (fetch up to 3 pages)
    let allInvoices: any[] = [];
    let currentPage = 1;
    const maxPages = 3;

    while (currentPage <= maxPages) {
      const invoices = await queryInvoiceDigest(
        credentials,
        token,
        navApiUrl,
        direction,
        dateFrom,
        dateTo,
        currentPage
      );

      if (!invoices || invoices.length === 0) {
        break;
      }

      allInvoices = [...allInvoices, ...invoices];
      console.log(`📄 Fetched page ${currentPage}: ${invoices.length} invoices`);

      currentPage++;
      await delay(100); // Small delay between pages
    }

    console.log(`📊 Total invoices fetched: ${allInvoices.length}`);

    // Upsert invoices to database
    if (allInvoices.length > 0) {
      const invoicesToInsert = allInvoices.map(inv => ({
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
        fetched_at: new Date().toISOString()
      }));

      const { error: upsertError } = await supabase
        .from('nav_invoices')
        .upsert(invoicesToInsert, {
          onConflict: 'invoice_number,user_id',
          ignoreDuplicates: false
        });

      if (upsertError) {
        throw new Error(`Failed to upsert invoices: ${upsertError.message}`);
      }

      // Cache partners from NAV data
      await cachePartnersFromInvoices(supabase, userId, companyId, allInvoices, direction);
    }

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
  
  const invoiceDigestRegex = /<invoiceDigest>([\s\S]*?)<\/invoiceDigest>/g;
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

    // Upsert partners to database
    const partnersToUpsert = Array.from(partnersMap.values()).map(p => ({
      user_id: userId,
      company_id: companyId,
      tax_number: p.taxNumber,
      name: p.name,
      partner_type: p.type
    }));

    const { error: partnerError } = await supabase
      .from('partners')
      .upsert(partnersToUpsert, {
        onConflict: 'user_id,tax_number',
        ignoreDuplicates: false
      });

    if (partnerError) {
      console.error('Error caching partners:', partnerError);
    } else {
      console.log(`📋 Cached ${partnersMap.size} partners from ${direction} invoices`);
    }
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
