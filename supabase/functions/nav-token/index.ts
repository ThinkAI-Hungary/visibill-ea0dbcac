import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  software_dev_name?: string;
  software_dev_contact?: string;
  is_test_environment: boolean;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Get the JWT token from the Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Get user from token
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      throw new Error('Invalid user token');
    }

    console.log('[NAV-TOKEN] Processing request for user:', user.id);

    const { action } = await req.json();

    switch (action) {
      case 'validate_credentials':
        return await validateCredentials(supabaseClient, user.id);
      case 'request_token':
        return await requestToken(supabaseClient, user.id);
      default:
        throw new Error('Invalid action');
    }

  } catch (error) {
    console.error('[NAV-TOKEN] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

async function validateCredentials(supabaseClient: any, userId: string) {
  console.log('[NAV-TOKEN] Validating credentials for user:', userId);

  // Get decrypted credentials
  const { data: credsResult, error: credsError } = await supabaseClient
    .rpc('get_nav_credentials', { p_user_id: userId });

  if (credsError || !credsResult || credsResult.error) {
    throw new Error('Could not retrieve credentials');
  }

  const credentials: NavCredentials = credsResult;
  
  // Test connection to NAV API
  const baseUrl = credentials.is_test_environment 
    ? 'https://api-test.onlineszamla.nav.gov.hu/invoiceService/v3'
    : 'https://api.onlineszamla.nav.gov.hu/invoiceService/v3';

  try {
    // Simple health check - just try to connect to the manageInvoice endpoint
    const testResponse = await fetch(`${baseUrl}/manageInvoice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/xml; charset=UTF-8',
        'Accept': 'application/xml'
      },
      body: createTestXMLRequest(credentials)
    });

    const xmlResponse = await testResponse.text();
    console.log('[NAV-TOKEN] Validation response:', xmlResponse);

    // Update validation status in database
    const validationStatus = xmlResponse.includes('DONE') ? 'valid' : 'invalid';
    const validationError = validationStatus === 'invalid' ? 'Authentication failed' : null;

    await supabaseClient
      .from('user_nav_credentials')
      .update({
        validation_status: validationStatus,
        validation_error: validationError,
        last_validated_at: new Date().toISOString()
      })
      .eq('user_id', userId);

    return new Response(
      JSON.stringify({
        success: true,
        status: validationStatus,
        message: validationStatus === 'valid' ? 'Credentials validated successfully' : 'Invalid credentials'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[NAV-TOKEN] Validation error:', error);
    
    await supabaseClient
      .from('user_nav_credentials')
      .update({
        validation_status: 'error',
        validation_error: error.message,
        last_validated_at: new Date().toISOString()
      })
      .eq('user_id', userId);

    throw new Error(`Validation failed: ${error.message}`);
  }
}

async function requestToken(supabaseClient: any, userId: string) {
  console.log('[NAV-TOKEN] Requesting token for user:', userId);

  // Get decrypted credentials
  const { data: credsResult, error: credsError } = await supabaseClient
    .rpc('get_nav_credentials', { p_user_id: userId });

  if (credsError || !credsResult || credsResult.error) {
    throw new Error('Could not retrieve credentials');
  }

  const credentials: NavCredentials = credsResult;
  
  const baseUrl = credentials.is_test_environment 
    ? 'https://api-test.onlineszamla.nav.gov.hu/invoiceService/v3'
    : 'https://api.onlineszamla.nav.gov.hu/invoiceService/v3';

  try {
    const tokenResponse = await fetch(`${baseUrl}/tokenExchange`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/xml; charset=UTF-8',
        'Accept': 'application/xml'
      },
      body: createTokenExchangeRequest(credentials)
    });

    const xmlResponse = await tokenResponse.text();
    console.log('[NAV-TOKEN] Token response:', xmlResponse);

    // Parse token from XML response
    const tokenMatch = xmlResponse.match(/<encodedExchangeToken>(.+?)<\/encodedExchangeToken>/);
    const token = tokenMatch ? tokenMatch[1] : null;

    if (!token) {
      throw new Error('No token received from NAV API');
    }

    return new Response(
      JSON.stringify({
        success: true,
        token: token,
        expires_in: 600 // NAV tokens typically expire in 10 minutes
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[NAV-TOKEN] Token request error:', error);
    throw new Error(`Token request failed: ${error.message}`);
  }
}

function createTestXMLRequest(credentials: NavCredentials): string {
  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const requestId = crypto.randomUUID();

  return `<?xml version="1.0" encoding="UTF-8"?>
<ManageInvoiceRequest xmlns="http://schemas.nav.gov.hu/OSA/3.0/api">
  <header>
    <requestId>${requestId}</requestId>
    <timestamp>${timestamp}</timestamp>
    <requestVersion>3.0</requestVersion>
    <headerVersion>1.0</headerVersion>
  </header>
  <user>
    <login>${credentials.nav_username}</login>
    <passwordHash>${hashPassword(credentials.nav_password, requestId)}</passwordHash>
    <taxNumber>${credentials.nav_tax_number}</taxNumber>
    <requestSignature>${createSignature(credentials, requestId, timestamp)}</requestSignature>
  </user>
  <software>
    <softwareId>${credentials.software_id}</softwareId>
    <softwareName>VisiBill NAV Integration</softwareName>
    <softwareOperation>LOCAL_SOFTWARE</softwareOperation>
    <softwareMainVersion>1.0</softwareMainVersion>
    <softwareDevName>${credentials.software_dev_name || 'VisiBill'}</softwareDevName>
    <softwareDevContact>${credentials.software_dev_contact || 'support@visibill.hu'}</softwareDevContact>
  </software>
</ManageInvoiceRequest>`;
}

function createTokenExchangeRequest(credentials: NavCredentials): string {
  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const requestId = crypto.randomUUID();

  return `<?xml version="1.0" encoding="UTF-8"?>
<TokenExchangeRequest xmlns="http://schemas.nav.gov.hu/OSA/3.0/api">
  <header>
    <requestId>${requestId}</requestId>
    <timestamp>${timestamp}</timestamp>
    <requestVersion>3.0</requestVersion>
    <headerVersion>1.0</headerVersion>
  </header>
  <user>
    <login>${credentials.nav_username}</login>
    <passwordHash>${hashPassword(credentials.nav_password, requestId)}</passwordHash>
    <taxNumber>${credentials.nav_tax_number}</taxNumber>
    <requestSignature>${createSignature(credentials, requestId, timestamp)}</requestSignature>
  </user>
  <software>
    <softwareId>${credentials.software_id}</softwareId>
    <softwareName>VisiBill NAV Integration</softwareName>
    <softwareOperation>LOCAL_SOFTWARE</softwareOperation>
    <softwareMainVersion>1.0</softwareMainVersion>
    <softwareDevName>${credentials.software_dev_name || 'VisiBill'}</softwareDevName>
    <softwareDevContact>${credentials.software_dev_contact || 'support@visibill.hu'}</softwareDevContact>
  </software>
</TokenExchangeRequest>`;
}

function hashPassword(password: string, requestId: string): string {
  // NAV requires SHA512 hash of password + requestId
  const encoder = new TextEncoder();
  const data = encoder.encode(requestId + password);
  return crypto.subtle.digest('SHA-512', data)
    .then(hash => Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase());
}

function createSignature(credentials: NavCredentials, requestId: string, timestamp: string): string {
  // Simplified signature creation - in production, this would use proper cryptographic signing
  const signatureBase = `${requestId}${timestamp}${credentials.nav_sign_key}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(signatureBase);
  return crypto.subtle.digest('SHA-256', data)
    .then(hash => Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase());
}