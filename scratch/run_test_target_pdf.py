import sys
sys.path.append(r"c:\Users\adetw\.antigravity\visibill\visibill-worker")

import asyncio
from transaction_extractor import _extract_from_pdf

async def main():
    pdf_path = r"c:\Users\adetw\.antigravity\visibill\visibill-709fffdf\tests\docs\1787566924235-Kivonat_20260730.pdf"
    with open(pdf_path, 'rb') as f:
        file_bytes = f.read()
    
    reject_holder = {"reason": None}
    transactions, bank = await _extract_from_pdf(
        file_bytes=file_bytes,
        file_name="1787566924235-Kivonat_20260730.pdf",
        upload_id="test-upload-id",
        company_id="test-company-id",
        reject_holder=reject_holder
    )
    
    print(f"Transactions found: {len(transactions)}")
    print(f"Bank: {bank}")
    print(f"Reject Reason: {reject_holder['reason']}")
    print("\n--- EXTRACTED TRANSACTIONS ---")
    for idx, tx in enumerate(transactions):
        print(f"{idx+1}. Date: {tx.transaction_date} | Amount: {tx.amount} {tx.currency} | Desc: {tx.description[:60]}")

if __name__ == "__main__":
    asyncio.run(main())
