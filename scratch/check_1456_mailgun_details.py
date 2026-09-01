from supabase import create_client
import sys

sys.stdout.reconfigure(encoding='utf-8')

url = "https://vxxgvdlqvvchtlmqnrqf.supabase.co"
key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4eGd2ZGxxdnZjaHRsbXFucnFmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Nzk3MDA1MCwiZXhwIjoyMDczNTQ2MDUwfQ.YO-8-3sg4m--ms7MCvtwBLOo7ygqxaTbdtvwVwCin_Q"
supabase = create_client(url, key)

print("=== INVOICE UPLOADS FOR THINK AI KFT ===")
invs = supabase.table("invoice_uploads").select("*").eq("company_id", "ecf31039-b539-4e04-bbea-70ea48c701bb").order("created_at", desc=True).limit(5).execute()
for u in invs.data:
    print(f"[{u['created_at']}] {u['file_name']} | Status: {u['upload_status']}/{u['processing_status']}")
    print(f"  Metadata: {u.get('metadata')}")
    print(f"  Notes: {u.get('notes')}\n")

print("\n=== RECENT APP ERROR LOGS FOR PROCESS-MAILGUN-WEBHOOK ===")
errs = supabase.table("app_error_logs").select("*").eq("component", "process-mailgun-webhook").order("created_at", desc=True).limit(10).execute()
for e in errs.data:
    print(f"[{e['created_at']}] [{e['severity']}] {e['action']}: {e['message'][:200]}")
    if e.get('context'):
        print(f"  Context: {e['context']}")
