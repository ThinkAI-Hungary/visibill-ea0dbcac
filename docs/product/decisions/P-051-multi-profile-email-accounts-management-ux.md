# P-051: Többprofilos Levelező Fiókok (Multi-Profile IMAP/SMTP) Kezelése UX

**Status:** Decided  
**Category:** UI / Workflow  
**Question:** Hogyan tegyük lehetővé a felhasználók számára több saját IMAP és SMTP levelező fiók (profil) áttekinthető, biztonságos és rugalmas kezelését az Integrációk felületen?  
**Decision:** Kártya alapú listanézetet (EmailAccountCard lista), dedikált szerkesztő/létrehozó modal dialógust (EmailAccountDialog), beágyazott élő kapcsolatteszteket és shadcn/ui AlertDialog törlés-megerősítést vezetünk be.  
**Supersedes:** [P-048: IMAP/SMTP Levelező Beállítások és Tabs UX](./P-048-imap-smtp-settings-tabs-ux.md)

---

## UI / UX Kialakítás

### 1. Kártya Alapú Profil Lista (`EmailSettingsForm.tsx` & `EmailAccountCard.tsx`)
A korábbi egyetlen form helyett az Integrációk oldal **„Saját Levelező (IMAP & SMTP)”** füle egy profillistát jelenít meg:
* **Felső Akciósáv:**
  * Számláló badge: mutatja a konfigurált fiókok számát (`X fiók konfigurálva`).
  * **„Új fiók hozzáadása”** elsődleges gomb (Plus ikonnal).
* **Fiók Kártya Felépítése (`EmailAccountCard`):**
  * **Fejléc:**
    * Fiók elnevezése (félkövér cím).
    * `Inaktív` badge, ha a főkapcsoló le van kapcsolva.
    * **A fiók neve alatt elhelyezett badge-sor:**
      * ⭐ `Alapértelmezett SMTP` (zöldes/elsődleges badge csillag ikonnal).
      * ✉️ `Alapértelmezett IMAP` (kék badge levél ikonnal).
    * Időbélyegek: Létrehozás dátuma és az utolsó sikeres IMAP szinkronizáció időpontja.
    * **Műveleti menü (3-pont DropdownMenu):**
      * `Szerkesztés` (megnyitja az EmailAccountDialog-ot).
      * `Beállítás alapértelmezett SMTP-ként`.
      * `Beállítás alapértelmezett IMAP-ként`.
      * `Fiók törlése` (piros, megerősítő modallal).
  * **Protokoll Állapot Panelek (Kétoszlopos Grid):**
    * **Bejövő (IMAP) panel:** Kiszolgáló host:port, felhasználónév, titkosítási mód és valós idejű státusz badge (`Aktív`, `Hiba`, `Tesztelésre vár`, `Kikapcsolva` - sortörésmentes `whitespace-nowrap` stílusban).
    * **Kimenő (SMTP) panel:** Kiszolgáló host:port, felhasználónév, titkosítási mód és státusz badge.
    * **Gyors Tesztelés Gomb:** Mindkét panelen közvetlenül elérhető az egykattintásos kapcsolat-újratesztelés anélkül, hogy a szerkesztő modalt meg kellene nyitni.

---

### 2. Szerkesztő és Hozzáadó Modális Ablak (`EmailAccountDialog.tsx`)
A fiókok felvitele és módosítása egy fókuszált, dialógus ablakban történik:
* **Fiók alapadatok és főkapcsolók:**
  * **Fiók elnevezése** szöveges mező (pl. *„Számlák (Gmail)”*, *„Központi Levelező”*).
  * **Kapcsoló sor:**
    * `Fiók aktív` (főkapcsoló - lekapcsolása szünetelteti az automata IMAP szinkront és SMTP küldést).
    * `Alapértelmezett SMTP` (kijelöli ezt a fiókot az alapértelmezett kimenő kézbesítőnek).
    * `Alapértelmezett IMAP` (kijelöli ezt a fiókot az elsődleges bejövő fióknak).
* **Fülek (Tabs):**
  * ✉️ **Bejövő (IMAP):** Funkció bekapcsoló toggle, Szerver / Host, Port, Felhasználónév, Jelszó (maszkolt, ha már létezik), Titkosítás és beépített **„IMAP Kapcsolat Tesztelése”** gomb inline visszajelzéssel.
  * ✈️ **Kimenő (SMTP):** Funkció bekapcsoló toggle, Szerver / Host, Port, Felhasználónév, Jelszó, Titkosítás és **„SMTP Kapcsolat Tesztelése”** gomb inline visszajelzéssel.

---

### 3. Törlés Megerősítés (`AlertDialog`)
A törlés nem natív böngészős popupot használ, hanem a rendszer egységes **`AlertDialog` komponensét**:
* Megjeleníti a törölni kívánt fiók pontos nevét.
* Világosan tájékoztat, hogy a beállítások és a titkosított Vault jelszavak véglegesen eltávolításra kerülnek.
* `Mégse` és kiemelt `bg-destructive` akciógomb.

---

## Rationale
* **Párhuzamos csatornák átláthatósága:** A felhasználó egyetlen felületen azonnal látja az összes postafiókja státuszát és a legutóbbi szinkronizáció idejét.
* **Hibaelhárítás egyszerűsége:** A közvetlen gyors teszt gombokkal azonnal kideríthető, ha egy jelszó lejárt vagy a szerver nem válaszol.
* **Véletlen adatvesztés megakadályozása:** Az `AlertDialog` kizárja a véletlen kattintásból eredő fióktörlést.

---

## Kapcsolódó
* [A-052: Multi-Profile Email Accounts and Vault Architecture](../../architecture/decisions/A-052-multi-profile-email-accounts-vault-integration.md)
* [P-025: Settings Structure](./P-025-settings-structure.md)
