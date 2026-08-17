import sys
import asyncio
import os
from dotenv import load_dotenv

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

sys.path.insert(0, r'c:\Users\adetw\.antigravity\visibill\visibill-worker')
os.chdir(r'c:\Users\adetw\.antigravity\visibill\visibill-worker')

load_dotenv()

PDF_PATH = r'c:\Users\adetw\.antigravity\visibill\visibill-709fffdf\tests\docs\1786783694944-03414_26-V_Victoria_Music_Hangs.pdf'

async def main():
    from ocr_markitdown import get_ocr_from_markitdown
    from processor import process_ocr_text
    
    print("Reading and OCR-ing PDF...")
    ocr_text = await get_ocr_from_markitdown(PDF_PATH)
    print(f"OCR characters: {len(ocr_text)}")
    
    print("\nRunning full pipeline (process_ocr_text) with Victoria Music...")
    invoice_type, extraction, error_msg, responses = await process_ocr_text(
        ocr_text,
        company_name="Victoria Music Kft.",
        company_tax="12970553",
    )
    
    print(f"invoice_type: {invoice_type}")
    print(f"error_msg: {error_msg}")
    if extraction:
        print("Extraction Result (model_dump):")
        print(extraction.model_dump())
    else:
        print("Extraction failed. Raw responses:")
        for i, r in enumerate(responses):
            print(f"Response {i+1} content:")
            print(r.choices[0].message.content)

if __name__ == "__main__":
    asyncio.run(main())
