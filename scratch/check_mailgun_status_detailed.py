import datetime
import sys
from supabase import create_client

sys.stdout.reconfigure(encoding='utf-8')

url = "https://vxxgvdlqvvchtlmqnrqf.supabase.co"
key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4eGd2ZGxxdnZjaHRsbXFucnFmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Nzk3MDA1MCwiZXhwIjoyMDczNTQ2MDUwfQ.YO-8-3sg4m--ms7MCvtwBLOo7ygqxaTbdtvwVwCin_Q"
supabase = create_client(url, key)

now_utc = datetime.datetime.now(datetime.timezone.utc)
one_hour_ago = (now_utc - datetime.timedelta(hours=1)).isoformat()

print(f"=== CHECKING ALL INVOICE UPLOADS SINCE {one_hour_ago} ===")

uploads = supabase.table("invoice_uploads").select("*").gte("created_at", one_hour_ago).order("created_at", desc=True).execute()

print(f"Found {len(uploads.data)} invoice upload entries:")
for u in uploads.data:
    print(f"  [{u['created_at']}] {u['file_name']} | Status: {u['upload_status']}/{u['processing_status']} | Source: {u.get('metadata', {}).get('source')}")
    print(f"    Metadata: {u.get('metadata')}")
