from supabase import create_client
import sys

sys.stdout.reconfigure(encoding='utf-8')

url = "https://vxxgvdlqvvchtlmqnrqf.supabase.co"
key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4eGd2ZGxxdnZjaHRsbXFucnFmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Nzk3MDA1MCwiZXhwIjoyMDczNTQ2MDUwfQ.YO-8-3sg4m--ms7MCvtwBLOo7ygqxaTbdtvwVwCin_Q"
supabase = create_client(url, key)

res = supabase.table("invoice_uploads").select("*").gte("created_at", "2026-09-01T13:08:00Z").order("created_at", desc=True).execute()

print(f"Found {len(res.data)} upload(s) since 15:08:")
for u in res.data:
    subject = u.get("metadata", {}).get("subject", "")
    sender = u.get("metadata", {}).get("sender", "")
    print(f"[{u['created_at']}] {u['file_name']} | Status: {u['upload_status']}/{u['processing_status']} | Subject: {subject}")
    print(f"  Notes: {u.get('notes')}\n")
