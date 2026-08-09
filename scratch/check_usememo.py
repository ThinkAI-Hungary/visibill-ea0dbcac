import os
import re

src_dir = r"c:\Users\adetw\.antigravity\visibill\visibill-709fffdf\src"

def check_files():
    for root, dirs, files in os.walk(src_dir):
        for file in files:
            if file.endswith(('.ts', '.tsx')):
                path = os.path.join(root, file)
                with open(path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                
                # Look for useMemo in content
                # We want to match useMemo as a word, but not React.useMemo
                # And we want to check if it's imported
                has_usememo = bool(re.search(r'\buseMemo\b', content))
                has_react_usememo = 'React.useMemo' in content
                
                # Check if it has a reference to useMemo (not React.useMemo)
                # i.e., let's strip React.useMemo and then search for \buseMemo\b
                content_stripped = content.replace('React.useMemo', '')
                has_naked_usememo = bool(re.search(r'\buseMemo\b', content_stripped))
                
                if has_naked_usememo:
                    # check if useMemo is imported
                    # e.g., import { ...useMemo... } from 'react';
                    is_imported = False
                    # Let's search for react imports
                    react_imports = re.findall(r'import\s+[^;]+?from\s+[\'"]react[\'"]', content)
                    for imp in react_imports:
                        if 'useMemo' in imp:
                            is_imported = True
                            break
                    if not is_imported:
                        print(f"File: {path}")
                        # print first 5 lines containing useMemo
                        lines = content.splitlines()
                        for i, line in enumerate(lines):
                            if 'useMemo' in line and 'React.useMemo' not in line:
                                print(f"  {i+1}: {line}")

if __name__ == '__main__':
    check_files()
