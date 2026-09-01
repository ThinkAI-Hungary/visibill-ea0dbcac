import os
os.environ["SUPABASE_URL"] = "https://vxxgvdlqvvchtlmqnrqf.supabase.co"
os.environ["SUPABASE_SERVICE_ROLE_KEY"] = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4eGd2ZGxxdnZjaHRsbXFucnFmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Nzk3MDA1MCwiZXhwIjoyMDczNTQ2MDUwfQ.YO-8-3sg4m--ms7MCvtwBLOo7ygqxaTbdtvwVwCin_Q"

import sys
sys.stdout.reconfigure(encoding='utf-8')
sys.path.append(r"c:\Users\adetw\.antigravity\visibill\visibill-worker")

from supabase import create_client

def main():
    supabase = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    company_id = "35a5409c-d9a7-4c0b-819e-b1ae79a9dd98" # TS Consult Kft.
    
    res = supabase.table("transactions").select("id, transaction_date, description, amount, currency").eq("company_id", company_id).execute()
    txs = res.data
    print(f"Total transactions for TS Consult Kft.: {len(txs)}")
    
    non_ascii_chars = {}
    for tx in txs:
        desc = tx.get("description") or ""
        for ch in desc:
            if ord(ch) > 127:
                non_ascii_chars[ch] = non_ascii_chars.get(ch, 0) + 1

    print("\n--- ALL NON-ASCII CHARACTERS & COUNTS ---")
    for ch, count in sorted(non_ascii_chars.items(), key=lambda x: -x[1]):
        print(f"  Character: {repr(ch)} (U+{ord(ch):04X}) -> Count: {count}")

    print("\n--- ALL DESCRIPTIONS WITH CORRUPTED CHARACTERS ---")
    for tx in txs:
        desc = tx.get("description") or ""
        if any(ord(c) > 127 and c not in "áéíóöőútüűÁÉÍÓÖŐÚTÜŰ" for c in desc) or any(k in desc for k in [">", "<"]):
            print(f"[{tx['transaction_date']}] ID: {tx['id']}\n  RAW: {repr(desc)}\n")

if __name__ == "__main__":
    main()
