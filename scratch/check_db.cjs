const { createClient } = require('@supabase/supabase-js');
const url = "https://vxxgvdlqvvchtlmqnrqf.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4eGd2ZGxxdnZjaHRsbXFucnFmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Nzk3MDA1MCwiZXhwIjoyMDczNTQ2MDUwfQ.YO-8-3sg4m--ms7MCvtwBLOo7ygqxaTbdtvwVwCin_Q";
const supabase = createClient(url, key);

async function verify() {
  const companyId = '86ac88ac-4b2f-4d79-8eeb-251e3db7a02e';

  console.log('=== 1. Checking courier_reports (row_type = compensation) ===');
  const { data: crRows, error: crErr } = await supabase
    .from('courier_reports')
    .select('id, package_number, reference_number, match_status, match_confidence, matched_nav_invoice_id, match_reason')
    .eq('row_type', 'compensation');
  console.log('Total compensation rows:', crRows?.length, 'Error:', crErr);
  crRows?.forEach(r => {
    console.log(`CR: ${r.package_number} | ref: ${r.reference_number} | status: ${r.match_status} | conf: ${r.match_confidence} | nav_id: ${r.matched_nav_invoice_id} | reason: ${r.match_reason}`);
  });

  console.log('\n=== 2. Calling rematch_courier_report on cbafbdce-3fa6-4ff3-9b6b-3cc941c2259c ===');
  const { data: rematchRes, error: rematchErr } = await supabase.rpc('rematch_courier_report', { p_report_id: 'cbafbdce-3fa6-4ff3-9b6b-3cc941c2259c' });
  console.log('Rematch result:', rematchRes, rematchErr);

  console.log('\n=== 3. Checking GLS invoices in nav_invoices ===');
  const { data: navRows, error: navErr } = await supabase
    .from('nav_invoices')
    .select('id, invoice_number, invoice_issue_date, invoice_gross_amount, paid, is_manual_payment, manual_payment_type, manual_payment_note')
    .eq('company_id', companyId)
    .ilike('supplier_name', '%GLS%')
    .order('invoice_issue_date', { ascending: false });
  console.log('GLS NAV invoices count:', navRows?.length, 'Error:', navErr);
  navRows?.forEach(n => {
    console.log(`NAV: ${n.invoice_number} (${n.invoice_issue_date}) | gross: ${n.invoice_gross_amount} | paid: ${n.paid} | manual: ${n.is_manual_payment} | type: ${n.manual_payment_type} | note: ${n.manual_payment_note}`);
  });

  console.log('\n=== 4. Checking GLS invoices in invoices table ===');
  const { data: invRows, error: invErr } = await supabase
    .from('invoices')
    .select('id, bizonylatsorszam, kibocsatas_datuma, fizetve, is_manual_payment, manual_payment_type, manual_payment_note')
    .eq('company_id', companyId)
    .ilike('elado_nev', '%GLS%')
    .order('kibocsatas_datuma', { ascending: false });
  console.log('GLS manual invoices count:', invRows?.length, 'Error:', invErr);
  invRows?.forEach(i => {
    console.log(`INV: ${i.bizonylatsorszam} (${i.kibocsatas_datuma}) | paid: ${i.fizetve} | manual: ${i.is_manual_payment} | type: ${i.manual_payment_type} | note: ${i.manual_payment_note}`);
  });
}

verify();
