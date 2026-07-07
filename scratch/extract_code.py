import json
import os

input_path = r'C:\Users\Morfi\.gemini\antigravity-ide\brain\d9d864e2-262f-4823-bc1e-7c3f4517218f\.system_generated\steps\158\output.txt'
output_path = r'd:\ThinkAI\Visibill\eaisybill-prod\scratch\deployed_index.ts'

with open(input_path, 'r', encoding='utf-8') as f:
    data = json.load(f)
    content = data['files'][0]['content']
    with open(output_path, 'w', encoding='utf-8') as out:
        out.write(content)
