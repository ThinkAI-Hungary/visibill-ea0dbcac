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
    const { type, companyId, config } = body

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
    const host = config?.host?.trim()
    const port = parseInt(config?.port)
    const encryption = config?.encryption // 'SSL/TLS', 'STARTTLS', 'NONE'

    if (!host || isNaN(port) || !username) {
      return new Response(
        JSON.stringify({ error: 'Missing required configuration fields (host, port, username)', debugId }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // If password is masked/empty and we have a companyId, retrieve the existing password from Vault
    if ((!password || password === '***masked***') && companyId) {
      console.log(`[${debugId}] Password not provided, fetching from Vault for company: ${companyId}`)
      
      const serviceClient = createClient(
        supabaseUrl,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )

      // Fetch decrypted settings using the new RPC function
      const { data: decSettings, error: decryptError } = await serviceClient
        .rpc('get_company_email_settings', { p_company_id: companyId })
        .maybeSingle()

      if (decryptError || !decSettings) {
        console.error(`[${debugId}] Failed to decrypt email settings:`, decryptError)
        return new Response(
          JSON.stringify({ error: 'Beállítások nem találhatók vagy sikertelen jelszó feloldás', debugId }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      password = type === 'imap' ? decSettings.imap_password : decSettings.smtp_password
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
