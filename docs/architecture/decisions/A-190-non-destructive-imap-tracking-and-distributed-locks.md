# A-190: Non-Destructive IMAP UID Követés (Zero-\Seen), Elosztott Zárolás és Batch Capping

**Status:** Decided  
**Date:** 2026-10-01  
**Utoljára frissítve:** 2026-10-01  

## Context
A Visibill háttér-workere az ügyfelek által megadott IMAP fiókokból (`company_email_settings`) automatikusan gyűjti be a bejövő számlákat és csatolmányokat 60 másodperces ciklusokban. Korábban a lekérés szabványos IMAP `FETCH` paranccsal történt, és a sikeres letöltés után a worker `\Seen` (olvasott) jelölést (`mail.store(..., '+FLAGS', '\\Seen')`) helyezett el az e-maileken.

Ez három súlyos működési és ügyfélélmény-problémát okozott:
1. **Megtévesztő ügyfélélmény (Seen flag):** Az ügyfelek saját levelezőprogramjukban (pl. Thunderbird, Outlook, Gmail) azt tapasztalták, hogy a beérkező fontos számlalevelek maguktól olvasottá váltak, így úgy tűnt, mintha a könyvelő vagy egy kolléga már feldolgozta volna a számlát, pedig a humán áttekintés még nem történt meg.
2. **Többkonténeres versenyhelyzet (Race Condition):** A termelési környezetben a worker több replikában fut (pl. `worker-prod-4`, `worker-prod-5`, `worker-prod-6`, `worker-prod-7`). Mivel mindegyik konténer önállóan futtatta a 60 másodperces pollert, azonos időben próbáltak kapcsolódni ugyanahhoz az IMAP postafiókhoz, párhuzamosan kezdték tölteni ugyanazokat az e-maileket és csatolmányokat, terhelve a hálózatot és duplikált PGMQ üzeneteket generálva.
3. **Postaláda-torlódás és memóriablokk (No Batch Limit):** Új IMAP fiók bekötésekor vagy hosszú leállás után, ha egy postafiókban több ezer olvasatlan levél halmozódott fel, a worker egyetlen ciklusban próbálta az összeset letölteni, ami percekig blokkolta az IMAP szálat és a worker memóriáját.

## Decision

A problémák elhárítására és a postaládák integritásának védelmére a következő három pillérből álló rendszert vezettük be:

### 1. RFC 3501 Zero-`\Seen` Non-Destructive Peek
- A worker a levelek lekérésekor kizárólag a `BODY.PEEK[]` specifikációt használja:
  `mail.uid("FETCH", uid, "(BODY.PEEK[])")`
- A `BODY.PEEK[]` lekérdezés a protokoll szintjén garantálja, hogy a szerver **nem** jelöli meg a levelet `\Seen`-ként a letöltés során.
- A korábbi explicit `mail.store(uid, "+FLAGS", "\\Seen")` hívásokat teljes egészében töröltük a pipeline-ból.
- **Eredmény:** Az e-mail a kliens postaládájában 100%-ban `UNSEEN` (olvasatlan) marad, a felhasználó megszokott levelezési munkafolyamata nem sérül.

### 2. Perzisztens Adatbázis-szintű UID Deduplikáció (`imap_processed_messages`)
Mivel az IMAP szerveren a levelek nem kapnak `\Seen` jelölést, a következő szinkronizációs ciklusban a `UNSEEN` keresés újra megtalálná őket. A perzisztens deduplikációra új adatbázis táblát hoztunk létre:
- **Tábla:** `public.imap_processed_messages`
  - `id`: UUID (PK)
  - `company_id`: UUID (FK -> companies.id ON DELETE CASCADE)
  - `mailbox_email`: TEXT (NOT NULL)
  - `message_uid`: TEXT (NOT NULL) — az IMAP szerver által kiosztott perzisztens UID
  - `message_id`: TEXT — RFC 822 Message-ID fejléc
  - `subject`, `from_address`: TEXT
  - `processed_at`: TIMESTAMPTZ (DEFAULT now())
  - `attachments_count`: INT
- **Egyediségi megszorítás (Unique Constraint):**
  `UNIQUE (company_id, mailbox_email, message_uid)`
