# Decision 051: Egyéni Vállalkozói (EV) és Szervezeti Egyszeres Könyvvitel

**Status:** Decided

**Category:** eaisyBooks & Integrált Modulok

**Question:** Hogyan kezelje a rendszer az egyszeres könyvvitelt vezető szervezeteket (Egyéni Vállalkozók, Civil szervezetek, Társasházak), és milyen adózási formák, analitikus nyilvántartások és zárási folyamatok szükségesek?

**Decision:**

1. **Három Támogatott EV Adózási Forma:**
   - **Átalányadózás (Flat-rate):** 40%, 80% vagy 90%-os költséghányad, adómentes keretösszeg figyelése, minimum járulékalapok (minimálbér / garantált bérminimum) automatikus alkalmazása szakképzettség alapján.
   - **Vállalkozói Személyi Jövedelemadó (VSZJA - Itemized):** Tételes költségelszámolás, vállalkozói kivét, vállalkozói osztalékalap és SZJA kalkuláció.
   - **KATA:** Kisadózó vállalkozások tételes adója (főállású 50.000 Ft/hó), 18M Ft-os bevételi értékhatár és 40%-os különadó figyelése.

2. **Egyszeres Pénztárkönyv Analitika & Zárási Varázsló:**
   - Időszaki pénztárkönyv vezetés a NAV Online Számla és banki/készpénzes bizonylatok alapján.
   - Időszaki Zárási Varázsló (Closing Wizard): nyitó/záró pénztár- és bankegyenleg ellenőrzése, negatív pénztáregyenleg kizárása, hibás vagy hiányzó adókódok auditja.
   - Törvényi stornózási mechanizmus és nyomtatható (PDF, Excel) hivatalos pénztárkönyvi kivonat.

3. **14 Kötelező Törvényi Nyilvántartás:**
   - A személyi jövedelemadóról szóló törvény szerinti kötelező analitikák biztosítása: vevők, szállítók, tárgyi eszközök és beruházások, gépjárműhasználat (útnyilvántartás / kiküldetési rendelvény), selejtezés, készlet, kölcsönök, stb.

4. **Bevallás Generálás:**
   - Havi járulékbevallás (58-as típusú ÁNYK XML export).
   - Éves személyi jövedelemadó bevallás előkészítése és időszaki ÁFA (2665) feladás.

5. **Nem-EV Szervezeti Egyszeres Könyvvitel:**
   - **Civil szervezetek (egyesületek, alapítványok):** Alaptevékenységi és vállalkozási bevételek/kiadások elkülönítése, támogatások elszámolása.
   - **Társasházak:** Közös költség előírások és befizetések, felújítási alap analitika.

**Rationale:** Magyarországon több százezer egyéni vállalkozó működik, akiknek könyvelése alapvetően eltér a kettős könyvvitelt vezető gazdasági társaságokétól (pénzforgalmi szemlélet, tételes pénztárkönyv, szakképzettség szerinti minimális járulékalapok). Az egyszeres könyvviteli motor biztosítja, hogy a könyvelőirodák egyetlen integrált felületen tudják kiszolgálni mind a Kft/Bt ügyfeleiket, mind az EV és nonprofit portfóliójukat.
