# Decision 055: [eaisyBooks] AI Asszisztens Chat és Szakmai Döntéstámogatás

**Status:** Decided

**Category:** eaisyBooks & Integrált Modulok

**Question:** Milyen üzleti célokat szolgál a beépített AI asszisztens chat az eaisyBooks könyvelőirodai felületén, milyen jogszabályi és szakmai területekre specializált, hogyan biztosítja az adatvédelmet (GDPR), és milyen felhasználási korlátokkal védjük a platformot a költségtúllépéstől és a visszaélésektől?

**Decision:**

1. **Szakmai Könyvelői AI Asszisztens Pozicionálás:**
   - Az eaisyBooks AI Asszisztens egy beépített intelligens döntéstámogató eszköz, amely kifejezetten a magyar könyvelők, bérszámfejtők és irodavezetők operatív munkáját segíti anélkül, hogy el kellene hagyniuk az ERP felületét.
   - **Támogatott szakterületek:**
     - Magyar munkajog és adójog (Mt., Szja tv., Tbj., Szocho tv., Art., Efo tv.).
     - Bérszámfejtés és járulékszámítási logikák.
     - NAV havi és éves bevallások (2608, 2658, M30, 08-as lapok).
     - Családi adó- és járulékkedvezmények optimális megosztása és érvényesítése.
     - KIVA vs. TAO adónem-választási döntés-előkészítés és szimuláció.
     - Bérszámfejtési anomáliák és hibák detektálása beküldés előtt.
   - **2026-os jogszabályi sarokszámok beépítése:**
     - Minimálbér: 322 800 Ft | Garantált bérminimum: 382 200 Ft.
     - Duplázott családi kedvezmények: 1 eltartott: 20 000 Ft/hó, 2 eltartott: 40 000 Ft/hó/fő, 3 vagy több: 99 000 Ft/hó/fő.
     - Kulcsok: SZJA 15%, TB járulék 18,5%, SZOCHO 13%.

2. **GDPR és Felelősségkizárási Irányelvek:**
   - **Felelősségkizárás:** Az AI válaszai szakmai tájékoztató jellegűek, nem minősülnek hivatalos jogi vagy adótanácsadásnak. A végső felelősség a könyvelőt terheli. A felületen kötelezően megjelenik a sárga figyelmeztető banner.
   - **Adatvédelem:** A foglalkoztatottak és magánszemélyek közvetlen azonosításra alkalmas személyes adatait (név, adóazonosító jel, TAJ szám, lakcím) szigorúan tilos az AI API-k felé továbbítani. A promptok anonimizált adatszerkezetekkel dolgoznak.

3. **Jogosultsági Határok (RBAC):**
   - Modul azonosító: `ai_assistant`.
   - **Alapértelmezett hozzáférés:** `iroda_admin`, `senior_konyvelo`, `konyvelo`.
   - Korlátozott szerepkörök: az egyszerű `asszisztens` vagy külső ügyfél szerepkör nem fér hozzá az AI asszisztenshez.
   - Az irodavezető a `PermissionMatrixPage` felületen felhasználónként egyedileg felülbírálhatja a hozzáférést az `accounty_module_permissions` táblán keresztül.

4. **Kvóták, Költségvédelem és Visszaélés-megelőzés:**
   - **Felhasználónkénti órás limit:** Egy bejelentkezett felhasználó maximum 30 kérést küldhet óránként (`RATE_LIMIT = 30 / 3600_000 ms`). Túllépés esetén a rendszer HTTP 429-es választ ad.
   - **Frontend flood védelem:** Két üzenet elküldése között minimum 3 másodpercnek kell eltelnie.
   - **Automatizációs pajzs (Automation Shield):** A közvetlen scriptes vagy bot alapú hívások blokkolásra kerülnek (`checkAutomationShield`).
   - **Költségelszámolás:** Minden lezárt chat válasz aszinkron rögzítésre kerül az `llm_koltsegek` táblában a felhasznált tokenek és a becsült USD költség naplózásával (`pipeline: 'accounty_ai_chat'`).

**Rationale:** A könyvelőirodák munkatársai rengeteg időt töltenek törvényi hivatkozások, adókulcsok és ellenőrzési szabályok keresésével. A beépített AI asszisztens drasztikusan csökkenti az adminisztrációs terheket és a hibalehetőségeket, miközben az órás kéréslimit és a token naplózás megvédi a platformot a kiszámíthatatlan költségrobbanástól.

---

## Kapcsolódó
- **ADR:** [A-104: eaisyBooks AI Chat Streaming és Edge Architektúra](../../architecture/decisions/A-104-eaisybooks-ai-chat-streaming-and-edge-architecture.md)
- **PRD:** [P-077: eaisyBooks AI Asszisztens Chat és Speed Dial UX](../../product/decisions/P-077-eaisybooks-ai-assistant-chat-and-speed-dial-ux.md)
- **BRD Követelmény:** [docs/business/brd.md](../brd.md) (REQ-8b.9)
- **Adatmodell:** [docs/architecture/database/18-eaisybooks-ai.md](../../architecture/database/18-eaisybooks-ai.md)
- **Kapcsolódó döntések:** [Decision 027: LLM Költség Kezelés](./027-llm-cost-management.md), [Decision 031: eaisyBooks modul scope](./031-accounty-module.md)
