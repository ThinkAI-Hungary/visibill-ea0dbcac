import sys
import os
import pdfplumber

pdf_path = r"c:\Users\adetw\.antigravity\visibill\visibill-709fffdf\tests\docs\10128AF0DN4KL0.pdf"

def main():
    if not os.path.exists(pdf_path):
        print(f"File not found: {pdf_path}")
        return

    with pdfplumber.open(pdf_path) as pdf:
        print(f"Total pages: {len(pdf.pages)}")
        
        # Extract text from all pages
        for i, page in enumerate(pdf.pages):
            text = page.extract_text()
            print(f"\n--- Page {i+1} ---")
            lines = text.split("\n") if text else []
            for line in lines:
                # Print safely for CP1252 terminal
                line_safe = line.encode('ascii', 'replace').decode('ascii')
                print(line_safe)

if __name__ == "__main__":
    main()
