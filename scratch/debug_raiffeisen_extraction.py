import os
os.environ["SUPABASE_URL"] = "https://vxxgvdlqvvchtlmqnrqf.supabase.co"
os.environ["SUPABASE_SERVICE_ROLE_KEY"] = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4eGd2ZGxxdnZjaHRsbXFucnFmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Nzk3MDA1MCwiZXhwIjoyMDczNTQ2MDUwfQ.YO-8-3sg4m--ms7MCvtwBLOo7ygqxaTbdtvwVwCin_Q"

import sys
sys.path.append(r"c:\Users\adetw\.antigravity\visibill\visibill-worker")

from ocr_markitdown import get_ocr_from_markitdown
import asyncio

async def main():
    pdf_path = r"c:\Users\adetw\.antigravity\visibill\visibill-709fffdf\tests\docs\2026_09_01_9673_A0AEWR_001_017841410.PDF"
    ocr_text = await get_ocr_from_markitdown(pdf_path)
    
    lines = ocr_text.split('\n')
    for idx, line in enumerate(lines):
        if '5815366327' in line or '581536632' in line or '507060' in line:
            for j in range(max(0, idx-5), min(len(lines), idx+15)):
                print(f"[{j}] {lines[j]}")

if __name__ == "__main__":
    asyncio.run(main())
