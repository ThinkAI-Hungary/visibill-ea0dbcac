import requests

# Test token URL from log: e54daff9-5746-4444-a7e6-83ee4e9e0000 or similar
test_url = "https://app.billingo.hu/document-access/download/e54daff9-5746-4444-a7e6-83ee4e9e0000"

print(f"Testing fetch from {test_url}...")
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Visibill-Invoice-Fetcher/1.0",
    "Accept": "application/pdf"
}

res = requests.get(test_url, headers=headers, allow_redirects=True)
print("Status Code:", res.status_code)
print("Content-Type:", res.headers.get("content-type"))
print("First 20 bytes:", res.content[:20])

if b"%PDF" in res.content[:10]:
    print("SUCCESS! Directly received %PDF binary bytes!")
else:
    print("Received HTML text (first 300 chars):", res.text[:300])
