import sys
import asyncio
import os
from dotenv import load_dotenv

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

sys.path.insert(0, r'c:\Users\adetw\.antigravity\visibill\visibill-worker')
os.chdir(r'c:\Users\adetw\.antigravity\visibill\visibill-worker')

load_dotenv()

PDF_PATH = r'c:\Users\adetw\.antigravity\visibill\visibill-709fffdf\tests\docs\10128AF0DN4KL0.pdf'

async def main():
    from ocr_markitdown import get_ocr_from_markitdown
    
    print("Reading and OCR-ing Customs PDF...")
    ocr_text = await get_ocr_from_markitdown(PDF_PATH)
    print(f"OCR characters: {len(ocr_text)}")
    print("\n--- Extracted Text ---")
    print(ocr_text)

if __name__ == "__main__":
    asyncio.run(main())
