import datetime
import time
import sys
from supabase import create_client

sys.stdout.reconfigure(encoding='utf-8')

url = "https://vxxgvdlqvvchtlmqnrqf.supabase.co"
key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4eGd2ZGxxdnZjaHRsbXFucnFmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Nzk3MDA1MCwiZXhwIjoyMDczNTQ2MDUwfQ.YO-8-3sg4m--ms7MCvtwBLOo7ygqxaTbdtvwVwCin_Q"
supabase = create_client(url, key)

start_time = "2026-09-01T13:08:00Z"

print(f"Polling database for records since {start_time}...")
for i in range(5):
    invs = supabase.table("invoice_uploads").select("*").gte("created_at", start_time).order("created_at", desc=True).execute()

    if invs.data:
        print(f"-> SUCCESS! Found {len(invs.data)} invoice upload(s):")
        for r in invs.data:
            print(f"   [{r['created_at']}] {r['file_name']} | Status: {r['upload_status']}/{r['processing_status']} | Subject: {r.get('metadata', {}).get('subject')}")
        break

    errs = supabase.table("app_error_logs").select("*").gte("created_at", start_time).order("created_at", desc=True).execute()
    if errs.data:
        print(f"-> Found {len(errs.data)} error log(s):")
        for r in errs.data:
            print(f"   [{r['created_at']}] [{r['severity']}] {r['action']}: {r['message'][:150]}")
        break

    time.sleep(8)
