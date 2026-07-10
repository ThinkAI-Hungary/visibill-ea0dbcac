import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from 'npm:resend@4.0.0'

const resend = new Resend(Deno.env.get('RESEND_API_KEY') as string)
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabaseUrl = Deno.env.get('SUPABASE_URL')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Mapping from notification type to accounty_email_preferences column
const PREF_MAP: Record<string, string> = {
  accounty_missing_invoice: 'missing_invoice_alert',
  accounty_deadline_reminder: 'deadline_reminder',
  accounty_client_status: 'client_status_change',
  accounty_approval: 'approval_request',
  accounty_weekly_report: 'weekly_report',
  accounty_monthly_report: 'monthly_report',
}

function wrapHtml(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="hu">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
    <div style="background:linear-gradient(135deg,#0f766e 0%,#14b8a6 100%);padding:24px 32px">
      <div style="color:#fff;font-size:20px;font-weight:700">eaisyBooks</div>
      <div style="color:rgba(255,255,255,0.8);font-size:12px;margin-top:4px">Könyvelőirodai menedzsment</div>
    </div>
    <div style="padding:28px 32px">
      <h2 style="color:#111827;font-size:18px;font-weight:600;margin:0 0 16px 0">${title}</h2>
      <div style="color:#374151;font-size:14px;line-height:1.6">${bodyHtml}</div>
    </div>
    <div style="background:#f3f4f6;padding:14px 32px;text-align:center">
      <p style="font-size:12px;color:#9ca3af;margin:0">Ez az értesítés automatikusan készült az eaisyBooks rendszerből.</p>
      <p style="font-size:12px;color:#9ca3af;margin:4px 0 0"><a href="https://app.visibill.hu/accounty/settings" style="color:#6b7280">Értesítési beállítások módosítása</a></p>
    </div>
  </div>
</body>
</html>`
}

function wrapClientHtml(title: string, bodyHtml: string, firmName?: string): string {
  const senderName = firmName || 'könyvelőirodája'
  return `<!DOCTYPE html>
<html lang="hu">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
    <div style="background:linear-gradient(135deg,#1e40af 0%,#3b82f6 100%);padding:24px 32px">
      <div style="color:#fff;font-size:20px;font-weight:700">${senderName}</div>
      <div style="color:rgba(255,255,255,0.8);font-size:12px;margin-top:4px">Dokumentum értesítés</div>
    </div>
    <div style="padding:28px 32px">
      <h2 style="color:#111827;font-size:18px;font-weight:600;margin:0 0 16px 0">${title}</h2>
      <div style="color:#374151;font-size:14px;line-height:1.6">${bodyHtml}</div>
    </div>
    <div style="background:#f3f4f6;padding:14px 32px;text-align:center">
      <p style="font-size:12px;color:#9ca3af;margin:0">Ez az értesítés a ${senderName} megbízásából készült.</p>
      <p style="font-size:12px;color:#9ca3af;margin:4px 0 0">Ha nem kíván több értesítést kapni, kérjük jelezze könyvelőjének.</p>
    </div>
  </div>
</body>
</html>`
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Allow both service-role key (internal/cron) and user JWT (frontend test)
    const authHeader = req.headers.get('Authorization') ?? ''
    const token = authHeader.replace('Bearer ', '')

    const supabase = createClient(supabaseUrl, serviceRoleKey)
    let callerUserId: string | null = null

    if (token === serviceRoleKey) {
      // Internal / server-to-server call — trust user_id from body
    } else {
      const { data: { user: jwtUser }, error: jwtError } = await supabase.auth.getUser(token)
      if (jwtError || !jwtUser) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      callerUserId = jwtUser.id
    }

    const body = await req.json()
    const { 
      user_id: bodyUserId, type, title, body_html, subject, company_name, company_id,
      recipient_type, recipient_email, recipient_name, firm_name,
    } = body
    const user_id = callerUserId || bodyUserId

    // ══════════════════════════════════════════════
    // MODE A: Client contact — direct email to client
    // ══════════════════════════════════════════════
    if (recipient_type === 'client_contact') {
      if (!recipient_email || !title || !body_html) {
        return new Response(JSON.stringify({ error: 'Missing fields for client_contact: recipient_email, title, body_html' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const html = wrapClientHtml(title, body_html, firm_name)
      const emailSubject = subject || `${title} — Dokumentum értesítés`

      const { data: sendData, error: sendError } = await resend.emails.send({
        from: 'Visibill <info@mail.visibill.hu>',
        to: [recipient_email],
        subject: emailSubject,
        html,
      })

      if (sendError) {
        console.error('[accounty-notify] Resend error (client):', sendError)
        return new Response(JSON.stringify({ error: sendError }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Log
      await supabase.from('outgoing_emails').insert({
        user_id: user_id || null,
        company_id: company_id || null,
        company_name: company_name || '',
        recipient_email,
        subject: emailSubject,
        category: 'client_notification',
        status: 'sent',
        resend_id: sendData?.id || null,
      }).then(() => {}).catch(() => {})

      console.log(`[accounty-notify] Sent client notification to ${recipient_email} (${recipient_name || 'N/A'}) — Resend: ${sendData?.id}`)
      return new Response(JSON.stringify({ success: true, resendId: sendData?.id, sentTo: recipient_email, mode: 'client_contact' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ══════════════════════════════════════════════
    // PUSH NOTIFICATION (Non-blocking invoke)
    // ══════════════════════════════════════════════
    if (user_id && type && title) {
      // Create a plain text excerpt from HTML
      const plainBody = (body_html || '').replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim().substring(0, 150);
      const targetUrl = company_id ? `/accounty/client/${company_id}` : '/accounty/dashboard';
      
      supabase.functions.invoke('send-web-push', {
        body: {
          user_id,
          type,
          title,
          body: plainBody,
          url: targetUrl
        }
      }).catch(err => console.error('[accounty-notify] Failed to invoke send-web-push:', err))
    }

    // ══════════════════════════════════════════════
    // MODE B: Accountant — existing flow (user lookup + pref check)
    // ══════════════════════════════════════════════
    if (!user_id || !type || !title || !body_html) {
      return new Response(JSON.stringify({ error: 'Missing fields: user_id, type, title, body_html' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 1. Get user email from auth
    const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(user_id)
    if (userError || !user?.email) {
      console.error('[accounty-notify] User lookup failed:', userError)
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 2. Check accounty email preferences — skip if opted out
    const prefColumn = PREF_MAP[type]
    if (prefColumn) {
      const { data: prefs } = await supabase
        .from('accounty_email_preferences')
        .select(prefColumn)
        .eq('user_id', user_id)
        .maybeSingle()

      if (!prefs || (prefs as any)[prefColumn] !== true) {
        console.log(`[accounty-notify] User ${user_id} has no prefs or opted out of ${type} (${prefColumn})`)
        return new Response(JSON.stringify({ skipped: true, reason: !prefs ? 'no_prefs_row' : 'opted_out' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    }

    // 3. Send email via Resend from info@mail.visibill.hu
    const html = wrapHtml(title, body_html)
    const emailSubject = subject || `${title} — eaisyBooks`

    const { data: sendData, error: sendError } = await resend.emails.send({
      from: 'eaisyBooks (Visibill) <info@mail.visibill.hu>',
      to: [user.email],
      subject: emailSubject,
      html,
    })

    if (sendError) {
      console.error('[accounty-notify] Resend error:', sendError)
      return new Response(JSON.stringify({ error: sendError }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 4. Log to outgoing_emails (optional, best-effort)
    await supabase.from('outgoing_emails').insert({
      user_id,
      company_id: company_id || null,
      company_name: company_name || 'eaisyBooks',
      recipient_email: user.email,
      subject: emailSubject,
      category: 'normal',
      message_id: null,
      status: 'sent',
      resend_id: sendData?.id || null,
    }).then(() => {}).catch(() => {})

    console.log(`[accounty-notify] Sent ${type} to ${user.email} (Resend ID: ${sendData?.id})`)
    return new Response(JSON.stringify({ success: true, resendId: sendData?.id, sentTo: user.email }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[accounty-notify] Error:', msg)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
