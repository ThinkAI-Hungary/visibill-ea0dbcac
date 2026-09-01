import datetime
import sys
import json
from supabase import create_client

sys.stdout.reconfigure(encoding='utf-8')

url = "https://vxxgvdlqvvchtlmqnrqf.supabase.co"
key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4eGd2ZGxxdnZjaHRsbXFucnFmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Nzk3MDA1MCwiZXhwIjoyMDczNTQ2MDUwfQ.YO-8-3sg4m--ms7MCvtwBLOo7ygqxaTbdtvwVwCin_Q"
supabase = create_client(url, key)

now_utc = datetime.datetime.now(datetime.timezone.utc)
fifteen_mins_ago = (now_utc - datetime.timedelta(minutes=15)).isoformat()

print(f"=== CHECKING RECENT RECORDS SINCE {fifteen_mins_ago} ===")

# Invoice uploads
invs = supabase.table("invoice_uploads").select("*").gte("created_at", fifteen_mins_ago).order("created_at", desc=True).execute()
print(f"\nInvoice Uploads ({len(invs.data)} records):")
for r in invs.data:
    print(f"  [{r['created_at']}] {r['file_name']} | Status: {r['upload_status']}/{r['processing_status']} | Metadata: {r.get('metadata')}")

# Transaction uploads
txs = supabase.table("transaction_uploads").select("*").gte("created_at", fifteen_mins_ago).order("created_at", desc=True).execute()
print(f"\nTransaction Uploads ({len(txs.data)} records):")
for r in txs.data:
    print(f"  [{r['created_at']}] {r['file_name']} | Status: {r['upload_status']}/{r['processing_status']}")

# Error logs
errs = supabase.table("app_error_logs").select("*").gte("created_at", fifteen_mins_ago).order("created_at", desc=True).execute()
print(f"\nError Logs ({len(errs.data)} records):")
for r in errs.data:
    print(f"  [{r['created_at']}] [{r['severity']}] {r['component']} -> {r['action']}: {r['message']}")
