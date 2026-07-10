import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from 'npm:resend@4.0.0'

const resend = new Resend(Deno.env.get('RESEND_API_KEY') as string)
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabaseUrl = Deno.env.get('SUPABASE_URL')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

// Format the email HTML
function wrapHtml(bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="hu">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
    <div style="background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);padding:24px 32px">
      <div style="color:#fff;font-size:20px;font-weight:700">eaisyBooks Digest</div>
      <div style="color:rgba(255,255,255,0.8);font-size:12px;margin-top:4px">Napi összefoglaló jelentés</div>
    </div>
    <div style="padding:28px 32px">
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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const cronSecret = Deno.env.get('CRON_SECRET_ACCOUNTY')
    const secretHeader = req.headers.get('x-cron-secret')
    
    // Auth bypass for testing or internal invocations
    const authHeader = req.headers.get('Authorization')
    let authorized = false

    if (cronSecret && secretHeader === cronSecret) {
      authorized = true
    } else if (authHeader) {
      const token = authHeader.replace('Bearer ', '')
      if (token === serviceRoleKey) authorized = true
    }

    if (!authorized) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // Determine current hour in CET/CEST for matching delivery_time
    const now = new Date()
    // Hungarian time is UTC+1 (or UTC+2 in summer). Let's use Intl.DateTimeFormat
    const formatter = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Budapest', hour: '2-digit', hour12: false })
    const hourStr = formatter.format(now).padStart(2, '0') // e.g. "08"
    const currentDeliveryTime = `${hourStr}:00`

    // Determine current day for frequency filtering
    const dayOfWeek = now.getDay() // 0 = Sun, 1 = Mon, ..., 6 = Sat
    const dayOfMonth = now.getDate() // 1-31

    console.log(`[accounty-digest] Running for delivery_time: ${currentDeliveryTime}`)

    // 1. Fetch preferences
    const { data: prefs, error: prefsError } = await supabase
      .from('accounty_email_preferences')
      .select('user_id, digest_frequency, digest_delivery_time, digest_include_kpis, digest_include_deadlines, digest_include_missing_items, digest_include_client_summary, digest_include_audit_log')
      .eq('digest_enabled', true)
      .eq('digest_delivery_time', currentDeliveryTime)

    if (prefsError) throw prefsError

    if (!prefs || prefs.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No active digests for this hour.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    let emailsSent = 0

    for (const pref of prefs) {
      // Frequency check
      if (pref.digest_frequency === 'daily' && (dayOfWeek === 0 || dayOfWeek === 6)) {
        continue // Skip weekends for daily
      }
      if (pref.digest_frequency === 'weekly' && dayOfWeek !== 1) {
        continue // Only Monday for weekly
      }
      if (pref.digest_frequency === 'biweekly' && dayOfMonth !== 1 && dayOfMonth !== 15) {
        continue // Only 1st and 15th
      }

      // Fetch user email
      const { data: { user } } = await supabase.auth.admin.getUserById(pref.user_id)
      if (!user || !user.email) continue

      // Fetch assigned companies
      const { data: assignments } = await supabase
        .from('accounty_assignments')
        .select('company_id')
        .eq('accountant_user_id', pref.user_id)
      
      const companyIds = assignments?.map(a => a.company_id) || []
      
      if (companyIds.length === 0) continue // No companies, no digest

      let htmlBlocks: string[] = []

      // KPI Mutatók
      if (pref.digest_include_kpis) {
        const { data: kpiData } = await supabase
          .from('accounty_assignments')
          .select('kanban_status')
          .in('company_id', companyIds)
        
        const criticalCount = kpiData?.filter(d => d.kanban_status === 'kritikus').length || 0
        const processingCount = kpiData?.filter(d => d.kanban_status === 'feldolgozandó').length || 0
        
        htmlBlocks.push(`
          <h3 style="color:#111827;margin-top:0;">KPI Mutatók</h3>
          <p>Kritikus státuszú ügyfelek: <strong>${criticalCount}</strong></p>
          <p>Feldolgozásra vár: <strong>${processingCount}</strong></p>
          <hr style="border:0;border-top:1px solid #e5e7eb;margin:20px 0;">
        `)
      }

      // Határidők
      if (pref.digest_include_deadlines) {
        // Just a mock/summary query, in reality we should fetch upcoming deadlines
        const { data: deadlines } = await supabase
          .from('accounty_deadlines')
          .select('title, due_date')
          .in('company_id', companyIds)
          .eq('status', 'pending')
          .gte('due_date', new Date().toISOString().split('T')[0])
          .order('due_date', { ascending: true })
          .limit(5)
        
        htmlBlocks.push(`
          <h3 style="color:#111827;margin-top:0;">Közelgő Határidők</h3>
          ${deadlines && deadlines.length > 0 
            ? `<ul>${deadlines.map(d => `<li>${d.due_date}: ${d.title}</li>`).join('')}</ul>` 
            : '<p>Nincs közeli határidő.</p>'}
          <hr style="border:0;border-top:1px solid #e5e7eb;margin:20px 0;">
        `)
      }

      // Hiányzó tételek
      if (pref.digest_include_missing_items) {
        const { data: missing } = await supabase
          .from('accounty_missing_items')
          .select('id')
          .in('company_id', companyIds)
          .eq('status', 'open')
        
        htmlBlocks.push(`
          <h3 style="color:#111827;margin-top:0;">Hiányzó Tételek</h3>
          <p>Összes nyitott hiányzó tétel a portfóliódban: <strong>${missing?.length || 0} db</strong></p>
          <hr style="border:0;border-top:1px solid #e5e7eb;margin:20px 0;">
        `)
      }

      // Ügyfél összesítő
      if (pref.digest_include_client_summary) {
        htmlBlocks.push(`
          <h3 style="color:#111827;margin-top:0;">Ügyfél Összesítő</h3>
          <p>Összes ügyfél: <strong>${companyIds.length}</strong></p>
          <hr style="border:0;border-top:1px solid #e5e7eb;margin:20px 0;">
        `)
      }

      // Audit napló
      if (pref.digest_include_audit_log) {
        htmlBlocks.push(`
          <h3 style="color:#111827;margin-top:0;">Audit Napló</h3>
          <p>Itt szerepelnének a fontosabb események.</p>
        `)
      }

      if (htmlBlocks.length === 0) {
        htmlBlocks.push('<p>Nem kértél egyetlen modult sem az összefoglalóba.</p>')
      }

      const finalHtml = wrapHtml(htmlBlocks.join(''))

      // Send via Resend
      const { error: sendError } = await resend.emails.send({
        from: 'eaisyBooks (Visibill) <info@mail.visibill.hu>',
        to: [user.email],
        subject: `Napi eaisyBooks Összefoglaló (${now.toISOString().split('T')[0]})`,
        html: finalHtml,
      })

      if (sendError) {
        console.error(`[accounty-digest] Resend error for user ${pref.user_id}:`, sendError)
      } else {
        emailsSent++
      }
    }

    return new Response(JSON.stringify({ success: true, emailsSent }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err: any) {
    console.error('[accounty-digest] Error:', err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
