from supabase import create_client
import sys

sys.stdout.reconfigure(encoding='utf-8')

url = "https://vxxgvdlqvvchtlmqnrqf.supabase.co"
key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4eGd2ZGxxdnZjaHRsbXFucnFmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Nzk3MDA1MCwiZXhwIjoyMDczNTQ2MDUwfQ.YO-8-3sg4m--ms7MCvtwBLOo7ygqxaTbdtvwVwCin_Q"
supabase = create_client(url, key)

res = supabase.table("invoice_uploads").select("*").gte("created_at", "2026-09-01T13:08:00Z").execute()

for u in res.data:
    print(f"[{u['created_at']}] {u['file_name']} ({u['file_size']} bytes) | Status: {u['upload_status']}/{u['processing_status']}")
    print(f"  URL: {u.get('file_url')}")
    print(f"  Metadata: {u.get('metadata')}")
    print(f"  Notes: {u.get('notes')}")
    print(f"  OCR Text: {u.get('metadata', {}).get('ocr_text', '')[:300]}\n")
