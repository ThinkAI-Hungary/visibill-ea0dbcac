Fejlesztendő Elemek Részletes Specifikációja
Az alábbi 8 funkciócsoport jelenti a könyvelő csapat által azonosított, a rendszerből még hiányzó új képességeket.

1. Pályázatos ÉCS Elszámolási Pálya és Különböző ÉCS Alapok Kezelése
A könyvelői igény: A számviteli és a TAO szerinti leírás mellett egy harmadik, önálló Pályázatos ÉCS pálya biztosítása. Lehessen a TAO és a Pályázatos ÉCS esetében a számviteli bekerülési értéktől eltérő értékcsökkenési alapot megadni.
Szakmai háttér:
Pályázati támogatásból vásárolt eszközöknél a támogatási szerződés szerinti elszámolható költség gyakran eltér a bruttó bekerülési értéktől (pl. önrész aránya, nem támogatott járulékos költségek).
A könyvelőnek a halasztott bevételek (4591 → 964) feloldásához pontosan a támogatásra jutó ÉCS összegét kell kimutatnia.
Fejlesztési feladat:
fixed_assets séma bővítése:
tax_depreciation_base (NUMERIC, opcionális – ha üres, a bekerülési értékből indul ki).
grant_depreciation_base (NUMERIC, pályázati ÉCS alapja).
grant_depreciation_rate (NUMERIC, pályázatos éves leírási kulcs %).
grant_depreciation_method (pályázat szerinti módszer).
DepreciationResult és useDepreciation.ts kibővítése:
Harmadik kalkulációs ág hozzáadása: grant: { monthly, accumulated, bookValue, ratePercent }.
Felület: Az eszközlétrehozó és szerkesztő dialógusban új szekció: "Pályázatos / Támogatási Amortizáció", ahol megadható az elkülönített alap és kulcs.

2. Fejlesztési Tartalék: Több Évi Keret Együttes Felhasználása és FIFO Ajánlás
A könyvelői igény: Egyetlen tárgyi eszköz beruházásához több korábbi évben képzett fejlesztési tartalékot is fel lehessen használni (mindig a legkorábbi lejárattal indulva), és az eszközlistában/kartonon külön oszlopként jelenjen meg a felhasznált összeg és a maradék TAO ÉCS-alap.
Jelenlegi szűk keresztmetszet:
A fixed_assets táblában jelenleg csak 1 darab development_reserve_id van, így egy 25M Ft-os géphez nem köthető hozzá pl. 15M Ft a 2023-as és 10M Ft a 2024-es keretből.
Fejlesztési feladat:
Új kapcsolótábla létrehozása:

sql
CREATE TABLE public.fixed_asset_reserve_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES public.fixed_assets(id) ON DELETE CASCADE,
  reserve_id UUID NOT NULL REFERENCES public.development_reserves(id) ON DELETE RESTRICT,
  allocated_amount NUMERIC(15, 2) NOT NULL CHECK (allocated_amount > 0),
  created_at TIMESTAMPTZ DEFAULT now()
);
FIFO intelligens allokáció gomb: Amikor a felhasználó megadja a felhasználni kívánt összeget, a rendszer automatikusan a legkorábbi lejáratú aktív tartalékkeretből von le, és ha az kimerült, automatikusan megnyitja a következő év keretét.
Táblázatos és karton megjelenítés:
Az eszközlistában és az amortizációs kimutatásban 3 dedikált oszlop:
Bekerülési érték (Ft)
Fejlesztési tartalék levonás (Ft) [évenkénti bontással]
TAO ÉCS-alap (maradványösszeg) (Ft)

