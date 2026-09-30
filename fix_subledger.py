import sys
content = sys.stdin.read()
content = content.replace(
    '<PageHeader actions={\n        title="Folyószámla és Analitika"\n      >\n      >',
    '<PageHeader\n        title="Folyószámla és Analitika"\n        description="Vevő, szállító és egyéb analitikus számlák nyitott tételeinek kezelése, automatikus és kézi párosítása és leírása."\n        actions={'
)
# Close the actions prop
content = content.replace(
    '</PageHeader>',
    '} />'
)
# Wait, I need to find where the children of PageHeader were.
# They are between <PageHeader> and </PageHeader>.
# In the original it was:
# <PageHeader ...>
#   <div ...>...</div>
# </PageHeader>
# Now it should be:
# <PageHeader ... actions={<div ...>...</div>} />
