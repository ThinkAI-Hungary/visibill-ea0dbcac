import zipfile
import xml.etree.ElementTree as ET
import os

docx_path = r"c:\Users\adetw\.antigravity\visibill\visibill-709fffdf\tests\docs\A Napló szerepe és működése a könyvelőprogramokban.docx"

try:
    with zipfile.ZipFile(docx_path) as docx:
        xml_content = docx.read('word/document.xml')
        tree = ET.fromstring(xml_content)
        ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
        
        # In docx, paragraph elements are w:p and run elements are w:r
        paragraphs = []
        for p in tree.findall('.//w:p', ns):
            p_text = "".join(node.text for node in p.findall('.//w:t', ns) if node.text)
            if p_text.strip():
                paragraphs.append(p_text)
                
        output_text = "\n\n".join(paragraphs)
        
        # Write to a text file in scratch
        output_path = r"c:\Users\adetw\.antigravity\visibill\visibill-709fffdf\scratch\docx_text.txt"
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(output_text)
            
        print(f"Successfully extracted {len(paragraphs)} paragraphs to {output_path}")

except Exception as e:
    print(f"Error: {e}")
