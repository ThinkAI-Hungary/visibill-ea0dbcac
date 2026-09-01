import os
os.environ["SUPABASE_URL"] = "https://vxxgvdlqvvchtlmqnrqf.supabase.co"
os.environ["SUPABASE_SERVICE_ROLE_KEY"] = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4eGd2ZGxxdnZjaHRsbXFucnFmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Nzk3MDA1MCwiZXhwIjoyMDczNTQ2MDUwfQ.YO-8-3sg4m--ms7MCvtwBLOo7ygqxaTbdtvwVwCin_Q"

import sys
sys.path.append(r"c:\Users\adetw\.antigravity\visibill\visibill-worker")

import asyncio
from transaction_extractor import _extract_from_pdf

async def main():
    pdf_path = r"c:\Users\adetw\.antigravity\visibill\visibill-709fffdf\tests\docs\2026_09_01_9673_A0AEWR_001_017841410.PDF"
    with open(pdf_path, 'rb') as f:
        file_bytes = f.read()
    
    reject_holder = {"reason": None}
    transactions, bank = await _extract_from_pdf(
        file_bytes=file_bytes,
        file_name="2026_09_01_9673_A0AEWR_001_017841410.PDF",
        upload_id="test-upload-id",
        company_id="test-company-id",
        reject_holder=reject_holder
    )
    
    print(f"Transactions found: {len(transactions)}")
    print(f"Bank detected: {bank}")
    print(f"Reject Reason: {reject_holder['reason']}")
    print("\n--- EXTRACTED TRANSACTIONS ---")
    for idx, tx in enumerate(transactions):
        print(f"{idx+1}. Date: {tx.transaction_date} | Amount: {tx.amount} {tx.currency} | Desc: {tx.description[:60]}")

if __name__ == "__main__":
    asyncio.run(main())
