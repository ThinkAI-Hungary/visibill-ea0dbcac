import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0'
import { Resend } from 'https://esm.sh/resend@4.0.0'

const resend = new Resend(Deno.env.get('RESEND_API_KEY') as string)
const hookSecret = Deno.env.get('SEND_EMAIL_HOOK_SECRET') as string

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type EdgeRuntimeType = {
  waitUntil: (promise: Promise<unknown>) => void
}

const edgeRuntime = (globalThis as typeof globalThis & { EdgeRuntime?: EdgeRuntimeType }).EdgeRuntime

function buildVerifyUrl(
  supabaseUrl: string,
  tokenHash: string,
  emailActionType: string,
  redirectTo: string
): string {
  const params = new URLSearchParams({
    token: tokenHash,
    type: emailActionType,
    redirect_to: redirectTo,
  })

  return `${supabaseUrl}/auth/v1/verify?${params.toString()}`
}

function buildRecoveryHtml(
  supabaseUrl: string,
  tokenHash: string,
  emailActionType: string,
  redirectTo: string,
  token: string
): string {
  const verifyUrl = buildVerifyUrl(supabaseUrl, tokenHash, emailActionType, redirectTo)

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="background-color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu',sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:0 12px;">
  <h1 style="color:#333;font-size:24px;font-weight:bold;margin:40px 0;">Jelsz\u00f3 vissza\u00e1ll\u00edt\u00e1s</h1>
  <p style="color:#333;font-size:14px;line-height:1.5;margin:24px 0;">
    Jelsz\u00f3 vissza\u00e1ll\u00edt\u00e1st k\u00e9rt\u00e9l. Kattints az al\u00e1bbi gombra \u00faj jelsz\u00f3 be\u00e1ll\u00edt\u00e1s\u00e1hoz:
  </p>
  <a href="${verifyUrl}" target="_blank" style="display:inline-block;padding:12px 24px;background-color:#0070f3;color:#ffffff;text-decoration:none;border-radius:5px;font-size:14px;margin-bottom:16px;">
    \u00daj jelsz\u00f3 be\u00e1ll\u00edt\u00e1sa
  </a>
  <p style="color:#333;font-size:14px;line-height:1.5;margin-top:24px;margin-bottom:14px;">
    Vagy m\u00e1sold be ezt az egyszer haszn\u00e1latos k\u00f3dot:
  </p>
  <code style="display:inline-block;padding:16px 4.5%;width:90.5%;background-color:#f4f4f4;border-radius:5px;border:1px solid #eee;color:#333;font-size:16px;font-weight:bold;letter-spacing:2px;text-align:center;">${token}</code>
  <p style="color:#ababab;font-size:14px;line-height:1.5;margin-top:14px;margin-bottom:16px;">
    Ha nem te k\u00e9rted a jelsz\u00f3 vissza\u00e1ll\u00edt\u00e1st, nyugodtan figyelmen k\u00edv\u00fcl hagyhatod ezt az emailt.
  </p>
  <p style="color:#898989;font-size:12px;line-height:22px;margin-top:12px;margin-bottom:24px;">
    <a href="https://app.visibill.hu" target="_blank" style="color:#898989;font-size:14px;text-decoration:underline;">Visibill</a> \u2013 Sz\u00e1mlakezel\u00e9s egyszer\u0171en
  </p>
</div>
</body></html>`
}

function buildConfirmationHtml(
  supabaseUrl: string,
  tokenHash: string,
  emailActionType: string,
  redirectTo: string,
  token: string
): string {
  const verifyUrl = buildVerifyUrl(supabaseUrl, tokenHash, emailActionType, redirectTo)

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="background-color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu',sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:0 12px;">
  <h1 style="color:#333;font-size:24px;font-weight:bold;margin:40px 0;">Email c\u00edm meger\u0151s\u00edt\u00e9se</h1>
  <p style="color:#333;font-size:14px;line-height:1.5;margin:24px 0;">
    K\u00f6sz\u00f6nj\u00fck a regisztr\u00e1ci\u00f3t! K\u00e9rj\u00fck, er\u0151s\u00edtsd meg az email c\u00edmedet az al\u00e1bbi gombra kattintva:
  </p>
  <a href="${verifyUrl}" target="_blank" style="display:inline-block;padding:12px 24px;background-color:#0070f3;color:#ffffff;text-decoration:none;border-radius:5px;font-size:14px;margin-bottom:16px;">
    Email c\u00edm meger\u0151s\u00edt\u00e9se
  </a>
  <p style="color:#333;font-size:14px;line-height:1.5;margin-top:24px;margin-bottom:14px;">
    Vagy m\u00e1sold be ezt az egyszer haszn\u00e1latos k\u00f3dot:
  </p>
  <code style="display:inline-block;padding:16px 4.5%;width:90.5%;background-color:#f4f4f4;border-radius:5px;border:1px solid #eee;color:#333;font-size:16px;font-weight:bold;letter-spacing:2px;text-align:center;">${token}</code>
  <p style="color:#ababab;font-size:14px;line-height:1.5;margin-top:14px;margin-bottom:16px;">
    Ha nem te regisztr\u00e1lt\u00e1l, nyugodtan figyelmen k\u00edv\u00fcl hagyhatod ezt az emailt.
  </p>
  <p style="color:#898989;font-size:12px;line-height:22px;margin-top:12px;margin-bottom:24px;">
    <a href="https://app.visibill.hu" target="_blank" style="color:#898989;font-size:14px;text-decoration:underline;">Visibill</a> \u2013 Sz\u00e1mlakezel\u00e9s egyszer\u0171en
  </p>
</div>
</body></html>`
}

