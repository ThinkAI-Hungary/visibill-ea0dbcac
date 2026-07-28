# 📦 AWS S3 — Simple Storage Service (Objektumtárolás)

> **Utoljára frissítve:** 2026-07-25  
> **Kapcsolódó doksi:** [AWS Cloud Platform](./aws-amazon-web-services.md) | [Supabase Platform](./supabase-platform.md) | [GLOSSARY Index](../index.md)

---

## 📖 Fogalom Meghatározása

Az **AWS S3 (Amazon Simple Storage Service)** az Amazon felhőalapú **objektumtároló (Object Storage) szolgáltatása**, amely korlátlan mennyiségű strukturálatlan adat (fájlok, képek, PDF dokumentumok, videók, biztonsági mentések) tárolására és elérésére szolgál bárhonnan az interneten keresztül.

A hagyományos fájlrendszerekkel ellentétben az S3 nem mappastruktúrát, hanem **Bucket-eket (vödröket)** és egyedi kulccsal rendelkező **Objektumokat (Objects)** használ, amelyek HTTP REST API-n keresztül érhetők el 99.999999999% (11 kilencel jelzett) adatbiztonság mellett.

---

## 🔑 Főbb S3 Koncepciók & Terminológia

| Kifejezés | Definíció & Működés |
|---|---|
| **Bucket (Vödör)** | A fájlok legfelső szintű tárolóegysége az S3-ban (pl. `visibill-invoices-prod`). Globálisan egyedi névvel kell rendelkeznie. |
| **Object Key (Objektum kulcs)** | A fájl egyedi elérési útvonala a bucket-en belül (pl. `company_123/invoices/2026/07/inv_9981.pdf`). |
| **Pre-signed URL (Előre aláírt URL)** | Ideiglenes, időkorlátos biztonságos letöltési vagy feltöltési hivatkozás, amely lehetővé teszi privát fájlok elérését publikus hozzáférés megadása nélkül. |
| **S3 API Compatibility** | Iparági szabvánnyá vált API protokoll. Más felhőszolgáltatók (Supabase Storage, MinIO, Cloudflare R2, DigitalOcean Spaces) mind ezt a protokollt használják. |

---

## 💡 Használat a Visibill Architektúrában

A Visibillben a felhasználók és e-mail aliasok által feltöltött PDF számlák, bankkivonatok és beszámolók **S3-kompatibilis objektumtárolóban** tárolódnak:

```
[ Kliens Feltöltés / Mailgun Attachment ]
                   ↓
   [ Supabase Storage S3 Bucket ]
  (path: {company_id}/{upload_table}/{file_name})
                   ↓
 ┌─────────────────┼─────────────────┐
 ↓                                   ↓
[ Python Worker Processing ]        [ Shared FilePreviewModal (A-044) ]
(PDF OCR, Splitter, MarkItDown)     (Előre aláírt letöltési URL)
```

### 1. Fájlok Izolációja Cégszinten
A bucket-en belül a fájlok útvonala automatikusan tartalmazza a `company_id`-t, garantálva, hogy a cégek állományai elkülönüljenek.

### 2. Biztonságos Fájl Előnézet (A-044)
A frontend `FilePreviewModal` komponense nem teszi publikussá a számlákat, hanem a Supabase Storage-tól **ideiglenes előre aláírt letöltési linket (Pre-signed URL)** kér, amely 60 másodperc után automatikusan érvénytelenné válik.
