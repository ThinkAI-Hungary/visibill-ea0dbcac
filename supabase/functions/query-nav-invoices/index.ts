import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'
import { sha3_512 as noble_sha3_512 } from "https://esm.sh/@noble/hashes@1.3.0/sha3";

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Auth
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request
    const { invoiceDirection, dateFrom, dateTo, page = 1, companyId } = await req.json()

    if (!invoiceDirection) {
      return new Response(
        JSON.stringify({ error: 'invoiceDirection is required (OUTBOUND or INBOUND)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get user's NAV credentials
    const { data: credentials, error: credError } = await supabaseClient.rpc(
      'get_nav_credentials',
      { p_user_id: user.id, p_company_id: companyId || null }
    )

    if (credError || !credentials || credentials.error) {
      return new Response(
        JSON.stringify({ error: 'NAV credentials not found. Please save credentials first.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Step 1: Get token
    const token = await getNavToken(credentials)

    // Step 2: Query invoices
    const invoices = await queryInvoices(credentials, token, {
      invoiceDirection,
      dateFrom,
      dateTo,
      page
    })

    // Step 3: Save to database (using nav_invoices table)
    if (invoices.length > 0) {
      const effectiveCompanyId = companyId || credentials.company_id || null;
      const invoicesToInsert = invoices.map(inv => ({
        ...inv,
        company_id: effectiveCompanyId,
        user_id: user.id,
        invoice_direction: invoiceDirection,
        fetched_at: new Date().toISOString()
      }))

      // Deduplicate by invoice_number to prevent upsert conflict errors
      const seen = new Map<string, (typeof invoicesToInsert)[0]>();
      for (const inv of invoicesToInsert) {
        seen.set(inv.invoice_number, inv);
      }
      const dedupedInvoices = Array.from(seen.values());

      await supabaseClient.from('nav_invoices').upsert(dedupedInvoices, {
        onConflict: 'company_id,invoice_number',
        ignoreDuplicates: false
      })
    }

    // Return JSON
    return new Response(
      JSON.stringify({
        success: true,
        invoices,
        count: invoices.length,
        page
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// Helper: Get NAV token
async function getNavToken(creds: any): Promise<string> {
  const requestId = generateRequestId()
  const timestamp = new Date().toISOString()
  const passwordHash = await sha512(creds.nav_password)
  
  // Convert ISO timestamp to compact format (yyyyMMddHHmmss) for signature
  const date = new Date(timestamp)
  const compactTimestamp = date.getUTCFullYear().toString() +
    (date.getUTCMonth() + 1).toString().padStart(2, '0') +
    date.getUTCDate().toString().padStart(2, '0') +
    date.getUTCHours().toString().padStart(2, '0') +
    date.getUTCMinutes().toString().padStart(2, '0') +
    date.getUTCSeconds().toString().padStart(2, '0')
  
  const requestSignature = sha3_512(requestId + compactTimestamp + creds.nav_sign_key)

  const xml = buildTokenXML(creds, requestId, timestamp, passwordHash, requestSignature)

  const apiUrl = creds.is_test_environment
    ? 'https://api-test.onlineszamla.nav.gov.hu/invoiceService/v3'
    : 'https://api.onlineszamla.nav.gov.hu/invoiceService/v3'

  const response = await fetch(`${apiUrl}/tokenExchange`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/xml; charset=UTF-8', 'Accept': 'application/xml' },
    body: xml
  })

  const xmlResponse = await response.text()
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlResponse, 'text/xml')

  const funcCode = doc.getElementsByTagName('funcCode')[0]?.textContent
  if (funcCode !== 'OK') {
    const errorCode = doc.getElementsByTagName('errorCode')[0]?.textContent
    const message = doc.getElementsByTagName('message')[0]?.textContent
    throw new Error(`NAV API Error: ${errorCode} - ${message}`)
  }

  return doc.getElementsByTagName('encodedExchangeToken')[0]?.textContent || ''
}

// Helper: Query invoices
async function queryInvoices(creds: any, token: string, params: any): Promise<any[]> {
  const requestId = generateRequestId()
  const timestamp = new Date().toISOString()
  // For queryInvoiceDigest, passwordHash = SHA-512(password only) per NAV v3 spec
  const passwordHash = await sha512(creds.nav_password)
  
  // Convert ISO timestamp to compact format (yyyyMMddHHmmss) for signature
  const date = new Date(timestamp)
  const compactTimestamp = date.getUTCFullYear().toString() +
    (date.getUTCMonth() + 1).toString().padStart(2, '0') +
    date.getUTCDate().toString().padStart(2, '0') +
    date.getUTCHours().toString().padStart(2, '0') +
    date.getUTCMinutes().toString().padStart(2, '0') +
    date.getUTCSeconds().toString().padStart(2, '0')
  
  const requestSignature = sha3_512(requestId + compactTimestamp + creds.nav_sign_key)

  const xml = buildQueryXML(creds, token, params, requestId, timestamp, passwordHash, requestSignature)

  const apiUrl = creds.is_test_environment
    ? 'https://api-test.onlineszamla.nav.gov.hu/invoiceService/v3'
    : 'https://api.onlineszamla.nav.gov.hu/invoiceService/v3'

  const response = await fetch(`${apiUrl}/queryInvoiceDigest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/xml; charset=UTF-8', 'Accept': 'application/xml' },
    body: xml
  })

  const xmlResponse = await response.text()
  return parseInvoicesXML(xmlResponse)
}

// Utilities
function generateRequestId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = 'RID'
  for (let i = 0; i < 13; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

async function sha512(input: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(input)
  const hashBuffer = await crypto.subtle.digest('SHA-512', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
}

function sha3_512(input: string): string {
  const encoder = new TextEncoder()
  const data = encoder.encode(input)
  const hash = noble_sha3_512(data)
  return Array.from(hash)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
}

function buildTokenXML(creds: any, requestId: string, timestamp: string, passwordHash: string, requestSignature: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<TokenExchangeRequest xmlns:common="http://schemas.nav.gov.hu/NTCA/1.0/common" xmlns="http://schemas.nav.gov.hu/OSA/3.0/api">
  <common:header>
    <common:requestId>${requestId}</common:requestId>
    <common:timestamp>${timestamp}</common:timestamp>
    <common:requestVersion>3.0</common:requestVersion>
    <common:headerVersion>1.0</common:headerVersion>
  </common:header>
  <common:user>
    <common:login>${creds.nav_username}</common:login>
    <common:passwordHash cryptoType="SHA-512">${passwordHash}</common:passwordHash>
    <common:taxNumber>${creds.nav_tax_number}</common:taxNumber>
    <common:requestSignature cryptoType="SHA3-512">${requestSignature}</common:requestSignature>
  </common:user>
  <software>
    <softwareId>${creds.software_id}</softwareId>
    <softwareName>NAV Invoice Manager</softwareName>
    <softwareOperation>ONLINE_SERVICE</softwareOperation>
    <softwareMainVersion>1.0</softwareMainVersion>
    <softwareDevName>${creds.software_dev_name || 'Developer'}</softwareDevName>
    <softwareDevContact>${creds.software_dev_contact || 'contact@example.com'}</softwareDevContact>
    <softwareDevCountryCode>HU</softwareDevCountryCode>
  </software>
</TokenExchangeRequest>`
}

function buildQueryXML(creds: any, token: string, params: any, requestId: string, timestamp: string, passwordHash: string, requestSignature: string): string {
  const dateFilter = params.dateFrom && params.dateTo
    ? `<invoiceQueryParams>
        <mandatoryQueryParams>
          <invoiceIssueDate>
            <dateFrom>${params.dateFrom}</dateFrom>
            <dateTo>${params.dateTo}</dateTo>
          </invoiceIssueDate>
        </mandatoryQueryParams>
      </invoiceQueryParams>`
    : ''

  return `<?xml version="1.0" encoding="UTF-8"?>
<QueryInvoiceDigestRequest xmlns:common="http://schemas.nav.gov.hu/NTCA/1.0/common" xmlns="http://schemas.nav.gov.hu/OSA/3.0/api">
  <common:header>
    <common:requestId>${requestId}</common:requestId>
    <common:timestamp>${timestamp}</common:timestamp>
    <common:requestVersion>3.0</common:requestVersion>
    <common:headerVersion>1.0</common:headerVersion>
  </common:header>
  <common:user>
    <common:login>${creds.nav_username}</common:login>
    <common:passwordHash cryptoType="SHA-512">${passwordHash}</common:passwordHash>
    <common:taxNumber>${creds.nav_tax_number}</common:taxNumber>
    <common:requestSignature cryptoType="SHA3-512">${requestSignature}</common:requestSignature>
  </common:user>
  <software>
    <softwareId>${creds.software_id}</softwareId>
    <softwareName>NAV Invoice Manager</softwareName>
    <softwareOperation>ONLINE_SERVICE</softwareOperation>
    <softwareMainVersion>1.0</softwareMainVersion>
    <softwareDevName>${creds.software_dev_name || 'Developer'}</softwareDevName>
    <softwareDevContact>${creds.software_dev_contact || 'contact@example.com'}</softwareDevContact>
    <softwareDevCountryCode>HU</softwareDevCountryCode>
  </software>
  <exchangeToken>${token}</exchangeToken>
  <page>${params.page}</page>
  <invoiceDirection>${params.invoiceDirection}</invoiceDirection>
  ${dateFilter}
</QueryInvoiceDigestRequest>`
}

function parseInvoicesXML(xmlString: string): any[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlString, 'text/xml')

  const funcCode = doc.getElementsByTagName('funcCode')[0]?.textContent
  if (funcCode !== 'OK') {
    const errorCode = doc.getElementsByTagName('errorCode')[0]?.textContent
    const message = doc.getElementsByTagName('message')[0]?.textContent
    throw new Error(`NAV API Error: ${errorCode} - ${message}`)
  }

  const invoices: any[] = []
  const invoiceElements = doc.getElementsByTagName('invoiceDigest')

  for (let i = 0; i < invoiceElements.length; i++) {
    const inv = invoiceElements[i]
    const getText = (tag: string) => inv.getElementsByTagName(tag)[0]?.textContent || ''

    invoices.push({
      invoice_number: getText('invoiceNumber'),
      invoice_operation: getText('invoiceOperation'),
      supplier_tax_number: getText('supplierTaxNumber'),
      customer_tax_number: getText('customerTaxNumber'),
      invoice_issue_date: getText('invoiceIssueDate'),
      invoice_delivery_date: getText('invoiceDeliveryDate'),
      invoice_net_amount: parseFloat(getText('invoiceNetAmount')) || 0,
      invoice_vat_amount: parseFloat(getText('invoiceVatAmount')) || 0,
      invoice_gross_amount: parseFloat(getText('invoiceGrossAmount')) || 0,
      payment_method: getText('paymentMethod'),
      currency: getText('invoiceCurrency') || 'HUF'
    })
  }

  return invoices
}