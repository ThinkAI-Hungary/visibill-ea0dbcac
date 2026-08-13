import os

src_dir = r"C:\Users\adetw\.antigravity\visibill\visibill-709fffdf\src"
supabase_dir = r"C:\Users\adetw\.antigravity\visibill\visibill-709fffdf\supabase\functions"

replacements = [
    ('"/accounty', '"/eaisybooks'),
    ("'/accounty", "'/eaisybooks"),
    ('`/accounty', '`/eaisybooks'),
    ('\\/accounty', '\\/eaisybooks'),
]

modified_files = []

def process_file(path):
    try:
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        orig_content = content
        for search, replace in replacements:
            content = content.replace(search, replace)
        
        if content != orig_content:
            with open(path, 'w', encoding='utf-8') as f:
                f.write(content)
            modified_files.append(path)
    except Exception as e:
        print(f"Error processing {path}: {e}")

def scan_and_replace(directory):
    for root, dirs, files in os.walk(directory):
        for file in files:
            if not file.endswith(('.ts', '.tsx', '.js', '.jsx')):
                continue
            path = os.path.join(root, file)
            process_file(path)

scan_and_replace(src_dir)
scan_and_replace(supabase_dir)

print(f"Total modified files: {len(modified_files)}")
for f in modified_files:
    print(f"Modified: {os.path.relpath(f, r'C:\Users\adetw\.antigravity\visibill\visibill-709fffdf')}")