3. Beruházási Adókedvezmény és 4 Éves Kivezetési Védelem
A könyvelői igény: Jelölhető legyen, hogy a cég az eszközre beruházási adókedvezményt (pl. KKV beruházási hitel kamatkedvezmény, fejlesztési adókedvezmény) vett igénybe, és a szoftver 4 évig figyelmeztesse a könyvelőt, hogy az eszközt tilos eladni vagy kivezetni.
Szakmai kockázat: A Tao. tv. szerint a beruházási adókedvezménnyel érintett eszközt a törvényben meghatározott ideig (jellemzően 4 év) a vállalkozásban kell tartani. Ha idő előtt eladják vagy selejtezik, a teljes igénybe vett adókedvezményt késedelmi pótlékkal növelten vissza kell fizetni!
Fejlesztési feladat:
Mezők hozzáadása a fixed_assets táblához:
has_tax_credit (BOOLEAN, default false).
tax_credit_type (ENUM: KKV_BERUHAZAS, FEJLESZTESI_ADOKEDVEZMENY, ENERGIAHATÉKONYSAGI).
tax_credit_retention_until (DATE – alapértelmezetten aktiválás dátuma + 4 év).
Kivezetési / Selejtezési Zárolás (DisposalDialog.tsx):
Ha a felhasználó egy védett eszközre kattintva a "Kivezetés" vagy "Selejtezés" funkciót indítja a határidő lejárta előtt, a rendszer piros riasztást jelenít meg:

⚠️ Figyelem! Az eszközre beruházási adókedvezmény lett igénybe véve!
Kötelező fenntartási idő lejárata: 2028.05.15 (még 2 év 3 hónap). A kivezetés adóvisszafizetési kötelezettséget von maga után.
A kivezetés csak explicit könyvelői felülbírálattal (figyelmeztetés elfogadása indoklással) engedélyezett.

4. Ingatlan és Gépjármű Azonosító Törzsadatok (Hrsz, Rendszám, Alvázszám)
A könyvelői igény: Törzsadatként rögzíthető legyen ingatlanoknál a helyrajzi szám (Hrsz.), gépjárműveknél a forgalmi rendszám és az alvázszám (VIN).
Fejlesztési feladat:
fixed_assets séma bővítése:
property_registry_number (VARCHAR(50), Hrsz. – pl. 12345/6/A/2).
license_plate (VARCHAR(20), Rendszám – normalizált, pl. AA-BB-123 vagy ABC-123).
vin_chassis_number (VARCHAR(30), Alvázszám).
Felület dinamikus megjelenítése:
Ha a kiválasztott főkönyvi számlaszám 12-es (Ingatlanok), automatikusan előugrik a Helyrajzi szám beviteli mező.
Ha 142-es vagy 143-as (Járművek), automatikusan kötelezővé válik a Rendszám és az Alvázszám mező.
Az azonosítók megjelennek az Eszközkartonon, a leltári íveken és a keresőmezőben is szűrhetővé válnak.

5. Többdimenziós Allokáció (Költséghely, Munkaszám, Projekt) és Automatikus ÉCS Feladás
A könyvelői igény: Egy eszközhöz nemcsak 1 projektet, hanem több dimenziót (költséghely, pályázat, munkaszám) lehessen rendelni, és a periodikus ÉCS vegyes naplóba könyvelésekor a rendszer ezeket automatikusan írja rá a főkönyvi sorokra.
Jelenlegi hiba a kódbázisban:
A depreciationPostingService.ts a vegyes napló sorok (lines.push) összeállításakor jelenleg semmilyen dimenziót (project_id, cost_center_id) nem ad át az acc_journal_lines táblának, így az ÉCS költség nem látszik a projektek eredménykimutatásában.
Fejlesztési feladat:
Dimenziók megadása az eszközkartonon: cost_center_id, project_id, grant_id.
Százalékos megosztási lehetőség (ha az eszközt több költséghely vagy projekt közösen használja).
depreciationPostingService.ts javítása:
Az 5711-es tartozik oldali sorok automatikusan átveszik az eszköz költséghelyét és projektazonosítóját.
Megosztás esetén az ÉCS sor automatikusan szétbontásra kerül a megadott százalékok szerint.

