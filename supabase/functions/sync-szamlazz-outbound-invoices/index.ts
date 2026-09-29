import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { corsHeaders, checkAutomationShield } from '../_shared/client-guard.ts';

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const automationBlock = checkAutomationShield(req);
  if (automationBlock) {
    return automationBlock;
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace('Bearer ', '');
    const isServiceRole = token === supabaseServiceKey;

    let user: any = null;
    if (isServiceRole) {
      user = { id: '00000000-0000-0000-0000-000000000000', email: 'system@internal' };
    } else {
      const { data: userData, error: authError } = await userClient.auth.getUser(token);
      if (authError || !userData?.user) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      user = userData.user;
    }

    const body = await req.json().catch(() => ({}));
    const { companyId, invoiceNumbers, limit = 10 } = body;

    if (!companyId) {
      return new Response(
        JSON.stringify({ error: 'companyId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Authorization check: User must be member of company, have accounty access, or be admin (or service role)
    let hasAccess = isServiceRole;
    if (!hasAccess) {
      const { data: member } = await serviceClient
        .from('company_members')
        .select('role')
        .eq('company_id', companyId)
        .eq('user_id', user.id)
        .maybeSingle();
      hasAccess = Boolean(member);

      if (!hasAccess) {
        const { data: assignment } = await serviceClient
          .from('accounty_assignments')
          .select('id')
          .eq('company_id', companyId)
          .eq('accountant_user_id', user.id)
          .maybeSingle();
        if (assignment) {
          hasAccess = true;
        }
      }
      if (!hasAccess) {
        const { data: comp } = await serviceClient
          .from('companies')
          .select('id')
          .eq('id', companyId)
          .eq('owner_id', user.id)
          .maybeSingle();
        if (comp) {
          hasAccess = true;
        }
      }
      if (!hasAccess) {
        const { data: profile } = await serviceClient
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();
        if (profile?.role === 'admin') {
          hasAccess = true;
        }
      }
    }

    if (!hasAccess) {
      return new Response(
        JSON.stringify({ error: 'Nincs jogosultságod a cég számláinak kezeléséhez.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Retrieve Számlázz.hu Agent key
    const { data: keyData, error: keyErr } = await serviceClient.rpc('get_szamlazz_agent_key', {
      p_company_id: companyId
    });
    const agentKey = (keyData as string)?.trim();
    if (keyErr || !agentKey || agentKey.length < 10) {
      return new Response(
        JSON.stringify({
          error: 'Nincs érvényes Számlázz.hu Agent kulcs beállítva ehhez a céghez. Kérjük add meg az Integrációk menüpontban!',
          code: 'MISSING_AGENT_KEY'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Query existing submitted invoices to avoid re-downloading
    const { data: existingInvoices } = await serviceClient
      .from('invoices')
      .select('id, bizonylatsorszam, melleklet_url, image_url')
      .eq('company_id', companyId)
      .eq('invoice_direction', 'OUTBOUND');

    const existingMap = new Map<string, any>();
    for (const inv of (existingInvoices || [])) {
      if (inv.bizonylatsorszam) {
        const norm = inv.bizonylatsorszam.trim().toLowerCase();
        existingMap.set(norm, inv);
      }
    }

    // Candidates query from nav_invoices
    let navQuery = serviceClient
      .from('nav_invoices')
      .select('*')
      .eq('company_id', companyId)
      .eq('invoice_direction', 'OUTBOUND')
      .order('invoice_issue_date', { ascending: false });

    if (Array.isArray(invoiceNumbers) && invoiceNumbers.length > 0) {
      navQuery = navQuery.in('invoice_number', invoiceNumbers);
    }

    const { data: allCandidates, error: candError } = await navQuery;
    if (candError) {
      throw candError;
    }

    // Filter to only candidates that do NOT have a valid PDF image yet
    const pendingCandidates = (allCandidates || []).filter(c => {
      const norm = (c.invoice_number || '').trim().toLowerCase();
      const existing = existingMap.get(norm);
      return !existing || (!existing.melleklet_url && !existing.image_url);
    });

    const safeLimit = Math.max(1, Math.min(Number(limit) || 10, 30));
    const batchToProcess = pendingCandidates.slice(0, safeLimit);
    const remainingCount = pendingCandidates.length - batchToProcess.length;

    console.log(`[SZAMLAZZ-SYNC] Processing ${batchToProcess.length} outbound invoices for company ${companyId}. Total pending: ${pendingCandidates.length}`);

    const results: Array<{
      invoiceNumber: string;
      success: boolean;
      url?: string;
      error?: string;
    }> = [];

    let downloadedCount = 0;
    let notFoundCount = 0;
    let errorCount = 0;

    for (let i = 0; i < batchToProcess.length; i++) {
      const candidate = batchToProcess[i];
      const invNum = candidate.invoice_number;

      // Rate limiting: 250ms gap between calls to avoid Számlázz.hu IP throttle
      if (i > 0) {
        await new Promise(res => setTimeout(res, 250));
      }

      console.log(`[SZAMLAZZ-SYNC] (${i + 1}/${batchToProcess.length}) Fetching PDF for ${invNum}...`);

      const xmlBody = `<?xml version="1.0" encoding="UTF-8"?>
<xmlszamlapdf xmlns="http://www.szamlazz.hu/xmlszamlapdf">
  <szamlaagentkulcs>${agentKey}</szamlaagentkulcs>
  <szamlaszam>${invNum}</szamlaszam>
  <valaszVerzio>2</valaszVerzio>
</xmlszamlapdf>`;

      try {
        const form = new FormData();
        form.append('action-szamla_agent_pdf', new Blob([xmlBody], { type: 'application/xml' }), 'request.xml');

        const apiRes = await fetch('https://www.szamlazz.hu/szamla/', {
          method: 'POST',
          body: form,
        });

        const resText = await apiRes.text();
        const errHeader = apiRes.headers.get('szlahu_error');
        const errCodeHeader = apiRes.headers.get('szlahu_error_code');

        const pdfMatch = resText.match(/<pdf>([\s\S]*?)<\/pdf>/i);
        const isSuccess = resText.includes('<sikeres>true</sikeres>') && Boolean(pdfMatch);

        if (isSuccess && pdfMatch) {
          const base64Data = pdfMatch[1].trim();
          const pdfBytes = base64ToUint8Array(base64Data);

          const cleanInv = sanitizeFileName(invNum);
          const storagePath = `${companyId}/szamlazz/${cleanInv}.pdf`;

          // 1. Upload to Supabase Storage 'invoice-uploads'
          const { error: uploadErr } = await serviceClient.storage
            .from('invoice-uploads')
            .upload(storagePath, pdfBytes, {
              contentType: 'application/pdf',
              upsert: true,
            });

          if (uploadErr) {
            console.error(`[SZAMLAZZ-SYNC] Storage upload error for ${invNum}:`, uploadErr);
            errorCount++;
            results.push({ invoiceNumber: invNum, success: false, error: uploadErr.message });
            continue;
          }

          const { data: { publicUrl } } = serviceClient.storage
            .from('invoice-uploads')
            .getPublicUrl(storagePath);

          const effectiveUserId = (user?.id && user.id !== '00000000-0000-0000-0000-000000000000')
            ? user.id
            : (candidate.user_id || member?.user_id || 'e5b822ee-4240-4350-9ebe-a14357d5bd89');

          // 2. Insert invoice_uploads record
          const { data: uploadRec, error: upInsertErr } = await serviceClient
            .from('invoice_uploads')
            .insert({
              company_id: companyId,
              user_id: effectiveUserId,
              file_name: `${cleanInv}.pdf`,
              file_type: 'application/pdf',
              file_size: pdfBytes.length,
              file_url: publicUrl,
              upload_status: 'uploaded',
              processing_status: 'processed',
              document_category: 'invoice',
              metadata: {
                source: 'szamlazz_agent_api',
                invoice_number: invNum,
                downloaded_at: new Date().toISOString(),
              },
              notes: [{
                timestamp: new Date().toISOString(),
                event: 'downloaded_via_szamlazz_agent_api',
                detail: invNum,
              }],
            })
            .select('id')
            .maybeSingle();

          if (upInsertErr) {
            console.error(`[SZAMLAZZ-SYNC] invoice_uploads insert error for ${invNum}:`, upInsertErr);
          }

          const invType = candidate.invoice_operation === 'STORNO' || (Number(candidate.invoice_gross_amount) < 0)
            ? 'sztorno_szla'
            : 'sima_szla';

          // 3. Upsert invoices record
          const existingInv = existingMap.get(invNum.trim().toLowerCase());
          if (existingInv) {
            const { error: invUpErr } = await serviceClient.from('invoices').update({
              melleklet_url: publicUrl,
              image_url: publicUrl,
              invoice_uploads_id: uploadRec?.id || existingInv.invoice_uploads_id,
              nav_status: 'verified',
              statusz: 'feldolgozott',
              frissitve: new Date().toISOString(),
            }).eq('id', existingInv.id);

            if (invUpErr) {
              console.error(`[SZAMLAZZ-SYNC] invoices update error for ${invNum}:`, invUpErr);
            }
          } else {
            const { error: invInsErr } = await serviceClient.from('invoices').insert({
              company_id: companyId,
              user_id: effectiveUserId,
              bizonylatsorszam: candidate.invoice_number,
              invoice_direction: 'OUTBOUND',
              invoice_type: invType,
              melleklet_url: publicUrl,
              image_url: publicUrl,
              invoice_uploads_id: uploadRec?.id || null,
              nav_status: 'verified',
              statusz: 'feldolgozott',
              kibocsatas_datuma: candidate.invoice_issue_date || new Date().toISOString().split('T')[0],
              teljesites_datuma: candidate.invoice_delivery_date || candidate.invoice_issue_date || new Date().toISOString().split('T')[0],
              fizetesi_hatarido: candidate.payment_date || null,
              elado_nev: candidate.supplier_name || 'Ismeretlen eladó',
              elado_vat_id: candidate.supplier_tax_number || '',
              elado_cim: candidate.supplier_address || '',
              vevo_nev: candidate.customer_name || 'Ismeretlen vevő',
              vevo_vat_id: candidate.customer_tax_number || '',
              vevo_cim: candidate.customer_address || '',
              brutto_vegosszeg: candidate.invoice_gross_amount ?? 0,
              adoalap_osszesen: candidate.invoice_net_amount ?? 0,
              afa_osszeg_osszesen: candidate.invoice_vat_amount ?? 0,
              penznem: candidate.currency || 'HUF',
              fizetve: candidate.paid || false,
              forditott_adozas: Boolean(candidate.is_reverse_charge),
              reverse_charge_category: candidate.reverse_charge_category || null,
            });

            if (invInsErr) {
              console.error(`[SZAMLAZZ-SYNC] invoices insert error for ${invNum}:`, invInsErr);
            }
          }

          // 4. Update nav_invoices submitted flag
          await serviceClient
            .from('nav_invoices')
            .update({ submitted: true })
            .eq('id', candidate.id);

          downloadedCount++;
          results.push({ invoiceNumber: invNum, success: true, url: publicUrl });
          console.log(`[SZAMLAZZ-SYNC] Successfully paired and stored PDF for ${invNum}`);
        } else {
          // Számlázz.hu returned error / invoice not found in Számlázz.hu
          const msgMatch = resText.match(/<hibauzenet>([\s\S]*?)<\/hibauzenet>/i);
          const errDetail = msgMatch ? msgMatch[1].trim() : (errHeader ? decodeURIComponent(errHeader) : `Hiba: ${errCodeHeader || 'nem található'}`);
          console.warn(`[SZAMLAZZ-SYNC] Invoice ${invNum} not downloaded: ${errDetail}`);
          notFoundCount++;
          results.push({ invoiceNumber: invNum, success: false, error: errDetail });
        }
      } catch (err: any) {
        console.error(`[SZAMLAZZ-SYNC] Network or processing error for ${invNum}:`, err);
        errorCount++;
        results.push({ invoiceNumber: invNum, success: false, error: err.message || String(err) });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        totalPending: pendingCandidates.length,
        processed: batchToProcess.length,
        downloaded: downloadedCount,
        notFound: notFoundCount,
        errors: errorCount,
        remaining: remainingCount,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[SZAMLAZZ-SYNC] Fatal error:', error);
    return new Response(
      JSON.stringify({ error: error.message || String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
