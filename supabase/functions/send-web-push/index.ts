import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Mapping from notification type to accounty_push_preferences column
const PREF_MAP: Record<string, string> = {
  accounty_missing_invoice: 'missing_invoice_alert',
  accounty_deadline_reminder: 'deadline_reminder',
  accounty_client_status: 'client_status_change',
  accounty_approval: 'approval_request',
  accounty_critical_alert: 'critical_alerts',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const token = authHeader.replace('Bearer ', '')

    const supabase = createClient(supabaseUrl, serviceRoleKey)
    let callerUserId: string | null = null

    if (token !== serviceRoleKey) {
      const { data: { user: jwtUser }, error: jwtError } = await supabase.auth.getUser(token)
      if (jwtError || !jwtUser) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      callerUserId = jwtUser.id
    }

    const body = await req.json()
    const { user_id: bodyUserId, type, title, body: pushBody, url } = body
    const user_id = callerUserId || bodyUserId

    if (!user_id || !type || !title) {
      return new Response(JSON.stringify({ error: 'Missing fields: user_id, type, title' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 1. Check if user has push enabled globally and for this specific type
    const prefColumn = PREF_MAP[type]
    if (prefColumn) {
      const { data: prefs } = await supabase
        .from('accounty_push_preferences')
        .select(`enabled, ${prefColumn}`)
        .eq('user_id', user_id)
        .maybeSingle()

      if (!prefs || prefs.enabled !== true || (prefs as any)[prefColumn] !== true) {
        console.log(`[send-web-push] User ${user_id} has push disabled or opted out of ${type}`)
        return new Response(JSON.stringify({ skipped: true, reason: 'opted_out' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    }

    // 2. Fetch active subscriptions for this user
    const { data: subs } = await supabase
      .from('accounty_push_subscriptions')
      .select('*')
      .eq('user_id', user_id)

    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ skipped: true, reason: 'no_subscriptions' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 3. Setup web-push
    webpush.setVapidDetails(
      'mailto:info@visibill.hu',
      Deno.env.get('VAPID_PUBLIC_KEY') as string,
      Deno.env.get('VAPID_PRIVATE_KEY') as string
    )

    const payload = JSON.stringify({
      title,
      body: pushBody || '',
      icon: '/eaisybill_favicon.svg',
      badge: '/eaisybill_favicon.svg',
      url: url || '/'
    })

    const results = []
    
    // 4. Send to all devices
    for (const sub of subs) {
      try {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            auth: sub.auth_key,
            p256dh: sub.p256dh_key
          }
        }
        await webpush.sendNotification(pushSubscription, payload)
        results.push({ endpoint: sub.endpoint, success: true })
      } catch (err: any) {
        console.error(`[send-web-push] Failed to send to ${sub.endpoint}:`, err)
        // Ha az endpoint már nem él (Gone 410), töröljük a DB-ből
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabase.from('accounty_push_subscriptions').delete().eq('endpoint', sub.endpoint)
        }
        results.push({ endpoint: sub.endpoint, success: false, error: err.message })
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[send-web-push] Error:', msg)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
