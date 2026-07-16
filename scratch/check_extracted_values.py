import sys
from supabase import create_client

# Set stdout to UTF-8
sys.stdout.reconfigure(encoding='utf-8')

URL = "https://vxxgvdlqvvchtlmqnrqf.supabase.co"
KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4eGd2ZGxxdnZjaHRsbXFucnFmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Nzk3MDA1MCwiZXhwIjoyMDczNTQ2MDUwfQ.YO-8-3sg4m--ms7MCvtwBLOo7ygqxaTbdtvwVwCin_Q"

def main():
    client = create_client(URL, KEY)
    res = client.table("invoices").select("id, bizonylatsorszam, kibocsatas_datuma, elado_nev, vevo_nev, adojogi_megjegyzes, confidence_score, statusz").eq("invoice_type", "penztarbizonylat").order("letrehozva", desc=True).limit(20).execute()
    for row in res.data:
        print(f"ID: {row['id']}")
        print(f"  Sorszam: {row['bizonylatsorszam']}")
        print(f"  Datum: {row['kibocsatas_datuma']}")
        print(f"  Elado: {row['elado_nev']}")
        print(f"  Vevo: {row['vevo_nev']}")
        print(f"  Megjegyzes: {row['adojogi_megjegyzes']}")
        print(f"  Confidence: {row['confidence_score']}")
        print(f"  Statusz: {row['statusz']}")
        print("-" * 40)

if __name__ == "__main__":
    main()
