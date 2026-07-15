# P-048: IMAP/SMTP Levelező Beállítások és Tabs UX

**Status:** Decided
**Category:** UI / Workflow
**Question:** Hogyan integráljuk a saját levelező szerver (IMAP/SMTP) beállításait az Integrációk oldal meglévő elrendezésébe anélkül, hogy túlterhelnénk a felhasználói felületet?
**Decision:** Az e-mail alapú integrációkat egy közös "E-mail Integráció" kártyába vonjuk össze, ahol egy Tabs komponens választja el a beállításokat.

## UI / UX Kialakítás

### 1. Tabs-alapú Kártya Struktúra
Az "E-mail Integráció" kártya az Integrációk oldal bal oldali oszlopában helyezkedik el (szimmetrikusan a jobb oldali NAV Online Számla kártyával). A kártyán belül egy kétállású Tabs komponenst használunk:
*   **Generált Alias fül:** Itt látható a Visibill által generált dedikált e-mail alias (EmailAliasManager), amely Mailgun webhookon keresztül fogadja a bejövő számlákat.
*   **Saját Levelező fül:** Itt adhatók meg a saját IMAP és SMTP adatok (EmailSettingsForm).

### 2. Form Elrendezés (EmailSettingsForm)
A form két egyenlő oszlopra van osztva:
*   **IMAP Beállítások (Bejövő):** Host, Port, Felhasználónév, Jelszó és Titkosítás (SSL/TLS, STARTTLS, NONE) választó.
*   **SMTP Beállítások (Kimenő):** Host, Port, Felhasználónév, Jelszó és Titkosítás választó.

### 3. Kapcsolat Tesztelése és Státuszok
*   Mindkét oszlop alján található egy **"Kapcsolat Tesztelése"** gomb.
*   A gomb megnyomásakor a rendszer meghívja a `test-email-connection` Edge Function-t, ami valós időben megkísérli a csatlakozást és a hitelesítést.
*   **Visszajelzés:**
    *   Sikeres kapcsolat esetén egy zöld keretes `Alert` jelenik meg: *"Sikeres kapcsolat"*.
    *   Hiba esetén egy piros keretes `Alert` írja ki a szerver által visszaadott részletes hibaüzenetet (pl. AuthError, Timeout).
*   Ha a beállítások el vannak mentve, a kártyák fejlécében és egy felső státusz panelen kis Badge-ek jelzik az aktuális állapotot:
    *   `Aktív` (zöld pipa): Sikeres szinkronizáció és működő kapcsolat.
    *   `Hiba` (piros X): Az utolsó automata szinkronizáció vagy teszt sikertelen volt.
    *   `Tesztelésre vár` (szürke óra): Mentett adatok, de még nem futott le sikeres teszt.

### 4. Jelszó Maszkolás (Masked Password)
Biztonsági okokból a korábban mentett jelszavakat a frontend nem kapja vissza plaintext formátumban. A beviteli mezőben a `••••••••••••` placeholder/érték jelenik meg, ha a jelszó már el van mentve. Új jelszó beírásakor a mező felülíródik, üresen hagyás esetén a mentett jelszó nem módosul a Vault-ban.

## Rationale
*   **Konzisztencia:** A Tabs elrendezés tökéletesen illeszkedik a NAV integrációs kártya logikájához (amely szintén fülekkel választja el a beállításokat a naplóktól).
*   **Helytakarékosság:** A fülek használatával elkerülhető, hogy a bal oldali oszlop túl hosszú legyen a jobb oldalihoz képest, megőrizve a kétoszlopos grid esztétikai egyensúlyát.
*   **Azonnali visszajelzés:** A kapcsolat tesztelése gombokkal a felhasználónak nem kell mentenie a hibás adatokat ahhoz, hogy ellenőrizze a szerver konfigurációját.

## Kapcsolódó
*   [A-038: IMAP/SMTP Credentials Vault Integration](../../architecture/decisions/A-038-imap-smtp-credentials-vault-integration.md)
*   [P-013: Upload UX](./P-013-upload-ux.md)
*   [P-025: Settings Structure](./P-025-settings-structure.md)
