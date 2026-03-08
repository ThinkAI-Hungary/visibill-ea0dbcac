

## Kapcsolt számlák megjelenítése a lenyíló sorban - globális dátumszűréstől függetlenül

### Probléma
A `linkedInvoicesMap` a `submittedInvoices`-ból épül, ami a globális dátumszűrés eredményeként kerül lekérdezésre. Ha egy számla kapcsolt számlája más dátummal rendelkezik, az nem lesz benne az adathalmazban, így a lenyíló menüben sem jelenik meg.

### Megoldás
Külön lekérdezéssel töltjük le az összes kapcsolt számlát (amelyekre `reference_number` mutat, vagy amelyek `reference_number`-rel hivatkoznak másra) dátumszűrés nélkül.

### Érintett fájl: `src/pages/InvoicesPage.tsx`

**1. Új state a kapcsolt számlákhoz (~172. sor után):**
```typescript
const [allLinkedInvoices, setAllLinkedInvoices] = useState<SubmittedInvoice[]>([]);
```

**2. Módosított fetch logika (555-568 sorok körül):**
- Meglévő `submittedQuery` marad változatlan (dátumszűrt lista a táblázathoz)
- Új lekérdezés hozzáadása: a dátumszűrt számlák `bizonylatsorszam` és `reference_number` értékei alapján lekérdezzük a kapcsolódó számlákat **dátumszűrés nélkül**

**3. LinkedInvoicesMap módosítása (~935. sor):**
- A map építésekor kombináljuk a `submittedInvoices` és `allLinkedInvoices` tömböket, duplikációk kiszűrésével

### Implementáció

A fetch után:
1. Gyűjtsük össze az összes `bizonylatsorszam`-ot és `reference_number`-t a szűrt listából
2. Kérdezzük le azokat a számlákat, amelyek:
   - `reference_number` IN (bizonylatszámok) VAGY
   - `bizonylatsorszam` IN (reference_number-ök)
3. Ezeket tároljuk `allLinkedInvoices`-ban
4. A `linkedInvoicesMap` építésekor mindkét adatforrást használjuk

### Előny
A táblázatban továbbra is csak a dátumszűrt számlák jelennek meg, de a lenyíló sorban megjelenik a teljes bizonylatlánc.

