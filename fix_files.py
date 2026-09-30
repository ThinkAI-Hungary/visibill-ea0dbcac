import sys

def fix_subledger():
    with open('src/pages/SubledgerPage.tsx', 'r') as f:
        content = f.read()
    
    start_tag = '<PageHeader actions={'
    end_tag = '</PageHeader>'
    
    start_idx = content.find(start_tag)
    end_idx = content.find(end_tag)
    
    if start_idx != -1 and end_idx != -1:
        # Find the div that should be in actions
        div_start = content.find('<div', start_idx)
        
        new_header = (
            '<PageHeader\n'
            '        title="Folyószámla és Analitika"\n'
            '        description="Vevő, szállító és egyéb analitikus számlák nyitott tételeinek kezelése, automatikus és kézi párosítása és leírása."\n'
            '        actions={' + content[div_start:end_idx] + '}\n'
            '      />'
        )
        content = content[:start_idx] + new_header + content[end_idx + len(end_tag):]
        
    with open('src/pages/SubledgerPage.tsx', 'w') as f:
        f.write(content)

def fix_escalation():
    with open('src/pages/EscalationListPage.tsx', 'r') as f:
        content = f.read()
    content = content.replace("(data || []) as EscalatedMatch[]", "(data || []) as unknown as EscalatedMatch[]")
    content = content.replace("selectedMatch.invoice?.melleklet_url", "(selectedMatch.invoice as any)?.melleklet_url")
    content = content.replace("selectedMatch.invoice?.image_url", "(selectedMatch.invoice as any)?.image_url")
    content = content.replace("selectedMatch.invoice?.bizonylatsorszam", "(selectedMatch.invoice as any)?.bizonylatsorszam")
    content = content.replace("onClick={handleCmrSearch}", "onClick={() => handleCmrSearch()}")
    content = content.replace("onClick={handlePendingManualSearch}", "onClick={() => handlePendingManualSearch()}")
    with open('src/pages/EscalationListPage.tsx', 'w') as f:
        f.write(content)

def fix_transfers():
    with open('src/pages/TransfersPage.tsx', 'r') as f:
        content = f.read()
    content = content.replace("inv.vevo_nev", "(inv as any).vevo_nev")
    content = content.replace("inv.vevo_vat_id", "(inv as any).vevo_vat_id")
    with open('src/pages/TransfersPage.tsx', 'w') as f:
        f.write(content)

fix_subledger()
fix_escalation()
fix_transfers()
