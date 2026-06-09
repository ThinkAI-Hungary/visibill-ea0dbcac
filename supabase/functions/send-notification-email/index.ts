import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from 'npm:resend@4.0.0'

const resend = new Resend(Deno.env.get('RESEND_API_KEY') as string)
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabaseUrl = Deno.env.get('SUPABASE_URL')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Mapping from notification type to user_email_preferences column
const PREF_MAP: Record<string, string> = {
  nav_sync_complete: 'nav_sync_complete',
  bank_statement_processed: 'bank_statement_processed',
  bank_statement_error: 'bank_statement_processed',
  salary_processed: 'salary_processed',
  salary_error: 'salary_processed',
  payment_due_soon: 'payment_reminders',
  member_joined: 'team_notifications',
  subscription_expiring: 'subscription_warnings',
  subscription_expired: 'subscription_warnings',
  missing_invoices: 'missing_invoices',
  email_invoice_processed: 'email_invoice_processed',
  email_invoice_error: 'email_invoice_processed',
  monthly_summary: 'monthly_summary',
  transaction_matching_complete: 'transaction_matched',
}

function wrapHtml(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="hu">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
    <div style="background:#111827;padding:24px 32px">
      <div style="color:#fff;font-size:20px;font-weight:700">Visibill</div>
    </div>
    <div style="padding:28px 32px">
      <h2 style="color:#111827;font-size:18px;font-weight:600;margin:0 0 16px 0">${title}</h2>
      <div style="color:#374151;font-size:14px;line-height:1.6">${bodyHtml}</div>
    </div>
    <div style="background:#f3f4f6;padding:14px 32px;text-align:center">
      <p style="font-size:12px;color:#9ca3af;margin:0">Ez az \u00e9rtes\u00edt\u00e9s automatikusan k\u00e9sz\u00fclt a Visibill rendszerb\u0151l.</p>
      <p style="font-size:12px;color:#9ca3af;margin:4px 0 0"><a href="https://app.visibill.hu/settings" style="color:#6b7280">\u00c9rtes\u00edt\u00e9si be\u00e1ll\u00edt\u00e1sok m\u00f3dos\u00edt\u00e1sa</a></p>
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
    // Allow both service-role key (internal) and user JWT (frontend)
    const authHeader = req.headers.get('Authorization') ?? ''
    const token = authHeader.replace('Bearer ', '')

    const supabase = createClient(supabaseUrl, serviceRoleKey)
    let callerUserId: string | null = null

    if (token === serviceRoleKey) {
      // Internal / server-to-server call — trust user_id from body
    } else {
      // Frontend call — validate JWT and extract user
      const { data: { user: jwtUser }, error: jwtError } = await supabase.auth.getUser(token)
      if (jwtError || !jwtUser) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      callerUserId = jwtUser.id
    }

    const { user_id: bodyUserId, to_email, type, title, body_html, subject } = await req.json()
    const user_id = callerUserId || bodyUserId

    if (!user_id || !type || !title || !body_html) {
      return new Response(JSON.stringify({ error: 'Missing fields' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 1. Get user email
    const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(user_id)
    if (userError || !user?.email) {
      console.error('[notify] User lookup failed:', userError)
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }


    // 2. Check email preferences
    const prefColumn = PREF_MAP[type]
    if (prefColumn) {
      const { data: prefs } = await supabase
        .from('user_email_preferences')
        .select(prefColumn)
        .eq('user_id', user_id)
        .maybeSingle()

      if (prefs && (prefs as any)[prefColumn] === false) {
        console.log(`[notify] User ${user_id} opted out of ${type} (${prefColumn}=false)`)
        return new Response(JSON.stringify({ skipped: true, reason: 'opted_out' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    }

    // 3. Send email — use to_email if provided, otherwise user's auth email
    const recipientEmail = to_email || user.email
    const html = wrapHtml(title, body_html)
    const emailSubject = subject || `${title} — Visibill`
    
    const { error: sendError } = await resend.emails.send({
      from: 'Visibill <noreply@mail.visibill.hu>',
      to: [recipientEmail],
      subject: emailSubject,
      html,
    })

    if (sendError) {
      console.error('[notify] Resend error:', sendError)
      return new Response(JSON.stringify({ error: sendError }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log(`[notify] Sent ${type} to ${user.email}`)
    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[notify] Error:', msg)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
