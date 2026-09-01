import requests

url = "https://vxxgvdlqvvchtlmqnrqf.supabase.co/functions/v1/process-mailgun-webhook"

# HTML matching the user's screenshot: "Trend-Art Media Nonprofit Kft.", orange button "LETÖLTÖM A SZÁMLÁT", copyright ©2005-2026
html_content = """
<div>
<p><strong>Továbbított levél kezdete:</strong></p>
<p><strong>Feladó:</strong> "Trend-Art Media Nonprofit Kft." &lt;trend.art@szamlazz.hu&gt;<br>
<strong>Tárgy:</strong> Értesítő: Számla érkezett – Trend-Art Media Nonprofit Kft.<br>
<strong>Dátum:</strong> 2026. augusztus 25. 9:47:54 CEST<br>
<strong>Címzett:</strong> viktor@thinkai.hu</p>
<hr>
<p>Tisztelt Think AI Kft.!</p>
<p>Köszönjük, hogy minket választott! Ezúton küldjük aktuális számláját. Kérjük, a számla tartalmának megfelelően legyen szíves a kifizetésről gondoskodni.</p>
<p>Ez egy automatikus üzenet. Amennyiben számlájával kapcsolatban bármilyen kérdése merül fel, vegye fel velünk a kapcsolatot!</p>
<p>Üdvözlettel:<br>Trend-Art Media Nonprofit Kft.</p>
<p>A számlát cégünk a Számlázz.hu rendszerével állította ki.</p>
<p><a href="https://www.szamlazz.hu/szamla/pdf/download/sample_trendart_token" style="background-color: #FF5722; color: white; padding: 12px 24px; text-decoration: none; display: inline-block;">LETÖLTÖM A SZÁMLÁT</a></p>
<p>©2005-2026 Számlázz.hu</p>
</div>
"""

payload = {
    "recipient": "thinkaikft2@in.visibill.hu",
    "sender": "viktor@thinkai.hu",
    "from": "Aron Beres <viktor@thinkai.hu>",
    "subject": "Fwd: Értesítő: Számla érkezett – Trend-Art Media Nonprofit Kft.",
    "body-plain": "---------- Forwarded message ---------\nFeladó: Trend-Art Media Nonprofit Kft. <trend.art@szamlazz.hu>\nLETÖLTÖM A SZÁMLÁT\n©2005-2026 Számlázz.hu",
    "body-html": html_content,
    "timestamp": "1757970050",
    "token": "testtoken999",
    "signature": "testsignature999"
}

print("Testing exact Trend-Art forwarded email payload...")
res = requests.post(url, data=payload)
print("Status Code:", res.status_code)
print("Response:", res.text)