6. Nyitó Kartonok Átvételi Dátuma és Eddig Elszámolt ÉCS Rögzítése
A könyvelői igény: Másik rendszertől átvett cégeknél vagy évnyitáskor meg lehessen adni:
Az utolsó elszámolt ÉCS dátumát (meddig volt leírva az eszköz).
Az eddig elszámolt halmozott ÉCS összegét (számviteli és TAO szerint).
Jelenlegi hiányosság:
A jelenlegi isOpeningAsset kapcsoló csak a beruházási (161) feladást kapcsolja ki, de az ÉCS-t a szoftver azonnal újraszámolja a múltbeli aktiválási dátumtól, ami felborítja az átvett könyvelési egyenlegeket.
Fejlesztési feladat:
fixed_assets mezők:
opening_accumulated_depreciation (NUMERIC – átvételkori könyv szerinti halmozott ÉCS).
opening_tax_depreciation (NUMERIC – átvételkori adótörvény szerinti ÉCS).
last_depreciation_date (DATE – határdátum, pl. 2025-12-31).
Számítási szabály: A rendszer a jövőbeli értékcsökkenést szigorúan csak a last_depreciation_date-et követő naptári hónaptól kezdi számolni, és a könyv szerinti nettó értéket az acquisition_value - opening_accumulated_depreciation képletből indítja.

7. ÉCS Kulcsok (%) Manuális Megadása és Szabad Felülbírálata
A könyvelői igény: Ne csak évekből lehessen kiszámoltatni a hasznos élettartamot, hanem a könyvelő közvetlenül beírhassa a számviteli és a TAO szerinti leírási kulcsot százalékban (pl. 14,5% vagy 33%), és a rendszer ebből számítsa a havi leírást.
Fejlesztési feladat:
Számviteli leírásnál: Dupla beviteli mező kétirányú reaktív kalkulációval:
Hasznos élettartam (Év / Hó) ↔ Éves leírási kulcs (depreciation_rate_percent).
Ha a könyvelő beírja, hogy 14.5%, a program automatikusan kalkulálja a futamidőt, és a törvényes lineáris formulát a beírt százalék alapján futtatja.
TAO leírásnál: A jelenlegi merev sablonválasztó mellé közvetlen tao_rate_override mező a felületen, ahol a sablontól eltérő egyedi TAO kulcs azonnal megadható.

8. Kibővített Számviteli Mozgásnemek (10+ mozgásnem) és Terven Felüli ÉCS
A könyvelői igény: A jelenlegi 3 mozgásnem (ráaktiválás, selejtezés, áthelyezés) helyett a teljes számviteli mozgásnem-törzs kezelése, kiemelten:
Kisértékű azonnali leírás.
Terven felüli értékcsökkenés elszámolása (866 / 139) káresemény vagy piaci értékvesztés esetén.
Terven felüli értékcsökkenés visszaírása (139 / 966).
Értékesítés számla alapján (861 / 131, 139 kivezetés).
Térítésmentes átadás / átvétel, apport.
Fejlesztési feladat:
asset_events típusok bővítése:
unplanned_depreciation (Terven felüli ÉCS).
unplanned_depreciation_reversal (Visszaírás).
sale (Értékesítés bizonylatszámmal és eladási árral).
scrapping (Selejtezés jegyzőkönyvvel).
contribution_in_kind (Apport).
free_transfer_out / free_transfer_in.
Új modális ablak: "Terven felüli értékcsökkenés rögzítése", ahol megadható az összeg, a számviteli indoklás, és legenerálható a vegyes könyvelési feladás:
Elszámolás: T 866 (Terven felüli ÉCS) - K 139/149 (Halmozott ÉCS).
Visszaírás: T 139/149 (Halmozott ÉCS) - K 966 (Terven felüli ÉCS visszaírása).

9. Cégautó Adó Modul és Gépjárműadó (Súlyadó) Levonási Automatizmus
A könyvelői igény:
Személygépkocsik cégautóadó nyilvántartása mind a saját tulajdonú (tárgyi eszközben lévő), mind a bérelt / lízingelt járművekre.
Adómérték automatikus meghatározása a kW (teljesítmény) és környezetvédelmi osztály alapján.
Kötelezettség időtartamának követése (saját autónál kivezetéskor automatikus zárás).
Gépjárműadó levonás: Ha a határidőre megfizették a gépjárműadót (súlyadót), annak összegével csökkenteni lehessen a fizetendő cégautóadót a rendszám összerendelése alapján.
Szakmai háttér (Gjt. IV. Fejezet):
A cégautóadót negyedévente, a negyedévet követő hó 20-ig kell bevallani és megfizetni.
Az adó mértéke törvényi mátrix alapján havi fix összeg (7 700 Ft-tól 44 000 Ft-ig járművenként; 5E/5Z környezetvédelmi osztálynál [zöld rendszám / tisztán elektromos] teljes mentesség áll fenn).
Levonási szabály (Gjt. 17/A. §): A naptári negyedévre megállapított cégautóadóból levonható a személygépkocsi után az adóévre megállapított, és a határidőig (I. félév: április 15., II. félév: szeptember 15.) igazoltan megfizetett gépjárműadó.
Fejlesztési feladat:
Új adatbázis-tábla: company_cars:

