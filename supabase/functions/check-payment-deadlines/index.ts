import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface NavInvoice {
  id: string
  invoice_number: string
  payment_date: string
  invoice_gross_amount: number | null
  supplier_name: string | null
}

interface ManualInvoice {
  id: string
  bizonylatsorszam: string | null
  fizetesi_hatarido: string
  brutto_vegosszeg: number | null
  elado_nev: string | null
}

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

    console.log('[payment-deadlines] Starting daily check...')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceKey)

    const today = new Date()
    const threeDaysFromNow = new Date(today)
    threeDaysFromNow.setDate(today.getDate() + 3)
    const todayStr = today.toISOString().split('T')[0]
    const thresholdStr = threeDaysFromNow.toISOString().split('T')[0]

    // Get all companies
    const { data: companies } = await supabase
      .from('companies')
      .select('id, name')

    if (!companies || companies.length === 0) {
      console.log('[payment-deadlines] No companies found')
      return new Response(JSON.stringify({ success: true, message: 'No companies' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    let totalNotifications = 0

    for (const company of companies) {
      // NAV invoices: INBOUND, not paid, payment_date between today and 3 days from now
      const { data: navInvoices } = await supabase
        .from('nav_invoices')
        .select('id, invoice_number, payment_date, invoice_gross_amount, supplier_name')
        .eq('company_id', company.id)
        .eq('invoice_direction', 'INBOUND')
        .or('paid.is.null,paid.eq.false')
        .gte('payment_date', todayStr)
        .lte('payment_date', thresholdStr)
        .returns<NavInvoice[]>()

      // Manual invoices: INBOUND, not paid, fizetesi_hatarido between today and 3 days
      const { data: manualInvoices } = await supabase
        .from('invoices')
        .select('id, bizonylatsorszam, fizetesi_hatarido, brutto_vegosszeg, elado_nev')
        .eq('company_id', company.id)
        .eq('invoice_direction', 'INBOUND')
        .or('fizetve.is.null,fizetve.eq.false')
        .gte('fizetesi_hatarido', todayStr)
        .lte('fizetesi_hatarido', thresholdStr)
        .returns<ManualInvoice[]>()

      const navCount = navInvoices?.length || 0
      const manualCount = manualInvoices?.length || 0
      const totalCount = navCount + manualCount

      if (totalCount === 0) continue

      // Calculate total amount
      let totalAmount = 0
      navInvoices?.forEach((inv: NavInvoice) => { totalAmount += Math.abs(inv.invoice_gross_amount || 0) })
      manualInvoices?.forEach((inv: ManualInvoice) => { totalAmount += Math.abs(inv.brutto_vegosszeg || 0) })

      const formattedAmount = new Intl.NumberFormat('hu-HU', { maximumFractionDigits: 0 }).format(totalAmount) + ' Ft'

      // Build invoice list HTML
      let invoiceListHtml = '<table style="width:100%;border-collapse:collapse;margin:12px 0">'
      invoiceListHtml += '<tr style="background:#f3f4f6"><th style="padding:8px;text-align:left;font-size:12px">Szállító</th><th style="padding:8px;text-align:left;font-size:12px">Számla</th><th style="padding:8px;text-align:right;font-size:12px">Határidő</th><th style="padding:8px;text-align:right;font-size:12px">Összeg</th></tr>'

      navInvoices?.forEach((inv: NavInvoice) => {
        invoiceListHtml += `<tr><td style="padding:6px 8px;font-size:13px;border-bottom:1px solid #e5e7eb">${inv.supplier_name || '—'}</td><td style="padding:6px 8px;font-size:13px;border-bottom:1px solid #e5e7eb">${inv.invoice_number}</td><td style="padding:6px 8px;font-size:13px;border-bottom:1px solid #e5e7eb;text-align:right">${inv.payment_date}</td><td style="padding:6px 8px;font-size:13px;border-bottom:1px solid #e5e7eb;text-align:right">${new Intl.NumberFormat('hu-HU', { maximumFractionDigits: 0 }).format(Math.abs(inv.invoice_gross_amount || 0))} Ft</td></tr>`
      })
      manualInvoices?.forEach((inv: ManualInvoice) => {
        invoiceListHtml += `<tr><td style="padding:6px 8px;font-size:13px;border-bottom:1px solid #e5e7eb">${inv.elado_nev || '—'}</td><td style="padding:6px 8px;font-size:13px;border-bottom:1px solid #e5e7eb">${inv.bizonylatsorszam || '—'}</td><td style="padding:6px 8px;font-size:13px;border-bottom:1px solid #e5e7eb;text-align:right">${inv.fizetesi_hatarido}</td><td style="padding:6px 8px;font-size:13px;border-bottom:1px solid #e5e7eb;text-align:right">${new Intl.NumberFormat('hu-HU', { maximumFractionDigits: 0 }).format(Math.abs(inv.brutto_vegosszeg || 0))} Ft</td></tr>`
      })
      invoiceListHtml += '</table>'

      const bodyHtml = `<p><strong>${totalCount}</strong> számla fizetési határideje <strong>3 napon belül lejár</strong> (összesen <strong>${formattedAmount}</strong>).</p>${invoiceListHtml}`

      // Get all members of this company
      const { data: members } = await supabase
        .from('company_members')
        .select('user_id')
        .eq('company_id', company.id)

      for (const member of (members || [])) {
        try {
          await fetch(`${supabaseUrl}/functions/v1/send-notification-email`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${serviceKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              user_id: member.user_id,
              type: 'payment_due_soon',
              title: `Fizetési határidő közeleg — ${company.name}`,
              body_html: bodyHtml,
            }),
          })
          totalNotifications++
        } catch (e) {
          console.error(`[payment-deadlines] Failed to notify ${member.user_id}:`, e)
        }
      }
    }

    console.log(`[payment-deadlines] Done. ${totalNotifications} notifications sent.`)

    return new Response(JSON.stringify({ success: true, notifications: totalNotifications }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[payment-deadlines] Error:', msg)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
