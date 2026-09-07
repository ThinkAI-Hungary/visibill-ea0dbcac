# Decision 053: NAV 08 ÁNYK XML Rekonstrukció és Tömeges Béradat Import

**Status:** Decided

**Category:** eaisyBooks & Integrált Modulok

**Question:** Hogyan oldható meg új ügyfél átvételekor vagy év közbeni szoftverváltáskor a munkavállalói törzs és a történeti bérszámfejtési adatok gyors, hibamentes rögzítése?

**Decision:**

1. **NAV 08 ÁNYK XML Rekonstrukciós Motor:**
   - A rendszer támogatja a korábban benyújtott havi NAV 08-as (pl. 2408, 2508, 2608) ÁNYK XML bevallási állományok közvetlen feltöltését és feldolgozását.
   - A `nav08XmlParser` komponens feldolgozza az XML állomány M-lapjait (magánszemélyenkénti bontás).
   - Automatikusan azonosítja és kinyeri:
     - Munkavállalói azonosítók (név, adóazonosító jel, TAJ szám, születési adatok).
     - Jogviszony kódok (heti munkaidő, FEOR, munkakör).
     - Béralapok (alapbér, pótlékok, egyéb jövedelmek).
     - Kedvezmények (családi kedvezmény, 25 év alattiak kedvezménye, személyi kedvezmény).
     - Levont adók és járulékok (SZJA, TB járulék, Szocho).

2. **Tömeges Adatbázis Ingesztió:**
   - Előnézeti képernyő a könyvelő számára az importálandó dolgozókról és a felismert múltbéli bérszámfejtési ciklusokról.
   - Jóváhagyás után a rendszer automatikusan feltölti a `payroll_employees`, `payroll_contracts` és a lezárt `payroll_cycles` rekordokat.
   - Duplikáció-védelem adóazonosító és tárgyhónap alapján.

**Rationale:** Egy új ügyfél átvételekor a korábbi könyvelőtől kapott adatok gyakran hiányosak, de a NAV-hoz benyújtott 08-as bevallások hivatalos, validált és pontos forrást jelentenek. A 08-as XML import kiküszöböli a többnapos kézi adatrögzítést, és azonnal megbízható bérszámfejtési történetet biztosít az új ügyfélnél.
