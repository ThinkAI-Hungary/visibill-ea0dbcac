from supabase import create_client
import sys

sys.stdout.reconfigure(encoding='utf-8')

url = "https://vxxgvdlqvvchtlmqnrqf.supabase.co"
key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4eGd2ZGxxdnZjaHRsbXFucnFmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Nzk3MDA1MCwiZXhwIjoyMDczNTQ2MDUwfQ.YO-8-3sg4m--ms7MCvtwBLOo7ygqxaTbdtvwVwCin_Q"
supabase = create_client(url, key)

res = supabase.table("app_error_logs").select("*").eq("component", "process-mailgun-webhook").order("created_at", desc=True).limit(10).execute()

for r in res.data:
    print(f"[{r['created_at']}] [{r['severity']}] Action: {r['action']}")
    print(f"  Message: {r['message'][:300]}")
    print(f"  Context: {r.get('context')}\n")
