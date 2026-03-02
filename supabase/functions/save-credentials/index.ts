import { createClient } from 'jsr:@supabase/supabase-js@2'

Deno.serve(async (req) => {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Generate debugId for correlation
    const debugId = `save-${Date.now()}-${Math.random().toString(36).substring(7)}`
    
    // Check for Authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      console.error(`[SAVE-CREDS][${debugId}] Missing or invalid Authorization header`)
      return new Response(
        JSON.stringify({ code: 'UNAUTHORIZED', error: 'Missing authorization header', debugId }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client with anon key and auth header for JWT verification
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // Create service role client for DB operations (bypasses RLS)
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Verify token using getUser (service role client validates JWT directly, no session needed)
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await serviceClient.auth.getUser(token)
    
    if (userError || !user) {
      console.error(`[SAVE-CREDS][${debugId}] Auth failed:`, userError?.message)
      return new Response(
        JSON.stringify({ code: 'UNAUTHORIZED', error: 'Invalid or expired token', debugId }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userId = user.id

    // Parse request body
    const body = await req.json()
    const {
      navUsername,
      navPassword,
      navTaxNumber,
      navSignKey,
      navExchangeKey,
      softwareDevName,
      softwareDevContact,
      isTestEnvironment = false,
      companyId = null
    } = body

    // Sanitize inputs
    const username = navUsername?.trim() || '';
    const password = navPassword?.trim() || '';
    const taxNumber = navTaxNumber?.trim() || '';
    const signKey = navSignKey?.trim() || '';
    const exchangeKey = navExchangeKey?.trim() || '';

    // Log entry with privacy-safe data
    console.log(`[SAVE-CREDS][${debugId}] Entry:`, {
      userId,
      companyId,
      taxNumberMasked: taxNumber.length >= 4 ? taxNumber.substring(0, 2) + '******' + taxNumber.substring(taxNumber.length - 2) : '***',
      usernameLength: username.length,
      isTestEnvironment
    })

    // Validate required fields
    if (!username || !password || !taxNumber || !signKey || !exchangeKey) {
      console.error(`[SAVE-CREDS][${debugId}] Missing required fields`)
      return new Response(
        JSON.stringify({ 
          code: 'MISSING_FIELDS',
          error: 'All NAV credentials are required (cannot be empty or whitespace)',
          debugId
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Validate tax number format (exactly 8 digits)
    if (!/^[0-9]{8}$/.test(taxNumber)) {
      console.error(`[SAVE-CREDS][${debugId}] Invalid tax number format: length=${taxNumber.length}, pattern=${!/^[0-9]{8}$/.test(taxNumber)}`)
      return new Response(
        JSON.stringify({ 
          code: 'INVALID_TAX_NUMBER',
          error: 'Tax number must be exactly 8 digits',
          debugId,
          hint: 'Remove any HU prefix or dashes. Example: 13996828'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Validate username character set (alphanumeric)
    if (!/^[a-zA-Z0-9]+$/.test(username)) {
      console.error(`[SAVE-CREDS][${debugId}] Invalid username charset`)
      return new Response(
        JSON.stringify({ 
          code: 'INVALID_USERNAME',
          error: 'Username must contain only letters and numbers',
          debugId
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[SAVE-CREDS][${debugId}] Validation passed, checking ownership`)

    // Verify user is the company owner
    if (companyId) {
      const serviceClient2 = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )
      const { data: companyData, error: companyError } = await serviceClient2
        .from('companies')
        .select('owner_id')
        .eq('id', companyId)
        .single()

      if (companyError || !companyData) {
        return new Response(
          JSON.stringify({ code: 'COMPANY_NOT_FOUND', error: 'Company not found', debugId }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (companyData.owner_id !== userId) {
        console.error(`[SAVE-CREDS][${debugId}] User ${userId} is not owner of company ${companyId}`)
        return new Response(
          JSON.stringify({ code: 'FORBIDDEN', error: 'Csak a cég tulajdonosa mentheti a NAV hitelesítő adatokat', debugId }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    console.log(`[SAVE-CREDS][${debugId}] Ownership verified, calling RPC`)

    // Call the database function to save credentials with sanitized values
    // Use supabaseClient (with user JWT) so auth.uid() works in the RPC function
    const { data, error } = await supabaseClient.rpc('save_nav_credentials', {
      p_nav_username: username,
      p_nav_password: password,
      p_nav_tax_number: taxNumber,
      p_nav_sign_key: signKey,
      p_nav_exchange_key: exchangeKey,
      p_software_dev_name: softwareDevName?.trim() || null,
      p_software_dev_contact: softwareDevContact?.trim() || null,
      p_is_test_environment: isTestEnvironment,
      p_company_id: companyId
    })

    if (error) {
      console.error(`[SAVE-CREDS][${debugId}] Database error:`, error)
      
      // Map specific DB errors to codes
      if (error.message?.includes('Tax number must be 8 digits')) {
        return new Response(
          JSON.stringify({ 
            code: 'INVALID_TAX_NUMBER',
            error: 'Tax number must be exactly 8 digits',
            debugId,
            hint: 'Remove any HU prefix or dashes. Example: 13996828'
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      return new Response(
        JSON.stringify({ code: 'DB_ERROR', error: error.message, debugId }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[SAVE-CREDS][${debugId}] Success`)
    return new Response(
      JSON.stringify({ ...data, debugId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    const debugId = `save-error-${Date.now()}`
    console.error(`[SAVE-CREDS][${debugId}] Error:`, error)
    return new Response(
      JSON.stringify({ code: 'SERVER_ERROR', error: error.message, debugId }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})