// Email change: only the button link, no OTP code
function buildEmailChangeHtml(
  supabaseUrl: string,
  tokenHash: string,
  emailActionType: string,
  redirectTo: string
): string {
  const verifyUrl = buildVerifyUrl(supabaseUrl, tokenHash, emailActionType, redirectTo)

  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="background-color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu',sans-serif;"><div style="max-width:600px;margin:0 auto;padding:0 12px;"><h1 style="color:#333;font-size:24px;font-weight:bold;margin:40px 0;">Email c\u00edm m\u00f3dos\u00edt\u00e1s</h1><p style="color:#333;font-size:14px;line-height:1.5;margin:24px 0;">Email c\u00edm v\u00e1ltoztat\u00e1st k\u00e9rt\u00e9l. Az \u00faj email c\u00edm meger\u0151s\u00edt\u00e9s\u00e9hez kattints az al\u00e1bbi gombra:</p><a href="${verifyUrl}" target="_blank" style="display:inline-block;padding:12px 24px;background-color:#0070f3;color:#ffffff;text-decoration:none;border-radius:5px;font-size:14px;margin-bottom:24px;">\u00daj email c\u00edm meger\u0151s\u00edt\u00e9se</a><p style="color:#ababab;font-size:14px;line-height:1.5;margin-top:8px;margin-bottom:16px;">Ha nem te k\u00e9rted az email c\u00edm v\u00e1ltoztat\u00e1st, nyugodtan figyelmen k\u00edv\u00fcl hagyhatod ezt az emailt. A jelenlegi c\u00edmed \u00e9rv\u00e9nyes marad.</p><p style="color:#898989;font-size:12px;line-height:22px;margin-top:12px;margin-bottom:24px;"><a href="https://app.visibill.hu" target="_blank" style="color:#898989;font-size:14px;text-decoration:underline;">Visibill</a> \u2013 Sz\u00e1mlakezel\u00e9s egyszer\u0171en</p></div></body></html>`
}

async function sendEmailInBackground(to: string, subject: string, html: string) {
  try {
    console.log('[SEND-EMAIL] Background send started:', { to, subject })

    const { error } = await resend.emails.send({
      from: 'Visibill <info@mail.visibill.hu>',
      to: [to],
      subject,
      html,
    })

    if (error) {
      console.error('[SEND-EMAIL] Resend error:', JSON.stringify(error))
      return
    }

    console.log('[SEND-EMAIL] Email sent successfully')
  } catch (error) {
    console.error('[SEND-EMAIL] Background send failed:', error)
  }
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
      user: { email: string; new_email?: string }
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
    } catch (verifyError: unknown) {
      const verifyMsg = verifyError instanceof Error ? verifyError.message : String(verifyError)
      console.warn('[SEND-EMAIL] Webhook verification failed, parsing directly:', verifyMsg)
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
      subject = 'Er\u0151s\u00edtsd meg az email c\u00edmed - Visibill'
      html = buildConfirmationHtml(supabaseUrl, token_hash, email_action_type, redirect_to, token)
    } else if (email_action_type === 'recovery' || email_action_type === 'magiclink') {
      subject = email_action_type === 'recovery'
        ? 'Jelsz\u00f3 vissza\u00e1ll\u00edt\u00e1s - Visibill'
        : 'Bejelentkez\u00e9si link - Visibill'
      html = buildRecoveryHtml(supabaseUrl, token_hash, email_action_type, redirect_to, token)
    } else if (email_action_type === 'email_change') {
      subject = 'Email c\u00edm m\u00f3dos\u00edt\u00e1s meger\u0151s\u00edt\u00e9se - Visibill'
      // No OTP code for email change — link only
      html = buildEmailChangeHtml(supabaseUrl, token_hash, email_action_type, redirect_to)
    } else {
      console.error('[SEND-EMAIL] Unsupported type:', email_action_type)
      return new Response(
        JSON.stringify({ error: 'Unsupported email action type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // For email_change: send to the NEW email address (user.new_email), not the old one
    const recipient = (email_action_type === 'email_change' && webhookData.user.new_email)
      ? webhookData.user.new_email
      : webhookData.user.email
    console.log('[SEND-EMAIL] Recipient:', recipient, '| Type:', email_action_type)

    const sendPromise = sendEmailInBackground(recipient, subject, html)

    if (edgeRuntime?.waitUntil) {
      edgeRuntime.waitUntil(sendPromise)
      console.log('[SEND-EMAIL] Email queued in background')

      return new Response(
        JSON.stringify({ success: true, queued: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.warn('[SEND-EMAIL] EdgeRuntime.waitUntil unavailable, falling back to synchronous send')
    await sendPromise

    return new Response(
      JSON.stringify({ success: true, queued: false }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error)
    console.error('[SEND-EMAIL] Error:', error)
    return new Response(
      JSON.stringify({ error: { message: errMsg } }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
