import fitz # PyMuPDF

pdf_path = r"c:\Users\adetw\.antigravity\visibill\visibill-709fffdf\tests\docs\Ertesito_-_VICTORIA_MUSIC_Kft._2026-08-03.pdf"
out_path = r"c:\Users\adetw\.antigravity\visibill\visibill-709fffdf\scratch\tax_pdf_text_output.txt"

try:
    doc = fitz.open(pdf_path)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(f"Number of pages: {len(doc)}\n")
        for i, page in enumerate(doc):
            f.write(f"\n--- Page {i+1} ---\n")
            text = page.get_text()
            f.write(text)
    print("Tax PDF text written successfully to scratch/tax_pdf_text_output.txt")
except Exception as e:
    print(f"Error reading PDF: {e}")
