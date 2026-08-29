xml_path = r"c:\Users\adetw\.antigravity\visibill\visibill-709fffdf\tests\docs\Mandala Fogadó Kft 2022.01.01.-2026.12.31. adatexport.xml"

found_assets = False
found_ecs = False

with open(xml_path, 'r', encoding='latin1') as f:
    for line in f:
        if '<Targyi' in line or '<targyi' in line:
            found_assets = True
        if '<Ecs' in line or '<ecs' in line:
            found_ecs = True
        if found_assets and found_ecs:
            break

print(f"Found Tárgyi Eszköz tags: {found_assets}")
print(f"Found Értékcsökkenés tags: {found_ecs}")
