import requests

url = "https://vxxgvdlqvvchtlmqnrqf.supabase.co/functions/v1/process-mailgun-webhook"

# Simulating Trend-Art Számlázz.hu notification email
html_body = """
<html>
<body>
<p>Tisztelt Think AI Kft.!</p>
<p>Ezúton küldjük aktuális számláját. A számlát cégünk a Számlázz.hu rendszerével állította ki.</p>
<a href="https://www.szamlazz.hu/szamla/pdf/download/test_sample_pdf" style="background-color: #FF5722; color: white; padding: 10px 20px;">LETÖLTÖM A SZÁMLÁT</a>
<p>©2005-2026 Számlázz.hu</p>
</body>
</html>
"""

payload = {
    "recipient": "thinkaikft2@in.visibill.hu",
    "sender": "trend.art@szamlazz.hu",
    "subject": "Értesítő: Számla érkezett – Trend-Art Media Nonprofit Kft.",
    "body-plain": "Tisztelt Think AI Kft.! Ezúton küldjük aktuális számláját. LETÖLTÖM A SZÁMLÁT ©2005-2026 Számlázz.hu",
    "body-html": html_body,
    "timestamp": "1757970050",
    "token": "testtoken123",
    "signature": "testsignature123"
}

print("Triggering webhook for Trend-Art email...")
res = requests.post(url, data=payload)
print("Status:", res.status_code)
print("Response:", res.text)
