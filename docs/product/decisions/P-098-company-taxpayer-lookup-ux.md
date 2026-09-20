# P-098: NAV Adózói Adatlekérdezés és Automatikus Cégkitöltés UX

> **Státusz:** Decided  
> **Dátum:** 2026-09-20  
> **Szerző:** ThinkAI / Morfi  
> **Érintett komponensek:** `CompanySelector.tsx`, `EmptyStateDashboard.tsx`, `ClientDetailsStep.tsx`, `navTaxpayerService.ts`  
> **Kapcsolódó:** [ADR A-132](../../architecture/decisions/A-132-nav-query-taxpayer-auto-fill.md)  

---

## 🎯 Problémafelvetés és Célkitűzés

Amikor egy vállalkozó vagy könyvelő új céget rögzít az eaisybill-prod felületén, eddig mindent kézzel kellett kitöltenie:
- Pontos cégnév (hosszú hivatalos elnevezés)
- Adószám (kötőjelekkel)
- Székhely címe (irányítószám, város, utca, házszám)
- ÁFA státusz (normál / alanyi adómentes)

Ez lassú volt és hibalehetőségeket hordozott. A cél az volt, hogy a felhasználónak **kizárólag az adószámát kelljen megadnia**, és egyetlen gombnyomással a rendszer automatikusan lekérdezze a NAV-tól a hivatalos törzsadatokat és kitöltse a mezőket.

---

## 💡 Termék és Felületi Tervezés (UX)

### 1. Intuitív Adószám-Első Elrendezés
- Az adószám mező a regisztrációs űrlapok felső/kiemelt pozíciójába került.
- A mező mellett közvetlenül elhelyezkedik a **„NAV lekérdezés”** gomb (Search ikonnal és töltésjelző animációval).
- Segítő szöveg tájékoztatja a felhasználót: *„Írd be az adószámot és kattints a lekérdezésre az adatok automatikus betöltéséhez!”*

### 2. Támogatott Formátumok és Előzetes Validáció
- A rendszer rugalmas: a felhasználó megadhatja az adószámot teljes formátumban (`12345678-2-42`) vagy akár csak a nyolc számjegyű törzsszámot (`12345678`).
- Ha a felhasználó 8 karakternél rövidebb szöveget üt be, a rendszer a gomb megnyomásakor figyelmeztető toast üzenetet ad, megelőzve a felesleges hálózati kéréseket.

### 3. Automatikus Mezőkitöltés
A sikeres lekérdezést követően:
1. **Cég neve:** Beírásra kerül a NAV nyilvántartás szerinti hivatalos cégnév (`taxpayerName`).
2. **Székhely címe:** Összefűzött, tiszta magyar címstruktúra kitöltése az `address` mezőbe.
3. **ÁFA-rendszer:** Amennyiben az adószám ÁFA-kódja `1`, az ÁFA státusz automatikusan `Alanyi adómentes (AAM)` értékre vált, `2`-es kód esetén pedig `Normál (27%)`-ra.
4. **Adószám formázás:** Ha a felhasználó csak 8 jegyet írt be, de a NAV visszaadja az ÁFA- és megyekódot, az adószám mező automatikusan kiegészül a szabványos 11 jegyű formátumra (`12345678-1-23`).

### 4. Vizuális Visszajelzés (Toast & Töltésjelző)
- Lekérdezés közben a gomb inaktívvá válik és animált forgó ikon jelzi a folyamatban lévő hívást.
- Sikeres lekérdezéskor zöld visszajelzés jelenik meg a talált cég nevével és adószámával.
- Sikertelen vagy érvénytelen adószám esetén diszkrét, érthető hibaüzenet jelenik meg.

---

## 📍 Megjelenési Helyek

1. **Globális Cégválasztó (`CompanySelector` modal):** A felső navigációs sávból indítható új cég regisztráció.
2. **Onboarding Varázsló (`EmptyStateDashboard`):** Az első regisztrációkor megjelenő 4-lépéses folyamat 1. lépése.
3. **eaisyBooks Ügyfélfelvitel (`ClientDetailsStep`):** Könyvelői modulban manuális ügyfél rögzítésekor a cégadatok bekérése.
