import requests
import json

url = "https://vxxgvdlqvvchtlmqnrqf.supabase.co/functions/v1/process-mailgun-webhook"

# Send sample payload mimicking Mailgun webhook for thinkaikft2@in.visibill.hu
payload = {
    "recipient": "thinkaikft2@in.visibill.hu",
    "sender": "ertesito@szamlazz.hu",
    "subject": "Értesítés számla elkészültéről: E-SZAMLA-2026-102",
    "body-plain": "Tisztelt Ügyfelünk!\n\nElkészült az Ön számlája a Számlázz.hu rendszerében.\nSzámlaszám: E-SZAMLA-2026-102\nLetöltési hivatkozás: https://www.szamlazz.hu/szamla/pdf/download/sampletoken\n\nKöszönjük vásárlását!",
    "timestamp": "1757970050",
    "token": "testtoken123",
    "signature": "testsignature123"
}

headers = {
    "Content-Type": "application/x-www-form-urlencoded"
}

print("Triggering process-mailgun-webhook Edge Function directly...")
res = requests.post(url, data=payload, headers=headers)

print(f"Status Code: {res.status_code}")
print("Response Body:", res.text)
