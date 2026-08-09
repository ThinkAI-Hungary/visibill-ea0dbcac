import os
import re

def process_file(file_path):
    print(f"Processing: {file_path}")
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Determine if it has "/accounty/client/" references
    if "/accounty/client/" not in content:
        return

    # Replace useParams patterns to include dateRange
    # Pattern 1: useParams<{ companyId: string }>()
    content = re.sub(
        r'const\s*\{\s*companyId\s*\}\s*=\s*useParams\s*<\s*\{\s*companyId\s*:\s*string\s*\}\s*>\s*\(\s*\);',
        'const { companyId, dateRange } = useParams<{ companyId: string; dateRange: string }>();',
        content
    )

    # Pattern 1b: const { id } = useParams<{ id: string }>()
    content = re.sub(
        r'const\s*\{\s*id\s*\}\s*=\s*useParams\s*<\s*\{\s*id\s*:\s*string\s*\}\s*>\s*\(\s*\);',
        'const { id, dateRange } = useParams<{ id: string; dateRange: string }>();',
        content
    )

    # Pattern 2: const { companyId, recordType } = useParams<{ companyId: string; recordType: string }>()
    content = re.sub(
        r'const\s*\{\s*companyId\s*,\s*recordType\s*\}\s*=\s*useParams\s*<\s*\{\s*companyId\s*:\s*string\s*;\s*recordType\s*:\s*string\s*\}\s*>\s*\(\s*\);',
        'const { companyId, recordType, dateRange } = useParams<{ companyId: string; recordType: string; dateRange: string }>();',
        content
    )

    # Pattern 3: const { companyId, step } = useParams<{ companyId: string; step: string }>()
    content = re.sub(
        r'const\s*\{\s*companyId\s*,\s*step\s*\}\s*=\s*useParams\s*<\s*\{\s*companyId\s*:\s*string\s*;\s*step\s*:\s*string\s*\}\s*>\s*\(\s*\);',
        'const { companyId, step, dateRange } = useParams<{ companyId: string; step: string; dateRange: string }>();',
        content
    )

    # Replace legacy client links with direct scoped links
    content = re.sub(
        r'/accounty/client/\$\{id\}/ev',
        r'/accounty/${id}/${dateRange}/ev',
        content
    )
    content = re.sub(
        r'/accounty/client/\$\{companyId\}/ev',
        r'/accounty/${companyId}/${dateRange}/ev',
        content
    )
    content = re.sub(
        r'/accounty/client/\$\{id\}/tao',
        r'/accounty/${id}/${dateRange}/tao',
        content
    )
    content = re.sub(
        r'/accounty/client/\$\{companyId\}/tao',
        r'/accounty/${companyId}/${dateRange}/tao',
        content
    )

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Successfully processed: {file_path}")

def run():
    # Process Ev folder
    ev_dir = 'src/pages/Accounty/Ev'
    for filename in os.listdir(ev_dir):
        if filename == 'EvPortfolioDashboard.tsx':
            continue
        if filename.endswith('.tsx') or filename.endswith('.ts'):
            process_file(os.path.join(ev_dir, filename))

    # Process Tao folder
    tao_dir = 'src/pages/Accounty/Tao'
    for filename in os.listdir(tao_dir):
        if filename == 'TaoPortfolioPage.tsx':
            continue
        if filename.endswith('.tsx') or filename.endswith('.ts'):
            process_file(os.path.join(tao_dir, filename))

if __name__ == '__main__':
    run()
