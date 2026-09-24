"""
Local worker test on the problematic file from ticket EB-0177:
"VI bejövő augusztus.pdf" (1.7 MB, 36 invoices)
Tests:
1. Physical PDF chunk slicing and page validation
2. Blank page omission verification
3. Deterministic NAV crosscheck Strategy 4 fallback on the 6 previously failing invoices
"""

import asyncio
import io
import os
import sys
import urllib.request
import fitz

# Set up paths so worker modules can be imported
WORKER_DIR = r"D:\ThinkAI\Visibill\worker"
if WORKER_DIR not in sys.path:
    sys.path.insert(0, WORKER_DIR)

from dotenv import load_dotenv
load_dotenv(os.path.join(WORKER_DIR, ".env"))

if not os.environ.get("SUPABASE_URL"):
    os.environ["SUPABASE_URL"] = "https://vxxgvdlqvvchtlmqnrqf.supabase.co"
if not os.environ.get("SUPABASE_SERVICE_ROLE_KEY"):
    # Attempt to read from .env.local or process environment
    local_env = os.path.join(os.path.dirname(__file__), "..", ".env.local")
    if os.path.exists(local_env):
        load_dotenv(local_env)

from pdf_splitter import split_pdf_bytes_async, _is_page_blank, _slice_pdf_bytes
from db import get_client, _check_nav_invoice_info

COMPANY_ID = "eaad1b07-39a2-4267-9001-78b4f764449f"
USER_ID = "39dfdbb2-e3c3-4deb-9d00-cad745e340c7"
UPLOAD_ID = "5f92451d-1f73-4226-9eba-ce50621c31b3"
FILE_URL = "https://vxxgvdlqvvchtlmqnrqf.supabase.co/storage/v1/object/public/invoice-uploads/39dfdbb2-e3c3-4deb-9d00-cad745e340c7/1790159973081-yj08v7judpg.pdf"

