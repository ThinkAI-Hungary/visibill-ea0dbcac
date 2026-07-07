import difflib

local_path = r'd:\ThinkAI\Visibill\eaisybill-prod\supabase\functions\process-mailgun-webhook\index.ts'
deployed_path = r'd:\ThinkAI\Visibill\eaisybill-prod\scratch\deployed_index.ts'

with open(local_path, 'r', encoding='utf-8') as f:
    local_lines = f.readlines()

with open(deployed_path, 'r', encoding='utf-8') as f:
    deployed_lines = f.readlines()

diff = difflib.unified_diff(deployed_lines, local_lines, fromfile='deployed', tofile='local')

with open(r'd:\ThinkAI\Visibill\eaisybill-prod\scratch\diff_result.txt', 'w', encoding='utf-8') as f:
    f.writelines(diff)
