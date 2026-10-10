# P-179: ÁFA Bevallás Változásvédelem, Kriptográfiai Pecsét & Önellenőrzési Munkaterület UX

**Status:** Decided  
**Category:** UI / Workflow  
**Question:** Hogyan tehető átláthatóvá és kezelhetővé a könyvelő számára az ÁFA bevallás lezárása, a beadás utáni bizonylat-módosulások felügyelete és az önellenőrzési pótlék levezetése?  
**Decision:** Kétlépcsős kriptográfiai zárolási folyamat, önálló „Változásvédelem & Önellenőrzés” munkaterület valós idejű diff-táblázattal, és Art. 211. § pótlékkalkulátor kártyákkal.  
**Current Implementation:** `VatReturnVersionHeader.tsx`, `VatAmendmentsWorkspace.tsx`, `VatReturnContainer.tsx`.  
**Rationale:** A könyvelők számára kritikus, hogy egy benyújtott bevallás után pontosan lássák, ha egy kolléga vagy ügyfél utólag módosított egy számlát, és ne kézzel kelljen kiszámolniuk a késedelmi pótlékot.  

---

## 🖥️ Felhasználói Munkafolyamat (Workflow)

### 1. Zárolási és Pecsételési Folyamat (`VatReturnVersionHeader.tsx`)
1. **Fejléc Állapotjelző:**
   - Nyitott időszak esetén: `DRAFT` (kék/szürke) jelvény, a gomb: *„Beadva / Zárolás pecsét”*.
   - Lezárt időszak esetén: `v1.0 (Eredeti beadás)` (zöld) jelvény, SHA-256 hash előnézet és lakat ikon.
2. **Kétlépcsős Megerősítő Modál:**
   - A könyvelő a zárolás gombra kattintva megnyitja a megerősítő párbeszédablakot.
   - A modál világosan feltünteti a rögzítendő fizetendő és levonható ÁFA összegeket, valamint a kriptográfiai ujjlenyomat képzését.
   - Megerősítés után a rendszer azonnal elmenti a snapshotot és a mögöttes számlaállományt (`invoicesMap`), majd sikeres értesítést (toast) jelenít meg.

### 2. Változásvédelem & Önellenőrzési Munkaterület (`VatAmendmentsWorkspace.tsx`)
A zárolt időszakban a felső fülek között megjelenik a **„Változásvédelem & Önellenőrzés”** lap:
1. **Felső Állapotkártya:**
   - Ha nincs változás: zöld pajzs ikon, `● Változatlan analitika` badge.
   - Ha változás történt: sárga figyelmeztető pajzs, `⚠️ Önellenőrzésre vár` badge, és a jobb felső sarokban megjelenik a narancs **„65H Helyesbítő XML”** letöltő gomb.
2. **4 KPI Kártya:**
   - *Aktuális Snapshot:* Verziószám és SHA hash.
   - *Zárolt fizetendő ÁFA:* A benyújtott eredeti pozíció.
   - *Utólagos ÁFA eltérés:* A módosítások nettó egyenlege (+ / - HUF).
   - *Art. Önellenőrzési Pótlék:* Számított pótlék összege és késedelmi napok száma.
3. **Három Al-Nézet (Sub-Tabs):**
   - **Önellenőrzési Diff Nézet:** Tételes táblázat (+ Utólagos, ● Módosult, ✕ Törölt/Storno sorokkal, eredeti vs. aktuális adóalap és áfa összehasonlítással).
   - **Art. 211. § Pótlék Kalkulátor:** Naptári napos levezetés, törvényes esedékesség, MNB alapkamat kulcs és törvényi hivatkozás.
   - **Verziótörténet:** Az adott időszak korábbi zárolt verzióinak (v1.0, v1.1, stb.) időbélyeges listája.
4. **Önellenőrzési Snapshot Zárolása Gomb:**
   - Lehetővé teszi az új, helyesbített bevallási verzió (v2.0 / v1.1) lepecsételését, ami lezárja az addigi diff listát.

---

## 🔗 Kapcsolódó
- [A-242: ÁFA Bevallás Változásvédelem és Kriptográfiai Pillanatkép Architektúra](../../architecture/decisions/A-242-vat-return-snapshots-and-self-revision-penalty-architecture.md)
- [P-154: NAV ÁNYK 2665A/2665M XML Export UX](./P-154-nav-anyk-vat-return-and-m-lines-scaling-and-validation-ux.md)
