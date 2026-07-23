const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Read env file manually
const envContent = fs.readFileSync('c:/Users/adetw/.antigravity/visibill/visibill-709fffdf/.env.local', 'utf8');
const envConfig = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
    envConfig[key] = val;
  }
});

const supabaseUrl = envConfig.SUPABASE_URL;
const serviceKey = envConfig.SUPABASE_SERVICE_KEY;
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4eGd2ZGxxdnZjaHRsbXFucnFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5NzAwNTAsImV4cCI6MjA3MzU0NjA1MH0.Ec9KFcjt89cY6FF9Nq9GnW1hzlnDUhQCCJ_LhWm2evY";

const adminClient = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
const userClient = createClient(supabaseUrl, SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });

const email = "temp_test_user@visibill.hu";
const password = "TemporaryPassword123!";
const companyId = "b1c19e7d-df9f-4a23-a9d0-fa43dea1f5c7";
const matchedInvoiceId = "983bad73-28b1-4841-9f3b-15e8d0e2a584"; // E-BA-2026-3

async function run() {
  console.log("Creating temp user...");
  // 1. Create user
  const { data: userData, error: createErr } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  });
  if (createErr) {
    console.error("Create user failed:", createErr);
    return;
  }
  const userId = userData.user.id;
  console.log("User created with ID:", userId);

  try {
    // 2. Add to company_members
    console.log("Adding user to company_members...");
    const { error: memberErr } = await adminClient
      .from('company_members')
      .insert({
        user_id: userId,
        company_id: companyId,
        role: 'owner'
      });
    if (memberErr) {
      console.error("Add company member failed:", memberErr);
      return;
    }
    console.log("Company member added.");

    // 3. Sign in as user
    console.log("Signing in as user...");
    const { data: sessionData, error: signInErr } = await userClient.auth.signInWithPassword({
      email,
      password
    });
    if (signInErr) {
      console.error("Sign in failed:", signInErr);
      return;
    }
    console.log("Signed in successfully.");

    // 4. Query invoices
    console.log("Querying invoices as user...");
    const { data: invoicesData, error: invoicesErr } = await userClient
      .from('invoices')
      .select('id, bizonylatsorszam')
      .eq('id', "f05796dc-36ab-468b-8e7f-9978692fd726")
      .maybeSingle();
    console.log("Invoices Result:", invoicesData, "Error:", invoicesErr);

    // 5. Query nav_invoices
    console.log("Querying nav_invoices as user...");
    const { data: navData, error: navErr } = await userClient
      .from('nav_invoices')
      .select('id, invoice_number')
      .eq('id', matchedInvoiceId)
      .maybeSingle();
    console.log("NAV Invoices Result:", navData, "Error:", navErr);

  } finally {
    // Cleanup
    console.log("Cleaning up...");
    await adminClient.from('company_members').delete().eq('user_id', userId);
    await adminClient.auth.admin.deleteUser(userId);
    console.log("Cleanup finished.");
  }
}

run();
