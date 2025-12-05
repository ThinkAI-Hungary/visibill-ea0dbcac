import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { sha3_512 } from 'https://esm.sh/@noble/hashes@1.3.0/sha3';
import { bytesToHex } from 'https://esm.sh/@noble/hashes@1.3.0/utils';

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
        // Get credentials via RPC
        const { data: credsData, error: credsError } = await supabase.rpc('get_nav_credentials', {
          p_user_id: company.user_id
        });

        if (credsError || !credsData) {
          throw new Error(`Failed to get credentials: ${credsError?.message || 'No data'}`);
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
  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

  const passwordHash = await sha512Hash(credentials.nav_password);
  const signatureInput = `${requestId}${timestamp}${credentials.nav_sign_key}`;
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

  if (!response.ok) {
    throw new Error(`NAV token request failed: ${response.status}`);
  }

  const responseText = await response.text();
  const tokenMatch = responseText.match(/<encodedExchangeToken>([^<]+)<\/encodedExchangeToken>/);

  if (!tokenMatch) {
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
  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

  const signatureInput = `${requestId}${timestamp}${credentials.nav_sign_key}`;
  const signature = sha3Hash(signatureInput);

  const queryXml = buildQueryXML(
    credentials.nav_username,
    credentials.nav_tax_number,
    signature,
    requestId,
    timestamp,
    token,
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

  if (!response.ok) {
    throw new Error(`NAV query failed: ${response.status}`);
  }

  const responseText = await response.text();
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
<TokenExchangeRequest xmlns="http://schemas.nav.gov.hu/OSA/3.0/api">
  <header>
    <requestId>${requestId}</requestId>
    <timestamp>${timestamp}</timestamp>
    <requestVersion>3.0</requestVersion>
    <headerVersion>1.0</headerVersion>
  </header>
  <user>
    <login>${username}</login>
    <passwordHash cryptoType="SHA-512">${passwordHash}</passwordHash>
    <taxNumber>${taxNumber}</taxNumber>
    <requestSignature cryptoType="SHA3-512">${signature}</requestSignature>
  </user>
  <software>
    <softwareId>${softwareId}</softwareId>
    <softwareName>VisiBill</softwareName>
    <softwareOperation>ONLINE_SERVICE</softwareOperation>
    <softwareMainVersion>1.0</softwareMainVersion>
    <softwareDevName>${devName || 'VisiBill Dev'}</softwareDevName>
    <softwareDevContact>${devContact || 'support@visibill.hu'}</softwareDevContact>
  </software>
</TokenExchangeRequest>`;
}

function buildQueryXML(
  username: string,
  taxNumber: string,
  signature: string,
  requestId: string,
  timestamp: string,
  token: string,
  direction: string,
  dateFrom: string,
  dateTo: string,
  page: number
): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<QueryInvoiceDigestRequest xmlns="http://schemas.nav.gov.hu/OSA/3.0/api">
  <header>
    <requestId>${requestId}</requestId>
    <timestamp>${timestamp}</timestamp>
    <requestVersion>3.0</requestVersion>
    <headerVersion>1.0</headerVersion>
  </header>
  <user>
    <login>${username}</login>
    <taxNumber>${taxNumber}</taxNumber>
    <requestSignature cryptoType="SHA3-512">${signature}</requestSignature>
  </user>
  <software>
    <softwareId>HU12345678VISIBILL</softwareId>
    <softwareName>VisiBill</softwareName>
    <softwareOperation>ONLINE_SERVICE</softwareOperation>
    <softwareMainVersion>1.0</softwareMainVersion>
    <softwareDevName>VisiBill Dev</softwareDevName>
    <softwareDevContact>support@visibill.hu</softwareDevContact>
  </software>
  <exchangeToken>${token}</exchangeToken>
  <invoiceDirection>${direction}</invoiceDirection>
  <invoiceQueryParams>
    <mandatoryQueryParams>
      <invoiceIssueDate>
        <dateFrom>${dateFrom}</dateFrom>
        <dateTo>${dateTo}</dateTo>
      </invoiceIssueDate>
    </mandatoryQueryParams>
  </invoiceQueryParams>
  <page>${page}</page>
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
      customerTaxNumber: extractTag(digest, 'customerTaxNumber'),
      invoiceOperation: extractTag(digest, 'invoiceOperation'),
      invoiceNetAmount: parseFloat(extractTag(digest, 'invoiceNetAmount') || '0'),
      invoiceVatAmount: parseFloat(extractTag(digest, 'invoiceVatAmount') || '0'),
      invoiceGrossAmount: parseFloat(extractTag(digest, 'invoiceGrossAmount') || '0'),
      paymentMethod: extractTag(digest, 'paymentMethod'),
      currency: extractTag(digest, 'currency') || 'HUF'
    };

    invoices.push(invoice);
  }

  return invoices;
}

function extractTag(xml: string, tagName: string): string {
  const regex = new RegExp(`<${tagName}>([^<]*)<\/${tagName}>`, 'i');
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
  return bytesToHex(new Uint8Array(hashBuffer));
}

function sha3Hash(input: string): string {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  return bytesToHex(sha3_512(data));
}
