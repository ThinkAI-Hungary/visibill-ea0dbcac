# 04. HR, Munkaidő és Tárgyi Eszközök — HR Lokalizációs Leltár

**Modul hatóköre:** Munkaidő-nyilvántartás, jelenléti ívek, bejelentési adatok, szabadságkalkuláció, bérek és járulékok, bérjegyzékek, tárgyi eszköz nyilvántartás (TENY), értékcsökkenés futtatás, fejlesztési tartalék.  
**Összes érintett fájl:** 26 db  
**Összes feltárt hiányosság:** 376 db  
**Elsődleges i18n névtér:** `hr` (továbbá `common`)

---

## 📈 1. Modul Statisztika és Hotspotok

### Kategóriák szerinti megoszlás
| Elem típusa | Előfordulás | Súlyosság / Hatás |
| :--- | :---: | :--- |
| **Értesítési ablakok (Toast)** | 41 db | Magas (P1) — Művelet-visszajelzés a felhasználónak |
| **Modálok és megerősítések (Dialog)** | 5 db | Kritikus (P0/P1) — Űrlapok és felugró ablakok |
| **Státusz jelvények (Badge)** | 0 db | Magas (P1) — Bizonylat- és tranzakció állapotok |
| **Feltételes állapotok (Ternary)** | 149 db | Magas (P1) — Táblázatcellákban megjelenő státuszok |
| **Táblázat oszlopok és menüpontok** | 1 db | Közepes (P2) — Adatstruktúra fejlécek és legördülők |
| **Űrlap súgók és helykitöltők (Props)** | 24 db | Közepes (P2) — `placeholder`, `title`, `tooltip` |
| **Közvetlen felületi szövegek (JSX)** | 121 db | Kritikus (P0) — Gombok, címkék, kártya tartalom |
| **Hiányzó szótárkulcsok (Missing HR key)** | 35 db | Magas (P1) — `t(...)` hívás ami nincs a horvát JSON-ban |


### Legtöbb lokalizációs hiányosságot tartalmazó komponensek:
- [CreateFixedAssetDialog.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/CreateFixedAssetDialog.tsx): **65 db** lefordítandó elem
- [DepreciationRunDialog.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DepreciationRunDialog.tsx): **39 db** lefordítandó elem
- [DevelopmentReservesTab.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DevelopmentReservesTab.tsx): **37 db** lefordítandó elem
- [TenyImportModal.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/ev/TenyImportModal.tsx): **24 db** lefordítandó elem
- [DepreciationCards.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DepreciationCards.tsx): **23 db** lefordítandó elem
- [DevelopmentReserveAssignDialog.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DevelopmentReserveAssignDialog.tsx): **18 db** lefordítandó elem
- [EmployeeRegister.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/EmployeeRegister.tsx): **17 db** lefordítandó elem
- [SubmittedEntriesPanel.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/working-time/SubmittedEntriesPanel.tsx): **16 db** lefordítandó elem

---

## 🔔 2. Értesítési Ablakok (Toasts) és Modális Megerősítések

