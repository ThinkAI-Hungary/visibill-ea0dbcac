import sys
import asyncio
import os
import base64
from dotenv import load_dotenv
import fitz  # PyMuPDF
import litellm

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

sys.path.insert(0, r'c:\Users\adetw\.antigravity\visibill\visibill-worker')
os.chdir(r'c:\Users\adetw\.antigravity\visibill\visibill-worker')

load_dotenv()

PDF_PATH = r'c:\Users\adetw\.antigravity\visibill\visibill-709fffdf\tests\docs\10128AF0DN4KL0.pdf'

async def send_to_vision(image_bytes, page_num):
    b64 = base64.b64encode(image_bytes).decode("utf-8")
    prompt = (
        "You are an OCR assistant. Transcribe ALL text from this page image exactly. "
        "Do not add any explanations, introductions, or refusal messages. If there is no text, reply with [BLANK]."
    )
    
    try:
        response = await litellm.acompletion(
            model="gpt-4o",
            messages=[{
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64}", "detail": "high"}}
                ]
            }],
            max_tokens=4096,
            temperature=0.0
        )
        return response.choices[0].message.content or ""
    except Exception as e:
        return f"Error on page {page_num}: {e}"

async def main():
    doc = fitz.open(PDF_PATH)
    print(f"Total pages: {len(doc)}")
    
    for i in range(len(doc)):
        print(f"\n--- RENDERING PAGE {i+1} ---")
        page = doc[i]
        pix = page.get_pixmap(dpi=200)
        image_bytes = pix.tobytes("png")
        print(f"Page {i+1} image size: {len(image_bytes)} bytes")
        
        # Save page image locally to check if we want
        img_name = f"scratch/page_{i+1}.png"
        with open(img_name, "wb") as f:
            f.write(image_bytes)
        print(f"Saved {img_name}")
        
        print("Calling GPT-4o Vision OCR...")
        ocr_result = await send_to_vision(image_bytes, i+1)
        print(f"OCR RESULT PAGE {i+1}:")
        print(ocr_result)
        print("="*40)
        
    doc.close()

if __name__ == "__main__":
    asyncio.run(main())
