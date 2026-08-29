import xml.etree.ElementTree as ET

xml_path = r"c:\Users\adetw\.antigravity\visibill\visibill-709fffdf\tests\docs\Mandala Fogadó Kft 2022.01.01.-2026.12.31. adatexport.xml"
tags = set()

# Since the file is 223MB, let's read only the tags at depth 1 using iterparse
context = ET.iterparse(xml_path, events=("start",))
for event, elem in context:
    # If the element is a direct child of 'Adatok', record its tag
    # The root tag is 'Adatok', so path stack or check parent.
    # Actually we can just find all unique tags at the second level.
    # To do it quickly, let's just parse the first 500,000 events or so, or let's use a streaming check.
    pass

# A simpler way in python:
import re
tags = set()
with open(xml_path, 'r', encoding='latin1') as f:
    # read first 5000 lines and find all opening tags at depth 1 (i.e. <something> right after <Adatok>)
    # Let's just find matches of '<(\w+)>' at the start of line or with spaces
    content = ""
    for _ in range(100000): # read first 100k lines
        line = f.readline()
        if not line:
            break
        m = re.match(r"^\s*<(\w+)>", line)
        if m:
            tags.add(m.group(1))

print("Found tags in XML (first 100k lines):")
for t in sorted(tags):
    print(f"  - {t}")