sql
CREATE TABLE public.company_cars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  license_plate VARCHAR(20) NOT NULL,
  ownership_type VARCHAR(20) NOT NULL CHECK (ownership_type IN ('OWNED', 'RENTED', 'LEASED')),
  fixed_asset_id UUID REFERENCES public.fixed_assets(id) ON DELETE SET NULL,
  make_and_model VARCHAR(100),
  engine_power_kw INTEGER NOT NULL,
  environmental_category VARCHAR(10) NOT NULL, -- pl. 'EURO_5', 'EURO_6', 'GREEN_ELECTRIC'
  tax_liability_from DATE NOT NULL,
  tax_liability_to DATE,
  monthly_tax_rate NUMERIC(10, 2) NOT NULL,
  is_tax_exempt BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
Automatikus TENY szinkron: Ha a jármű saját tulajdonú, a fixed_assets karton kivezetésekor (disposal_date) a tax_liability_to mező automatikusan frissül a kivezetés hónapjának utolsó napjára.
Törvényi Cégautóadó Kalkulációs Motor:
Beépített Gjt. adótábla, amely a kW és környezetvédelmi kategória alapján azonnal kiszámítja a havi és negyedéves adót.
Gépjárműadó (Súlyadó) Összekapcsolás és Automatikus Levonás:
A banki naplóban a NAV Gépjárműadó számlára (10032000-01076167) történő utalásoknál a könyvelő kiválaszthatja a gépjármű rendszámát (license_plate).
A kalkulátor ellenőrzi:
A befizetés dátuma ≤ a törvényi esedékesség (április 15. / szeptember 15.).
Ha időben történt: a megfizetett összeg automatikusan levonásra kerül a negyedéves cégautóadó fizetési kötelezettségből.
Ha késedelmesen történt: figyelmeztetés jelenik meg, hogy a levonási jog a törvény szerint elveszett.

📊 Összegző Fejlesztési Mátrix
Modul
Fejlesztendő Elem
Célrendszer
Prioritás
Érintett Terület
TENY
Pályázatos ÉCS pálya és eltérő ÉCS-alapok
eaisybill / eaisyBooks
Magas
DB séma, useDepreciation.ts, UI
TENY
Több évi fejlesztési tartalék összekapcsolása (FIFO)
eaisybill / eaisyBooks
Magas
Új tábla (allocations), UI dialógus
TENY
Beruházási adókedvezmény jelölése és 4 éves zárolás
eaisybill / eaisyBooks
Közepes
fixed_assets, DisposalDialog.tsx
TENY
Hrsz, Rendszám, Alvázszám törzsmezők
eaisybill / eaisyBooks
Magas
CreateFixedAssetDialog.tsx, táblázat
TENY & Főkönyv
Költséghely/Projekt ráírás ÉCS vegyes feladásra
eaisyBooks
Kritikus
depreciationPostingService.ts
TENY
Nyitó halmozott ÉCS és utolsó elszámolt ÉCS dátuma
eaisybill / eaisyBooks
Kritikus
CreateFixedAssetDialog.tsx, kalkuláció
TENY
ÉCS kulcs (%) manuális szerkesztése / felülbírálata
eaisybill / eaisyBooks
Magas
UI beviteli mezők, konverzió
TENY
10+ számviteli mozgásnem és terven felüli ÉCS
eaisyBooks
Magas
AssetDetailPanel.tsx, új modálok, 866/966
Cégautóadó
Új Cégautóadó modul (kW/Euro mátrix, saját+bérelt)
eaisyBooks
Magas
Új tábla (company_cars), adómotor
Cégautóadó
Gépjárműadó levonási automatizmus határidő-vizsgálattal
eaisyBooks
Közepes
Banki tétel összekötés, negyedéves riport
