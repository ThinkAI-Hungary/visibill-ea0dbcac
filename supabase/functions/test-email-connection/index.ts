import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'
import nodemailer from 'https://esm.sh/nodemailer@6.9.13'
import { ImapFlow } from 'https://esm.sh/imapflow@1.0.156'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  // CORS configuration
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const debugId = `test-conn-${Date.now()}`

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header', debugId }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    
    // Create supabase client to verify user
    const supabaseClient = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token)
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token', debugId }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const body = await req.json()
    const { type, companyId, accountId, config } = body

    if (!type || !['imap', 'smtp'].includes(type)) {
      return new Response(
        JSON.stringify({ error: "Invalid connection type. Must be 'imap' or 'smtp'.", debugId }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify company member role
    if (companyId) {
      const { data: member, error: memberError } = await supabaseClient
        .from('company_members')
        .select('role')
        .eq('company_id', companyId)
        .eq('user_id', user.id)
        .maybeSingle()

      if (memberError || !member) {
        return new Response(
          JSON.stringify({ error: 'Forbidden: nem vagy tagja a cégnek', debugId }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Resolve credentials (either passed from frontend form or fetched from DB + Vault)
    let username = config?.username?.trim()
    let password = config?.password
    let host = config?.host?.trim()
    let port = parseInt(config?.port)
    let encryption = config?.encryption // 'SSL/TLS', 'STARTTLS', 'NONE'

    // If password is masked/empty and we have an accountId or companyId, retrieve from Vault
    if ((!password || password === '***masked***') && (accountId || companyId)) {
      console.log(`[${debugId}] Password not provided/masked, fetching from Vault (accountId: ${accountId}, companyId: ${companyId})`)
      
      const serviceClient = createClient(
        supabaseUrl,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )

      let decSettings: any = null
      let decryptError: any = null

      if (accountId) {
        const res = await serviceClient
          .rpc('get_single_email_account', { p_account_id: accountId })
          .maybeSingle()
        decSettings = res.data
        decryptError = res.error
      } else if (companyId) {
        const res = await serviceClient
          .rpc('get_company_email_settings', { p_company_id: companyId })
          .maybeSingle()
        decSettings = res.data
        decryptError = res.error
      }

      if (decryptError || !decSettings) {
        console.error(`[${debugId}] Failed to decrypt email settings:`, decryptError)
        return new Response(
          JSON.stringify({ error: 'Beállítások nem találhatók vagy sikertelen jelszó feloldás', debugId }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (!host) host = type === 'imap' ? decSettings.imap_host : decSettings.smtp_host
      if (isNaN(port)) port = type === 'imap' ? decSettings.imap_port : decSettings.smtp_port
      if (!username) username = type === 'imap' ? decSettings.imap_username : decSettings.smtp_username
      if (!encryption) encryption = type === 'imap' ? decSettings.imap_encryption : decSettings.smtp_encryption
      password = type === 'imap' ? decSettings.imap_password : decSettings.smtp_password
    }

    if (!host || isNaN(port) || !username) {
      return new Response(
        JSON.stringify({ error: 'Hiányzó kötelező mezők (host, port, felhasználónév)', debugId }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!password) {
      return new Response(
        JSON.stringify({ error: 'Jelszó megadása kötelező', debugId }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Run connection test based on type
    if (type === 'imap') {
      console.log(`[${debugId}] Testing IMAP connection for: ${host}:${port}`)
      
      const secure = encryption === 'SSL/TLS' || port === 993;
      const client = new ImapFlow({
        host,
        port,
        secure,
        auth: {
          user: username,
          pass: password
        },
        logger: false,
        tls: {
          rejectUnauthorized: false
        },
        connectionTimeout: 10000,
        greetingTimeout: 10000
      })

      await client.connect()
      await client.logout()

      // If accountId is present, update status to valid
      if (accountId) {
        const serviceClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
        await serviceClient.from('company_email_accounts').update({
          imap_status: 'valid',
          imap_validation_error: null,
          imap_last_validated_at: new Date().toISOString()
        }).eq('id', accountId)
      }

      return new Response(
        JSON.stringify({ success: true, message: 'IMAP kapcsolat sikeresen tesztelve és hitelesítve.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } else {
      console.log(`[${debugId}] Testing SMTP connection for: ${host}:${port}`)
      
      const secure = encryption === 'SSL/TLS' || port === 465;
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: {
          user: username,
          pass: password
        },
        tls: {
          rejectUnauthorized: false
        },
        connectionTimeout: 10000
      })

      await transporter.verify()

      // If accountId is present, update status to valid
      if (accountId) {
        const serviceClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
        await serviceClient.from('company_email_accounts').update({
          smtp_status: 'valid',
          smtp_validation_error: null,
          smtp_last_validated_at: new Date().toISOString()
        }).eq('id', accountId)
      }

      return new Response(
        JSON.stringify({ success: true, message: 'SMTP kapcsolat sikeresen tesztelve és hitelesítve.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

  } catch (error: any) {
    console.error(`[${debugId}] Connection test failed:`, error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Kapcsolódási hiba lépett fel.',
        debugId 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
