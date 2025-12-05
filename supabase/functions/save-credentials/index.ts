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
    
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // Get user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      console.error(`[SAVE-CREDS][${debugId}] Unauthorized`)
      return new Response(
        JSON.stringify({ code: 'UNAUTHORIZED', error: 'Unauthorized', debugId }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

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
      userId: user.id,
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

    console.log(`[SAVE-CREDS][${debugId}] Validation passed, calling RPC`)

    // Call the database function to save credentials with sanitized values
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