from supabase import create_client

url = "https://vxxgvdlqvvchtlmqnrqf.supabase.co"
key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4eGd2ZGxxdnZjaHRsbXFucnFmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Nzk3MDA1MCwiZXhwIjoyMDczNTQ2MDUwfQ.YO-8-3sg4m--ms7MCvtwBLOo7ygqxaTbdtvwVwCin_Q"
supabase = create_client(url, key)

res = supabase.table("invoices").select("*").eq("company_id", "ecf31039-b539-4e04-bbea-70ea48c701bb").eq("bizonylatsorszam", "E-TAXAU-2026-294").execute()

if res.data:
    print("Taxology Invoice found:")
    for inv in res.data:
        print(f"  Supplier: {inv.get('elado_nev')}")
        print(f"  Invoice No: {inv.get('bizonylatsorszam')}")
        print(f"  Gross Amount: {inv.get('brutto_vegosszeg')} HUF")
        print(f"  Status: {inv.get('statusz')}")
else:
    print("Not found in invoices table yet, checking invoice_uploads...")
    res2 = supabase.table("invoice_uploads").select("*").eq("company_id", "ecf31039-b539-4e04-bbea-70ea48c701bb").ilike("file_name", "%TAXAU%").execute()
    for u in res2.data:
        print(f"  [{u['created_at']}] {u['file_name']} | Status: {u['upload_status']}/{u['processing_status']}")
