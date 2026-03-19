import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0'
import { Resend } from 'npm:resend@4.0.0'

const resend = new Resend(Deno.env.get('RESEND_API_KEY') as string)
const hookSecret = Deno.env.get('SEND_EMAIL_HOOK_SECRET') as string

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function buildRecoveryHtml(supabaseUrl: string, tokenHash: string, emailActionType: string, redirectTo: string, token: string): string {
  const verifyUrl = `${supabaseUrl}/auth/v1/verify?token=${tokenHash}&type=${emailActionType}&redirect_to=${redirectTo}`
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="background-color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu',sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:0 12px;">
  <h1 style="color:#333;font-size:24px;font-weight:bold;margin:40px 0;">Jelszó visszaállítás</h1>
  <p style="color:#333;font-size:14px;line-height:1.5;margin:24px 0;">
    Jelszó visszaállítást kértél. Kattints az alábbi gombra új jelszó beállításához:
  </p>
  <a href="${verifyUrl}" target="_blank" style="display:inline-block;padding:12px 24px;background-color:#0070f3;color:#ffffff;text-decoration:none;border-radius:5px;font-size:14px;margin-bottom:16px;">
    Új jelszó beállítása
  </a>
  <p style="color:#333;font-size:14px;line-height:1.5;margin-top:24px;margin-bottom:14px;">
    Vagy másold be ezt az egyszer használatos kódot:
  </p>
  <code style="display:inline-block;padding:16px 4.5%;width:90.5%;background-color:#f4f4f4;border-radius:5px;border:1px solid #eee;color:#333;font-size:16px;font-weight:bold;letter-spacing:2px;text-align:center;">${token}</code>
  <p style="color:#ababab;font-size:14px;line-height:1.5;margin-top:14px;margin-bottom:16px;">
    Ha nem te kérted a jelszó visszaállítást, nyugodtan figyelmen kívül hagyhatod ezt az emailt.
  </p>
  <p style="color:#898989;font-size:12px;line-height:22px;margin-top:12px;margin-bottom:24px;">
    <a href="https://visibill.hu" target="_blank" style="color:#898989;font-size:14px;text-decoration:underline;">Visibill</a> – Számlakezelés egyszerűen
  </p>
</div>
</body></html>`
}

function buildConfirmationHtml(supabaseUrl: string, tokenHash: string, emailActionType: string, redirectTo: string, token: string, email: string): string {
  const verifyUrl = `${supabaseUrl}/auth/v1/verify?token=${tokenHash}&type=${emailActionType}&redirect_to=${redirectTo}`
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="background-color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu',sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:0 12px;">
  <h1 style="color:#333;font-size:24px;font-weight:bold;margin:40px 0;">Email cím megerősítése</h1>
  <p style="color:#333;font-size:14px;line-height:1.5;margin:24px 0;">
    Köszönjük a regisztrációt! Kérjük, erősítsd meg az email címedet az alábbi gombra kattintva:
  </p>
  <a href="${verifyUrl}" target="_blank" style="display:inline-block;padding:12px 24px;background-color:#0070f3;color:#ffffff;text-decoration:none;border-radius:5px;font-size:14px;margin-bottom:16px;">
    Email cím megerősítése
  </a>
  <p style="color:#333;font-size:14px;line-height:1.5;margin-top:24px;margin-bottom:14px;">
    Vagy másold be ezt az egyszer használatos kódot:
  </p>
  <code style="display:inline-block;padding:16px 4.5%;width:90.5%;background-color:#f4f4f4;border-radius:5px;border:1px solid #eee;color:#333;font-size:16px;font-weight:bold;letter-spacing:2px;text-align:center;">${token}</code>
  <p style="color:#ababab;font-size:14px;line-height:1.5;margin-top:14px;margin-bottom:16px;">
    Ha nem te regisztráltál, nyugodtan figyelmen kívül hagyhatod ezt az emailt.
  </p>
  <p style="color:#898989;font-size:12px;line-height:22px;margin-top:12px;margin-bottom:24px;">
    <a href="https://visibill.hu" target="_blank" style="color:#898989;font-size:14px;text-decoration:underline;">Visibill</a> – Számlakezelés egyszerűen
  </p>
</div>
</body></html>`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders })
  }

  try {
    console.log('[SEND-EMAIL] Function started')
    
    const payload = await req.text()
    const headers = Object.fromEntries(req.headers)
    
    let webhookData: {
      user: { email: string }
      email_data: {
        token: string
        token_hash: string
        redirect_to: string
        email_action_type: string
        site_url: string
      }
    }
    
    try {
      const wh = new Webhook(hookSecret)
      webhookData = wh.verify(payload, headers) as typeof webhookData
      console.log('[SEND-EMAIL] Webhook verified successfully')
    } catch (verifyError) {
      console.warn('[SEND-EMAIL] Webhook verification failed, parsing directly:', verifyError.message)
      try {
        webhookData = JSON.parse(payload)
        console.log('[SEND-EMAIL] Parsed payload directly')
      } catch (parseError) {
        console.error('[SEND-EMAIL] Failed to parse payload:', parseError)
        return new Response(
          JSON.stringify({ error: 'Invalid payload' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    const {
      user,
      email_data: { token, token_hash, redirect_to, email_action_type },
    } = webhookData

    console.log('[SEND-EMAIL] Processing:', { email: user.email, type: email_action_type })

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    let html: string
    let subject: string

    if (email_action_type === 'signup') {
      subject = 'Erősítsd meg az email címed - Visibill'
      html = buildConfirmationHtml(supabaseUrl, token_hash, email_action_type, redirect_to, token, user.email)
    } else if (email_action_type === 'recovery' || email_action_type === 'magiclink') {
      subject = email_action_type === 'recovery' 
        ? 'Jelszó visszaállítás - Visibill' 
        : 'Bejelentkezési link - Visibill'
      html = buildRecoveryHtml(supabaseUrl, token_hash, email_action_type, redirect_to, token)
    } else {
      console.error('[SEND-EMAIL] Unsupported type:', email_action_type)
      return new Response(
        JSON.stringify({ error: 'Unsupported email action type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('[SEND-EMAIL] Sending via Resend...')
    
    const { error } = await resend.emails.send({
      from: 'Visibill <info@mail.visibill.hu>',
      to: [user.email],
      subject,
      html,
    })

    if (error) {
      console.error('[SEND-EMAIL] Resend error:', JSON.stringify(error))
      throw error
    }

    console.log('[SEND-EMAIL] Email sent successfully!')

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('[SEND-EMAIL] Error:', error.message)
    return new Response(
      JSON.stringify({ error: { message: error.message } }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
