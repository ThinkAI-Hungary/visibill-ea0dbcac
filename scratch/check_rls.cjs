const { createClient } = require('@supabase/supabase-js');
const url = "https://vxxgvdlqvvchtlmqnrqf.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4eGd2ZGxxdnZjaHRsbXFucnFmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Nzk3MDA1MCwiZXhwIjoyMDczNTQ2MDUwfQ.YO-8-3sg4m--ms7MCvtwBLOo7ygqxaTbdtvwVwCin_Q";
const supabase = createClient(url, key);

async function run() {
  const { data: policies, error } = await supabase
    .rpc('get_policies_for_tables', { table_names: ['accounty_assignments', 'companies'] });
  
  if (error) {
    // If RPC doesn't exist, we can run a direct SQL query via a generic RPC if it exists,
    // or just run a select from pg_policies if we have a way.
    console.log("RPC error, trying raw select on pg_policies...");
    const { data: rawPols, error: rawErr } = await supabase
      .from('pg_policies')
      .select('*');
    if (rawErr) {
      console.error("Direct select error:", rawErr);
    } else {
      console.log("Policies:", rawPols);
    }
  } else {
    console.log("Policies:", policies);
  }
}

async function runRawSql() {
  // Let's see if we can query using postgres query or check table definitions.
  // Actually, we can run a query to get policies:
  // SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check FROM pg_policies WHERE tablename IN ('accounty_assignments', 'companies');
  // Wait, let's check if there's a sql execution endpoint or just query it.
}

run();
