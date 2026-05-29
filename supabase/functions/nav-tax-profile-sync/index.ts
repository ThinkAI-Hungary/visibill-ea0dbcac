import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'
import { sha3_512 } from 'https://esm.sh/@noble/hashes@1.3.0/sha3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * NAV queryTaxpayer API – lekérdezi egy adószám adózási profilját:
 * - ÁFA bevallás gyakoriság
 * - KATA / KIVA státusz
 * - Adócsoport
 *
 * A lekérdezett adatokkal frissíti az accounty_tax_profiles táblát.
 *
 * Input JSON body: { taxNumber: string, companyId: string }
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No authorization header');

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (userError || !user) throw new Error('Invalid user token');

    const { taxNumber, companyId } = await req.json();
    if (!taxNumber || !companyId) {
      throw new Error('Missing taxNumber or companyId');
    }

    console.log(`[NAV-TAX-PROFILE] Querying tax profile for ${taxNumber}`);

    // Get NAV credentials
    const { data: credsResult, error: credsError } = await supabaseClient
      .rpc('get_nav_credentials', { p_user_id: user.id });

    if (credsError || !credsResult || credsResult.error) {
      throw new Error('Could not retrieve NAV credentials');
    }

    const credentials = credsResult;
    const baseUrl = credentials.is_test_environment
      ? 'https://api-test.onlineszamla.nav.gov.hu/invoiceService/v3'
      : 'https://api.onlineszamla.nav.gov.hu/invoiceService/v3';

    // Get exchange token
    const token = await getNavToken(credentials, baseUrl);

    // Build queryTaxpayer request
    const requestId = crypto.randomUUID().replace(/-/g, '').substring(0, 30);
    const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    const passwordHash = await hashPassword(credentials.nav_password);
    const signature = await createSignature(credentials, requestId, timestamp);

    // NAV v3 queryTaxpayer endpoint
    const queryXml = `<?xml version="1.0" encoding="UTF-8"?>
<QueryTaxpayerRequest xmlns="http://schemas.nav.gov.hu/OSA/3.0/api"
                      xmlns:common="http://schemas.nav.gov.hu/NTCA/1.0/common">
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
    <softwareName>VisiBill NAV Integration</softwareName>
    <softwareOperation>ONLINE_SERVICE</softwareOperation>
    <softwareMainVersion>1.0</softwareMainVersion>
    <softwareDevName>${credentials.software_dev_name || 'VisiBill'}</softwareDevName>
    <softwareDevContact>${credentials.software_dev_contact || 'support@visibill.hu'}</softwareDevContact>
  </software>
  <taxNumber>${taxNumber}</taxNumber>
</QueryTaxpayerRequest>`;

    const response = await fetch(`${baseUrl}/queryTaxpayer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/xml; charset=UTF-8',
        'Accept': 'application/xml'
      },
      body: queryXml,
    });

    const xmlResponse = await response.text();
    console.log('[NAV-TAX-PROFILE] Response:', xmlResponse.substring(0, 500));

    if (!response.ok) {
      throw new Error(`NAV queryTaxpayer failed: ${response.status}`);
    }

    // Parse response
    const taxpayerValidity = extractXMLValue(xmlResponse, 'taxpayerValidity') === 'true';
    const taxpayerName = extractXMLValue(xmlResponse, 'taxpayerName');
    const incorporationType = extractXMLValue(xmlResponse, 'incorporationType');

    // Determine tax profile from response
    const isKata = incorporationType?.includes('KATA') ||
                   xmlResponse.includes('KATA') ||
                   false;
    const isKiva = xmlResponse.includes('KIVA') || false;

    // Determine VAT frequency (heuristic from incorporation type)
    let vatFrequency: 'monthly' | 'quarterly' | 'yearly' = 'monthly';
    if (incorporationType === 'SELF_EMPLOYED' || isKata) {
      vatFrequency = 'yearly';
    }

    // Upsert tax profile
    const { error: upsertError } = await supabaseClient
      .from('accounty_tax_profiles')
      .upsert({
        company_id: companyId,
        vat_frequency: vatFrequency,
        is_kata: isKata,
        is_kiva: isKiva,
        nav_synced: true,
        last_nav_sync_at: new Date().toISOString(),
        tax_group: incorporationType || null,
      }, { onConflict: 'company_id' });

    if (upsertError) {
      console.error('[NAV-TAX-PROFILE] Upsert error:', upsertError);
      throw new Error('Failed to save tax profile');
    }

    console.log(`[NAV-TAX-PROFILE] Saved tax profile for company ${companyId}`);

    return new Response(
      JSON.stringify({
        success: true,
        taxpayerValid: taxpayerValidity,
        taxpayerName,
        incorporationType,
        profile: { vatFrequency, isKata, isKiva },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[NAV-TAX-PROFILE] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ── Shared NAV helpers (same as nav-sync) ──

function extractXMLValue(xml: string, tagName: string): string | null {
  const regex = new RegExp(`<(?:\\w+:)?${tagName}>([^<]+)</(?:\\w+:)?${tagName}>`, 's');
  const match = xml.match(regex);
  return match ? match[1].trim() : null;
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-512', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

async function createSignature(credentials: any, requestId: string, timestamp: string): Promise<string> {
  const date = new Date(timestamp);
  const compactTimestamp = date.getUTCFullYear().toString() +
    (date.getUTCMonth() + 1).toString().padStart(2, '0') +
    date.getUTCDate().toString().padStart(2, '0') +
    date.getUTCHours().toString().padStart(2, '0') +
    date.getUTCMinutes().toString().padStart(2, '0') +
    date.getUTCSeconds().toString().padStart(2, '0');
  const signatureBase = `${requestId}${compactTimestamp}${credentials.nav_sign_key}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(signatureBase);
  const hash = sha3_512(data);
  return Array.from(hash)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

async function getNavToken(credentials: any, navApiUrl: string): Promise<string> {
  const requestId = crypto.randomUUID().replace(/-/g, '').substring(0, 30);
  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const passwordHash = await hashPassword(credentials.nav_password);
  const signature = await createSignature(credentials, requestId, timestamp);

  const tokenXml = `<?xml version="1.0" encoding="UTF-8"?>
<TokenExchangeRequest xmlns="http://schemas.nav.gov.hu/OSA/3.0/api" xmlns:common="http://schemas.nav.gov.hu/NTCA/1.0/common">
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
    <softwareName>VisiBill NAV Integration</softwareName>
    <softwareOperation>ONLINE_SERVICE</softwareOperation>
    <softwareMainVersion>1.0</softwareMainVersion>
    <softwareDevName>${credentials.software_dev_name || 'VisiBill'}</softwareDevName>
    <softwareDevContact>${credentials.software_dev_contact || 'support@visibill.hu'}</softwareDevContact>
  </software>
</TokenExchangeRequest>`;

  const response = await fetch(`${navApiUrl}/tokenExchange`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/xml; charset=UTF-8',
      'Accept': 'application/xml'
    },
    body: tokenXml
  });

  const responseText = await response.text();
  if (!response.ok) throw new Error(`NAV token request failed: ${response.status}`);

  const tokenMatch = responseText.match(/<(?:\w+:)?encodedExchangeToken>([^<]+)<\/(?:\w+:)?encodedExchangeToken>/);
  if (!tokenMatch) throw new Error('Failed to extract token from NAV response');

  return tokenMatch[1];
}
