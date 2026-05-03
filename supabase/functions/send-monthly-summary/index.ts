import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function formatHuf(amount: number): string {
  return new Intl.NumberFormat('hu-HU', { maximumFractionDigits: 0 }).format(amount) + ' Ft'
}

function trendIcon(current: number, previous: number): string {
  if (previous === 0) return ''
  const pct = Math.round(((current - previous) / previous) * 100)
  if (pct > 0) return `<span style="color:#16a34a">\u25b2 +${pct}%</span>`
  if (pct < 0) return `<span style="color:#ef4444">\u25bc ${pct}%</span>`
  return '<span style="color:#6b7280">\u2014 0%</span>'
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('[monthly-summary] Starting...')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceKey)

    // Calculate date ranges
    const now = new Date()
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const thisMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 2, 1)
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth() - 1, 0)

    const fmtDate = (d: Date) => d.toISOString().split('T')[0]
    const monthName = thisMonthStart.toLocaleDateString('hu-HU', { year: 'numeric', month: 'long' })

    const { data: companies } = await supabase.from('companies').select('id, name')
    if (!companies || companies.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No companies' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    let totalNotifications = 0

    for (const company of companies) {
      // Current month data
      const { data: navOut } = await supabase
        .from('nav_invoices')
        .select('invoice_gross_amount')
        .eq('company_id', company.id)
        .eq('invoice_direction', 'OUTBOUND')
        .gte('invoice_issue_date', fmtDate(thisMonthStart))
        .lte('invoice_issue_date', fmtDate(thisMonthEnd))

      const { data: navIn } = await supabase
        .from('nav_invoices')
        .select('invoice_gross_amount')
        .eq('company_id', company.id)
        .eq('invoice_direction', 'INBOUND')
        .gte('invoice_issue_date', fmtDate(thisMonthStart))
        .lte('invoice_issue_date', fmtDate(thisMonthEnd))

      // Previous month data
      const { data: prevNavOut } = await supabase
        .from('nav_invoices')
        .select('invoice_gross_amount')
        .eq('company_id', company.id)
        .eq('invoice_direction', 'OUTBOUND')
        .gte('invoice_issue_date', fmtDate(prevMonthStart))
        .lte('invoice_issue_date', fmtDate(prevMonthEnd))

      const { data: prevNavIn } = await supabase
        .from('nav_invoices')
        .select('invoice_gross_amount')
        .eq('company_id', company.id)
        .eq('invoice_direction', 'INBOUND')
        .gte('invoice_issue_date', fmtDate(prevMonthStart))
        .lte('invoice_issue_date', fmtDate(prevMonthEnd))

      const revenue = (navOut || []).reduce((s, i) => s + Math.abs(i.invoice_gross_amount || 0), 0)
      const expenses = (navIn || []).reduce((s, i) => s + Math.abs(i.invoice_gross_amount || 0), 0)
      const profit = revenue - expenses

      const prevRevenue = (prevNavOut || []).reduce((s, i) => s + Math.abs(i.invoice_gross_amount || 0), 0)
      const prevExpenses = (prevNavIn || []).reduce((s, i) => s + Math.abs(i.invoice_gross_amount || 0), 0)

      // Receivables (unpaid outbound)
      const { data: receivables } = await supabase
        .from('nav_invoices')
        .select('invoice_gross_amount')
        .eq('company_id', company.id)
        .eq('invoice_direction', 'OUTBOUND')
        .or('paid.is.null,paid.eq.false')

      const receivableTotal = (receivables || []).reduce((s, i) => s + Math.abs(i.invoice_gross_amount || 0), 0)

      // Payables (unpaid inbound)
      const { data: payables } = await supabase
        .from('nav_invoices')
        .select('invoice_gross_amount')
        .eq('company_id', company.id)
        .eq('invoice_direction', 'INBOUND')
        .or('paid.is.null,paid.eq.false')

      const payableTotal = (payables || []).reduce((s, i) => s + Math.abs(i.invoice_gross_amount || 0), 0)

      const profitColor = profit >= 0 ? '#16a34a' : '#ef4444'

      const bodyHtml = `
        <p style="margin-bottom:20px">\u00cdme a(z) <strong>${company.name}</strong> havi p\u00e9nz\u00fcgyi \u00e1ttekint\u00e9se (<strong>${monthName}</strong>):</p>
        <table style="width:100%;border-collapse:collapse;margin:12px 0">
          <tr style="background:#f3f4f6">
            <th style="padding:10px 12px;text-align:left;font-size:13px">Mutat\u00f3</th>
            <th style="padding:10px 12px;text-align:right;font-size:13px">\u00d6sszeg</th>
            <th style="padding:10px 12px;text-align:right;font-size:13px">El\u0151z\u0151 h\u00f3nap</th>
            <th style="padding:10px 12px;text-align:right;font-size:13px">V\u00e1ltoz\u00e1s</th>
          </tr>
          <tr>
            <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px">Bev\u00e9tel (kimen\u0151)</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:13px;font-weight:600">${formatHuf(revenue)}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:13px;color:#6b7280">${formatHuf(prevRevenue)}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:13px">${trendIcon(revenue, prevRevenue)}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px">Kiad\u00e1s (bej\u00f6v\u0151)</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:13px;font-weight:600">${formatHuf(expenses)}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:13px;color:#6b7280">${formatHuf(prevExpenses)}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:13px">${trendIcon(expenses, prevExpenses)}</td>
          </tr>
          <tr style="background:#f9fafb">
            <td style="padding:10px 12px;font-size:14px;font-weight:700">Eredm\u00e9ny</td>
            <td style="padding:10px 12px;text-align:right;font-size:14px;font-weight:700;color:${profitColor}">${formatHuf(profit)}</td>
            <td colspan="2"></td>
          </tr>
        </table>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr>
            <td style="padding:8px 12px;font-size:13px;border-bottom:1px solid #e5e7eb">Kintl\u00e9v\u0151s\u00e9g (kifizetetlen kimen\u0151)</td>
            <td style="padding:8px 12px;text-align:right;font-size:13px;border-bottom:1px solid #e5e7eb;font-weight:600;color:#f59e0b">${formatHuf(receivableTotal)}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;font-size:13px;border-bottom:1px solid #e5e7eb">Fizetend\u0151 (kifizetetlen bej\u00f6v\u0151)</td>
            <td style="padding:8px 12px;text-align:right;font-size:13px;border-bottom:1px solid #e5e7eb;font-weight:600;color:#ef4444">${formatHuf(payableTotal)}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;font-size:13px">Kimen\u0151 sz\u00e1ml\u00e1k sz\u00e1ma</td>
            <td style="padding:8px 12px;text-align:right;font-size:13px;font-weight:600">${navOut?.length || 0} db</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;font-size:13px">Bej\u00f6v\u0151 sz\u00e1ml\u00e1k sz\u00e1ma</td>
            <td style="padding:8px 12px;text-align:right;font-size:13px;font-weight:600">${navIn?.length || 0} db</td>
          </tr>
        </table>
        <p style="margin-top:16px"><a href="https://app.visibill.hu/analytics" style="display:inline-block;padding:10px 20px;background:#0070f3;color:#fff;border-radius:6px;text-decoration:none;font-weight:600">R\u00e9szletes elemz\u00e9s</a></p>`

      // Notify company members
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
              type: 'monthly_summary',
              title: `Havi \u00f6sszegz\u00e9s \u2014 ${monthName}`,
              body_html: bodyHtml,
              subject: `${company.name} \u2014 Havi p\u00e9nz\u00fcgyi \u00f6sszegz\u00e9s (${monthName})`,
            }),
          })
          totalNotifications++
        } catch (e) {
          console.error(`[monthly-summary] Notify failed:`, e)
        }
      }
    }

    console.log(`[monthly-summary] Done. ${totalNotifications} notifications sent.`)

    return new Response(JSON.stringify({ success: true, notifications: totalNotifications }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[monthly-summary] Error:', msg)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
