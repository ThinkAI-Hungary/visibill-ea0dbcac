import requests

url = "https://vxxgvdlqvvchtlmqnrqf.supabase.co/functions/v1/process-mailgun-webhook"

# 1. Billingo Company Solutions email HTML with link https://app.billingo.hu/document-access/default/...
billingo_html = """
<div>
<p><strong>Feladó:</strong> "Company Solutions Kft." &lt;szamla@company-solutions.hu&gt;<br>
<strong>Tárgy:</strong> Számla érkezett: CS-2026-31</p>
<p>Tisztelt Think AI Kft.!</p>
<p>Kattintson az alábbi gombra a számla megtekintéséhez és letöltéséhez:</p>
<p><a href="https://app.billingo.hu/document-access/default/e54daff9-5746-4444-a7e6-83ee4e9e0000" style="background-color: #0052FF; color: white; padding: 12px 24px;">SZÁMLA MEGTEKINTÉSE A BILLINGÓBAN</a></p>
</div>
"""

payload_billingo = {
    "recipient": "thinkaikft2@in.visibill.hu",
    "sender": "szamla@company-solutions.hu",
    "subject": "Számla érkezett: CS-2026-31",
    "body-plain": "Számla érkezett CS-2026-31. SZÁMLA MEGTEKINTÉSE A BILLINGÓBAN: https://app.billingo.hu/document-access/default/e54daff9-5746-4444-a7e6-83ee4e9e0000",
    "body-html": billingo_html,
    "timestamp": "1757970050",
    "token": "testtokenbillingo",
    "signature": "testsigbillingo"
}

print("Testing Billingo email webhook trigger...")
res1 = requests.post(url, data=payload_billingo)
print("Status:", res1.status_code)
print("Response:", res1.text)
