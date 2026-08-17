import sys
import os
from dotenv import load_dotenv
from supabase import create_client

# Explicitly load from worker's .env file
load_dotenv(r'c:\Users\adetw\.antigravity\visibill\visibill-worker\.env')

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

supabase = create_client(url, key)

def check_invoice():
    res = supabase.table("invoices").select("*").eq("bizonylatsorszam", "03414/26-V").execute()
    
    if res.data:
        print(f"FOUND! Count: {len(res.data)}")
        for idx, inv in enumerate(res.data):
            print(f"--- Record {idx+1} ---")
            print(f"ID: {inv.get('id')}")
            print(f"Invoice Number: {inv.get('bizonylatsorszam')}")
            # Replace characters that fail Windows encoding
            elado = str(inv.get('elado_nev')).encode('ascii', 'replace').decode('ascii')
            vevo = str(inv.get('vevo_nev')).encode('ascii', 'replace').decode('ascii')
            print(f"Seller: {elado}")
            print(f"Buyer: {vevo}")
            print(f"Status: {inv.get('statusz')}")
            print(f"Total: {inv.get('brutto_vegosszeg')} {inv.get('penznem')}")
            print(f"Direction: {inv.get('invoice_direction')}")
            print(f"Created: {inv.get('created_at')}")
    else:
        print("Not found in invoices table.")

if __name__ == "__main__":
    check_invoice()
