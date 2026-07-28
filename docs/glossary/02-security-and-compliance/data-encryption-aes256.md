# 🔐 Data Encryption (Adattitkosítás: AES-256-GCM & TLS)

> **Utoljára frissítve:** 2026-07-25  
> **Kapcsolódó doksi:** [A-010: Credential Encryption](../../architecture/decisions/A-010-credential-encryption.md) | [A-038: IMAP/SMTP Vault](../../architecture/decisions/A-038-imap-smtp-credentials-vault-integration.md) | [GLOSSARY Index](../index.md)

---

## 📖 Fogalom Meghatározása

Az **Adattitkosítás (Data Encryption)** a nyílt szöveges információk (plain text) olyan matematikai átalakítása titkosírássá (cipher text), amely kizárólag a megfelelő titkosítási kulcs (Encryption Key) birtokában fejthető vissza.

Az iparági szabványok két fő állapotot különböztetnek meg:
- **Encryption in-Transit (Átvitel közbeni titkosítás):** Az adatok védelme a hálózaton (HTTPS / TLS 1.3).
- **Encryption at-Rest (Nyugalmi állapotú titkosítás):** Az adatok védelme a lemezen vagy az adatbázisban (AES-256-GCM).

---

## 🔑 Titkosítási Szintek a Visibillben

```
[ Kliens Böngésző ] ─── HTTPS / TLS 1.3 (In-Transit) ───► [ Edge Function / Supabase ]
                                                                   │
                                                        AES-256-GCM Titkosítás (At-Rest)
                                                                   ▼
                                                       [ Database Vault & Storage ]
```

| Réteg | Technológia | Mit Véd? | Szabály / Megvalósítás |
|---|---|---|---|
| **In-Transit (Hálózat)** | **TLS 1.3 / HTTPS** | Minden kliens-szerver hálózati forgalmat. | Kötelező HSTS & SSL aláírás a Supabase és Cloudflare rétegen. |
| **At-Rest (Adatbázis)** | **PostgreSQL Transparent Disk Encryption** | A teljes adatbázis lemezképét a felhőben. | A Supabase kezeli a lemez-szintű blokk-titkosítást. |
| **Field-Level (Mező-szint)** | **AES-256-GCM (Vault)** | **Kiemelten érzékeny jelszavakat és kulcsokat** (IMAP/SMTP jelszavak, NAV aláírókulcsok). | [A-010] & [A-038]: Az adatbázisba csak titkosított sztring menthető. |

---

## 💡 Használat a Visibillben: Per-User Credentials Vault ([A-010] / [A-038])

Az ügyfelek NAV integrációs jelszavait és az IMAP/SMTP e-mail beállításait a rendszer **nem tárolja nyílt szövegesen** a táblákban.

### AES-256-GCM Titkosítási Minta:
1. **Titkosítás:** Az adatbázisba történő mentés előtt az Edge Function vagy a szerver az egyedi master key segítségével `AES-256-GCM` algoritmussal titkosítja a jelszót, generálva egy egyedi **IV (Initialization Vector)**-t és **Auth Tag**-et.
2. **Visszafejtés:** A Python worker az e-mail olvasásakor (`imap_sync`) memóriában, az adott művelet idejére fejti vissza a jelszót.

```python
# Szerver oldali visszafejtés példa (worker/credentials.py):
def decrypt_credential(cipher_text: str, iv: str, tag: str, master_key: bytes) -> str:
    cipher = Cipher(algorithms.AES(master_key), modes.GCM(bytes.fromhex(iv), bytes.fromhex(tag)))
    decryptor = cipher.decryptor()
    return (decryptor.update(bytes.fromhex(cipher_text)) + decryptor.finalize()).decode('utf-8')
```
