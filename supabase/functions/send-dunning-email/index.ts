import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from 'npm:resend@4.0.0'

const resend = new Resend(Deno.env.get('RESEND_API_KEY') as string)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type AgingCategory = 'green' | 'yellow' | 'red' | 'purple'

interface InvoicePayload {
  id: string
  invoiceNumber: string
  issueDate: string | null
  dueDate: string
  amount: number
  currency: string
  daysOverdue: number
  category: AgingCategory
  source: 'nav' | 'manual'
  attachmentUrl: string | null
}

interface RequestBody {
  companyId: string
  senderCompanyName: string
  debtorCompanyName: string
  debtorTaxNumber: string | null
  debtorEmail: string
  invoices: InvoicePayload[]
  totalAmount: number
  worstCategory: AgingCategory
}

function formatHuf(amount: number): string {
  return new Intl.NumberFormat('hu-HU', { maximumFractionDigits: 0 }).format(amount) + ' Ft'
}

function getSubject(worstCategory: AgingCategory, companyName: string): string {
  switch (worstCategory) {
    case 'yellow': return `Fizetési emlékeztető — ${companyName}`
    case 'red':    return `Fizetési felszólítás — ${companyName}`
    case 'purple': return `Végső fizetési felszólítás — ${companyName}`
    default:       return `Fizetési emlékeztető — ${companyName}`
  }
}

function getIntroText(worstCategory: AgingCategory, companyName: string, totalAmount: number): string {
  const total = formatHuf(totalAmount)
  switch (worstCategory) {
    case 'green':
    case 'yellow':
      return `Tisztelt ${companyName}!\n\nSzámlakö nyvelési rendszerünk jelzi, hogy az alábbi számláink kiegyenlítése még nem érkezett meg hozzánk. Felkérjük, hogy szíveskedjeék az összesen <strong>${total}</strong> összegű tartozásukat a táblázatban feltüntetett határidőkig rendezni.\n\nAmennyiben az utalás már megtörtént, kérjük, tekintse ezt az emlékeztetőt tárgytalannak.`
    case 'red':
      return `Tisztelt ${companyName}!\n\nTájékoztatjuk, hogy az alábbi, összesen <strong>${total}</strong> összegű számláink fizetési határideje lejárt, és azok kiegyenlítéséről mindeddig nem értesültünk.\n\nKérjük, haladéktalanul intézkedjen a fennálló tartozás rendezéséről. Amennyiben a kifizetés már megtörtént, kérjük, küldje el az átutalás bizonylatát.`
    case 'purple':
      return `Tisztelt ${companyName}!\n\nUtolsó alkalommal tájékoztatjuk önöket, hogy összesen <strong>${total}</strong> összeggel tartoznak felénk, amelyek fizetési határideje több mint 180 napja lejárt.\n\nAmennyiben fizetési kötelezettségüknek 8 napon belül nem tesznek eleget, kénytelenek leszünk követeléskezelési eljárást megindítani. Kérjük, vegye fel velünk a kapcsolatot a helyzet rendezése érdekében.`
  }
}

function getCategoryLabel(cat: AgingCategory): string {
  switch (cat) {
    case 'green':  return 'Nem lejárt'
    case 'yellow': return '1–30 napos'
    case 'red':    return '31–180 napos'
    case 'purple': return '180+ napos'
  }
}

