# P-185: TENY Rekonciliáció, Kivezetés Jóváhagyás és Fejlesztési Tartalék Riasztás UX

**Status:** Decided  
**Category:** Workflow / UI  
**Question:** Hogyan lássa a felhasználó a TENY ↔ főkönyv eltérést, hogyan vezessen ki eszközt jóváhagyással, és hogyan figyelmeztessük a lejáró fejlesztési tartalékokra?  
**Decision:**
1. **Rekonciliáció & Főkönyv fül** (`/teny?tab=reconciliation`): KPI kártyák (bruttó, ÉCS, beruházás egyezőség), root-cause panel, eszköztábla, `Hiányzó tételek pótlása` kötegelt könyvelő varázsló (dialógus megerősítéssel). A Főkönyv rekonciliációs nézet Tárgyi eszközök kártyáján link vezet ide (`#gl-recon-link-fixed-assets`).
2. **Kivezetés két lépésben:** az eszközkartonon `Kivezetés` gomb (`#asset-disposal-request-btn`) → kérelem űrlap (jogcím, dátum, indoklás, jogcím-specifikus mezők) → `Kivezetés jóváhagyásra vár` jelvény (`#asset-disposal-pending-badge`). A jóváhagyó (`ledger_write` jogosultság) a `Kivezetés elbírálása` gombbal (`#asset-disposal-review-btn`) nyitja a dialógust: KPI-k (bruttó, halmozott ÉCS, ebből pótlás, nettó), könyvelési előnézet, Jegyzőkönyv PDF, Jóváhagyás / Elutasítás. Nem jogosult felhasználó „Csak megtekintés” nézetet kap; ha az eszköz nincs a főkönyvben, piros hiba jelzi és a jóváhagyás letiltott.
3. **Fejlesztési tartalékok fül:** `#dev-reserve-expiry-alerts` riasztássáv – 3. adóév (figyelmeztetés), 4. adóév (kritikus, hátralévő napok), lejárt (becsült visszafizetés: adóalap-növelés, társasági adó, késedelmi pótlék, összesen), „Tájékoztató becslés” lábjegyzettel. Kivezetési dialógusokban elidegenítési tilalom figyelmeztetés (`#disposal-reserve-alienation-alert`).
**Current Implementation:** `AssetReconciliationTab.tsx`, `DisposalDialog.tsx`, `DisposalApprovalDialog.tsx`, `AssetDetailPanel.tsx`, `DevelopmentReservesTab.tsx`, `DevelopmentReserveAlienationAlert.tsx`. A 2. és 3. pont böngészőben igazolva (Dev); a jegyzőkönyv PDF letöltése és a tényleges jóváhagyás gombnyomás böngészőben még nincs kipróbálva (Vitest / DB teszt fedi).  
**Rationale:** Maker–checker elv: a kivezetés könyvelési hatású, ezért a kezdeményező és a jóváhagyó szétválik; a könyvelés csak megerősített előnézet után fut. A riasztások a tartalék 4 éves felhasználási határideje előtt adnak időt cselekedni.

## Kapcsolódó
- [A-251: TENY ↔ főkönyv kapcsolat, rekonciliáció és kivezetési workflow](../../architecture/decisions/A-251-fixed-assets-gl-linkage-reconciliation-and-disposal-workflow.md)
- [P-123: Fejlesztési tartalék TENY UX](./P-123-development-reserve-teny-ux.md)
