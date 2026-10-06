#!/usr/bin/env python3
"""
BRD Verification Script (verify_brd.py)
Validates:
1. Internal relative markdown links & diagram image references (SVG & @2x.png).
2. Absence of LaTeX formatting ($..., \\rightarrow, \\approx, \\le, \\ge).
3. Purity audit: Flags technical leakage (SQL, RPC, endpoints, code imports).
"""

import os
import re
import sys
from pathlib import Path
import urllib.parse

# Ensure UTF-8 stdout even on Windows cp1250 terminal
if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

LATEX_PATTERNS = [
    r"\$[^\$]+\$",
    r"\\rightarrow",
    r"\\approx",
    r"\\le\b",
    r"\\ge\b",
    r"\\times\b",
]

FORBIDDEN_TECH_KEYWORDS = [
    "CREATE TABLE",
    "ALTER TABLE",
    "FOREIGN KEY",
    "SECURITY DEFINER",
    "SECURITY INVOKER",
    "CREATE FUNCTION",
    "CREATE OR REPLACE",
    "ENABLE ROW LEVEL SECURITY",
    "CREATE POLICY",
    "auth.uid()",
    "GET /api/",
    "POST /api/",
    "HTTP 200",
    "Bearer token",
    "import React",
    "from 'react'",
    "FastAPI",
    "@tanstack/react-table",
]

def extract_markdown_links_and_images(text: str):
    """
    Extracts all markdown links and images, properly handling balanced parentheses in URLs.
    """
    results = []
    i = 0
    while True:
        start_bracket = text.find('[', i)
        if start_bracket == -1:
            break
        end_bracket = text.find(']', start_bracket)
        if end_bracket == -1:
            break
        if end_bracket + 1 < len(text) and text[end_bracket+1] == '(':
            depth = 1
            curr = end_bracket + 2
            while curr < len(text) and depth > 0:
                if text[curr] == '(':
                    depth += 1
                elif text[curr] == ')':
                    depth -= 1
                curr += 1
            if depth == 0:
                url = text[end_bracket+2:curr-1].strip()
                label = text[start_bracket+1:end_bracket].strip()
                results.append((label, url))
                i = curr
                continue
        i = start_bracket + 1
    return results

def verify_brd_directory(directory_path: str):
    dir_path = Path(directory_path).resolve()
    if not dir_path.is_dir():
        print(f"Error: Directory does not exist: {dir_path}")
        sys.exit(1)

    md_files = sorted(dir_path.glob("*.md"))
    if not md_files:
        print(f"No markdown files found in {dir_path}")
        sys.exit(1)

    print(f"=== VERIFYING BRD DIRECTORY: {dir_path} ===")
    print(f"Found {len(md_files)} markdown files.")

    total_errors = 0
    total_warnings = 0

    for md_file in md_files:
        filename = md_file.name
        content = md_file.read_text(encoding="utf-8")
        lines = content.splitlines()

        file_errors = 0
        file_warnings = 0

        # 1. LaTeX check
        for i, line in enumerate(lines, 1):
            for pat in LATEX_PATTERNS:
                if re.search(pat, line):
                    print(f"  [ERROR] {filename}:{i} - Found LaTeX syntax: {line.strip()[:80]}")
                    file_errors += 1

        # 2. Tech leakage check (skip audit reports themselves)
        if not any(filename.startswith(p) for p in ["BRD_PURITY_AUDIT", "BRD_TISZTASAGI_AUDIT", "PRD_PURITY_AUDIT", "PRD_TISZTASAGI_AUDIT"]):
            for i, line in enumerate(lines, 1):
                for kw in FORBIDDEN_TECH_KEYWORDS:
                    if kw.lower() in line.lower() and not line.strip().startswith("#"):
                        if "tilos" not in line.lower() and "helyett" not in line.lower():
                            print(f"  [WARN] {filename}:{i} - Possible technical leakage ('{kw}'): {line.strip()[:80]}")
                            file_warnings += 1

        # 3. Relative link & image existence check
        all_refs = extract_markdown_links_and_images(content)
        for text, url in all_refs:
            url = url.strip("<>")
            # ignore web links, mailto, anchor only
            if url.startswith("http://") or url.startswith("https://") or url.startswith("mailto:") or url.startswith("#"):
                continue
            
            clean_url = url.split("#")[0].split("?")[0]
            clean_url = urllib.parse.unquote(clean_url)
            if not clean_url:
                continue

            if clean_url.startswith("file:///"):
                clean_path = clean_url.replace("file:///", "")
                target_path = Path(clean_path).resolve()
            else:
                target_path = (md_file.parent / clean_url).resolve()

            if not target_path.exists():
                print(f"  [ERROR] {filename} - Broken link: '{url}' -> Target not found: {target_path}")
                file_errors += 1

        if file_errors == 0 and file_warnings == 0:
            print(f"[OK] {filename}: 100% Clean (Valid links, zero LaTeX, zero technical leaks)")
        else:
            print(f"[WARN] {filename}: {file_errors} errors, {file_warnings} warnings")

        total_errors += file_errors
        total_warnings += file_warnings

    print("\n=== VERIFICATION SUMMARY ===")
    print(f"Total Errors: {total_errors}")
    print(f"Total Warnings: {total_warnings}")

    if total_errors > 0:
        print("RESULT: FAILED (Fix broken links and formatting errors)")
        sys.exit(1)
    else:
        print("RESULT: PASSED (BRD integrity confirmed)")
        sys.exit(0)

if __name__ == "__main__":
    target_dir = sys.argv[1] if len(sys.argv) > 1 else "."
    verify_brd_directory(target_dir)
