import re

dmp_path = r"c:\Users\adetw\.antigravity\visibill\visibill-709fffdf\tests\docs\AdatExport.dmp"
samples = {}

with open(dmp_path, 'r', encoding='latin1') as f:
    for line in f:
        m = re.match(r"INSERT INTO\s+(\w+)", line, re.IGNORECASE)
        if m:
            tbl = m.group(1)
            if tbl not in samples:
                samples[tbl] = line.strip()[:300] # print first 300 chars

print("Sample rows for each table:")
for t, s in sorted(samples.items()):
    print(f"Table: {t}\nSample: {s}\n" + "-"*50)