| Forrás és sorszám | Elem | Megjelenő magyar szöveg | Javasolt horvát (HR) fordítás |
| :--- | :--- | :--- | :--- |
| [TenyImportModal.tsx:L98](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/ev/TenyImportModal.tsx#L98) | `toast_title` | Nincs kijelölt tétel | **— (Prevesti na HR)** |
| [TenyImportModal.tsx:L98](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/ev/TenyImportModal.tsx#L98) | `toast_desc` | Kérlek jelölj ki legalább egy eszközt az AI módszer javaslathoz! | **— (Prevesti na HR)** |
| [TenyImportModal.tsx:L232](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/ev/TenyImportModal.tsx#L232) | `toast_title` | AI javaslatok betöltve | **— (Prevesti na HR)** |
| [TenyImportModal.tsx:L239](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/ev/TenyImportModal.tsx#L239) | `toast_title` | AI javaslat sikertelen | **— (Prevesti na HR)** |
| [DepreciationRunDialog.tsx:L176](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DepreciationRunDialog.tsx#L176) | `toast_title` | Könyvelési figyelmeztetés | **— (Prevesti na HR)** |
| [DepreciationRunDialog.tsx:L185](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DepreciationRunDialog.tsx#L185) | `toast_title` | Értékcsökkenés sikeresen lekönyvelve! 🎉 | **— (Prevesti na HR)** |
| [DepreciationRunDialog.tsx:L201](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DepreciationRunDialog.tsx#L201) | `toast_title` | Hiba a feladás során | **— (Prevesti na HR)** |
| [DevelopmentReserveAssignDialog.tsx:L83](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DevelopmentReserveAssignDialog.tsx#L83) | `toast_title` | Érvénytelen összeg | **— (Prevesti na HR)** |
| [DevelopmentReserveAssignDialog.tsx:L110](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DevelopmentReserveAssignDialog.tsx#L110) | `toast_title` | Hiba a mentés során | **— (Prevesti na HR)** |
| [DevelopmentReservesTab.tsx:L48](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DevelopmentReservesTab.tsx#L48) | `toast_title` | Hiba | **Greška** |
| [DevelopmentReservesTab.tsx:L48](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DevelopmentReservesTab.tsx#L48) | `toast_desc` | Kérjük adjon meg egy érvényes összeget! | **— (Prevesti na HR)** |
| [DevelopmentReservesTab.tsx:L62](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DevelopmentReservesTab.tsx#L62) | `toast_title` | Sikeres rögzítés | **— (Prevesti na HR)** |
| [DevelopmentReservesTab.tsx:L67](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DevelopmentReservesTab.tsx#L67) | `toast_title` | Hiba a mentés során | **— (Prevesti na HR)** |
| [DevelopmentReservesTab.tsx:L79](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DevelopmentReservesTab.tsx#L79) | `toast_title` | Fejlesztési tartalék törölve | **— (Prevesti na HR)** |
| [DevelopmentReservesTab.tsx:L81](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DevelopmentReservesTab.tsx#L81) | `toast_title` | Törlés sikertelen | **— (Prevesti na HR)** |
| [InventoryCheckDialog.tsx:L116](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/InventoryCheckDialog.tsx#L116) | `toast_title` | Leltár rögzítve | **— (Prevesti na HR)** |
| [InventoryCheckDialog.tsx:L125](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/InventoryCheckDialog.tsx#L125) | `toast_title` | Hiba | **Greška** |
| [SubmittedEntriesPanel.tsx:L136](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/working-time/SubmittedEntriesPanel.tsx#L136) | `toast_title` | Jóváhagyva | **Odobreno** |
| [SubmittedEntriesPanel.tsx:L141](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/working-time/SubmittedEntriesPanel.tsx#L141) | `toast_title` | Hiba | **Greška** |
| [SubmittedEntriesPanel.tsx:L141](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/working-time/SubmittedEntriesPanel.tsx#L141) | `toast_desc` | Nem sikerült jóváhagyni. | **— (Prevesti na HR)** |
| [SubmittedEntriesPanel.tsx:L155](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/working-time/SubmittedEntriesPanel.tsx#L155) | `toast_title` | Törölve | **Obrisano** |
| [SubmittedEntriesPanel.tsx:L160](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/working-time/SubmittedEntriesPanel.tsx#L160) | `toast_desc` | Nem sikerült törölni. | **— (Prevesti na HR)** |
| [useEmployeeRates.ts:L115](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useEmployeeRates.ts#L115) | `toast_desc` | Dolgozó sikeresen hozzáadva. | **— (Prevesti na HR)** |
| [useEmployeeRates.ts:L117](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useEmployeeRates.ts#L117) | `toast_desc` | Dolgozó óradíja frissítve. | **— (Prevesti na HR)** |
| [useEmployeeRates.ts:L122](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useEmployeeRates.ts#L122) | `toast_title` | Hiba | **Greška** |
| [useEmployeeRates.ts:L140](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useEmployeeRates.ts#L140) | `toast_title` | Törölve | **Obrisano** |
| [useEmployeeRates.ts:L140](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useEmployeeRates.ts#L140) | `toast_desc` | Dolgozó óradíja törölve. | **— (Prevesti na HR)** |
| [useEmployeeRates.ts:L144](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useEmployeeRates.ts#L144) | `toast_desc` | Nem sikerült törölni. | **— (Prevesti na HR)** |
| [useSalaryData.ts:L147](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useSalaryData.ts#L147) | `toast_desc` | KP kifizetés rögzítve. | **— (Prevesti na HR)** |
| [useSalaryData.ts:L151](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useSalaryData.ts#L151) | `toast_title` | Hiba | **Greška** |
| [useSalaryData.ts:L151](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useSalaryData.ts#L151) | `toast_desc` | Nem sikerült rögzíteni a kifizetést. | **— (Prevesti na HR)** |
| [useSalaryData.ts:L163](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useSalaryData.ts#L163) | `toast_desc` | Bejegyzés frissítve. | **— (Prevesti na HR)** |
| [useSalaryData.ts:L167](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useSalaryData.ts#L167) | `toast_desc` | Nem sikerült frissíteni a bejegyzést. | **— (Prevesti na HR)** |
| [EmployeeRegister.tsx:L87](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/EmployeeRegister.tsx#L87) | `toast_title` | A jelszavak nem egyeznek | **— (Prevesti na HR)** |
| [EmployeeRegister.tsx:L87](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/EmployeeRegister.tsx#L87) | `toast_desc` | Kérlek ellenőrizd a megadott jelszavakat. | **— (Prevesti na HR)** |
| [EmployeeRegister.tsx:L96](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/EmployeeRegister.tsx#L96) | `toast_title` | Túl rövid jelszó | **— (Prevesti na HR)** |
| [EmployeeRegister.tsx:L96](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/EmployeeRegister.tsx#L96) | `toast_desc` | A jelszónak legalább 6 karakter hosszúnak kell lennie. | **— (Prevesti na HR)** |
| [EmployeeRegister.tsx:L160](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/EmployeeRegister.tsx#L160) | `toast_title` | Regisztráció sikertelen | **— (Prevesti na HR)** |
| [DevelopmentReserveAssignDialog.tsx:L124](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DevelopmentReserveAssignDialog.tsx#L124) | `Dialog Title/Description` | Fejlesztési Tartalék Hozzárendelése | **— (Prevesti na HR)** |
| [DevelopmentReservesTab.tsx:L75](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DevelopmentReservesTab.tsx#L75) | `window.confirm` | Biztosan törölni szeretné a ${reserve.creation_year}. évi fejlesztési ta... | **Jeste li sigurni da želite obrisati?** |
| [DevelopmentReservesTab.tsx:L336](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DevelopmentReservesTab.tsx#L336) | `Dialog Title/Description` | Új Fejlesztési Tartalék Rögzítése | **— (Prevesti na HR)** |
| [SalaryLinkCard.tsx:L229](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/working-time/SalaryLinkCard.tsx#L229) | `Dialog Title/Description` | Óradíj szerkesztése — {employeeName} | **— (Prevesti na HR)** |
| [SubmittedEntriesPanel.tsx:L494](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/working-time/SubmittedEntriesPanel.tsx#L494) | `window.confirm` | Biztosan törölni szeretnéd a kijelölt ${selectedIds.size} tételt? | **Jeste li sigurni da želite obrisati?** |


---

## 🏷️ 3. Státusz Badge-ek, Jelvények és Feltételes Állapotok

| Forrás és sorszám | Elem | Megjelenő magyar szöveg | Javasolt horvát (HR) fordítás |
| :--- | :--- | :--- | :--- |
| [TenyImportModal.tsx:L100](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/ev/TenyImportModal.tsx#L100) | `ternary condition literal` | Nincs kijelölt tétel | **— (Prevesti na HR)** |
| [TenyImportModal.tsx:L158](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/ev/TenyImportModal.tsx#L158) | `ternary condition literal` | teny-import-ai | **— (Prevesti na HR)** |
| [TenyImportModal.tsx:L164](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/ev/TenyImportModal.tsx#L164) | `ternary condition literal` | Ismeretlen hiba | **— (Prevesti na HR)** |
| [TenyImportModal.tsx:L233](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/ev/TenyImportModal.tsx#L233) | `ternary condition literal` | AI javaslatok betöltve | **— (Prevesti na HR)** |
| [TenyImportModal.tsx:L234](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/ev/TenyImportModal.tsx#L234) | `ternary condition literal` | Sikeresen elemeztünk ${data.suggestions.length} eszközt. | **— (Prevesti na HR)** |
| [TenyImportModal.tsx:L241](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/ev/TenyImportModal.tsx#L241) | `ternary condition literal` | AI javaslat sikertelen | **— (Prevesti na HR)** |
| [TenyImportModal.tsx:L358](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/ev/TenyImportModal.tsx#L358) | `ternary condition literal` | AI elemzés... | **— (Prevesti na HR)** |
| [TenyImportModal.tsx:L358](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/ev/TenyImportModal.tsx#L358) | `ternary condition literal` | AI módszer javaslat | **— (Prevesti na HR)** |
| [TenyImportModal.tsx:L392](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/ev/TenyImportModal.tsx#L392) | `ternary condition literal` | Nincs a keresésnek megfelelő eszköz. | **— (Prevesti na HR)** |
| [AssetDetailPanel.tsx:L55](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/AssetDetailPanel.tsx#L55) | `ternary condition literal` | Aktiválás | **— (Prevesti na HR)** |
| [AssetDetailPanel.tsx:L56](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/AssetDetailPanel.tsx#L56) | `ternary condition literal` | Leltár - Fellelve | **— (Prevesti na HR)** |
| [AssetDetailPanel.tsx:L57](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/AssetDetailPanel.tsx#L57) | `ternary condition literal` | Áthelyezés | **— (Prevesti na HR)** |
| [AssetDetailPanel.tsx:L58](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/AssetDetailPanel.tsx#L58) | `ternary condition literal` | Projekt hozzárendelés | **— (Prevesti na HR)** |
| [AssetDetailPanel.tsx:L59](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/AssetDetailPanel.tsx#L59) | `ternary condition literal` | Ráaktiválás | **— (Prevesti na HR)** |
| [AssetDetailPanel.tsx:L60](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/AssetDetailPanel.tsx#L60) | `ternary condition literal` | Kivezetés | **— (Prevesti na HR)** |
| [AssetDetailPanel.tsx:L61](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/AssetDetailPanel.tsx#L61) | `ternary condition literal` | Értékváltozás | **— (Prevesti na HR)** |
| [AssetDetailPanel.tsx:L62](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/AssetDetailPanel.tsx#L62) | `ternary condition literal` | Dokumentum feltöltés | **— (Prevesti na HR)** |
| [AssetDetailPanel.tsx:L63](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/AssetDetailPanel.tsx#L63) | `ternary condition literal` | Teljesítmény rögzítés | **— (Prevesti na HR)** |
| [CreateFixedAssetDialog.tsx:L172](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/CreateFixedAssetDialog.tsx#L172) | `ternary condition literal` | Az eszköz megnevezése kötelező. | **— (Prevesti na HR)** |
| [CreateFixedAssetDialog.tsx:L181](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/CreateFixedAssetDialog.tsx#L181) | `ternary condition literal` | A leltári szám megadása kötelező. | **— (Prevesti na HR)** |
| [CreateFixedAssetDialog.tsx:L190](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/CreateFixedAssetDialog.tsx#L190) | `ternary condition literal` | A bekerülési értéknek nagyobbnak kell lennie nullánál. | **— (Prevesti na HR)** |
| [CreateFixedAssetDialog.tsx:L247](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/CreateFixedAssetDialog.tsx#L247) | `ternary condition literal` | Nyitó / előzmény tárgyi eszköz sikeresen rögzítve. | **— (Prevesti na HR)** |
| [CreateFixedAssetDialog.tsx:L248](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/CreateFixedAssetDialog.tsx#L248) | `ternary condition literal` | Új tárgyi eszköz sikeresen aktiválva. | **— (Prevesti na HR)** |
| [CreateFixedAssetDialog.tsx:L263](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/CreateFixedAssetDialog.tsx#L263) | `ternary condition literal` | Hiba történt az eszköz mentése során. | **Došlo je do greške** |
| [CreateFixedAssetDialog.tsx:L618](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/CreateFixedAssetDialog.tsx#L618) | `ternary condition literal` | Éves leírási összegek (vesszővel elválasztva, Ft) | **— (Prevesti na HR)** |
| [CreateFixedAssetDialog.tsx:L619](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/CreateFixedAssetDialog.tsx#L619) | `ternary condition literal` | Éves szorzók / kulcsok (vesszővel elválasztva) | **— (Prevesti na HR)** |
| [CreateFixedAssetDialog.tsx:L792](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/CreateFixedAssetDialog.tsx#L792) | `ternary condition literal` | Nyitó eszköz rögzítése | **— (Prevesti na HR)** |
| [CreateFixedAssetDialog.tsx:L792](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/CreateFixedAssetDialog.tsx#L792) | `ternary condition literal` | Eszköz mentése | **— (Prevesti na HR)** |
| [DepreciationCards.tsx:L12](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DepreciationCards.tsx#L12) | `ternary condition literal` | Lineáris | **— (Prevesti na HR)** |
| [DepreciationCards.tsx:L13](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DepreciationCards.tsx#L13) | `ternary condition literal` | Degresszív (Évek száma) | **— (Prevesti na HR)** |
| [DepreciationCards.tsx:L15](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DepreciationCards.tsx#L15) | `ternary condition literal` | Degresszív (Nettó érték) | **— (Prevesti na HR)** |
| [DepreciationCards.tsx:L17](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DepreciationCards.tsx#L17) | `ternary condition literal` | Progresszív | **— (Prevesti na HR)** |
| [DepreciationCards.tsx:L18](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DepreciationCards.tsx#L18) | `ternary condition literal` | Teljesítményarányos | **— (Prevesti na HR)** |
| [DepreciationCards.tsx:L19](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DepreciationCards.tsx#L19) | `ternary condition literal` | Abszolút összegű | **— (Prevesti na HR)** |
| [DepreciationCards.tsx:L20](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DepreciationCards.tsx#L20) | `ternary condition literal` | Szorzószámos | **— (Prevesti na HR)** |
| [DepreciationCards.tsx:L53](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DepreciationCards.tsx#L53) | `ternary condition literal` | ${usefulLifeYears} év ${usefulLifeRemMonths} hó | **— (Prevesti na HR)** |
| [DepreciationCards.tsx:L54](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DepreciationCards.tsx#L54) | `ternary condition literal` | ${usefulLifeYears} év | **— (Prevesti na HR)** |
| [DepreciationRunDialog.tsx:L177](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DepreciationRunDialog.tsx#L177) | `ternary condition literal` | Könyvelési figyelmeztetés | **— (Prevesti na HR)** |
| [DepreciationRunDialog.tsx:L186](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DepreciationRunDialog.tsx#L186) | `ternary condition literal` | Értékcsökkenés sikeresen lekönyvelve! 🎉 | **— (Prevesti na HR)** |
| [DepreciationRunDialog.tsx:L202](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DepreciationRunDialog.tsx#L202) | `ternary condition literal` | Hiba a feladás során | **— (Prevesti na HR)** |
| [DepreciationRunDialog.tsx:L408](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DepreciationRunDialog.tsx#L408) | `ternary condition literal` | (${preview.existingPosting.journalNumber}. sorszám alatt) | **— (Prevesti na HR)** |
| [DevelopmentReserveAssignDialog.tsx:L84](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DevelopmentReserveAssignDialog.tsx#L84) | `ternary condition literal` | Érvénytelen összeg | **— (Prevesti na HR)** |
| [DevelopmentReserveAssignDialog.tsx:L102](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DevelopmentReserveAssignDialog.tsx#L102) | `ternary condition literal` | Fejlesztési tartalék leválasztva | **— (Prevesti na HR)** |
| [DevelopmentReserveAssignDialog.tsx:L102](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DevelopmentReserveAssignDialog.tsx#L102) | `ternary condition literal` | Fejlesztési tartalék sikeresen beállítva | **— (Prevesti na HR)** |
| [DevelopmentReserveAssignDialog.tsx:L111](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DevelopmentReserveAssignDialog.tsx#L111) | `ternary condition literal` | Hiba a mentés során | **— (Prevesti na HR)** |
| [DevelopmentReserveAssignDialog.tsx:L151](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DevelopmentReserveAssignDialog.tsx#L151) | `ternary condition literal` | Betöltés... | **— (Prevesti na HR)** |
| [DevelopmentReserveAssignDialog.tsx:L151](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DevelopmentReserveAssignDialog.tsx#L151) | `ternary condition literal` | Válasszon fejlesztési tartalékot... | **— (Prevesti na HR)** |
| [DevelopmentReserveAssignDialog.tsx:L276](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DevelopmentReserveAssignDialog.tsx#L276) | `ternary condition literal` | Mentés... | **Spremi...** |
| [DevelopmentReserveAssignDialog.tsx:L276](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DevelopmentReserveAssignDialog.tsx#L276) | `ternary condition literal` | Módosítás mentése | **— (Prevesti na HR)** |
| [DevelopmentReservesTab.tsx:L48](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DevelopmentReservesTab.tsx#L48) | `ternary condition literal` | Hiba | **Greška** |
| [DevelopmentReservesTab.tsx:L48](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DevelopmentReservesTab.tsx#L48) | `ternary condition literal` | Kérjük adjon meg egy érvényes összeget! | **— (Prevesti na HR)** |
| [DevelopmentReservesTab.tsx:L62](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DevelopmentReservesTab.tsx#L62) | `ternary condition literal` | Sikeres rögzítés | **— (Prevesti na HR)** |
| [DevelopmentReservesTab.tsx:L62](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DevelopmentReservesTab.tsx#L62) | `ternary condition literal` | ${creationYear}. évi fejlesztési tartalék elmentve. | **— (Prevesti na HR)** |
| [DevelopmentReservesTab.tsx:L67](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DevelopmentReservesTab.tsx#L67) | `ternary condition literal` | Hiba a mentés során | **— (Prevesti na HR)** |
| [DevelopmentReservesTab.tsx:L79](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DevelopmentReservesTab.tsx#L79) | `ternary condition literal` | Fejlesztési tartalék törölve | **— (Prevesti na HR)** |
| [DevelopmentReservesTab.tsx:L81](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DevelopmentReservesTab.tsx#L81) | `ternary condition literal` | Törlés sikertelen | **— (Prevesti na HR)** |
| [DevelopmentReservesTab.tsx:L197](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DevelopmentReservesTab.tsx#L197) | `ternary condition literal` | Nincs lejáró keret | **— (Prevesti na HR)** |
| [DevelopmentReservesTab.tsx:L319](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DevelopmentReservesTab.tsx#L319) | `ternary condition literal` | Nem törölhető, mert már használták fel belőle | **— (Prevesti na HR)** |
| [DevelopmentReservesTab.tsx:L319](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DevelopmentReservesTab.tsx#L319) | `ternary condition literal` | Törlés | **Obriši** |
| [DevelopmentReservesTab.tsx:L404](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DevelopmentReservesTab.tsx#L404) | `ternary condition literal` | Mentés... | **Spremi...** |
| [DevelopmentReservesTab.tsx:L404](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DevelopmentReservesTab.tsx#L404) | `ternary condition literal` | Tartalék Mentése | **— (Prevesti na HR)** |
| [InventoryCheckDialog.tsx:L74](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/InventoryCheckDialog.tsx#L74) | `ternary condition literal` | Leltár — Fellelve ✅ | **— (Prevesti na HR)** |
| [InventoryCheckDialog.tsx:L103](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/InventoryCheckDialog.tsx#L103) | `ternary condition literal` | Leltár — Nem fellelve ❌ | **— (Prevesti na HR)** |
| [InventoryCheckDialog.tsx:L117](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/InventoryCheckDialog.tsx#L117) | `ternary condition literal` | Leltár rögzítve | **— (Prevesti na HR)** |
| [InventoryCheckDialog.tsx:L125](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/InventoryCheckDialog.tsx#L125) | `ternary condition literal` | Hiba | **Greška** |
| [InventoryCheckDialog.tsx:L229](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/InventoryCheckDialog.tsx#L229) | `ternary condition literal` | Rögzítés... | **— (Prevesti na HR)** |
| [InventoryCheckDialog.tsx:L229](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/InventoryCheckDialog.tsx#L229) | `ternary condition literal` | Leltár rögzítése (${foundCount} fellelve) | **— (Prevesti na HR)** |
| [EmployeeAccordion.tsx:L38](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/salaries/EmployeeAccordion.tsx#L38) | `ternary condition literal` | (${employeeGroups.length} fő) | **— (Prevesti na HR)** |
| [EmployeeAccordion.tsx:L78](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/salaries/EmployeeAccordion.tsx#L78) | `ternary condition literal` | ${items.length} tétel | **— (Prevesti na HR)** |
| [SubmittedEntriesPanel.tsx:L136](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/working-time/SubmittedEntriesPanel.tsx#L136) | `ternary condition literal` | Jóváhagyva | **Odobreno** |
| [SubmittedEntriesPanel.tsx:L136](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/working-time/SubmittedEntriesPanel.tsx#L136) | `ternary condition literal` | ${entryIds.length} bejegyzés jóváhagyva. | **— (Prevesti na HR)** |
| [SubmittedEntriesPanel.tsx:L141](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/working-time/SubmittedEntriesPanel.tsx#L141) | `ternary condition literal` | Hiba | **Greška** |
| [SubmittedEntriesPanel.tsx:L141](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/working-time/SubmittedEntriesPanel.tsx#L141) | `ternary condition literal` | Nem sikerült jóváhagyni. | **— (Prevesti na HR)** |
| [SubmittedEntriesPanel.tsx:L155](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/working-time/SubmittedEntriesPanel.tsx#L155) | `ternary condition literal` | Törölve | **Obrisano** |
| [SubmittedEntriesPanel.tsx:L155](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/working-time/SubmittedEntriesPanel.tsx#L155) | `ternary condition literal` | ${entryIds.length} bejegyzés törölve. | **— (Prevesti na HR)** |
| [SubmittedEntriesPanel.tsx:L160](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/working-time/SubmittedEntriesPanel.tsx#L160) | `ternary condition literal` | Nem sikerült törölni. | **— (Prevesti na HR)** |
| [TimeEntryForm.tsx:L62](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/working-time/TimeEntryForm.tsx#L62) | `ternary condition literal` | Szabadság | **— (Prevesti na HR)** |
| [TimeEntryForm.tsx:L277](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/working-time/TimeEntryForm.tsx#L277) | `ternary condition literal` | Mentés... | **Spremi...** |
| [TimeEntryForm.tsx:L279](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/working-time/TimeEntryForm.tsx#L279) | `ternary condition literal` | Távollét rögzítése | **— (Prevesti na HR)** |
| [TimeEntryForm.tsx:L280](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/working-time/TimeEntryForm.tsx#L280) | `ternary condition literal` | Rögzítés | **— (Prevesti na HR)** |
| [TimeEntryForm.tsx:L290](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/working-time/TimeEntryForm.tsx#L290) | `ternary condition literal` | Leadás... | **— (Prevesti na HR)** |
| [TimeEntryForm.tsx:L290](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/working-time/TimeEntryForm.tsx#L290) | `ternary condition literal` | Mentés | **Spremi** |
| [TimesheetTable.tsx:L47](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/working-time/TimesheetTable.tsx#L47) | `ternary condition literal` | Jóváhagyva | **Odobreno** |
| [useEmployeeRates.ts:L115](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useEmployeeRates.ts#L115) | `ternary condition literal` | Dolgozó sikeresen hozzáadva. | **— (Prevesti na HR)** |
| [useEmployeeRates.ts:L117](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useEmployeeRates.ts#L117) | `ternary condition literal` | Dolgozó óradíja frissítve. | **— (Prevesti na HR)** |
| [useEmployeeRates.ts:L124](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useEmployeeRates.ts#L124) | `ternary condition literal` | Hiba | **Greška** |
| [useEmployeeRates.ts:L140](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useEmployeeRates.ts#L140) | `ternary condition literal` | Törölve | **Obrisano** |
| [useEmployeeRates.ts:L140](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useEmployeeRates.ts#L140) | `ternary condition literal` | Dolgozó óradíja törölve. | **— (Prevesti na HR)** |
| [useEmployeeRates.ts:L147](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useEmployeeRates.ts#L147) | `ternary condition literal` | Nem sikerült törölni. | **— (Prevesti na HR)** |
| [useFixedAssets.ts:L10](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useFixedAssets.ts#L10) | `ternary condition literal` | Lineáris (Egyenletes) | **— (Prevesti na HR)** |
| [useFixedAssets.ts:L11](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useFixedAssets.ts#L11) | `ternary condition literal` | Degresszív (Évek száma összege) | **— (Prevesti na HR)** |
| [useFixedAssets.ts:L12](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useFixedAssets.ts#L12) | `ternary condition literal` | Degresszív (Nettó érték alapú) | **— (Prevesti na HR)** |
| [useFixedAssets.ts:L13](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useFixedAssets.ts#L13) | `ternary condition literal` | Progresszív (Növekvő) | **— (Prevesti na HR)** |
| [useFixedAssets.ts:L14](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useFixedAssets.ts#L14) | `ternary condition literal` | Teljesítményarányos | **— (Prevesti na HR)** |
| [useFixedAssets.ts:L15](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useFixedAssets.ts#L15) | `ternary condition literal` | Abszolút összegű | **— (Prevesti na HR)** |
| [useFixedAssets.ts:L16](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useFixedAssets.ts#L16) | `ternary condition literal` | Szorzószámos | **— (Prevesti na HR)** |
| [useFixedAssets.ts:L17](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useFixedAssets.ts#L17) | `ternary condition literal` | Azonnali (Kisértékű eszköz) | **— (Prevesti na HR)** |
| [useFixedAssets.ts:L150](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useFixedAssets.ts#L150) | `ternary condition literal` | Tárgyi Eszköz Aktiválási Jegyzőkönyv | **— (Prevesti na HR)** |
| [useFixedAssets.ts:L359](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useFixedAssets.ts#L359) | `ternary condition literal` | Előzmény / nyitó eszköz rögzítve: ${params.name} | **— (Prevesti na HR)** |
| [useFixedAssets.ts:L360](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useFixedAssets.ts#L360) | `ternary condition literal` | Eszköz aktiválva: ${params.name} | **— (Prevesti na HR)** |
| [useFixedAssets.ts:L633](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useFixedAssets.ts#L633) | `ternary condition literal` | Értékesítés | **— (Prevesti na HR)** |
| [useFixedAssets.ts:L633](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useFixedAssets.ts#L633) | `ternary condition literal` | Selejtezés / Kivezetés | **— (Prevesti na HR)** |
| [useSalaryData.ts:L141](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useSalaryData.ts#L141) | `ternary condition literal` | Nyitott | **Otvoreno** |
| [useSalaryData.ts:L142](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useSalaryData.ts#L142) | `ternary condition literal` | készpénz | **— (Prevesti na HR)** |
| [useSalaryData.ts:L142](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useSalaryData.ts#L142) | `ternary condition literal` | bér | **Plaća** |
| [useSalaryData.ts:L147](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useSalaryData.ts#L147) | `ternary condition literal` | KP kifizetés rögzítve. | **— (Prevesti na HR)** |
| [useSalaryData.ts:L151](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useSalaryData.ts#L151) | `ternary condition literal` | Hiba | **Greška** |
| [useSalaryData.ts:L151](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useSalaryData.ts#L151) | `ternary condition literal` | Nem sikerült rögzíteni a kifizetést. | **— (Prevesti na HR)** |
| [useSalaryData.ts:L163](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useSalaryData.ts#L163) | `ternary condition literal` | Bejegyzés frissítve. | **— (Prevesti na HR)** |
| [useSalaryData.ts:L167](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useSalaryData.ts#L167) | `ternary condition literal` | Nem sikerült frissíteni a bejegyzést. | **— (Prevesti na HR)** |
| [salary-helpers.ts:L32](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/lib/salary-helpers.ts#L32) | `ternary condition literal` | Bér | **Plaća** |
| [salary-helpers.ts:L34](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/lib/salary-helpers.ts#L34) | `ternary condition literal` | Bruttó Bér | **— (Prevesti na HR)** |
| [salary-helpers.ts:L36](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/lib/salary-helpers.ts#L36) | `ternary condition literal` | ÁFA | **PDV** |
| [salary-helpers.ts:L38](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/lib/salary-helpers.ts#L38) | `ternary condition literal` | Adó | **— (Prevesti na HR)** |
| [salary-helpers.ts:L40](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/lib/salary-helpers.ts#L40) | `ternary condition literal` | Járulék | **— (Prevesti na HR)** |
| [salary-helpers.ts:L55](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/lib/salary-helpers.ts#L55) | `ternary condition literal` | Fizetve | **Plaćeno** |
| [salary-helpers.ts:L57](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/lib/salary-helpers.ts#L57) | `ternary condition literal` | Nyitott | **Otvoreno** |
| [depreciationPostingService.ts:L98](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/lib/fixed-assets/depreciationPostingService.ts#L98) | `ternary condition literal` | Nincs amortizálható alap vagy aktiválási dátum | **— (Prevesti na HR)** |
| [depreciationPostingService.ts:L113](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/lib/fixed-assets/depreciationPostingService.ts#L113) | `ternary condition literal` | Az eszköz aktiválása az időszak vége utáni | **— (Prevesti na HR)** |
| [depreciationPostingService.ts:L126](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/lib/fixed-assets/depreciationPostingService.ts#L126) | `ternary condition literal` | Az eszköz az időszak kezdete előtt kivezetésre került | **— (Prevesti na HR)** |
| [depreciationPostingService.ts:L148](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/lib/fixed-assets/depreciationPostingService.ts#L148) | `ternary condition literal` | Azonnali leírással korábban már elszámolva | **— (Prevesti na HR)** |
| [depreciationPostingService.ts:L192](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/lib/fixed-assets/depreciationPostingService.ts#L192) | `ternary condition literal` | Nem esik aktív hónap a kijelölt időszakra | **— (Prevesti na HR)** |
| [depreciationPostingService.ts:L213](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/lib/fixed-assets/depreciationPostingService.ts#L213) | `ternary condition literal` | Az eszköz már teljesen leíródott | **— (Prevesti na HR)** |
| [depreciationPostingService.ts:L268](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/lib/fixed-assets/depreciationPostingService.ts#L268) | `ternary condition literal` | Már teljesen leíródott | **— (Prevesti na HR)** |
| [depreciationPostingService.ts:L478](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/lib/fixed-assets/depreciationPostingService.ts#L478) | `ternary condition literal` | Hiányzó 571-es költségszámla a számlatükörben | **— (Prevesti na HR)** |
| [depreciationPostingService.ts:L479](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/lib/fixed-assets/depreciationPostingService.ts#L479) | `ternary condition literal` | Nem található megfelelő 139/149-es halmozott ÉCS számla | **Nema podataka** |
| [depreciationPostingService.ts:L577](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/lib/fixed-assets/depreciationPostingService.ts#L577) | `ternary condition literal` | Nem található aktív Vegyes könyvelési napló a cégnél. | **Nema podataka** |
| [depreciationPostingService.ts:L593](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/lib/fixed-assets/depreciationPostingService.ts#L593) | `ternary condition literal` | AUTOMATIKUS | **— (Prevesti na HR)** |
| [depreciationPostingService.ts:L669](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/lib/fixed-assets/depreciationPostingService.ts#L669) | `ternary condition literal` | Napló sorok mentési hiba: ${linesErr.message} | **— (Prevesti na HR)** |
| [developmentReserveAutoPoster.ts:L82](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/lib/fixed-assets/developmentReserveAutoPoster.ts#L82) | `ternary condition literal` | Nincs érvényes fejlesztési tartalék összeg. | **— (Prevesti na HR)** |
| [developmentReserveAutoPoster.ts:L98](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/lib/fixed-assets/developmentReserveAutoPoster.ts#L98) | `ternary condition literal` | Nem található Vegyes könyvelési napló a cégnél. | **Nema podataka** |
| [developmentReserveAutoPoster.ts:L114](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/lib/fixed-assets/developmentReserveAutoPoster.ts#L114) | `ternary condition literal` | — ${reserveYear}. évi keretből | **— (Prevesti na HR)** |
| [developmentReserveAutoPoster.ts:L136](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/lib/fixed-assets/developmentReserveAutoPoster.ts#L136) | `ternary condition literal` | AUTOMATIKUS | **— (Prevesti na HR)** |
| [developmentReserveAutoPoster.ts:L150](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/lib/fixed-assets/developmentReserveAutoPoster.ts#L150) | `ternary condition literal` | Napló fejléc hiba: ${headerErr?.message} | **— (Prevesti na HR)** |
| [developmentReserveAutoPoster.ts:L172](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/lib/fixed-assets/developmentReserveAutoPoster.ts#L172) | `ternary condition literal` | Lekötött tartalék feloldása (414) — ${assetName} | **— (Prevesti na HR)** |
| [developmentReserveAutoPoster.ts:L180](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/lib/fixed-assets/developmentReserveAutoPoster.ts#L180) | `ternary condition literal` | Eredménytartalékba visszavezetés (413) — ${assetName} | **— (Prevesti na HR)** |
| [developmentReserveAutoPoster.ts:L186](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/lib/fixed-assets/developmentReserveAutoPoster.ts#L186) | `ternary condition literal` | Napló sorok hiba: ${linesErr?.message} | **— (Prevesti na HR)** |
| [EmployeeRegister.tsx:L89](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/EmployeeRegister.tsx#L89) | `ternary condition literal` | A jelszavak nem egyeznek | **— (Prevesti na HR)** |
| [EmployeeRegister.tsx:L90](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/EmployeeRegister.tsx#L90) | `ternary condition literal` | Kérlek ellenőrizd a megadott jelszavakat. | **— (Prevesti na HR)** |
| [EmployeeRegister.tsx:L98](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/EmployeeRegister.tsx#L98) | `ternary condition literal` | Túl rövid jelszó | **— (Prevesti na HR)** |
| [EmployeeRegister.tsx:L99](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/EmployeeRegister.tsx#L99) | `ternary condition literal` | A jelszónak legalább 6 karakter hosszúnak kell lennie. | **— (Prevesti na HR)** |
| [EmployeeRegister.tsx:L162](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/EmployeeRegister.tsx#L162) | `ternary condition literal` | Regisztráció sikertelen | **— (Prevesti na HR)** |
| [EmployeeRegister.tsx:L254](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/EmployeeRegister.tsx#L254) | `ternary condition literal` | Bejelentett dolgozó | **— (Prevesti na HR)** |
| [EmployeeRegister.tsx:L255](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/EmployeeRegister.tsx#L255) | `ternary condition literal` | Alvállalkozó | **— (Prevesti na HR)** |


---

## 🖥️ 4. Felületi Kezelőszervek, Gombok, Fejlécek és Mezők (JSX & Props)

| Forrás és sorszám | Elem | Megjelenő magyar szöveg | Javasolt horvát (HR) fordítás |
| :--- | :--- | :--- | :--- |
| [TenyImportModal.tsx:L492](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/ev/TenyImportModal.tsx#L492) | `JSX node text` | Lineáris | **— (Prevesti na HR)** |
| [TenyImportModal.tsx:L493](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/ev/TenyImportModal.tsx#L493) | `JSX node text` | Degresszív (Nettó) | **— (Prevesti na HR)** |
| [TenyImportModal.tsx:L494](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/ev/TenyImportModal.tsx#L494) | `JSX node text` | Degresszív (Évek) | **— (Prevesti na HR)** |
| [TenyImportModal.tsx:L495](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/ev/TenyImportModal.tsx#L495) | `JSX node text` | Progresszív | **— (Prevesti na HR)** |
| [TenyImportModal.tsx:L496](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/ev/TenyImportModal.tsx#L496) | `JSX node text` | Teljesítmény | **— (Prevesti na HR)** |
| [TenyImportModal.tsx:L497](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/ev/TenyImportModal.tsx#L497) | `JSX node text` | Szorzószámos | **— (Prevesti na HR)** |
| [TenyImportModal.tsx:L498](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/ev/TenyImportModal.tsx#L498) | `JSX node text` | Abszolút | **— (Prevesti na HR)** |
| [AssetDetailPanel.tsx:L345](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/AssetDetailPanel.tsx#L345) | `JSX node text` | Fejlesztési tartalék | **— (Prevesti na HR)** |
| [AssetDetailPanel.tsx:L368](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/AssetDetailPanel.tsx#L368) | `JSX node text` | Nincs hozzárendelve | **— (Prevesti na HR)** |
| [CreateFixedAssetDialog.tsx:L537](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/CreateFixedAssetDialog.tsx#L537) | `JSX node text` | Lineáris (Egyenletes) | **— (Prevesti na HR)** |
| [CreateFixedAssetDialog.tsx:L538](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/CreateFixedAssetDialog.tsx#L538) | `JSX node text` | Degresszív (Évek száma összege) | **— (Prevesti na HR)** |
| [CreateFixedAssetDialog.tsx:L539](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/CreateFixedAssetDialog.tsx#L539) | `JSX node text` | Degresszív (Nettó érték alapú) | **— (Prevesti na HR)** |
| [CreateFixedAssetDialog.tsx:L540](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/CreateFixedAssetDialog.tsx#L540) | `JSX node text` | Progresszív (Növekvő) | **— (Prevesti na HR)** |
| [CreateFixedAssetDialog.tsx:L541](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/CreateFixedAssetDialog.tsx#L541) | `JSX node text` | Teljesítményarányos | **— (Prevesti na HR)** |
| [CreateFixedAssetDialog.tsx:L542](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/CreateFixedAssetDialog.tsx#L542) | `JSX node text` | Abszolút összegű | **— (Prevesti na HR)** |
| [CreateFixedAssetDialog.tsx:L543](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/CreateFixedAssetDialog.tsx#L543) | `JSX node text` | Szorzószámos | **— (Prevesti na HR)** |
| [CreateFixedAssetDialog.tsx:L544](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/CreateFixedAssetDialog.tsx#L544) | `JSX node text` | Azonnali (Kisértékű eszköz) | **— (Prevesti na HR)** |
| [CreateFixedAssetDialog.tsx:L561](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/CreateFixedAssetDialog.tsx#L561) | `JSX node text` | év | **— (Prevesti na HR)** |
| [CreateFixedAssetDialog.tsx:L573](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/CreateFixedAssetDialog.tsx#L573) | `JSX node text` | hónap | **— (Prevesti na HR)** |
| [CreateFixedAssetDialog.tsx:L592](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/CreateFixedAssetDialog.tsx#L592) | `JSX node text` | Mértékegység (pl. km, üzemóra, db) | **— (Prevesti na HR)** |
| [CreateFixedAssetDialog.tsx:L601](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/CreateFixedAssetDialog.tsx#L601) | `JSX node text` | Tervezett összteljesítmény | **— (Prevesti na HR)** |
| [CreateFixedAssetDialog.tsx:L638](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/CreateFixedAssetDialog.tsx#L638) | `JSX node text` | Nincs TAO sablon hozzárendelve | **— (Prevesti na HR)** |
| [CreateFixedAssetDialog.tsx:L655](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/CreateFixedAssetDialog.tsx#L655) | `JSX node text` | Nincs főkönyvi számla kiválasztva | **— (Prevesti na HR)** |
| [CreateFixedAssetDialog.tsx:L681](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/CreateFixedAssetDialog.tsx#L681) | `JSX node text` | Nincs megadva telephely | **— (Prevesti na HR)** |
| [CreateFixedAssetDialog.tsx:L698](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/CreateFixedAssetDialog.tsx#L698) | `JSX node text` | Nincs projekthez rendelve | **— (Prevesti na HR)** |
| [CreateFixedAssetDialog.tsx:L739](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/CreateFixedAssetDialog.tsx#L739) | `JSX node text` | Fejlesztési Tartalék Keret | **— (Prevesti na HR)** |
| [CreateFixedAssetDialog.tsx:L754](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/CreateFixedAssetDialog.tsx#L754) | `JSX node text` | Felhasznált összeg (Ft) | **— (Prevesti na HR)** |
| [DepreciationCards.tsx:L66](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DepreciationCards.tsx#L66) | `JSX node text` | Számviteli ÉCS | **— (Prevesti na HR)** |
| [DepreciationCards.tsx:L69](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DepreciationCards.tsx#L69) | `JSX node text` | Élettartam: | **— (Prevesti na HR)** |
| [DepreciationCards.tsx:L73](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DepreciationCards.tsx#L73) | `JSX node text` | Módszer: | **— (Prevesti na HR)** |
| [DepreciationCards.tsx:L78](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DepreciationCards.tsx#L78) | `JSX node text` | Mértékegység: | **— (Prevesti na HR)** |
| [DepreciationCards.tsx:L83](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DepreciationCards.tsx#L83) | `JSX node text` | Maradványérték: | **— (Prevesti na HR)** |
| [DepreciationCards.tsx:L87](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DepreciationCards.tsx#L87) | `JSX node text` | ÉCS Kulcs: | **— (Prevesti na HR)** |
| [DepreciationCards.tsx:L92](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DepreciationCards.tsx#L92) | `JSX node text` | Könyvsz. Érték: | **— (Prevesti na HR)** |
| [DepreciationCards.tsx:L101](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DepreciationCards.tsx#L101) | `JSX node text` | Tao ÉCS | **— (Prevesti na HR)** |
| [DepreciationCards.tsx:L122](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DepreciationCards.tsx#L122) | `JSX node text` | Felhasznált tartalék: | **— (Prevesti na HR)** |
| [DepreciationCards.tsx:L126](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DepreciationCards.tsx#L126) | `JSX node text` | Tao ÉCS alap: | **— (Prevesti na HR)** |
| [DepreciationCards.tsx:L133](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DepreciationCards.tsx#L133) | `JSX node text` | Tao Érték: | **— (Prevesti na HR)** |
| [DepreciationRunDialog.tsx:L245](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DepreciationRunDialog.tsx#L245) | `JSX node text` | Időszak gyakorisága | **— (Prevesti na HR)** |
| [DepreciationRunDialog.tsx:L254](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DepreciationRunDialog.tsx#L254) | `JSX node text` | Havi (Ajánlott) | **— (Prevesti na HR)** |
| [DepreciationRunDialog.tsx:L255](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DepreciationRunDialog.tsx#L255) | `JSX node text` | Negyedéves | **— (Prevesti na HR)** |
| [DepreciationRunDialog.tsx:L256](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DepreciationRunDialog.tsx#L256) | `JSX node text` | Éves (Zárás) | **— (Prevesti na HR)** |
| [DepreciationRunDialog.tsx:L257](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DepreciationRunDialog.tsx#L257) | `JSX node text` | Egyedi dátumtartomány | **— (Prevesti na HR)** |
| [DepreciationRunDialog.tsx:L266](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DepreciationRunDialog.tsx#L266) | `JSX node text` | Év | **— (Prevesti na HR)** |
| [DepreciationRunDialog.tsx:L284](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DepreciationRunDialog.tsx#L284) | `JSX node text` | Hónap | **— (Prevesti na HR)** |
| [DepreciationRunDialog.tsx:L325](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DepreciationRunDialog.tsx#L325) | `JSX node text` | Negyedév | **— (Prevesti na HR)** |
| [DepreciationRunDialog.tsx:L334](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DepreciationRunDialog.tsx#L334) | `JSX node text` | I. negyedév (Jan - Mác) | **— (Prevesti na HR)** |
| [DepreciationRunDialog.tsx:L335](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DepreciationRunDialog.tsx#L335) | `JSX node text` | II. negyedév (Ápr - Jún) | **— (Prevesti na HR)** |
| [DepreciationRunDialog.tsx:L336](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DepreciationRunDialog.tsx#L336) | `JSX node text` | III. negyedév (Júl - Szep) | **— (Prevesti na HR)** |
| [DepreciationRunDialog.tsx:L337](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DepreciationRunDialog.tsx#L337) | `JSX node text` | IV. negyedév (Okt - Dec) | **— (Prevesti na HR)** |
| [DepreciationRunDialog.tsx:L346](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DepreciationRunDialog.tsx#L346) | `JSX node text` | Üzleti Év | **— (Prevesti na HR)** |
| [DepreciationRunDialog.tsx:L368](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DepreciationRunDialog.tsx#L368) | `JSX node text` | Kezdő dátum | **— (Prevesti na HR)** |
| [DepreciationRunDialog.tsx:L377](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DepreciationRunDialog.tsx#L377) | `JSX node text` | Záró dátum | **— (Prevesti na HR)** |
| [DepreciationRunDialog.tsx:L390](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DepreciationRunDialog.tsx#L390) | `JSX node text` | Bizonylatszám | **— (Prevesti na HR)** |
| [DepreciationRunDialog.tsx:L405](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DepreciationRunDialog.tsx#L405) | `JSX node text` | Már lekönyvelt időszak! | **— (Prevesti na HR)** |
| [DepreciationRunDialog.tsx:L418](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DepreciationRunDialog.tsx#L418) | `JSX node text` | Összes elszámolandó ÉCS | **— (Prevesti na HR)** |
| [DepreciationRunDialog.tsx:L428](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DepreciationRunDialog.tsx#L428) | `JSX node text` | Érintett aktív eszközök | **— (Prevesti na HR)** |
| [DepreciationRunDialog.tsx:L438](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DepreciationRunDialog.tsx#L438) | `JSX node text` | Könyvelési cél-napló | **— (Prevesti na HR)** |
| [DepreciationRunDialog.tsx:L470](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DepreciationRunDialog.tsx#L470) | `JSX node text` | ÉCS kalkuláció betöltése... | **— (Prevesti na HR)** |
| [DepreciationRunDialog.tsx:L480](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DepreciationRunDialog.tsx#L480) | `JSX node text` | Leltári szám | **— (Prevesti na HR)** |
| [DepreciationRunDialog.tsx:L481](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DepreciationRunDialog.tsx#L481) | `JSX node text` | Eszköz megnevezése | **— (Prevesti na HR)** |
| [DepreciationRunDialog.tsx:L482](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DepreciationRunDialog.tsx#L482) | `JSX node text` | Bekerülési érték | **— (Prevesti na HR)** |
| [DepreciationRunDialog.tsx:L483](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DepreciationRunDialog.tsx#L483) | `JSX node text` | Időszak | **— (Prevesti na HR)** |
| [DepreciationRunDialog.tsx:L484](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DepreciationRunDialog.tsx#L484) | `JSX node text` | Időszaki ÉCS | **— (Prevesti na HR)** |
| [DepreciationRunDialog.tsx:L485](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DepreciationRunDialog.tsx#L485) | `JSX node text` | Maradványérték | **— (Prevesti na HR)** |
| [DepreciationRunDialog.tsx:L486](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DepreciationRunDialog.tsx#L486) | `JSX node text` | Főkönyv (T / K) | **— (Prevesti na HR)** |
| [DepreciationRunDialog.tsx:L487](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DepreciationRunDialog.tsx#L487) | `JSX node text` | Státusz | **— (Prevesti na HR)** |
| [DepreciationRunDialog.tsx:L552](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DepreciationRunDialog.tsx#L552) | `JSX node text` | Kettős könyvviteli Vegyes napló tétel | **— (Prevesti na HR)** |
| [DevelopmentReserveAssignDialog.tsx:L124](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DevelopmentReserveAssignDialog.tsx#L124) | `JSX node text` | Fejlesztési Tartalék Hozzárendelése | **— (Prevesti na HR)** |
| [DevelopmentReserveAssignDialog.tsx:L135](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DevelopmentReserveAssignDialog.tsx#L135) | `JSX node text` | Bekerülési (bruttó) érték: | **— (Prevesti na HR)** |
| [DevelopmentReserveAssignDialog.tsx:L139](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DevelopmentReserveAssignDialog.tsx#L139) | `JSX node text` | Aktiválás dátuma: | **— (Prevesti na HR)** |
| [DevelopmentReserveAssignDialog.tsx:L155](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DevelopmentReserveAssignDialog.tsx#L155) | `JSX node text` | Nincs fejlesztési tartalék hozzárendelés | **— (Prevesti na HR)** |
| [DevelopmentReserveAssignDialog.tsx:L218](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DevelopmentReserveAssignDialog.tsx#L218) | `JSX node text` | Számviteli ÉCS alap: | **— (Prevesti na HR)** |
| [DevelopmentReserveAssignDialog.tsx:L224](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DevelopmentReserveAssignDialog.tsx#L224) | `JSX node text` | Tartalék levonás: | **— (Prevesti na HR)** |
| [DevelopmentReserveAssignDialog.tsx:L230](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DevelopmentReserveAssignDialog.tsx#L230) | `JSX node text` | Módosított Tao ÉCS alap: | **— (Prevesti na HR)** |
| [DevelopmentReservesTab.tsx:L255](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DevelopmentReservesTab.tsx#L255) | `JSX node text` | Nincs megjeleníthető fejlesztési tartalék | **— (Prevesti na HR)** |
| [DevelopmentReservesTab.tsx:L256](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DevelopmentReservesTab.tsx#L256) | `JSX node text` | Rögzítsen egy új tartalék keretet a fenti gombra kattintva. | **— (Prevesti na HR)** |
| [DevelopmentReservesTab.tsx:L262](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DevelopmentReservesTab.tsx#L262) | `JSX node text` | Képzés Éve | **— (Prevesti na HR)** |
| [DevelopmentReservesTab.tsx:L263](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DevelopmentReservesTab.tsx#L263) | `JSX node text` | Képzett Keret (Ft) | **— (Prevesti na HR)** |
| [DevelopmentReservesTab.tsx:L264](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DevelopmentReservesTab.tsx#L264) | `JSX node text` | Felhasználtság | **— (Prevesti na HR)** |
| [DevelopmentReservesTab.tsx:L266](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DevelopmentReservesTab.tsx#L266) | `JSX node text` | Lejárat | **— (Prevesti na HR)** |
| [DevelopmentReservesTab.tsx:L267](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DevelopmentReservesTab.tsx#L267) | `JSX node text` | Státusz | **— (Prevesti na HR)** |
| [DevelopmentReservesTab.tsx:L268](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DevelopmentReservesTab.tsx#L268) | `JSX node text` | Megjegyzés | **— (Prevesti na HR)** |
| [DevelopmentReservesTab.tsx:L269](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DevelopmentReservesTab.tsx#L269) | `JSX node text` | Művelet | **— (Prevesti na HR)** |
| [DevelopmentReservesTab.tsx:L336](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DevelopmentReservesTab.tsx#L336) | `JSX node text` | Új Fejlesztési Tartalék Rögzítése | **— (Prevesti na HR)** |
| [DevelopmentReservesTab.tsx:L357](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DevelopmentReservesTab.tsx#L357) | `JSX node text` | Felhasználási Határidő | **— (Prevesti na HR)** |
| [DevelopmentReservesTab.tsx:L368](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DevelopmentReservesTab.tsx#L368) | `JSX node text` | Képzett Összeg (Ft) | **— (Prevesti na HR)** |
| [DevelopmentReservesTab.tsx:L382](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DevelopmentReservesTab.tsx#L382) | `JSX node text` | Megjegyzés / Határozat száma | **— (Prevesti na HR)** |
| [DevelopmentReservesTab.tsx:L394](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DevelopmentReservesTab.tsx#L394) | `JSX node text` | Fontos törvényi szabály: | **— (Prevesti na HR)** |
| [InventoryCheckDialog.tsx:L182](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/InventoryCheckDialog.tsx#L182) | `JSX node text` | Leltári Szám | **— (Prevesti na HR)** |
| [InventoryCheckDialog.tsx:L183](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/InventoryCheckDialog.tsx#L183) | `JSX node text` | Megnevezés | **— (Prevesti na HR)** |
| [InventoryCheckDialog.tsx:L184](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/InventoryCheckDialog.tsx#L184) | `JSX node text` | Helyszín | **— (Prevesti na HR)** |
| [InventoryCheckDialog.tsx:L185](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/InventoryCheckDialog.tsx#L185) | `JSX node text` | Státusz | **— (Prevesti na HR)** |
| [InventoryCheckDialog.tsx:L222](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/InventoryCheckDialog.tsx#L222) | `JSX node text` | Mégse | **Odustani** |
| [EmployeeRatesPanel.tsx:L58](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/working-time/EmployeeRatesPanel.tsx#L58) | `JSX node text` | Nincsenek dolgozók | **— (Prevesti na HR)** |
| [LeavePanel.tsx:L113](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/working-time/LeavePanel.tsx#L113) | `JSX node text` | Új távolléti kérelem | **— (Prevesti na HR)** |
| [SalaryLinkCard.tsx:L203](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/working-time/SalaryLinkCard.tsx#L203) | `JSX node text` | Bér | **Plaća** |
| [SalaryLinkCard.tsx:L209](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/working-time/SalaryLinkCard.tsx#L209) | `JSX node text` | Adó | **— (Prevesti na HR)** |
| [SalaryLinkCard.tsx:L215](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/working-time/SalaryLinkCard.tsx#L215) | `JSX node text` | Járulék | **— (Prevesti na HR)** |
| [SalaryLinkCard.tsx:L233](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/working-time/SalaryLinkCard.tsx#L233) | `JSX node text` | Teljes bérköltség (Ft/hó) | **— (Prevesti na HR)** |
| [SalaryLinkCard.tsx:L244](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/working-time/SalaryLinkCard.tsx#L244) | `JSX node text` | Havi munkaórák: | **— (Prevesti na HR)** |
| [SalaryLinkCard.tsx:L248](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/working-time/SalaryLinkCard.tsx#L248) | `JSX node text` | Számított óradíj: | **— (Prevesti na HR)** |
| [SubmittedEntriesPanel.tsx:L251](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/working-time/SubmittedEntriesPanel.tsx#L251) | `JSX node text` | Nincs leadott bejegyzés | **— (Prevesti na HR)** |
| [TimeEntryForm.tsx:L76](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/working-time/TimeEntryForm.tsx#L76) | `JSX node text` | Új bejegyzés | **— (Prevesti na HR)** |
| [TimesheetTable.tsx:L112](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/working-time/TimesheetTable.tsx#L112) | `JSX node text` | Nincs bejegyzés | **— (Prevesti na HR)** |
| [TimesheetTable.tsx:L142](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/working-time/TimesheetTable.tsx#L142) | `JSX node text` | Dolgozó | **— (Prevesti na HR)** |
| [TimesheetTable.tsx:L144](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/working-time/TimesheetTable.tsx#L144) | `JSX node text` | Vége | **— (Prevesti na HR)** |
| [TimesheetTable.tsx:L145](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/working-time/TimesheetTable.tsx#L145) | `JSX node text` | Órák | **— (Prevesti na HR)** |
| [TimesheetTable.tsx:L146](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/working-time/TimesheetTable.tsx#L146) | `JSX node text` | Projekt | **Projekt** |
| [TimesheetTable.tsx:L147](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/working-time/TimesheetTable.tsx#L147) | `JSX node text` | Megjegyzés | **— (Prevesti na HR)** |
| [TimesheetTable.tsx:L148](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/working-time/TimesheetTable.tsx#L148) | `JSX node text` | Státusz | **— (Prevesti na HR)** |
| [TimesheetTable.tsx:L149](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/working-time/TimesheetTable.tsx#L149) | `JSX node text` | Jóváhagyva | **Odobreno** |
| [TimesheetTable.tsx:L210](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/working-time/TimesheetTable.tsx#L210) | `JSX node text` | Szabadság | **— (Prevesti na HR)** |
| [TimesheetTable.tsx:L238](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/working-time/TimesheetTable.tsx#L238) | `JSX node text` | Összesen | **Ukupno** |
| [WeeklyTimesheetView.tsx:L383](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/working-time/WeeklyTimesheetView.tsx#L383) | `JSX node text` | Szabadság | **— (Prevesti na HR)** |
| [EmployeeRegister.tsx:L200](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/EmployeeRegister.tsx#L200) | `JSX node text` | Link ellenőrzése... | **— (Prevesti na HR)** |
| [EmployeeRegister.tsx:L212](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/EmployeeRegister.tsx#L212) | `JSX node text` | Érvénytelen link | **— (Prevesti na HR)** |
| [EmployeeRegister.tsx:L381](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/EmployeeRegister.tsx#L381) | `JSX node text` | Sikeres regisztráció! | **— (Prevesti na HR)** |
| [TenyImportModal.tsx:L374](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/ev/TenyImportModal.tsx#L374) | `prop:placeholder` | Keresés eszköznév vagy leltári szám alapján... | **— (Prevesti na HR)** |
| [TenyImportModal.tsx:L470](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/ev/TenyImportModal.tsx#L470) | `prop:title` | Manuálisan módosított érték | **— (Prevesti na HR)** |
| [TenyImportModal.tsx:L477](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/ev/TenyImportModal.tsx#L477) | `prop:title` | Figyelem: 200 000 Ft feletti értékű eszköz nem írható le azonnal 100%-ban! | **— (Prevesti na HR)** |
| [TenyImportModal.tsx:L512](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/ev/TenyImportModal.tsx#L512) | `prop:placeholder` | Összeg | **Iznos** |
| [AssetDetailPanel.tsx:L685](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/AssetDetailPanel.tsx#L685) | `prop:title` | Törlés | **Obriši** |
| [CreateFixedAssetDialog.tsx:L304](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/CreateFixedAssetDialog.tsx#L304) | `prop:placeholder` | pl. Dell Latitude 5540, Raktári emelőgép... | **— (Prevesti na HR)** |
| [CreateFixedAssetDialog.tsx:L322](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/CreateFixedAssetDialog.tsx#L322) | `prop:title` | Következő leltári szám automatikus generálása | **— (Prevesti na HR)** |
| [CreateFixedAssetDialog.tsx:L467](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/CreateFixedAssetDialog.tsx#L467) | `prop:placeholder` | pl. Alza.hu Kft., Használt gép eladó... | **— (Prevesti na HR)** |
| [CreateFixedAssetDialog.tsx:L635](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/CreateFixedAssetDialog.tsx#L635) | `prop:placeholder` | Válassz TAO kulcsot... | **— (Prevesti na HR)** |
| [CreateFixedAssetDialog.tsx:L652](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/CreateFixedAssetDialog.tsx#L652) | `prop:placeholder` | Válassz főkönyvi számlát... | **— (Prevesti na HR)** |
| [CreateFixedAssetDialog.tsx:L678](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/CreateFixedAssetDialog.tsx#L678) | `prop:placeholder` | Válassz telephelyet... | **— (Prevesti na HR)** |
| [CreateFixedAssetDialog.tsx:L695](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/CreateFixedAssetDialog.tsx#L695) | `prop:placeholder` | Válassz projektet... | **— (Prevesti na HR)** |
| [DepreciationRunDialog.tsx:L454](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DepreciationRunDialog.tsx#L454) | `prop:placeholder` | Szűrés eszközre vagy leltári számra... | **— (Prevesti na HR)** |
| [DevelopmentReservesTab.tsx:L212](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DevelopmentReservesTab.tsx#L212) | `prop:placeholder` | Keresés év vagy megjegyzés... | **— (Prevesti na HR)** |
| [DevelopmentReservesTab.tsx:L385](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/DevelopmentReservesTab.tsx#L385) | `prop:placeholder` | pl. 2023. évi taggyűlési határozat szerinti tartalék | **— (Prevesti na HR)** |
| [InventoryCheckDialog.tsx:L167](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/InventoryCheckDialog.tsx#L167) | `prop:placeholder` | Keresés leltári szám, név vagy helyszín alapján... | **— (Prevesti na HR)** |
| [LeavePanel.tsx:L161](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/working-time/LeavePanel.tsx#L161) | `prop:placeholder` | Megjegyzés (opcionális) | **— (Prevesti na HR)** |
| [TimeEntryForm.tsx:L135](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/working-time/TimeEntryForm.tsx#L135) | `prop:placeholder` | Válassz projektet... | **— (Prevesti na HR)** |
| [TimeEntryForm.tsx:L187](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/working-time/TimeEntryForm.tsx#L187) | `prop:placeholder` | Mit csináltál... | **— (Prevesti na HR)** |
| [EmployeeRegister.tsx:L293](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/EmployeeRegister.tsx#L293) | `prop:placeholder` | Legalább 6 karakter | **— (Prevesti na HR)** |
| [EmployeeRegister.tsx:L316](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/EmployeeRegister.tsx#L316) | `prop:placeholder` | Jelszó ismét | **— (Prevesti na HR)** |


---

## 🔑 5. Hiányzó vagy Nem Szinkronizált i18n Szótárkulcsok

| Forrás és sorszám | Elem | Megjelenő magyar szöveg | Javasolt horvát (HR) fordítás |
| :--- | :--- | :--- | :--- |
| [AssetListTable.tsx:L77](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/AssetListTable.tsx#L77) | `t('hr:fixed_assets.create_asset_btn') missing in hr/hr.json` | Új eszköz felvétele | **— (Prevesti na HR)** |
| [CreateFixedAssetDialog.tsx:L172](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/CreateFixedAssetDialog.tsx#L172) | `t('hr:fixed_assets.create_dialog.validation_name') missing in hr/hr.json` | Az eszköz megnevezése kötelező. | **— (Prevesti na HR)** |
| [CreateFixedAssetDialog.tsx:L181](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/CreateFixedAssetDialog.tsx#L181) | `t('hr:fixed_assets.create_dialog.validation_inventory_number') missing in hr/hr.json` | A leltári szám megadása kötelező. | **— (Prevesti na HR)** |
| [CreateFixedAssetDialog.tsx:L190](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/CreateFixedAssetDialog.tsx#L190) | `t('hr:fixed_assets.create_dialog.validation_value') missing in hr/hr.json` | A bekerülési értéknek nagyobbnak kell lennie nullánál. | **— (Prevesti na HR)** |
| [CreateFixedAssetDialog.tsx:L200](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/CreateFixedAssetDialog.tsx#L200) | `t('hr:fixed_assets.create_dialog.validation_life') missing in hr/hr.json` | Adjon meg érvényes hasznos élettartamot (vagy válasszon Azonnali leírást). | **— (Prevesti na HR)** |
| [CreateFixedAssetDialog.tsx:L247](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/CreateFixedAssetDialog.tsx#L247) | `t('hr:fixed_assets.create_dialog.success_opening') missing in hr/hr.json` | Nyitó / előzmény tárgyi eszköz sikeresen rögzítve. | **— (Prevesti na HR)** |
| [CreateFixedAssetDialog.tsx:L248](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/CreateFixedAssetDialog.tsx#L248) | `t('hr:fixed_assets.create_dialog.success_new') missing in hr/hr.json` | Új tárgyi eszköz sikeresen aktiválva. | **— (Prevesti na HR)** |
| [CreateFixedAssetDialog.tsx:L263](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/CreateFixedAssetDialog.tsx#L263) | `t('hr:fixed_assets.create_dialog.error') missing in hr/hr.json` | Hiba történt az eszköz mentése során. | **Došlo je do greške** |
| [CreateFixedAssetDialog.tsx:L278](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/CreateFixedAssetDialog.tsx#L278) | `t('hr:fixed_assets.create_dialog.title') missing in hr/hr.json` | Új tárgyi eszköz felvétele | **— (Prevesti na HR)** |
| [CreateFixedAssetDialog.tsx:L292](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/CreateFixedAssetDialog.tsx#L292) | `t('hr:fixed_assets.create_dialog.section_general') missing in hr/hr.json` | Eszköz Azonosítása | **— (Prevesti na HR)** |
| [CreateFixedAssetDialog.tsx:L298](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/CreateFixedAssetDialog.tsx#L298) | `t('hr:fixed_assets.create_dialog.name') missing in hr/hr.json` | Megnevezés | **— (Prevesti na HR)** |
| [CreateFixedAssetDialog.tsx:L312](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/CreateFixedAssetDialog.tsx#L312) | `t('hr:fixed_assets.create_dialog.inventory_number') missing in hr/hr.json` | Leltári szám | **— (Prevesti na HR)** |
| [CreateFixedAssetDialog.tsx:L325](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/CreateFixedAssetDialog.tsx#L325) | `t('common:actions.regenerate') missing in hr/common.json` | Auto-generálás | **— (Prevesti na HR)** |
| [CreateFixedAssetDialog.tsx:L342](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/CreateFixedAssetDialog.tsx#L342) | `t('hr:fixed_assets.create_dialog.vtsz') missing in hr/hr.json` | VTSZ / TESZOR / KSH besorolás | **— (Prevesti na HR)** |
| [CreateFixedAssetDialog.tsx:L354](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/CreateFixedAssetDialog.tsx#L354) | `t('hr:fixed_assets.create_dialog.specs') missing in hr/hr.json` | Gyári szám / Műszaki paraméterek | **— (Prevesti na HR)** |
| [CreateFixedAssetDialog.tsx:L369](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/CreateFixedAssetDialog.tsx#L369) | `t('hr:fixed_assets.create_dialog.section_valuation') missing in hr/hr.json` | Bekerülési Érték és Időpontok | **— (Prevesti na HR)** |
| [CreateFixedAssetDialog.tsx:L375](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/CreateFixedAssetDialog.tsx#L375) | `t('hr:fixed_assets.create_dialog.acquisition_value') missing in hr/hr.json` | Bekerülési (bruttó) érték | **— (Prevesti na HR)** |
| [CreateFixedAssetDialog.tsx:L413](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/CreateFixedAssetDialog.tsx#L413) | `t('hr:fixed_assets.create_dialog.residual_value') missing in hr/hr.json` | Tervezett maradványérték (Ft) | **— (Prevesti na HR)** |
| [CreateFixedAssetDialog.tsx:L431](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/CreateFixedAssetDialog.tsx#L431) | `t('hr:fixed_assets.create_dialog.purchase_date') missing in hr/hr.json` | Beszerzés / Vásárlás dátuma | **— (Prevesti na HR)** |
| [CreateFixedAssetDialog.tsx:L445](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/CreateFixedAssetDialog.tsx#L445) | `t('hr:fixed_assets.create_dialog.activation_date') missing in hr/hr.json` | Aktiválás / Használatbavétel dátuma | **— (Prevesti na HR)** |
| [CreateFixedAssetDialog.tsx:L461](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/CreateFixedAssetDialog.tsx#L461) | `t('hr:fixed_assets.create_dialog.supplier') missing in hr/hr.json` | Beszállító / Eladó partner | **— (Prevesti na HR)** |
| [CreateFixedAssetDialog.tsx:L473](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/CreateFixedAssetDialog.tsx#L473) | `t('hr:fixed_assets.create_dialog.invoice_number') missing in hr/hr.json` | Eredeti számlaszám / Szerződésszám | **— (Prevesti na HR)** |
| [CreateFixedAssetDialog.tsx:L499](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/CreateFixedAssetDialog.tsx#L499) | `t('hr:fixed_assets.create_dialog.is_opening_label') missing in hr/hr.json` | Előzmény / nyitó eszköz (már szerepel a nyitó mérlegben) | **— (Prevesti na HR)** |
| [CreateFixedAssetDialog.tsx:L526](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/CreateFixedAssetDialog.tsx#L526) | `t('hr:fixed_assets.create_dialog.section_depreciation') missing in hr/hr.json` | Értékcsökkenés és Leírás | **— (Prevesti na HR)** |
| [CreateFixedAssetDialog.tsx:L531](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/CreateFixedAssetDialog.tsx#L531) | `t('hr:fixed_assets.create_dialog.depreciation_method') missing in hr/hr.json` | Leírási módszer | **— (Prevesti na HR)** |
| [CreateFixedAssetDialog.tsx:L550](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/CreateFixedAssetDialog.tsx#L550) | `t('hr:fixed_assets.create_dialog.useful_life') missing in hr/hr.json` | Hasznos élettartam | **— (Prevesti na HR)** |
| [CreateFixedAssetDialog.tsx:L632](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/CreateFixedAssetDialog.tsx#L632) | `t('hr:fixed_assets.create_dialog.tao_template') missing in hr/hr.json` | Társasági Adó (TAO) kulcs sablon | **— (Prevesti na HR)** |
| [CreateFixedAssetDialog.tsx:L649](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/CreateFixedAssetDialog.tsx#L649) | `t('hr:fixed_assets.create_dialog.gl_account') missing in hr/hr.json` | Főkönyvi Számlaszám (1xx Befektetett) | **— (Prevesti na HR)** |
| [CreateFixedAssetDialog.tsx:L670](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/CreateFixedAssetDialog.tsx#L670) | `t('hr:fixed_assets.create_dialog.section_org') missing in hr/hr.json` | Helyszín és Projekt Hozzárendelés | **— (Prevesti na HR)** |
| [CreateFixedAssetDialog.tsx:L675](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/CreateFixedAssetDialog.tsx#L675) | `t('hr:fixed_assets.create_dialog.location') missing in hr/hr.json` | Telephely / Helyszín | **— (Prevesti na HR)** |
| [CreateFixedAssetDialog.tsx:L692](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/CreateFixedAssetDialog.tsx#L692) | `t('hr:fixed_assets.create_dialog.project') missing in hr/hr.json` | Projekt | **Projekt** |
| [EmployeeAccordion.tsx:L145](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/salaries/EmployeeAccordion.tsx#L145) | `t('hr:salaries.breakdown.empty') missing in hr/hr.json` | Nincs dolgozói adat a kiválasztott időszakban | **— (Prevesti na HR)** |
| [FixedAssetsPage.tsx:L152](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/FixedAssetsPage.tsx#L152) | `t('hr:fixed_assets.create_asset') missing in hr/hr.json` | Új eszköz felvétele | **— (Prevesti na HR)** |
| [FixedAssetsPage.tsx:L163](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/FixedAssetsPage.tsx#L163) | `t('hr:fixed_assets.depreciation_run') missing in hr/hr.json` | ÉCS elszámolás | **— (Prevesti na HR)** |
| [SalariesPage.tsx:L133](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/SalariesPage.tsx#L133) | `t('common:no_permission') missing in hr/common.json` | Nincs írási jogosultságod | **— (Prevesti na HR)** |


---

## 🚀 6. Moduláris Javítási Javaslat

1. A modulban szereplő hardkódolt feliratokat ki kell szervezni a `src/locales/hu/hr.json` és `src/locales/hr/hr.json` fájlokba.
2. A `toast({{ title: '...', description: '...' }})` hívásoknál kötelező bevezetni a `t('{ns}:toasts.title')` és `t('{ns}:toasts.desc')` formátumot.
3. A táblázatokban és badge-ekben szereplő hardkódolt magyar string literálokat (`'Fizetve'`, `'Függőben'`) fel kell váltani a központi állapotfordító segédfüggvénnyel vagy szótári kulccsal.
