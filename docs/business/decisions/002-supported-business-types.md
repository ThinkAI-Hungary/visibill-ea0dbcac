# Decision 002: Támogatott Vállalkozási Formák

**Status:** Partially Decided

**Category:** Célpiac & Üzleti Modell

**Question:** Milyen vállalkozási formákat támogat a Visibill? Csak kettős könyvvitelt vezető cégeket (Kft, Bt, Zrt), vagy egyéni vállalkozókat (KATA, átalányadó) is? Van-e különbség a funkciókészletben vállalkozási forma szerint?

**Decision:**
- A **fő eaisyBill alkalmazás** (cégvezető nézet) továbbra is elsősorban kettős könyvvitelt vezető cégeket (Kft, Bt, Zrt) támogatja
- Az **eaisyBooks modul** (könyvelői nézet) az eaisyBill mellett EV (Egyéni Vállalkozó) ügyfeleket is teljes mértékben támogatja (2026-06 óta):
  - **Adóformák:** Átalányadó (Szja tv. 50–56. §), Vállalkozói SZJA (49/B–49/C. §), KATA (KATA tv. 7–8. §)
  - **Foglalkoztatási státuszok:** Főfoglalkozású, Mellékállású, Kiegészítő (nyugdíjas)
  - **Könyvelési módok:** Egyszeres könyvvitel (pénztárkönyv-alapú)
  - **Bevallások:** SZJA, ÁFA, Járulék, HIPA, KATA, cégautóadó
  - **Nyilvántartások:** 14 féle nyilvántartás (vevők/szállítók, tárgyi eszközök, gépjármű, stb.)
  - **Járulékok:** Negyedéves TB-járulék (18,5%) és szocho (13%) kalkuláció minimumjárulék-alappal
  - **Szervezeti típusok:** Társasházak, civil szervezetek, egyéb szervezetek (2026-07 óta)

**Rationale:** A könyvelőirodák ügyfélkörének jelentős részét EV-k alkotják. Az eaisyBooks modul EV-bővítése lehetővé teszi, hogy egy könyvelő minden ügyfele — legyen az Kft vagy EV — egyetlen platformon legyen kezelhető. Az EV modul a fő app-tól elkülönült UI-ban fut (`/accounty/client/:id/ev/*`), saját adatbázis sémával (`accounty_ev_*` táblák, 21 db).
