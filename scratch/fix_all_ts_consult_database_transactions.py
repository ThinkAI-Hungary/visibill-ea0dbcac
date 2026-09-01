import os
os.environ["SUPABASE_URL"] = "https://vxxgvdlqvvchtlmqnrqf.supabase.co"
os.environ["SUPABASE_SERVICE_ROLE_KEY"] = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4eGd2ZGxxdnZjaHRsbXFucnFmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Nzk3MDA1MCwiZXhwIjoyMDczNTQ2MDUwfQ.YO-8-3sg4m--ms7MCvtwBLOo7ygqxaTbdtvwVwCin_Q"

import sys
sys.stdout.reconfigure(encoding='utf-8')
sys.path.append(r"c:\Users\adetw\.antigravity\visibill\visibill-worker")

from supabase import create_client
import re

def fix_encoding(s: str) -> str:
    if not s:
        return ""

    # Protect emails
    emails = []
    def save_email(m):
        emails.append(m.group(0))
        return f"___EMAIL_{len(emails)-1}___"

    s = re.sub(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}", save_email, s)

    # 1. Single character replacement map (PDF / Latin-1 font artifacts)
    replacements = {
        'ø': 'ó',
        'Ø': 'Ó',
        'ù': 'ő',
        'Ù': 'Ő',
        'ì': 'ő',
        'ï': 'ü',
        'î': 'ű',
        '›': 'í',
        '‹': 'í',
        '©': 'é',
        '@': 'é',
        '>': 'í',
        '<': 'í',
        '£': 'á',
        '¶': 'Á',
        '½': ' É',
        'ë': 'ó',
        'õ': 'ő',
        'Õ': 'Ő',
        'û': 'ű',
        'Û': 'Ű',
        'ẽ': 'á',
    }

    for src, dst in replacements.items():
        s = s.replace(src, dst)

    # 2. Specific word corruptions from Hungarian PDF bank statements
    s = re.sub(r'Kényvelés', 'Könyvelés', s)
    s = re.sub(r'Kézlem', 'Közlem', s)
    s = re.sub(r'El[ìíõi]jegyzett', 'Előjegyzett', s)
    s = re.sub(r'Előjegyzettd[íi›>]j', 'Előjegyzett díj', s)
    s = re.sub(r'El[ìíõi]jegyzettd[íi›>]j', 'Előjegyzett díj', s)
    s = re.sub(r'\bésszeg', 'összeg', s)
    s = re.sub(r'\bésszes', 'összes', s)
    s = re.sub(r'bankonbelüli', 'bankon belüli', s)
    s = re.sub(r'bankonbelïli', 'bankon belüli', s)

    # Restore emails
    for idx, em in enumerate(emails):
        s = s.replace(f"___EMAIL_{idx}___", em)

    return s

def main():
    supabase = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    company_id = "35a5409c-d9a7-4c0b-819e-b1ae79a9dd98" # TS Consult Kft.
    
    res = supabase.table("transactions").select("id, transaction_date, description").eq("company_id", company_id).execute()
    txs = res.data
    print(f"Loaded {len(txs)} transactions for TS Consult Kft.")

    updated_count = 0
    for tx in txs:
        old_desc = tx.get("description") or ""
        new_desc = fix_encoding(old_desc)
        if old_desc != new_desc:
            updated_count += 1
            print(f"\n[UPDATE {tx['id']} ({tx['transaction_date']})]")
            print(f"  BEFORE: {repr(old_desc)}")
            print(f"  AFTER : {repr(new_desc)}")
            # Update database record directly!
            supabase.table("transactions").update({"description": new_desc}).eq("id", tx["id"]).execute()

    print(f"\nSuccessfully updated {updated_count} / {len(txs)} transactions in DB!")

if __name__ == "__main__":
    main()
