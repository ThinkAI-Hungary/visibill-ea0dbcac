import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const cronSecret = Deno.env.get('CRON_SECRET')
    const provided = req.headers.get('x-cron-secret')
    if (!cronSecret || provided !== cronSecret) {
      return new Response('Forbidden', { status: 403, headers: corsHeaders })
    }

    console.log('[subscription-check] Starting daily check...')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceKey)

    const now = new Date()
    const sevenDaysFromNow = new Date(now)
    sevenDaysFromNow.setDate(now.getDate() + 7)

    // Find subscriptions expiring within 7 days
    const { data: expiringSubs } = await supabase
      .from('user_subscriptions')
      .select('user_id, plan_type, current_period_end')
      .eq('status', 'active')
      .lte('current_period_end', sevenDaysFromNow.toISOString())
      .gte('current_period_end', now.toISOString())

    // Find already expired subscriptions
    const { data: expiredSubs } = await supabase
      .from('user_subscriptions')
      .select('user_id, plan_type, current_period_end')
      .eq('status', 'active')
      .lt('current_period_end', now.toISOString())

    let notificationCount = 0

    // Notify users with expiring subscriptions
    for (const sub of (expiringSubs || [])) {
      const endDate = new Date(sub.current_period_end)
      const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

      try {
        await fetch(`${supabaseUrl}/functions/v1/send-notification-email`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: sub.user_id,
            type: 'subscription_expiring',
            title: 'El\u0151fizet\u00e9s hamarosan lej\u00e1r',
            body_html: `<p>Az el\u0151fizet\u00e9sed <strong>${daysLeft} nap m\u00falva</strong> (${endDate.toLocaleDateString('hu-HU')}) lej\u00e1r.</p><p>Hosszabb\u00edtsd meg id\u0151ben, hogy ne vesz\u00edtsd el a hozz\u00e1f\u00e9r\u00e9sed a Visibill funkci\u00f3khoz.</p><p><a href=\"https://app.visibill.hu/pricing\" style=\"display:inline-block;padding:10px 20px;background:#0070f3;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;margin-top:8px\">El\u0151fizet\u00e9s meghosszabb\u00edt\u00e1sa</a></p>`,
          }),
        })
        notificationCount++
      } catch (e) {
        console.error(`[subscription-check] Notify failed for ${sub.user_id}:`, e)
      }
    }

    // Notify users with expired subscriptions
    for (const sub of (expiredSubs || [])) {
      try {
        await fetch(`${supabaseUrl}/functions/v1/send-notification-email`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: sub.user_id,
            type: 'subscription_expired',
            title: 'El\u0151fizet\u00e9s lej\u00e1rt',
            body_html: `<p>Az el\u0151fizet\u00e9sed <strong>lej\u00e1rt</strong>. Egyes funkci\u00f3k korl\u00e1tozottak lehetnek.</p><p>\u00daj\u00edtsd meg az el\u0151fizet\u00e9sed a teljes hozz\u00e1f\u00e9r\u00e9s vissza\u00e1ll\u00edt\u00e1s\u00e1hoz.</p><p><a href=\"https://app.visibill.hu/pricing\" style=\"display:inline-block;padding:10px 20px;background:#0070f3;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;margin-top:8px\">El\u0151fizet\u00e9s meg\u00faj\u00edt\u00e1sa</a></p>`,
          }),
        })
        notificationCount++
      } catch (e) {
        console.error(`[subscription-check] Notify failed for ${sub.user_id}:`, e)
      }
    }

    console.log(`[subscription-check] Done. ${notificationCount} notifications, ${expiringSubs?.length || 0} expiring, ${expiredSubs?.length || 0} expired.`)

    return new Response(JSON.stringify({ 
      success: true, 
      expiring: expiringSubs?.length || 0,
      expired: expiredSubs?.length || 0,
      notifications: notificationCount 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[subscription-check] Error:', msg)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