function buildHtml(body: RequestBody): string {
  const introText = getIntroText(body.worstCategory, body.debtorCompanyName, body.totalAmount)
  const rows = body.invoices.map(inv => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-family:monospace;font-size:13px">${inv.invoiceNumber}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px">${inv.issueDate ?? '—'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px">${inv.dueDate}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;text-align:right">${inv.daysOverdue <= 0 ? 'Nem lejárt' : inv.daysOverdue + ' nap'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;text-align:right;font-weight:600">${formatHuf(inv.amount)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#6b7280">${getCategoryLabel(inv.category)}</td>
    </tr>`).join('')

  return `<!DOCTYPE html>
<html lang="hu">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:680px;margin:32px auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
    <div style="background:#111827;padding:28px 32px">
      <div style="color:#ffffff;font-size:22px;font-weight:700">Visibill</div>
      <div style="color:#9ca3af;font-size:13px;margin-top:4px">Pénzügyi felszólítólevél</div>
    </div>
    <div style="padding:32px">
      <p style="font-size:15px;line-height:1.7;color:#374151;white-space:pre-line">${introText}</p>
      <div style="margin:24px 0;border-radius:6px;overflow:hidden;border:1px solid #e5e7eb">
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr style="background:#f3f4f6">
              <th style="padding:10px 12px;text-align:left;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em">Számlaszám</th>
              <th style="padding:10px 12px;text-align:left;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em">Kiállítva</th>
              <th style="padding:10px 12px;text-align:left;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em">Lejárat</th>
              <th style="padding:10px 12px;text-align:right;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em">Késés</th>
              <th style="padding:10px 12px;text-align:right;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em">Összeg</th>
              <th style="padding:10px 12px;text-align:left;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em">Kategória</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
          <tfoot>
            <tr style="background:#f9fafb">
              <td colspan="4" style="padding:10px 12px;font-weight:700;font-size:14px">Összesen fizetendő:</td>
              <td style="padding:10px 12px;text-align:right;font-weight:700;font-size:14px;color:#111827">${formatHuf(body.totalAmount)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p style="font-size:14px;color:#6b7280;margin-top:24px">Köszönjük szíves együttmûködését!</p>
      <p style="font-size:14px;font-weight:600;color:#374151;margin-top:8px">${body.senderCompanyName}</p>
    </div>
    <div style="background:#f3f4f6;padding:16px 32px;text-align:center">
      <p style="font-size:12px;color:#9ca3af;margin:0">Ez a levél automatikusan készült a Visibill rendszerből. Kérdés esetén válaszoljon erre az emailre.</p>
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
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const body: RequestBody = await req.json()
    const { companyId, debtorCompanyName, debtorTaxNumber, debtorEmail, invoices, totalAmount } = body

    console.log(`[dunning] Sending to ${debtorEmail} for ${debtorCompanyName}, ${invoices.length} invoices`)

    const subject = getSubject(body.worstCategory, debtorCompanyName)
    const html = buildHtml(body)

    // Collect PDF attachments (manual invoices only)
    const attachments: { filename: string; path: string }[] = []
    for (const inv of invoices) {
      if (inv.source === 'manual' && inv.attachmentUrl) {
        attachments.push({
          filename: `${inv.invoiceNumber}.pdf`,
          path: inv.attachmentUrl,
        })
      }
    }

    const emailPayload: Record<string, unknown> = {
      from: `${body.senderCompanyName} (Visibill) <noreply@mail.visibill.hu>`,
      reply_to: user.email,
      to: [debtorEmail],
      subject,
      html,
    }
    if (attachments.length > 0) {
      emailPayload.attachments = attachments
    }

    const { error: resendError } = await resend.emails.send(emailPayload as any)

    const status = resendError ? 'error' : 'sent'
    const errorMessage = resendError ? JSON.stringify(resendError) : null

    // Log to dunning_sends
    const serviceSupabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )
    await serviceSupabase.from('dunning_sends').insert({
      user_id: user.id,
      company_id: companyId,
      debtor_company_name: debtorCompanyName,
      debtor_tax_number: debtorTaxNumber ?? null,
      debtor_email: debtorEmail,
      invoice_ids: invoices.map(i => i.id),
      total_amount: totalAmount,
      currency: invoices[0]?.currency ?? 'HUF',
      status,
      error_message: errorMessage,
    })

    if (resendError) {
      console.error('[dunning] Resend error:', resendError)
      return new Response(JSON.stringify({ error: resendError }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log(`[dunning] Success for ${debtorEmail}`)
    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[dunning] Unexpected error:', msg)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
