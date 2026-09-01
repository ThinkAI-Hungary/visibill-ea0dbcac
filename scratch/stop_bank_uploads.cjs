const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const url = "https://vxxgvdlqvvchtlmqnrqf.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4eGd2ZGxxdnZjaHRsbXFucnFmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Nzk3MDA1MCwiZXhwIjoyMDczNTQ2MDUwfQ.YO-8-3sg4m--ms7MCvtwBLOo7ygqxaTbdtvwVwCin_Q";

const supabase = createClient(url, key);

async function main() {
  // Query the 3 bank statement uploads
  const { data: rows, error } = await supabase
    .from('bank_statement_uploads')
    .select('*')
    .or('file_name.ilike.%1788162987761%,file_name.ilike.%1788162988169%,file_name.ilike.%IMG_0002%');

  console.log('Found rows in bank_statement_uploads:', rows, error);

  if (rows && rows.length > 0) {
    for (const r of rows) {
      console.log(`Updating ${r.id} (${r.file_name}) from ${r.processing_status} to dismissed/ignored...`);
      const { data: updateRes, error: updateErr } = await supabase
        .from('bank_statement_uploads')
        .update({
          processing_status: 'dismissed',
          error_message: 'Feldolgozás leállítva a felhasználó kérésére.'
        })
        .eq('id', r.id);
      console.log('Update result:', updateRes, updateErr);
    }
  }

  // Also check transaction_uploads just in case
  const { data: txRows } = await supabase
    .from('transaction_uploads')
    .select('*')
    .or('file_name.ilike.%1788162987761%,file_name.ilike.%1788162988169%,file_name.ilike.%IMG_0002%');
  
  if (txRows && txRows.length > 0) {
    console.log('Found rows in transaction_uploads:', txRows);
    for (const r of txRows) {
      await supabase
        .from('transaction_uploads')
        .update({
          processing_status: 'dismissed',
          error_message: 'Feldolgozás leállítva a felhasználó kérésére.'
        })
        .eq('id', r.id);
    }
  }
}

main();
