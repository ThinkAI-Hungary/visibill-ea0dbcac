const { createClient } = require('@supabase/supabase-js');
const url = "https://vxxgvdlqvvchtlmqnrqf.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4eGd2ZGxxdnZjaHRsbXFucnFmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Nzk3MDA1MCwiZXhwIjoyMDczNTQ2MDUwfQ.YO-8-3sg4m--ms7MCvtwBLOo7ygqxaTbdtvwVwCin_Q";
const supabase = createClient(url, key);

async function test() {
  const { data, error } = await supabase.auth.admin.updateUserById(
    '5abff3e7-0b0e-47eb-9198-4db551668caf',
    { password: 'ViktorTest123!' }
  );
  if (error) {
    console.error("Error updating password:", error);
  } else {
    console.log("Successfully updated password for Kovács Péter.");
  }
}
test();