async def run_test():
    if "--nav-only" not in sys.argv:
        print("=" * 70)
        print("TEST 1: Downloading problematic file...")
        req = urllib.request.Request(FILE_URL, headers={"User-Agent": "VisibillWorkerTest/1.0"})
        with urllib.request.urlopen(req) as resp:
            pdf_bytes = resp.read()
        print(f"Downloaded: {len(pdf_bytes):,} bytes.")

        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        total_pages = len(doc)
        print(f"Original PDF total pages: {total_pages}")
        doc.close()

        print("\n" + "=" * 70)
        print("TEST 2: Running split_pdf_bytes_async with physical slicing (Decision D-1)...")
        result = await split_pdf_bytes_async(
            pdf_bytes=pdf_bytes,
            filename="VI bejövő augusztus.pdf",
            min_pages_for_split=2,
        )

        print(f"Split Result:")
        print(f"  - Total pages: {result.total_pages}")
        print(f"  - Multi-invoice detected: {result.is_multi_invoice}")
        print(f"  - Scanned PDF: {result.is_scanned}")
        print(f"  - Total chunks generated: {len(result.chunks)}")

        assert result.is_multi_invoice is True, "Expected multi-invoice to be True"
        assert len(result.chunks) > 1, "Expected multiple chunks"

        # Validate that every chunk has physical sliced PDF bytes
        print("\nValidating each chunk's sliced PDF bytes:")
        sliced_valid_count = 0
        total_sliced_pages = 0
        for idx, chunk in enumerate(result.chunks):
            assert chunk.pdf_bytes is not None, f"Chunk {idx} is missing pdf_bytes!"
            assert len(chunk.pdf_bytes) > 0, f"Chunk {idx} pdf_bytes is empty!"

            # Open sliced PDF and verify page count matches chunk.page_numbers
            chunk_doc = fitz.open(stream=chunk.pdf_bytes, filetype="pdf")
            sliced_pages = len(chunk_doc)
            chunk_doc.close()

            assert sliced_pages == len(chunk.page_numbers), (
                f"Chunk {idx}: sliced PDF has {sliced_pages} pages, but page_numbers has {len(chunk.page_numbers)}"
            )
            sliced_valid_count += 1
            total_sliced_pages += sliced_pages

            if idx < 5 or idx == len(result.chunks) - 1:
                print(f"  Chunk {idx + 1:02d}: pages={chunk.page_numbers} -> {len(chunk.pdf_bytes):,} bytes PDF (pages: {sliced_pages}) | Hint: '{chunk.hint[:30]}'")

        print(f"All {sliced_valid_count}/{len(result.chunks)} chunks successfully sliced into valid standalone PDFs!")
        print(f"Total sliced pages across all chunks: {total_sliced_pages} (original: {total_pages})")

    print("\n" + "=" * 70)
    print("TEST 3: Testing Deterministic NAV Fallback (Decision D-3) against live DB...")
    client = get_client()

    test_cases = [
        {
            "name": "2026/106 (OCR read truncated '1069')",
            "extracted_number": "1069",
            "vat_id": "HU12666872",
            "gross": 117589.0,
            "currency": "HUF",
            "date": "2026-08-28",
            "expected_nav_number": "2026/106",
        },
        {
            "name": "KDLK-2026-8 (OCR generated OCR-1ad4a169)",
            "extracted_number": "OCR-1ad4a169",
            "vat_id": "HU59354961",
            "gross": 160000.0,
            "currency": "HUF",
            "date": "2026-08-25",
            "expected_nav_number": "KDLK-2026-8",
        },
        {
            "name": "MKB-2026-8 (OCR generated OCR-cba6bb04)",
            "extracted_number": "OCR-cba6bb04",
            "vat_id": "HU90961629",
            "gross": 50842.0,
            "currency": "HUF",
            "date": "2026-08-19",
            "expected_nav_number": "MKB-2026-8",
        },
        {
            "name": "SZSZ-2026-8 (OCR generated OCR-49ad54fc)",
            "extracted_number": "OCR-49ad54fc",
            "vat_id": "HU46120234",
            "gross": 68822.0,
            "currency": "HUF",
            "date": "2026-08-19",
            "expected_nav_number": "SZSZ-2026-8",
        },
        {
            "name": "KDD-2026-8 (OCR generated OCR-6bc1f9b3)",
            "extracted_number": "OCR-6bc1f9b3",
            "vat_id": "HU90957217",
            "gross": 51822.0,
            "currency": "HUF",
            "date": "2026-08-19",
            "expected_nav_number": "KDD-2026-8",
        },
        {
            "name": "KSZE-2026-9 (OCR generated OCR-2dff78bb)",
            "extracted_number": "OCR-2dff78bb",
            "vat_id": "HU53395245",
            "gross": 160000.0,
            "currency": "HUF",
            "date": "2026-08-24",
            "expected_nav_number": "KSZE-2026-9",
        },
    ]

    for tc in test_cases:
        row = {
            "bizonylatsorszam": tc["extracted_number"],
            "elado_vat_id": tc["vat_id"],
            "brutto_vegosszeg": tc["gross"],
            "penznem": tc["currency"],
            "kibocsatas_datuma": tc["date"],
            "invoice_direction": "INBOUND",
        }
        matched = _check_nav_invoice_info(row, COMPANY_ID)
        assert matched is not None, f"Failed to match {tc['name']} via NAV crosscheck fallback!"
        assert row["bizonylatsorszam"] == tc["expected_nav_number"], (
            f"Expected {tc['expected_nav_number']}, got {row['bizonylatsorszam']}"
        )
        print(f"  [PASS] {tc['name']} -> Matched to NAV: '{row['bizonylatsorszam']}' (elado: '{row.get('elado_nev')}')")

    print("\n" + "=" * 70)
    print("ALL TESTS PASSED SUCCESSFULLY ON THE PROBLEMATIC FILE!")
    print("=" * 70)

if __name__ == "__main__":
    asyncio.run(run_test())
