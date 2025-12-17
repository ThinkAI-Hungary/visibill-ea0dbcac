import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sha3_512 } from "https://esm.sh/@noble/hashes@1.3.0/sha3";

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

    const { action, company_id } = await req.json();

    switch (action) {
      case 'validate_credentials':
        return await validateCredentials(supabaseClient, user.id, company_id);
      case 'request_token':
        return await requestToken(supabaseClient, user.id, company_id);
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

// Generate NAV-compliant request ID (max 32 chars)
function generateRequestId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'RID';
  for (let i = 0; i < 13; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result; // 16 chars total: "RID" + 13 random chars
}

// SHA-512 hash for password (NAV v3: hash password only, no requestId)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-512', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

// SHA3-512 hash for request signature (NAV v3: use compact timestamp format yyyyMMddHHmmss)
function createSignature(credentials: NavCredentials, requestId: string, timestamp: string): string {
  // Convert ISO timestamp to compact format (yyyyMMddHHmmss) in UTC
  const date = new Date(timestamp);
  const compactTimestamp = date.getUTCFullYear().toString() +
    (date.getUTCMonth() + 1).toString().padStart(2, '0') +
    date.getUTCDate().toString().padStart(2, '0') +
    date.getUTCHours().toString().padStart(2, '0') +
    date.getUTCMinutes().toString().padStart(2, '0') +
    date.getUTCSeconds().toString().padStart(2, '0');
  
  const signatureBase = requestId + compactTimestamp + credentials.nav_sign_key;
  const encoder = new TextEncoder();
  const data = encoder.encode(signatureBase);
  const hash = sha3_512(data);
  return Array.from(hash)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

async function validateCredentials(supabaseClient: any, userId: string, companyId?: string) {
  console.log('[NAV-TOKEN] Validating credentials for user:', userId, 'company:', companyId);

  // Get decrypted credentials
  const { data: credsResult, error: credsError } = await supabaseClient
    .rpc('get_nav_credentials', { p_user_id: userId, p_company_id: companyId || null });

  if (credsError || !credsResult || credsResult.error) {
    console.error('[NAV-TOKEN] Credentials retrieval failed:', credsError || credsResult?.error);
    throw new Error('Could not retrieve credentials');
  }

  const credentials: NavCredentials = credsResult;
  
  // Sanitize inputs
  const nav_username = credentials.nav_username?.trim() || '';
  const nav_password = credentials.nav_password?.trim() || '';
  const nav_tax_number = credentials.nav_tax_number?.trim() || '';
  const nav_sign_key = credentials.nav_sign_key?.trim() || '';
  
  // Validate inputs
  if (!nav_username || !nav_password || !nav_tax_number || !nav_sign_key) {
    throw new Error('Missing required credentials');
  }
  
  if (!/^\d{8}$/.test(nav_tax_number)) {
    throw new Error('Invalid tax number format - must be exactly 8 digits');
  }
  
  // Field diagnostics for debugging (no actual values logged)
  const diagnostics = {
    loginLength: nav_username.length,
    taxNumberLength: nav_tax_number.length,
    hasWhitespaceInLogin: nav_username !== credentials.nav_username,
    hasWhitespaceInPassword: nav_password !== credentials.nav_password,
    hasWhitespaceInSignKey: nav_sign_key !== credentials.nav_sign_key
  };
  
  // Create sanitized credentials object
  const sanitizedCreds: NavCredentials = {
    ...credentials,
    nav_username,
    nav_password,
    nav_tax_number,
    nav_sign_key
  };
  
  // Test connection to NAV API using TokenExchange (production only)
  const env = 'prod';
  const baseUrl = 'https://api.onlineszamla.nav.gov.hu/invoiceService/v3';

  try {
    const timestamp = new Date().toISOString();
    const requestId = generateRequestId();
    const passwordHash = await hashPassword(sanitizedCreds.nav_password);
    const requestSignature = createSignature(sanitizedCreds, requestId, timestamp);

    const xmlRequest = buildTokenXML(sanitizedCreds, requestId, timestamp, passwordHash, requestSignature);
    
    // Mask sensitive data in XML for logging
    const maskedXmlRequest = xmlRequest
      .replace(/<common:passwordHash[^>]*>.*?<\/common:passwordHash>/g, '<common:passwordHash>***MASKED***</common:passwordHash>')
      .replace(/<common:requestSignature[^>]*>.*?<\/common:requestSignature>/g, '<common:requestSignature>***MASKED***</common:requestSignature>');
    
    console.log('[NAV-TOKEN] ========== VALIDATION REQUEST START ==========');
    console.log('[NAV-TOKEN] Request ID:', requestId);
    console.log('[NAV-TOKEN] Environment:', env);
    console.log('[NAV-TOKEN] Endpoint:', baseUrl);
    console.log('[NAV-TOKEN] XML Request (sensitive data masked):');
    console.log(maskedXmlRequest);
    console.log('[NAV-TOKEN] ========== VALIDATION REQUEST END ==========');

    const testResponse = await fetch(`${baseUrl}/tokenExchange`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/xml; charset=UTF-8',
        'Accept': 'application/xml'
      },
      body: xmlRequest
    });

    const xmlResponse = await testResponse.text();
    
    console.log('[NAV-TOKEN] ========== VALIDATION RESPONSE START ==========');
    console.log('[NAV-TOKEN] Request ID:', requestId);
    console.log('[NAV-TOKEN] HTTP Status:', testResponse.status);
    console.log('[NAV-TOKEN] XML Response:');
    console.log(xmlResponse);
    console.log('[NAV-TOKEN] ========== VALIDATION RESPONSE END ==========');

    // Check for success - NAV returns funcCode=OK for successful validation
    const isValid = xmlResponse.includes('<funcCode>OK</funcCode>') || 
                    xmlResponse.includes('<encodedExchangeToken>');
    
    const validationStatus = isValid ? 'valid' : 'invalid';
    const validationError = !isValid ? parseNAVError(xmlResponse) : null;

    const updateFilter = companyId 
      ? { user_id: userId, company_id: companyId }
      : { user_id: userId };
    
    await supabaseClient
      .from('user_nav_credentials')
      .update({
        validation_status: validationStatus,
        validation_error: validationError,
        last_validated_at: new Date().toISOString()
      })
      .match(updateFilter);

    return new Response(
      JSON.stringify({
        success: isValid,
        status: validationStatus,
        message: isValid ? 'Credentials validated successfully' : validationError || 'Invalid credentials',
        details: xmlResponse,
        env,
        requestId,
        diagnostics: !isValid ? diagnostics : undefined
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[NAV-TOKEN] Validation error:', error);
    
    const updateFilter = companyId 
      ? { user_id: userId, company_id: companyId }
      : { user_id: userId };
    
    await supabaseClient
      .from('user_nav_credentials')
      .update({
        validation_status: 'error',
        validation_error: error.message,
        last_validated_at: new Date().toISOString()
      })
      .match(updateFilter);

    throw new Error(`Validation failed: ${error.message}`);
  }
}

async function requestToken(supabaseClient: any, userId: string, companyId?: string) {
  console.log('[NAV-TOKEN] Requesting token for user:', userId, 'company:', companyId);

  // Get decrypted credentials
  const { data: credsResult, error: credsError } = await supabaseClient
    .rpc('get_nav_credentials', { p_user_id: userId, p_company_id: companyId || null });

  if (credsError || !credsResult || credsResult.error) {
    console.error('[NAV-TOKEN] Credentials retrieval failed:', credsError || credsResult?.error);
    throw new Error('Could not retrieve credentials');
  }

  const credentials: NavCredentials = credsResult;
  
  const baseUrl = 'https://api.onlineszamla.nav.gov.hu/invoiceService/v3';

  try {
    const timestamp = new Date().toISOString();
    const requestId = generateRequestId();
    const passwordHash = await hashPassword(credentials.nav_password);
    const requestSignature = createSignature(credentials, requestId, timestamp);

    const xmlRequest = buildTokenXML(credentials, requestId, timestamp, passwordHash, requestSignature);

    // Mask sensitive data in XML for logging
    const maskedXmlRequest = xmlRequest
      .replace(/<common:passwordHash[^>]*>.*?<\/common:passwordHash>/g, '<common:passwordHash>***MASKED***</common:passwordHash>')
      .replace(/<common:requestSignature[^>]*>.*?<\/common:requestSignature>/g, '<common:requestSignature>***MASKED***</common:requestSignature>');
    
    console.log('[NAV-TOKEN] ========== TOKEN REQUEST START ==========');
    console.log('[NAV-TOKEN] Request ID:', requestId);
    console.log('[NAV-TOKEN] XML Request (sensitive data masked):');
    console.log(maskedXmlRequest);
    console.log('[NAV-TOKEN] ========== TOKEN REQUEST END ==========');

    const tokenResponse = await fetch(`${baseUrl}/tokenExchange`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/xml; charset=UTF-8',
        'Accept': 'application/xml'
      },
      body: xmlRequest
    });

    const xmlResponse = await tokenResponse.text();
    
    console.log('[NAV-TOKEN] ========== TOKEN RESPONSE START ==========');
    console.log('[NAV-TOKEN] Request ID:', requestId);
    console.log('[NAV-TOKEN] HTTP Status:', tokenResponse.status);
    console.log('[NAV-TOKEN] XML Response:');
    console.log(xmlResponse);
    console.log('[NAV-TOKEN] ========== TOKEN RESPONSE END ==========');

    // Parse token from XML response
    const tokenMatch = xmlResponse.match(/<encodedExchangeToken>(.+?)<\/encodedExchangeToken>/);
    const token = tokenMatch ? tokenMatch[1] : null;

    if (!token) {
      const errorMsg = parseNAVError(xmlResponse);
      throw new Error(errorMsg || 'No token received from NAV API');
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

function buildTokenXML(
  creds: NavCredentials, 
  requestId: string, 
  timestamp: string, 
  passwordHash: string, 
  requestSignature: string
): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<TokenExchangeRequest xmlns="http://schemas.nav.gov.hu/OSA/3.0/api" 
                      xmlns:common="http://schemas.nav.gov.hu/NTCA/1.0/common">
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
    <softwareName>VisiBill NAV Integration</softwareName>
    <softwareOperation>ONLINE_SERVICE</softwareOperation>
    <softwareMainVersion>1.0</softwareMainVersion>
    <softwareDevName>${creds.software_dev_name || 'VisiBill'}</softwareDevName>
    <softwareDevContact>${creds.software_dev_contact || 'support@visibill.hu'}</softwareDevContact>
  </software>
</TokenExchangeRequest>`;
}

function parseNAVError(xmlResponse: string): string {
  // Try to extract error message from NAV response
  const errorMatch = xmlResponse.match(/<message>(.+?)<\/message>/);
  const errorCodeMatch = xmlResponse.match(/<errorCode>(.+?)<\/errorCode>/);
  
  if (errorMatch && errorCodeMatch) {
    return `${errorCodeMatch[1]}: ${errorMatch[1]}`;
  } else if (errorMatch) {
    return errorMatch[1];
  } else if (errorCodeMatch) {
    return errorCodeMatch[1];
  }
  
  return 'Unknown NAV API error';
}