- **Index:** `idx_imap_processed_lookup` a `(company_id, mailbox_email, message_uid)` hármason.
- **Row Level Security (RLS):** Engedélyezve, a cég tagjai (`company_members`) és `service_role` számára.
- **Működés:** A worker a postaláda megnyitásakor egyetlen gyors lekérdezéssel betölti az eddig feldolgozott UID-ket egy in-memory halmazba (`set`), és az IMAP szerver által adott listából azonnal kiszűri a már feldolgozott elemeket. A sikeresen letöltött levelek UID-jét azonnal perzisztálja a táblába.

### 3. PostgreSQL Elosztott Leader Zárolás (`worker_distributed_locks`)
A többkonténeres környezetben fellépő versenyhelyzet kivédésére atomi adatbázis zárolást vezettünk be:
- **Tábla:** `public.worker_distributed_locks` (`lock_key`, `locked_by`, `acquired_at`, `expires_at`)
- **Függvények (RPC):**
  - `acquire_worker_lock(p_lock_key TEXT, p_locked_by TEXT, p_ttl_seconds INT DEFAULT 90) -> BOOLEAN`
    - Atomi zárolást végez: ha nincs aktív zár vagy a meglévő zár lecsengett (`expires_at < now()`), bejegyzi a konténert és `TRUE`-val tér vissza.
    - Ha másik élő konténer birtokolja a zárat, azonnal `FALSE`-szal tér vissza várakozás nélkül.
  - `release_worker_lock(p_lock_key TEXT, p_locked_by TEXT) -> BOOLEAN`
    - Csak az a konténer oldhatja fel a zárat, amelyik megszerezte.
- **Alkalmazás:** Az `_imap_sync_poller()` ciklusban a leader lock kulcsa: `imap_sync_poll`, TTL: 90 másodperc. Így a klaszterből (pl. 4 worker replica) pontosan 1 konténer futtatja a levelek lekérését percenként. Konténer crash esetén a 90 mp TTL automatikus feloldást (self-healing) biztosít.

### 4. Batch Capping (`MAX_EMAILS_PER_SYNC = 50`)
- A worker a szinkronizálandó új leveleket numerikus UID szerint csökkenő sorrendbe rendezi: a legfrissebb levelek kerülnek feldolgozásra először.
- Ciklusonként legfeljebb 50 levél kerül feldolgozásra postaládánként.
- Ha egy postafiókban 200 olvasatlan levél van, az első ciklusban a legfrissebb 50-et dolgozza fel, a maradék 150-et pedig a rákövetkező percek ciklusai egyenletes terheléssel fejezik be.

## Consequences

**Pozitív:**
- **Ügyfélélmény integritása:** A kliensek levelei olvasatlanok maradnak saját levelezőjükben, nem tűnik úgy, mintha humán feldolgozás történt volna.
- **Duplikációmentes feldolgozás:** Az IMAP UID perzisztens tárolása biztosítja, hogy sem üres, sem csatolmányos levél ne kerüljön többször feldolgozásra.
- **Klaszter stabilitás:** A `worker_distributed_locks` megszüntette a párhuzamos IMAP kapcsolatokat és a multi-replica versenyhelyzetet.
- **Torlódásvédelem:** A batch limit megvédi a workert a memóriatúlcsordulástól és az IMAP timeoutoktól nagyméretű postaládáknál.

**Negatív / Költségek:**
- Az adatbázisban tárolni kell a feldolgozott üzenetek UID-jét (minimális lemezterület).
- Ha az IMAP szerveren megváltozik az `UIDVALIDITY` (pl. mailbox áthelyezés vagy szervercsere), a korábbi UID-k új leveleket jelenthetnek (ezt a másodlagos Message-ID és fájlnév alapú idempotencia védi ki).

## Kapcsolódó
- [A-006: Python Worker Architektúra](./A-006-python-worker.md)
- [A-038: IMAP/SMTP Hitelesítő Adatok és Vault Integráció](./A-038-imap-smtp-credentials-vault-integration.md)
- [A-052: Multi-Profile IMAP/SMTP Levelező Fiókok és Vault Integráció](./A-052-multi-profile-email-accounts-vault-integration.md)
- [A-162: Mailgun & IMAP Csatolmány Szűrési Szinkronizáció](./A-162-mailgun-and-imap-attachment-filtering-and-mime-hardening.md)
