# 02. Pénzügy, Könyvelés és GL — HR Lokalizációs Leltár

**Modul hatóköre:** Főkönyvi kivonat, karton nézet, naplófőkönyv, analitika és folyószámla, vegyes és nyitó naplók, nyitó varázsló, könyvelési szabályok, Mérleg, Eredménykimutatás, Éves beszámoló és Horvát ÁFA (Obrazac PDV, ePorezna XML).  
**Összes érintett fájl:** 95 db  
**Összes feltárt hiányosság:** 1861 db  
**Elsődleges i18n névtér:** `accounting` (továbbá `common`)

---

## 📈 1. Modul Statisztika és Hotspotok

### Kategóriák szerinti megoszlás
| Elem típusa | Előfordulás | Súlyosság / Hatás |
| :--- | :---: | :--- |
| **Értesítési ablakok (Toast)** | 128 db | Magas (P1) — Művelet-visszajelzés a felhasználónak |
| **Modálok és megerősítések (Dialog)** | 2 db | Kritikus (P0/P1) — Űrlapok és felugró ablakok |
| **Státusz jelvények (Badge)** | 4 db | Magas (P1) — Bizonylat- és tranzakció állapotok |
| **Feltételes állapotok (Ternary)** | 842 db | Magas (P1) — Táblázatcellákban megjelenő státuszok |
| **Táblázat oszlopok és menüpontok** | 153 db | Közepes (P2) — Adatstruktúra fejlécek és legördülők |
| **Űrlap súgók és helykitöltők (Props)** | 115 db | Közepes (P2) — `placeholder`, `title`, `tooltip` |
| **Közvetlen felületi szövegek (JSX)** | 518 db | Kritikus (P0) — Gombok, címkék, kártya tartalom |
| **Hiányzó szótárkulcsok (Missing HR key)** | 99 db | Magas (P1) — `t(...)` hívás ami nincs a horvát JSON-ban |


### Legtöbb lokalizációs hiányosságot tartalmazó komponensek:
- [BalanceSheet.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/BalanceSheet.tsx): **191 db** lefordítandó elem
- [OpeningJournalWizardModal.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/OpeningJournalWizardModal.tsx): **109 db** lefordítandó elem
- [ProfitAndLoss.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/ProfitAndLoss.tsx): **63 db** lefordítandó elem
- [SubledgerPage.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/SubledgerPage.tsx): **56 db** lefordítandó elem
- [Step4KiegMelleklet.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/annual-report/components/steps/Step4KiegMelleklet.tsx): **54 db** lefordítandó elem
- [JournalsPage.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/JournalsPage.tsx): **50 db** lefordítandó elem
- [CreateJournalModal.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/CreateJournalModal.tsx): **46 db** lefordítandó elem
- [VatCodeConfigTab.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/vat/VatCodeConfigTab.tsx): **45 db** lefordítandó elem

---

## 🔔 2. Értesítési Ablakok (Toasts) és Modális Megerősítések

| Forrás és sorszám | Elem | Megjelenő magyar szöveg | Javasolt horvát (HR) fordítás |
| :--- | :--- | :--- | :--- |
| [CompanyPromptRulesManager.tsx:L161](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/accounting/CompanyPromptRulesManager.tsx#L161) | `toast_title` | Szabály létrehozva | **— (Prevesti na HR)** |
| [CompanyPromptRulesManager.tsx:L161](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/accounting/CompanyPromptRulesManager.tsx#L161) | `toast_desc` | Az egyedi szabály sikeresen hozzáadva a szabálytárhoz. | **— (Prevesti na HR)** |
| [CompanyPromptRulesManager.tsx:L167](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/accounting/CompanyPromptRulesManager.tsx#L167) | `toast_title` | Hiba történt | **Došlo je do greške** |
| [CompanyPromptRulesManager.tsx:L184](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/accounting/CompanyPromptRulesManager.tsx#L184) | `toast_title` | Módosítás sikertelen | **— (Prevesti na HR)** |
| [CompanyPromptRulesManager.tsx:L199](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/accounting/CompanyPromptRulesManager.tsx#L199) | `toast_title` | Szabály törölve | **— (Prevesti na HR)** |
| [CompanyPromptRulesManager.tsx:L199](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/accounting/CompanyPromptRulesManager.tsx#L199) | `toast_desc` | A szabály eltávolítva a könyvtárból. | **— (Prevesti na HR)** |
| [CompanyPromptRulesManager.tsx:L202](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/accounting/CompanyPromptRulesManager.tsx#L202) | `toast_title` | Törlés sikertelen | **— (Prevesti na HR)** |
| [ReactivationDialog.tsx:L53](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/ReactivationDialog.tsx#L53) | `toast_title` | Hiba | **Greška** |
| [ReactivationDialog.tsx:L53](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/ReactivationDialog.tsx#L53) | `toast_desc` | Nem sikerült a ráaktiválás. | **— (Prevesti na HR)** |
| [AddGlAccountModal.tsx:L177](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/AddGlAccountModal.tsx#L177) | `toast_title` | Főkönyvi szám létrehozva | **— (Prevesti na HR)** |
| [AddGlAccountModal.tsx:L186](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/AddGlAccountModal.tsx#L186) | `toast_title` | Hiba a mentéskor | **— (Prevesti na HR)** |
| [GeneralLedgerTable.tsx:L758](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GeneralLedgerTable.tsx#L758) | `toast_title` | Hiba a mentés során | **— (Prevesti na HR)** |
| [GeneralLedgerTable.tsx:L760](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GeneralLedgerTable.tsx#L760) | `toast_title` | Sikeres módosítás | **— (Prevesti na HR)** |
| [GeneralLedgerTable.tsx:L1409](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GeneralLedgerTable.tsx#L1409) | `toast_title` | Exportálás folyamatban... | **— (Prevesti na HR)** |
| [GeneralLedgerTable.tsx:L1409](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GeneralLedgerTable.tsx#L1409) | `toast_desc` | Analitikus tételek lekérése az Excelhez. | **— (Prevesti na HR)** |
| [GeneralLedgerTable.tsx:L1563](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GeneralLedgerTable.tsx#L1563) | `toast_title` | Sikeres exportálás | **— (Prevesti na HR)** |
| [GeneralLedgerTable.tsx:L1563](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GeneralLedgerTable.tsx#L1563) | `toast_desc` | Az analitikus Excel fájl elkészült. | **— (Prevesti na HR)** |
| [GeneralLedgerTable.tsx:L1566](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GeneralLedgerTable.tsx#L1566) | `toast_title` | Exportálási hiba | **— (Prevesti na HR)** |
| [GlAnalyticReconciliationView.tsx:L176](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GlAnalyticReconciliationView.tsx#L176) | `toast_title` | Egyeztetési kontroll lefutott | **— (Prevesti na HR)** |
| [GlAnalyticReconciliationView.tsx:L176](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GlAnalyticReconciliationView.tsx#L176) | `toast_desc` | A főkönyvi számlák és analitikus nyilvántartások ellenőrzése megtörtént. | **— (Prevesti na HR)** |
| [AddManualJournalEntryModal.tsx:L593](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/AddManualJournalEntryModal.tsx#L593) | `toast_title` | Érvénytelen főkönyvi szám | **— (Prevesti na HR)** |
| [CreateJournalModal.tsx:L164](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/CreateJournalModal.tsx#L164) | `toast_title` | Hiányzó naplókód | **— (Prevesti na HR)** |
| [CreateJournalModal.tsx:L164](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/CreateJournalModal.tsx#L164) | `toast_desc` | Kérjük adjon meg egy naplókódot (pl. B3). | **— (Prevesti na HR)** |
| [CreateJournalModal.tsx:L169](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/CreateJournalModal.tsx#L169) | `toast_title` | Hiányzó megnevezés | **— (Prevesti na HR)** |
| [CreateJournalModal.tsx:L169](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/CreateJournalModal.tsx#L169) | `toast_desc` | Kérjük adja meg a napló megnevezését (pl. OTP Bank HUF). | **— (Prevesti na HR)** |
| [CreateJournalModal.tsx:L178](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/CreateJournalModal.tsx#L178) | `toast_title` | Már létező naplókód | **— (Prevesti na HR)** |
| [CreateJournalModal.tsx:L206](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/CreateJournalModal.tsx#L206) | `toast_title` | Napló sikeresen létrehozva | **— (Prevesti na HR)** |
| [CreateJournalModal.tsx:L221](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/CreateJournalModal.tsx#L221) | `toast_title` | Hiba a napló mentésekor | **— (Prevesti na HR)** |
| [ManageJournalsModal.tsx:L68](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/ManageJournalsModal.tsx#L68) | `toast_title` | A megnevezés kötelező | **— (Prevesti na HR)** |
| [ManageJournalsModal.tsx:L86](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/ManageJournalsModal.tsx#L86) | `toast_title` | Napló sikeresen frissítve | **— (Prevesti na HR)** |
| [ManageJournalsModal.tsx:L91](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/ManageJournalsModal.tsx#L91) | `toast_title` | Hiba a mentés során | **— (Prevesti na HR)** |
| [OpeningJournalWizardModal.tsx:L640](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/OpeningJournalWizardModal.tsx#L640) | `toast_title` | MNB árfolyam betöltve | **— (Prevesti na HR)** |
| [OpeningJournalWizardModal.tsx:L645](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/OpeningJournalWizardModal.tsx#L645) | `toast_title` | Árfolyam nem található | **Nema podataka** |
| [OpeningJournalWizardModal.tsx:L672](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/OpeningJournalWizardModal.tsx#L672) | `toast_title` | MNB árfolyamok frissítve | **— (Prevesti na HR)** |
| [OpeningJournalWizardModal.tsx:L677](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/OpeningJournalWizardModal.tsx#L677) | `toast_title` | Nem található devizás tétel vagy árfolyam | **Nema podataka** |
| [OpeningJournalWizardModal.tsx:L677](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/OpeningJournalWizardModal.tsx#L677) | `toast_desc` | Nincs elérhető árfolyam az aktuális devizanemekhez. | **— (Prevesti na HR)** |
| [PeriodClosingSettings.tsx:L101](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/PeriodClosingSettings.tsx#L101) | `toast_title` | Időszak lezárási állapota sikeresen módosítva | **— (Prevesti na HR)** |
| [PeriodClosingSettings.tsx:L104](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/PeriodClosingSettings.tsx#L104) | `toast_title` | Hiba az időszak zárásakor | **— (Prevesti na HR)** |
| [AccountingPolicySection.tsx:L60](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/settings/AccountingPolicySection.tsx#L60) | `toast_title` | Nem támogatott fájlformátum | **— (Prevesti na HR)** |
| [AccountingPolicySection.tsx:L60](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/settings/AccountingPolicySection.tsx#L60) | `toast_desc` | Kérjük, PDF vagy DOCX formátumú számviteli politikát tölts fel. | **— (Prevesti na HR)** |
| [AccountingPolicySection.tsx:L69](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/settings/AccountingPolicySection.tsx#L69) | `toast_title` | A fájl túl nagy | **— (Prevesti na HR)** |
| [AccountingPolicySection.tsx:L69](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/settings/AccountingPolicySection.tsx#L69) | `toast_desc` | A maximális megengedett fájlméret 50 MB. | **— (Prevesti na HR)** |
| [AccountingPolicySection.tsx:L108](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/settings/AccountingPolicySection.tsx#L108) | `toast_title` | Letöltési hiba | **— (Prevesti na HR)** |
| [SubledgerPostingModal.tsx:L251](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/subledger/SubledgerPostingModal.tsx#L251) | `toast_title` | Nem törölhető | **— (Prevesti na HR)** |
| [SubledgerPostingModal.tsx:L251](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/subledger/SubledgerPostingModal.tsx#L251) | `toast_desc` | A bizonylatnak legalább egy tétellel rendelkeznie kell. | **— (Prevesti na HR)** |
| [SubledgerPostingModal.tsx:L292](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/subledger/SubledgerPostingModal.tsx#L292) | `toast_title` | Mentési hiba | **— (Prevesti na HR)** |
| [SubledgerPostingModal.tsx:L332](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/subledger/SubledgerPostingModal.tsx#L332) | `toast_title` | Számla sikeresen lekönyvelve | **— (Prevesti na HR)** |
| [SubledgerPostingModal.tsx:L347](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/subledger/SubledgerPostingModal.tsx#L347) | `toast_title` | Könyvelési hiba | **— (Prevesti na HR)** |
| [SubledgerPostingModal.tsx:L368](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/subledger/SubledgerPostingModal.tsx#L368) | `toast_title` | Változtatások elmentve | **— (Prevesti na HR)** |
| [SubledgerPostingModal.tsx:L387](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/subledger/SubledgerPostingModal.tsx#L387) | `toast_title` | Nincs egyensúlyban | **— (Prevesti na HR)** |
| [SubledgerPostingModal.tsx:L387](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/subledger/SubledgerPostingModal.tsx#L387) | `toast_desc` | A könyveléshez a Tartozik és Követel összegeknek egyezniük kell (∑T = ∑K)! | **— (Prevesti na HR)** |
| [VatCodeConfigTab.tsx:L274](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/vat/VatCodeConfigTab.tsx#L274) | `toast_title` | Alapértelmezett áfakódok betöltve | **— (Prevesti na HR)** |
| [VatCodeConfigTab.tsx:L274](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/vat/VatCodeConfigTab.tsx#L274) | `toast_desc` | FAD (fordított adózás) kódok is hozzáadva | **— (Prevesti na HR)** |
| [VatCodeConfigTab.tsx:L276](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/vat/VatCodeConfigTab.tsx#L276) | `toast_title` | Hiba | **Greška** |
| [VatCodeConfigTab.tsx:L286](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/vat/VatCodeConfigTab.tsx#L286) | `toast_title` | Áfakód törölve | **— (Prevesti na HR)** |
| [VatCodeConfigTab.tsx:L304](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/vat/VatCodeConfigTab.tsx#L304) | `toast_title` | Áfakód mentve | **— (Prevesti na HR)** |
| [VatCodeConfigTab.tsx:L357](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/vat/VatCodeConfigTab.tsx#L357) | `toast_title` | Megjelenítési mód elmentve | **— (Prevesti na HR)** |
| [useAnnualReportData.ts:L141](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/annual-report/hooks/useAnnualReportData.ts#L141) | `toast_title` | Beszámoló létrehozva | **— (Prevesti na HR)** |
| [useAnnualReportData.ts:L144](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/annual-report/hooks/useAnnualReportData.ts#L144) | `toast_title` | Hiba | **Greška** |
| [useAnnualReportData.ts:L243](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/annual-report/hooks/useAnnualReportData.ts#L243) | `toast_title` | ✓ Minden ellenőrzés sikeres! | **— (Prevesti na HR)** |
| [useAnnualReportData.ts:L248](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/annual-report/hooks/useAnnualReportData.ts#L248) | `toast_title` | Ellenőrzés kész | **— (Prevesti na HR)** |
| [VatAnnualMatrixView.tsx:L311](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/vat/components/VatAnnualMatrixView.tsx#L311) | `toast_title` | Éves mátrix újraszámítva | **— (Prevesti na HR)** |
| [VatAnnualMatrixView.tsx:L316](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/vat/components/VatAnnualMatrixView.tsx#L316) | `toast_title` | Hiba az újraszámítás során | **— (Prevesti na HR)** |
| [VatSteelProductsSection.tsx:L138](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/vat/components/VatSteelProductsSection.tsx#L138) | `toast_title` | Sikeres mentés | **Uspješno spremljeno** |
| [VatSteelProductsSection.tsx:L138](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/vat/components/VatSteelProductsSection.tsx#L138) | `toast_desc` | A VTSZ szám és a nettó tömeg frissítve. | **— (Prevesti na HR)** |
| [VatSteelProductsSection.tsx:L143](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/vat/components/VatSteelProductsSection.tsx#L143) | `toast_title` | Hiba történt a mentés során | **Došlo je do greške** |
| [VatSteelProductsSection.tsx:L199](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/vat/components/VatSteelProductsSection.tsx#L199) | `toast_title` | CSV letöltve | **— (Prevesti na HR)** |
| [VatSteelProductsSection.tsx:L199](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/vat/components/VatSteelProductsSection.tsx#L199) | `toast_desc` | A 6/B szerinti vas- és acélipari analitika letöltésre került. | **— (Prevesti na HR)** |
| [VatTourismTaxSection.tsx:L124](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/vat/components/VatTourismTaxSection.tsx#L124) | `toast_title` | Adatok feltöltve | **— (Prevesti na HR)** |
| [VatTourismTaxSection.tsx:L129](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/vat/components/VatTourismTaxSection.tsx#L129) | `toast_title` | Hiba a feltöltés során | **— (Prevesti na HR)** |
| [VatTourismTaxSection.tsx:L181](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/vat/components/VatTourismTaxSection.tsx#L181) | `toast_title` | 26TFEJLH ÁNYK XML letöltve | **— (Prevesti na HR)** |
| [VatTourismTaxSection.tsx:L181](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/vat/components/VatTourismTaxSection.tsx#L181) | `toast_desc` | A bevallási állomány sikeresen exportálva lett. | **— (Prevesti na HR)** |
| [Nav2665ReplicaContainer.tsx:L128](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/vat/components/replica/Nav2665ReplicaContainer.tsx#L128) | `toast_title` | ÁFA bevallás frissítve | **— (Prevesti na HR)** |
| [Nav2665ReplicaContainer.tsx:L128](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/vat/components/replica/Nav2665ReplicaContainer.tsx#L128) | `toast_desc` | A 2665A nyomtatvány számai sikeresen újraszámítva a számlákból! | **— (Prevesti na HR)** |
| [Nav2665ReplicaContainer.tsx:L133](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/vat/components/replica/Nav2665ReplicaContainer.tsx#L133) | `toast_title` | Hiba a frissítéskor | **— (Prevesti na HR)** |
| [Nav26A60ReplicaContainer.tsx:L154](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/vat/components/replica/Nav26A60ReplicaContainer.tsx#L154) | `toast_title` | Sikeres frissítés | **— (Prevesti na HR)** |
| [Nav26A60ReplicaContainer.tsx:L154](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/vat/components/replica/Nav26A60ReplicaContainer.tsx#L154) | `toast_desc` | Az A60 nyilatkozat adatai újraszámolva az adatbázisból. | **— (Prevesti na HR)** |
| [Nav26A60ReplicaContainer.tsx:L159](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/vat/components/replica/Nav26A60ReplicaContainer.tsx#L159) | `toast_title` | Hiba a frissítéskor | **— (Prevesti na HR)** |
| [useVatReturnData.ts:L1005](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/vat/hooks/useVatReturnData.ts#L1005) | `toast_title` | Számítás kész | **— (Prevesti na HR)** |
| [useVatReturnData.ts:L1010](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/vat/hooks/useVatReturnData.ts#L1010) | `toast_title` | Hiba | **Greška** |
| [useVatReturnData.ts:L1024](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/vat/hooks/useVatReturnData.ts#L1024) | `toast_title` | Bevallás ellenőrzöttnek jelölve | **— (Prevesti na HR)** |
| [useVatReturnData.ts:L1027](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/vat/hooks/useVatReturnData.ts#L1027) | `toast_title` | Státusz váltás hiba | **— (Prevesti na HR)** |
| [useVatReturnData.ts:L1041](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/vat/hooks/useVatReturnData.ts#L1041) | `toast_title` | Bevallás véglegesítve | **— (Prevesti na HR)** |
| [useVatReturnData.ts:L1041](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/vat/hooks/useVatReturnData.ts#L1041) | `toast_desc` | Változtatás csak visszanyitás után lehetséges. | **— (Prevesti na HR)** |
| [useVatReturnData.ts:L1047](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/vat/hooks/useVatReturnData.ts#L1047) | `toast_title` | Véglegesítés hiba | **— (Prevesti na HR)** |
| [useVatReturnData.ts:L1061](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/vat/hooks/useVatReturnData.ts#L1061) | `toast_title` | Bevallás visszanyitva piszkozatba | **— (Prevesti na HR)** |
| [useVatReturnData.ts:L1064](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/vat/hooks/useVatReturnData.ts#L1064) | `toast_title` | Visszanyitás hiba | **— (Prevesti na HR)** |
| [useVatReturnData.ts:L1133](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/vat/hooks/useVatReturnData.ts#L1133) | `toast_title` | Áthozat frissítve | **— (Prevesti na HR)** |
| [useVatReturnData.ts:L1139](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/vat/hooks/useVatReturnData.ts#L1139) | `toast_title` | Áthozat mentési hiba | **— (Prevesti na HR)** |
| [useVatReturnData.ts:L1166](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/vat/hooks/useVatReturnData.ts#L1166) | `toast_title` | Mentési hiba | **— (Prevesti na HR)** |
| [useVatReturnData.ts:L1218](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/vat/hooks/useVatReturnData.ts#L1218) | `toast_title` | Nincs ellenőrizhető partner | **— (Prevesti na HR)** |
| [useVatReturnData.ts:L1218](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/vat/hooks/useVatReturnData.ts#L1218) | `toast_desc` | Ebben az időszakban nem található közösségi (EU) adószámmal rendelkező t... | **Nema podataka** |
| [useVatReturnData.ts:L1283](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/vat/hooks/useVatReturnData.ts#L1283) | `toast_title` | VIES ellenőrzés befejezve | **— (Prevesti na HR)** |
| [useAccountingPolicy.ts:L153](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useAccountingPolicy.ts#L153) | `toast_title` | Számviteli politika feltöltve | **— (Prevesti na HR)** |
| [useAccountingPolicy.ts:L153](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useAccountingPolicy.ts#L153) | `toast_desc` | A dokumentum feldolgozása elindult, a szabályok kinyerése folyamatban. | **— (Prevesti na HR)** |
| [useAccountingPolicy.ts:L159](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useAccountingPolicy.ts#L159) | `toast_title` | Hiba a feltöltés során | **— (Prevesti na HR)** |
| [useAccountingPolicy.ts:L179](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useAccountingPolicy.ts#L179) | `toast_title` | Feldolgozás befejezve | **— (Prevesti na HR)** |
| [useAccountingPolicy.ts:L179](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useAccountingPolicy.ts#L179) | `toast_desc` | A szabályok sikeresen kinyerve a dokumentumból. | **— (Prevesti na HR)** |
| [useAccountingPolicy.ts:L185](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useAccountingPolicy.ts#L185) | `toast_title` | Feldolgozási hiba | **— (Prevesti na HR)** |
| [useAccountingPolicy.ts:L204](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useAccountingPolicy.ts#L204) | `toast_title` | Szabályok élesítve | **— (Prevesti na HR)** |
| [useAccountingPolicy.ts:L204](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useAccountingPolicy.ts#L204) | `toast_desc` | A számviteli politika és szabályai aktívvá váltak a cég könyvelésében. | **— (Prevesti na HR)** |
| [useAccountingPolicy.ts:L210](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useAccountingPolicy.ts#L210) | `toast_title` | Hiba az élesítés során | **— (Prevesti na HR)** |
| [useAccountingPolicy.ts:L245](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useAccountingPolicy.ts#L245) | `toast_title` | Szabály módosítva | **— (Prevesti na HR)** |
| [useAccountingPolicy.ts:L245](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useAccountingPolicy.ts#L245) | `toast_desc` | A szabály beállítása sikeresen frissítve. | **— (Prevesti na HR)** |
| [useAccountingPolicy.ts:L251](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useAccountingPolicy.ts#L251) | `toast_title` | Hiba a mentéskor | **— (Prevesti na HR)** |
| [useAccountingPolicy.ts:L281](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useAccountingPolicy.ts#L281) | `toast_title` | Szabályzat törölve | **— (Prevesti na HR)** |
| [useAccountingPolicy.ts:L281](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useAccountingPolicy.ts#L281) | `toast_desc` | A számviteli politika sikeresen eltávolítva. | **— (Prevesti na HR)** |
| [useAccountingPolicy.ts:L287](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useAccountingPolicy.ts#L287) | `toast_title` | Törlési hiba | **— (Prevesti na HR)** |
| [useSubledger.ts:L183](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useSubledger.ts#L183) | `toast_title` | Sikeres rendezés | **— (Prevesti na HR)** |
| [useSubledger.ts:L183](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useSubledger.ts#L183) | `toast_desc` | A kiválasztott tételek sikeresen össze lettek párosítva. | **— (Prevesti na HR)** |
| [useSubledger.ts:L190](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useSubledger.ts#L190) | `toast_title` | Hiba a rendezés során | **— (Prevesti na HR)** |
| [useSubledger.ts:L220](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useSubledger.ts#L220) | `toast_title` | Automatikus párosítás befejeződött | **— (Prevesti na HR)** |
| [useSubledger.ts:L225](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useSubledger.ts#L225) | `toast_title` | Nincs új párosítható tétel | **— (Prevesti na HR)** |
| [useSubledger.ts:L225](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useSubledger.ts#L225) | `toast_desc` | Nem található azonos hivatkozású vagy összegű rendezetlen tétel a folyós... | **Nema podataka** |
| [useSubledger.ts:L233](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useSubledger.ts#L233) | `toast_title` | Hiba az automatikus párosítás során | **— (Prevesti na HR)** |
| [useSubledger.ts:L260](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useSubledger.ts#L260) | `toast_title` | Tételek sikeresen lekönyvelve | **— (Prevesti na HR)** |
| [useSubledger.ts:L267](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useSubledger.ts#L267) | `toast_title` | Hiba a könyvelés során | **— (Prevesti na HR)** |
| [useSubledger.ts:L294](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useSubledger.ts#L294) | `toast_title` | Rendezés felbontva | **— (Prevesti na HR)** |
| [useSubledger.ts:L294](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useSubledger.ts#L294) | `toast_desc` | A tétel párosítása sikeresen meg lett szüntetve, visszakerült a nyitott ... | **— (Prevesti na HR)** |
| [useSubledger.ts:L301](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useSubledger.ts#L301) | `toast_title` | Hiba a felbontás során | **— (Prevesti na HR)** |
| [useSubledger.ts:L333](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useSubledger.ts#L333) | `toast_desc` | A vegyes bizonylat automatikusan le lett könyvelve és a tétel le lett zá... | **— (Prevesti na HR)** |
| [useSubledger.ts:L340](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useSubledger.ts#L340) | `toast_title` | Hiba a leírás során | **— (Prevesti na HR)** |
| [useSubledger.ts:L372](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useSubledger.ts#L372) | `toast_title` | Bizonylat visszanyitva piszkozattá | **— (Prevesti na HR)** |
| [useSubledger.ts:L372](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useSubledger.ts#L372) | `toast_desc` | A tétel sikeresen visszanyitva szerkesztésre. | **— (Prevesti na HR)** |
| [useSubledger.ts:L379](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useSubledger.ts#L379) | `toast_title` | Hiba a bizonylat visszanyitásakor | **— (Prevesti na HR)** |
| [AccountingPolicySection.tsx:L271](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/settings/AccountingPolicySection.tsx#L271) | `window.confirm` | Biztosan törölni szeretnéd a feltöltött számviteli politikát és annak sz... | **Jeste li sigurni da želite obrisati?** |
| [SubledgerItemMatchesModal.tsx:L35](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/subledger/SubledgerItemMatchesModal.tsx#L35) | `window.confirm` | Biztosan felbontja ezt a párosítást? A tétel ismét nyitott státuszba kerül. | **— (Prevesti na HR)** |


---

## 🏷️ 3. Státusz Badge-ek, Jelvények és Feltételes Állapotok

| Forrás és sorszám | Elem | Megjelenő magyar szöveg | Javasolt horvát (HR) fordítás |
| :--- | :--- | :--- | :--- |
| [OpeningCSVImportModal.tsx:L290](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/OpeningCSVImportModal.tsx#L290) | `Badge JSX` | Ajánlott | **— (Prevesti na HR)** |
| [VatItemizedJournalView.tsx:L451](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/vat/components/VatItemizedJournalView.tsx#L451) | `Badge JSX` | szállító | **Dobavljač** |
| [VatItemizedJournalView.tsx:L453](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/vat/components/VatItemizedJournalView.tsx#L453) | `Badge JSX` | vevő | **Kupac** |
| [VatItemizedJournalView.tsx:L455](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/vat/components/VatItemizedJournalView.tsx#L455) | `Badge JSX` | pénztár | **— (Prevesti na HR)** |
| [AssetActivationDialog.tsx:L157](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/AssetActivationDialog.tsx#L157) | `ternary condition literal` | Az ${i + 1}. tétel neve és hasznos élettartama kötelező. | **— (Prevesti na HR)** |
| [AssetActivationDialog.tsx:L210](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/AssetActivationDialog.tsx#L210) | `ternary condition literal` | ${forms.length} eszköz sikeresen aktiválva. | **— (Prevesti na HR)** |
| [AssetActivationDialog.tsx:L245](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/AssetActivationDialog.tsx#L245) | `ternary condition literal` | ${selectedItems.length} tétel aktiválása eszközként. | **— (Prevesti na HR)** |
| [AssetActivationDialog.tsx:L660](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/AssetActivationDialog.tsx#L660) | `ternary condition literal` | Aktiválás (${forms.length} tétel) | **— (Prevesti na HR)** |
| [AccountingRulesDialog.tsx:L72](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/accounting/AccountingRulesDialog.tsx#L72) | `ternary condition literal` | Könyvelési Szabályok | **Računovodstvena pravila** |
| [AccountingRulesDialog.tsx:L90](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/accounting/AccountingRulesDialog.tsx#L90) | `ternary condition literal` | Számlatétel szabályok | **— (Prevesti na HR)** |
| [AccountingRulesDialog.tsx:L100](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/accounting/AccountingRulesDialog.tsx#L100) | `ternary condition literal` | AI Prompt könyvtár | **— (Prevesti na HR)** |
| [CompanyPromptRulesManager.tsx:L50](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/accounting/CompanyPromptRulesManager.tsx#L50) | `ternary condition literal` | Szoftver licenc előfizetések | **— (Prevesti na HR)** |
| [CompanyPromptRulesManager.tsx:L53](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/accounting/CompanyPromptRulesManager.tsx#L53) | `ternary condition literal` | Költség | **— (Prevesti na HR)** |
| [CompanyPromptRulesManager.tsx:L56](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/accounting/CompanyPromptRulesManager.tsx#L56) | `ternary condition literal` | Kisértékű eszközök értékhatár | **— (Prevesti na HR)** |
| [CompanyPromptRulesManager.tsx:L59](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/accounting/CompanyPromptRulesManager.tsx#L59) | `ternary condition literal` | Eszköz | **— (Prevesti na HR)** |
| [CompanyPromptRulesManager.tsx:L62](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/accounting/CompanyPromptRulesManager.tsx#L62) | `ternary condition literal` | MOL üzemanyag beszerzés | **— (Prevesti na HR)** |
| [CompanyPromptRulesManager.tsx:L68](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/accounting/CompanyPromptRulesManager.tsx#L68) | `ternary condition literal` | Könyvelési és jogi díjak | **— (Prevesti na HR)** |
| [CompanyPromptRulesManager.tsx:L71](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/accounting/CompanyPromptRulesManager.tsx#L71) | `ternary condition literal` | Szolgáltatás | **— (Prevesti na HR)** |
| [CompanyPromptRulesManager.tsx:L161](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/accounting/CompanyPromptRulesManager.tsx#L161) | `ternary condition literal` | Szabály létrehozva | **— (Prevesti na HR)** |
| [CompanyPromptRulesManager.tsx:L161](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/accounting/CompanyPromptRulesManager.tsx#L161) | `ternary condition literal` | Az egyedi szabály sikeresen hozzáadva a szabálytárhoz. | **— (Prevesti na HR)** |
| [CompanyPromptRulesManager.tsx:L167](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/accounting/CompanyPromptRulesManager.tsx#L167) | `ternary condition literal` | Hiba történt | **Došlo je do greške** |
| [CompanyPromptRulesManager.tsx:L184](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/accounting/CompanyPromptRulesManager.tsx#L184) | `ternary condition literal` | Módosítás sikertelen | **— (Prevesti na HR)** |
| [CompanyPromptRulesManager.tsx:L199](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/accounting/CompanyPromptRulesManager.tsx#L199) | `ternary condition literal` | Szabály törölve | **— (Prevesti na HR)** |
| [CompanyPromptRulesManager.tsx:L199](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/accounting/CompanyPromptRulesManager.tsx#L199) | `ternary condition literal` | A szabály eltávolítva a könyvtárból. | **— (Prevesti na HR)** |
| [CompanyPromptRulesManager.tsx:L202](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/accounting/CompanyPromptRulesManager.tsx#L202) | `ternary condition literal` | Törlés sikertelen | **— (Prevesti na HR)** |
| [CompanyPromptRulesManager.tsx:L224](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/accounting/CompanyPromptRulesManager.tsx#L224) | `ternary condition literal` | Céges AI Prompt Szabályok | **— (Prevesti na HR)** |
| [CompanyPromptRulesManager.tsx:L234](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/accounting/CompanyPromptRulesManager.tsx#L234) | `ternary condition literal` | + Új szabály hozzáadása | **— (Prevesti na HR)** |
| [CompanyPromptRulesManager.tsx:L240](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/accounting/CompanyPromptRulesManager.tsx#L240) | `ternary condition literal` | Egyedi könyvelési szabály felvétele | **— (Prevesti na HR)** |
| [CompanyPromptRulesManager.tsx:L248](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/accounting/CompanyPromptRulesManager.tsx#L248) | `ternary condition literal` | Szabály megnevezése | **— (Prevesti na HR)** |
| [CompanyPromptRulesManager.tsx:L253](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/accounting/CompanyPromptRulesManager.tsx#L253) | `ternary condition literal` | Pl. MOL üzemanyag kontírozás | **— (Prevesti na HR)** |
| [CompanyPromptRulesManager.tsx:L259](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/accounting/CompanyPromptRulesManager.tsx#L259) | `ternary condition literal` | AI Instrukció (Prompt) | **— (Prevesti na HR)** |
| [CompanyPromptRulesManager.tsx:L264](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/accounting/CompanyPromptRulesManager.tsx#L264) | `ternary condition literal` | Írd le pontosan a szabályt... | **— (Prevesti na HR)** |
| [CompanyPromptRulesManager.tsx:L273](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/accounting/CompanyPromptRulesManager.tsx#L273) | `ternary condition literal` | Mégse | **Odustani** |
| [CompanyPromptRulesManager.tsx:L277](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/accounting/CompanyPromptRulesManager.tsx#L277) | `ternary condition literal` | Mentés... | **Spremi...** |
| [CompanyPromptRulesManager.tsx:L278](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/accounting/CompanyPromptRulesManager.tsx#L278) | `ternary condition literal` | Szabály mentése | **— (Prevesti na HR)** |
| [CompanyPromptRulesManager.tsx:L297](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/accounting/CompanyPromptRulesManager.tsx#L297) | `ternary condition literal` | Szabályok betöltése... | **— (Prevesti na HR)** |
| [CompanyPromptRulesManager.tsx:L304](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/accounting/CompanyPromptRulesManager.tsx#L304) | `ternary condition literal` | Még nincsenek egyedi szabályok | **— (Prevesti na HR)** |
| [CompanyPromptRulesManager.tsx:L327](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/accounting/CompanyPromptRulesManager.tsx#L327) | `ternary condition literal` | Aktív | **Aktivno** |
| [CompanyPromptRulesManager.tsx:L331](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/accounting/CompanyPromptRulesManager.tsx#L331) | `ternary condition literal` | Inaktív | **Neaktivno** |
| [CompanyPromptRulesManager.tsx:L339](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/accounting/CompanyPromptRulesManager.tsx#L339) | `ternary condition literal` | Utoljára frissítve: | **— (Prevesti na HR)** |
| [CompanyPromptRulesManager.tsx:L356](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/accounting/CompanyPromptRulesManager.tsx#L356) | `ternary condition literal` | Biztosan törlöd ezt a könyvelési szabályt? | **— (Prevesti na HR)** |
| [BalanceSheetWidgets.tsx:L131](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/balance-sheet/BalanceSheetWidgets.tsx#L131) | `ternary condition literal` | Eszköz: ${formatHuf(totalAssets)} | **— (Prevesti na HR)** |
| [BalanceSheetWidgets.tsx:L132](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/balance-sheet/BalanceSheetWidgets.tsx#L132) | `ternary condition literal` | Forrás: ${formatHuf(totalLiabilities)} | **— (Prevesti na HR)** |
| [BalanceSheetWidgets.tsx:L154](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/balance-sheet/BalanceSheetWidgets.tsx#L154) | `ternary condition literal` | Eltérés: ${formatHuf(difference)} | **— (Prevesti na HR)** |
| [BalanceSheetWidgets.tsx:L241](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/balance-sheet/BalanceSheetWidgets.tsx#L241) | `ternary condition literal` | Eszközök összesen: ${formatHuf(totalAssets)} | **— (Prevesti na HR)** |
| [BalanceSheetWidgets.tsx:L241](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/balance-sheet/BalanceSheetWidgets.tsx#L241) | `ternary condition literal` | Források összesen: ${formatHuf(totalLiabilities)} | **— (Prevesti na HR)** |
| [VatSection.tsx:L91](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/VatSection.tsx#L91) | `ternary condition literal` | Összes ÁFA | **— (Prevesti na HR)** |
| [VatSection.tsx:L92](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/VatSection.tsx#L92) | `ternary condition literal` | Levonható ÁFA | **— (Prevesti na HR)** |
| [VatSection.tsx:L95](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/VatSection.tsx#L95) | `ternary condition literal` | Visszaigényelhető ÁFA | **— (Prevesti na HR)** |
| [VatSection.tsx:L96](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/VatSection.tsx#L96) | `ternary condition literal` | Fizetendő ÁFA | **— (Prevesti na HR)** |
| [ReactivationDialog.tsx:L53](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/ReactivationDialog.tsx#L53) | `ternary condition literal` | Hiba | **Greška** |
| [ReactivationDialog.tsx:L53](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/ReactivationDialog.tsx#L53) | `ternary condition literal` | Nem sikerült a ráaktiválás. | **— (Prevesti na HR)** |
| [ReactivationDialog.tsx:L127](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/ReactivationDialog.tsx#L127) | `ternary condition literal` | Ráaktiválás... | **— (Prevesti na HR)** |
| [ReactivationDialog.tsx:L127](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/ReactivationDialog.tsx#L127) | `ternary condition literal` | Ráaktiválás | **— (Prevesti na HR)** |
| [AddGlAccountModal.tsx:L178](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/AddGlAccountModal.tsx#L178) | `ternary condition literal` | Főkönyvi szám létrehozva | **— (Prevesti na HR)** |
| [AddGlAccountModal.tsx:L187](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/AddGlAccountModal.tsx#L187) | `ternary condition literal` | Hiba a mentéskor | **— (Prevesti na HR)** |
| [AddManualJournalEntryModal.tsx:L147](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/AddManualJournalEntryModal.tsx#L147) | `ternary condition literal` | Vegyes Manuális Bizonylatok | **— (Prevesti na HR)** |
| [GeneralLedgerComparisonTable.tsx:L200](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GeneralLedgerComparisonTable.tsx#L200) | `ternary condition literal` | Tárgyév | **— (Prevesti na HR)** |
| [GeneralLedgerComparisonTable.tsx:L201](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GeneralLedgerComparisonTable.tsx#L201) | `ternary condition literal` | Előző év | **— (Prevesti na HR)** |
| [GeneralLedgerComparisonTable.tsx:L204](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GeneralLedgerComparisonTable.tsx#L204) | `ternary condition literal` | Teljesítés | **— (Prevesti na HR)** |
| [GeneralLedgerComparisonTable.tsx:L204](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GeneralLedgerComparisonTable.tsx#L204) | `ternary condition literal` | Kibocsátás | **— (Prevesti na HR)** |
| [GeneralLedgerComparisonTable.tsx:L210](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GeneralLedgerComparisonTable.tsx#L210) | `ternary condition literal` | Eltérés (${currencyLabel}) | **— (Prevesti na HR)** |
| [GeneralLedgerTable.tsx:L757](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GeneralLedgerTable.tsx#L757) | `ternary condition literal` | Hiba módosításkor: | **— (Prevesti na HR)** |
| [GeneralLedgerTable.tsx:L758](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GeneralLedgerTable.tsx#L758) | `ternary condition literal` | Hiba a mentés során | **— (Prevesti na HR)** |
| [GeneralLedgerTable.tsx:L760](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GeneralLedgerTable.tsx#L760) | `ternary condition literal` | Sikeres módosítás | **— (Prevesti na HR)** |
| [GeneralLedgerTable.tsx:L760](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GeneralLedgerTable.tsx#L760) | `ternary condition literal` | ${itemsToUpdate.length} tétel sikeresen felülírva. | **— (Prevesti na HR)** |
| [GeneralLedgerTable.tsx:L1227](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GeneralLedgerTable.tsx#L1227) | `ternary condition literal` | több | **— (Prevesti na HR)** |
| [GeneralLedgerTable.tsx:L1380](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GeneralLedgerTable.tsx#L1380) | `ternary condition literal` | GL queue insert hiba: | **— (Prevesti na HR)** |
| [GeneralLedgerTable.tsx:L1385](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GeneralLedgerTable.tsx#L1385) | `ternary condition literal` | Hiba az AI átsorolás közben: | **— (Prevesti na HR)** |
| [GeneralLedgerTable.tsx:L1409](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GeneralLedgerTable.tsx#L1409) | `ternary condition literal` | Exportálás folyamatban... | **— (Prevesti na HR)** |
| [GeneralLedgerTable.tsx:L1409](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GeneralLedgerTable.tsx#L1409) | `ternary condition literal` | Analitikus tételek lekérése az Excelhez. | **— (Prevesti na HR)** |
| [GeneralLedgerTable.tsx:L1563](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GeneralLedgerTable.tsx#L1563) | `ternary condition literal` | Sikeres exportálás | **— (Prevesti na HR)** |
| [GeneralLedgerTable.tsx:L1563](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GeneralLedgerTable.tsx#L1563) | `ternary condition literal` | Az analitikus Excel fájl elkészült. | **— (Prevesti na HR)** |
| [GeneralLedgerTable.tsx:L1565](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GeneralLedgerTable.tsx#L1565) | `ternary condition literal` | Export error: | **— (Prevesti na HR)** |
| [GeneralLedgerTable.tsx:L1566](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GeneralLedgerTable.tsx#L1566) | `ternary condition literal` | Exportálási hiba | **— (Prevesti na HR)** |
| [GeneralLedgerTable.tsx:L2654](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GeneralLedgerTable.tsx#L2654) | `ternary condition literal` | Nem könyvelt tételek (${excludedItems.length}) | **— (Prevesti na HR)** |
| [GlAccountCardView.tsx:L95](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GlAccountCardView.tsx#L95) | `ternary condition literal` | Vevők | **— (Prevesti na HR)** |
| [GlAccountCardView.tsx:L96](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GlAccountCardView.tsx#L96) | `ternary condition literal` | Szállítók | **— (Prevesti na HR)** |
| [GlAccountCardView.tsx:L97](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GlAccountCardView.tsx#L97) | `ternary condition literal` | Házipénztár | **Blagajna** |
| [GlAccountCardView.tsx:L98](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GlAccountCardView.tsx#L98) | `ternary condition literal` | Elszámolási számla (Bank) | **— (Prevesti na HR)** |
| [GlAccountCardView.tsx:L280](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GlAccountCardView.tsx#L280) | `ternary condition literal` | NYITÓ | **— (Prevesti na HR)** |
| [GlAccountCardView.tsx:L282](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GlAccountCardView.tsx#L282) | `ternary condition literal` | Nyitó napló | **— (Prevesti na HR)** |
| [GlAccountCardView.tsx:L288](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GlAccountCardView.tsx#L288) | `ternary condition literal` | Időszak eleji nyitó egyenleg | **— (Prevesti na HR)** |
| [GlAnalyticReconciliationView.tsx:L136](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GlAnalyticReconciliationView.tsx#L136) | `ternary condition literal` | Vevő követelések (311) | **— (Prevesti na HR)** |
| [GlAnalyticReconciliationView.tsx:L144](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GlAnalyticReconciliationView.tsx#L144) | `ternary condition literal` | Szállítói kötelezettségek (454) | **— (Prevesti na HR)** |
| [GlAnalyticReconciliationView.tsx:L152](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GlAnalyticReconciliationView.tsx#L152) | `ternary condition literal` | Házipénztár (381) | **— (Prevesti na HR)** |
| [GlAnalyticReconciliationView.tsx:L160](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GlAnalyticReconciliationView.tsx#L160) | `ternary condition literal` | Tárgyi eszközök (1-es számlaosztály) | **— (Prevesti na HR)** |
| [GlAnalyticReconciliationView.tsx:L177](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GlAnalyticReconciliationView.tsx#L177) | `ternary condition literal` | Egyeztetési kontroll lefutott | **— (Prevesti na HR)** |
| [GlAnalyticReconciliationView.tsx:L200](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GlAnalyticReconciliationView.tsx#L200) | `ternary condition literal` | Figyelem! Analitikus eltérés tapasztalható. | **— (Prevesti na HR)** |
| [GlAnalyticReconciliationView.tsx:L200](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GlAnalyticReconciliationView.tsx#L200) | `ternary condition literal` | Minden analitika tökéletesen egyezik a főkönyvvel! | **— (Prevesti na HR)** |
| [GlKpiBar.tsx:L200](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GlKpiBar.tsx#L200) | `ternary condition literal` | Követel (${currencyLabel}) | **— (Prevesti na HR)** |
| [JournalView.tsx:L51](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/JournalView.tsx#L51) | `ternary condition literal` | Számla | **Račun** |
| [JournalView.tsx:L54](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/JournalView.tsx#L54) | `ternary condition literal` | NAV Számla | **— (Prevesti na HR)** |
| [JournalView.tsx:L57](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/JournalView.tsx#L57) | `ternary condition literal` | Naplótétel | **— (Prevesti na HR)** |
| [JournalView.tsx:L58](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/JournalView.tsx#L58) | `ternary condition literal` | XML Naplótétel | **— (Prevesti na HR)** |
| [JournalView.tsx:L60](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/JournalView.tsx#L60) | `ternary condition literal` | Banki tranzakció | **— (Prevesti na HR)** |
| [JournalView.tsx:L62](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/JournalView.tsx#L62) | `ternary condition literal` | Házipénztár | **Blagajna** |
| [JournalView.tsx:L63](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/JournalView.tsx#L63) | `ternary condition literal` | Készpénz | **— (Prevesti na HR)** |
| [JournalView.tsx:L64](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/JournalView.tsx#L64) | `ternary condition literal` | Bérszámfejtés | **— (Prevesti na HR)** |
| [JournalView.tsx:L133](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/JournalView.tsx#L133) | `ternary condition literal` | Ismeretlen hiba a naplófőkönyvi tételek lekérdezésekor | **— (Prevesti na HR)** |
| [JournalView.tsx:L165](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/JournalView.tsx#L165) | `ternary condition literal` | Ismeretlen hiba a főkönyvi számlák lekérdezésekor | **— (Prevesti na HR)** |
| [JournalView.tsx:L286](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/JournalView.tsx#L286) | `ternary condition literal` | Teljesítés | **— (Prevesti na HR)** |
| [JournalView.tsx:L286](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/JournalView.tsx#L286) | `ternary condition literal` | Kibocsátás | **— (Prevesti na HR)** |
| [PartnerLedgerCardView.tsx:L340](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/PartnerLedgerCardView.tsx#L340) | `ternary condition literal` | ${activePartner.partner_name} Folyószámla Kartonja | **— (Prevesti na HR)** |
| [PartnerLedgerCardView.tsx:L422](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/PartnerLedgerCardView.tsx#L422) | `ternary condition literal` | Követel | **— (Prevesti na HR)** |
| [PartnerLedgerCardView.tsx:L437](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/PartnerLedgerCardView.tsx#L437) | `ternary condition literal` | Számlázott bruttó (${currencyLabel}) | **— (Prevesti na HR)** |
| [PartnerLedgerCardView.tsx:L438](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/PartnerLedgerCardView.tsx#L438) | `ternary condition literal` | Kiegyenlített (${currencyLabel}) | **— (Prevesti na HR)** |
| [AddManualJournalEntryModal.tsx:L594](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/AddManualJournalEntryModal.tsx#L594) | `ternary condition literal` | Érvénytelen főkönyvi szám | **— (Prevesti na HR)** |
| [AddManualJournalEntryModal.tsx:L931](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/AddManualJournalEntryModal.tsx#L931) | `ternary condition literal` | (Gyűjtő - nem könyvelhető) | **— (Prevesti na HR)** |
| [CreateJournalModal.tsx:L35](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/CreateJournalModal.tsx#L35) | `ternary condition literal` | BANK | **— (Prevesti na HR)** |
| [CreateJournalModal.tsx:L35](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/CreateJournalModal.tsx#L35) | `ternary condition literal` | Banki napló (BANK) | **— (Prevesti na HR)** |
| [CreateJournalModal.tsx:L36](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/CreateJournalModal.tsx#L36) | `ternary condition literal` | Házipénztár napló (PETTY_CASH) | **— (Prevesti na HR)** |
| [CreateJournalModal.tsx:L37](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/CreateJournalModal.tsx#L37) | `ternary condition literal` | Vegyes napló (MIXED) | **— (Prevesti na HR)** |
| [CreateJournalModal.tsx:L38](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/CreateJournalModal.tsx#L38) | `ternary condition literal` | Vevő napló (CUSTOMER) | **— (Prevesti na HR)** |
| [CreateJournalModal.tsx:L39](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/CreateJournalModal.tsx#L39) | `ternary condition literal` | Szállító napló (SUPPLIER) | **— (Prevesti na HR)** |
| [CreateJournalModal.tsx:L40](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/CreateJournalModal.tsx#L40) | `ternary condition literal` | Nyitó napló (OPENING) | **— (Prevesti na HR)** |
| [CreateJournalModal.tsx:L41](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/CreateJournalModal.tsx#L41) | `ternary condition literal` | Záró napló (CLOSING) | **— (Prevesti na HR)** |
| [CreateJournalModal.tsx:L42](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/CreateJournalModal.tsx#L42) | `ternary condition literal` | Rendszer feladási napló (SYSTEM) | **— (Prevesti na HR)** |
| [CreateJournalModal.tsx:L164](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/CreateJournalModal.tsx#L164) | `ternary condition literal` | Hiányzó naplókód | **— (Prevesti na HR)** |
| [CreateJournalModal.tsx:L164](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/CreateJournalModal.tsx#L164) | `ternary condition literal` | Kérjük adjon meg egy naplókódot (pl. B3). | **— (Prevesti na HR)** |
| [CreateJournalModal.tsx:L169](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/CreateJournalModal.tsx#L169) | `ternary condition literal` | Hiányzó megnevezés | **— (Prevesti na HR)** |
| [CreateJournalModal.tsx:L169](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/CreateJournalModal.tsx#L169) | `ternary condition literal` | Kérjük adja meg a napló megnevezését (pl. OTP Bank HUF). | **— (Prevesti na HR)** |
| [CreateJournalModal.tsx:L179](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/CreateJournalModal.tsx#L179) | `ternary condition literal` | Már létező naplókód | **— (Prevesti na HR)** |
| [CreateJournalModal.tsx:L207](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/CreateJournalModal.tsx#L207) | `ternary condition literal` | Napló sikeresen létrehozva | **— (Prevesti na HR)** |
| [CreateJournalModal.tsx:L208](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/CreateJournalModal.tsx#L208) | `ternary condition literal` | ${data.code} - ${data.name} (${data.currency}) rögzítve. | **— (Prevesti na HR)** |
| [CreateJournalModal.tsx:L222](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/CreateJournalModal.tsx#L222) | `ternary condition literal` | Hiba a napló mentésekor | **— (Prevesti na HR)** |
| [ManageJournalsModal.tsx:L68](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/ManageJournalsModal.tsx#L68) | `ternary condition literal` | A megnevezés kötelező | **— (Prevesti na HR)** |
| [ManageJournalsModal.tsx:L86](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/ManageJournalsModal.tsx#L86) | `ternary condition literal` | Napló sikeresen frissítve | **— (Prevesti na HR)** |
| [ManageJournalsModal.tsx:L92](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/ManageJournalsModal.tsx#L92) | `ternary condition literal` | Hiba a mentés során | **— (Prevesti na HR)** |
| [OpeningCSVImportModal.tsx:L64](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/OpeningCSVImportModal.tsx#L64) | `ternary condition literal` | Hiba történt a fájl beolvasásakor. | **Došlo je do greške** |
| [OpeningCSVImportModal.tsx:L126](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/OpeningCSVImportModal.tsx#L126) | `ternary condition literal` | Nincs érvényes adat | **— (Prevesti na HR)** |
| [OpeningCSVImportModal.tsx:L127](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/OpeningCSVImportModal.tsx#L127) | `ternary condition literal` | A fájl nem tartalmazott feldolgozható sorokat. | **— (Prevesti na HR)** |
| [OpeningCSVImportModal.tsx:L140](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/OpeningCSVImportModal.tsx#L140) | `ternary condition literal` | Sikeres importálás | **— (Prevesti na HR)** |
| [OpeningCSVImportModal.tsx:L141](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/OpeningCSVImportModal.tsx#L141) | `ternary condition literal` | ${activeItems.length} db főkönyvi nyitó tétel beimportálva! | **— (Prevesti na HR)** |
| [OpeningCSVImportModal.tsx:L154](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/OpeningCSVImportModal.tsx#L154) | `ternary condition literal` | Nyitó adatok importálása (.xlsx, .xls, .csv, .json) | **— (Prevesti na HR)** |
| [OpeningCSVImportModal.tsx:L166](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/OpeningCSVImportModal.tsx#L166) | `ternary condition literal` | Főkönyvi Nyitó egyenlegek | **— (Prevesti na HR)** |
| [OpeningCSVImportModal.tsx:L170](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/OpeningCSVImportModal.tsx#L170) | `ternary condition literal` | Nyitó Számlák (Hamarosan) | **— (Prevesti na HR)** |
| [OpeningCSVImportModal.tsx:L177](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/OpeningCSVImportModal.tsx#L177) | `ternary condition literal` | Támogatott formátumok: | **— (Prevesti na HR)** |
| [OpeningCSVImportModal.tsx:L215](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/OpeningCSVImportModal.tsx#L215) | `ternary condition literal` | Fájl feldolgozása... | **— (Prevesti na HR)** |
| [OpeningCSVImportModal.tsx:L216](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/OpeningCSVImportModal.tsx#L216) | `ternary condition literal` | Húzd ide vagy kattints a fájl kiválasztásához | **— (Prevesti na HR)** |
| [OpeningCSVImportModal.tsx:L219](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/OpeningCSVImportModal.tsx#L219) | `ternary condition literal` | Támogatott kiterjesztések: .xlsx, .xls, .xml, .csv, .json | **— (Prevesti na HR)** |
| [OpeningCSVImportModal.tsx:L388](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/OpeningCSVImportModal.tsx#L388) | `ternary condition literal` | Mégse | **Odustani** |
| [OpeningCSVImportModal.tsx:L397](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/OpeningCSVImportModal.tsx#L397) | `ternary condition literal` | Importálás alkalmazása (${activeItems.length}) | **— (Prevesti na HR)** |
| [OpeningJournalWizardModal.tsx:L126](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/OpeningJournalWizardModal.tsx#L126) | `ternary condition literal` | Főkönyv & 491 | **— (Prevesti na HR)** |
| [OpeningJournalWizardModal.tsx:L128](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/OpeningJournalWizardModal.tsx#L128) | `ternary condition literal` | Rendező | **— (Prevesti na HR)** |
| [OpeningJournalWizardModal.tsx:L139](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/OpeningJournalWizardModal.tsx#L139) | `ternary condition literal` | Előző évi záró mérleg és nyitó főkönyvi kivonat alapján | **— (Prevesti na HR)** |
| [OpeningJournalWizardModal.tsx:L144](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/OpeningJournalWizardModal.tsx#L144) | `ternary condition literal` | Eszköz nyitó tétel | **— (Prevesti na HR)** |
| [OpeningJournalWizardModal.tsx:L145](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/OpeningJournalWizardModal.tsx#L145) | `ternary condition literal` | Forrás nyitó tétel | **— (Prevesti na HR)** |
| [OpeningJournalWizardModal.tsx:L182](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/OpeningJournalWizardModal.tsx#L182) | `ternary condition literal` | Számlatükör sikeresen importálva! | **— (Prevesti na HR)** |
| [OpeningJournalWizardModal.tsx:L240](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/OpeningJournalWizardModal.tsx#L240) | `ternary condition literal` | Bejelentkezés szükséges. | **— (Prevesti na HR)** |
| ... | ... | *(További 605 elem a teljes JSON leltárban)* | ... |


---

## 🖥️ 4. Felületi Kezelőszervek, Gombok, Fejlécek és Mezők (JSX & Props)

| Forrás és sorszám | Elem | Megjelenő magyar szöveg | Javasolt horvát (HR) fordítás |
| :--- | :--- | :--- | :--- |
| [AssetActivationDialog.tsx:L600](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/AssetActivationDialog.tsx#L600) | `JSX node text` | Fejlesztési Tartalék Keret | **— (Prevesti na HR)** |
| [AssetActivationDialog.tsx:L625](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/AssetActivationDialog.tsx#L625) | `JSX node text` | Felhasznált Összeg (Ft) | **— (Prevesti na HR)** |
| [AssetActivationDialog.tsx:L636](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/AssetActivationDialog.tsx#L636) | `JSX node text` | Adózási hatás: | **— (Prevesti na HR)** |
| [ReactivationDialog.tsx:L74](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/ReactivationDialog.tsx#L74) | `JSX node text` | Jelenlegi bekerülési érték: | **— (Prevesti na HR)** |
| [ReactivationDialog.tsx:L80](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/ReactivationDialog.tsx#L80) | `JSX node text` | Ráaktiválás összege: | **— (Prevesti na HR)** |
| [ReactivationDialog.tsx:L85](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/ReactivationDialog.tsx#L85) | `JSX node text` | Új bekerülési érték: | **— (Prevesti na HR)** |
| [ReactivationDialog.tsx:L104](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/ReactivationDialog.tsx#L104) | `JSX node text` | Ráaktiválás dátuma | **— (Prevesti na HR)** |
| [ReactivationDialog.tsx:L109](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/ReactivationDialog.tsx#L109) | `JSX node text` | Megjegyzés | **— (Prevesti na HR)** |
| [ReactivationDialog.tsx:L120](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/ReactivationDialog.tsx#L120) | `JSX node text` | Mégse | **Odustani** |
| [AddGlAccountModal.tsx:L209](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/AddGlAccountModal.tsx#L209) | `JSX node text` | Aktív sablon: | **— (Prevesti na HR)** |
| [AddGlAccountModal.tsx:L334](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/AddGlAccountModal.tsx#L334) | `JSX node text` | EUR — Euró (Fix devizás bank / pénztár) | **— (Prevesti na HR)** |
| [AddGlAccountModal.tsx:L335](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/AddGlAccountModal.tsx#L335) | `JSX node text` | USD — Amerikai dollár | **— (Prevesti na HR)** |
| [AddGlAccountModal.tsx:L336](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/AddGlAccountModal.tsx#L336) | `JSX node text` | CHF — Svájci frank | **— (Prevesti na HR)** |
| [AddGlAccountModal.tsx:L338](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/AddGlAccountModal.tsx#L338) | `JSX node text` | Tetszőleges / Többdevizás analitika (pl. Vevő, Szállító) | **— (Prevesti na HR)** |
| [GeneralLedgerTable.tsx:L3050](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GeneralLedgerTable.tsx#L3050) | `JSX node text` | Összeg: | **Iznos:** |
| [GlAnalyticReconciliationView.tsx:L252](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GlAnalyticReconciliationView.tsx#L252) | `JSX node text` | Analitika összesen: | **— (Prevesti na HR)** |
| [GlKpiBar.tsx:L219](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GlKpiBar.tsx#L219) | `JSX node text` | Kész (100%) | **— (Prevesti na HR)** |
| [GlToolbar.tsx:L178](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GlToolbar.tsx#L178) | `JSX node text` | XML Import | **— (Prevesti na HR)** |
| [ManagePresetsModal.tsx:L390](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/ManagePresetsModal.tsx#L390) | `JSX node text` | lekönyvelt naplótétel | **— (Prevesti na HR)** |
| [ManagePresetsModal.tsx:L393](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/ManagePresetsModal.tsx#L393) | `JSX node text` | banki tranzakció | **— (Prevesti na HR)** |
| [ManagePresetsModal.tsx:L396](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/ManagePresetsModal.tsx#L396) | `JSX node text` | számla | **Račun** |
| [ManagePresetsModal.tsx:L399](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/ManagePresetsModal.tsx#L399) | `JSX node text` | NAV számla | **— (Prevesti na HR)** |
| [ManagePresetsModal.tsx:L402](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/ManagePresetsModal.tsx#L402) | `JSX node text` | tárgyi eszköz | **Dugotrajna imovina** |
| [ManagePresetsModal.tsx:L405](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/ManagePresetsModal.tsx#L405) | `JSX node text` | éves beszámoló | **— (Prevesti na HR)** |
| [ManagePresetsModal.tsx:L408](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/ManagePresetsModal.tsx#L408) | `JSX node text` | elhatárolás | **— (Prevesti na HR)** |
| [PartnerLedgerCardView.tsx:L378](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/PartnerLedgerCardView.tsx#L378) | `JSX node text` | Bizonylatszám | **— (Prevesti na HR)** |
| [PartnerLedgerCardView.tsx:L379](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/PartnerLedgerCardView.tsx#L379) | `JSX node text` | Dátum | **Datum** |
| [PartnerLedgerCardView.tsx:L380](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/PartnerLedgerCardView.tsx#L380) | `JSX node text` | Esedékesség | **— (Prevesti na HR)** |
| [PartnerLedgerCardView.tsx:L381](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/PartnerLedgerCardView.tsx#L381) | `JSX node text` | Főkönyvi szám | **Broj konta** |
| [PartnerLedgerCardView.tsx:L382](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/PartnerLedgerCardView.tsx#L382) | `JSX node text` | Szöveg / Megnevezés | **— (Prevesti na HR)** |
| [PartnerLedgerCardView.tsx:L383](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/PartnerLedgerCardView.tsx#L383) | `JSX node text` | Deviza összeg | **— (Prevesti na HR)** |
| [PartnerLedgerCardView.tsx:L385](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/PartnerLedgerCardView.tsx#L385) | `JSX node text` | Irány | **— (Prevesti na HR)** |
| [AddManualJournalEntryModal.tsx:L783](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/AddManualJournalEntryModal.tsx#L783) | `JSX node text` | Gyakori jogcímek | **— (Prevesti na HR)** |
| [CreateJournalModal.tsx:L238](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/CreateJournalModal.tsx#L238) | `JSX node text` | Új Könyvelési Napló Létrehozása | **— (Prevesti na HR)** |
| [CreateJournalModal.tsx:L248](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/CreateJournalModal.tsx#L248) | `JSX node text` | Naplótípus * | **— (Prevesti na HR)** |
| [CreateJournalModal.tsx:L264](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/CreateJournalModal.tsx#L264) | `JSX node text` | Naplókód * | **— (Prevesti na HR)** |
| [CreateJournalModal.tsx:L277](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/CreateJournalModal.tsx#L277) | `JSX node text` | Napló megnevezése * | **— (Prevesti na HR)** |
| [CreateJournalModal.tsx:L289](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/CreateJournalModal.tsx#L289) | `JSX node text` | Pénznem * | **— (Prevesti na HR)** |
| [CreateJournalModal.tsx:L296](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/CreateJournalModal.tsx#L296) | `JSX node text` | EUR - Euró | **— (Prevesti na HR)** |
| [CreateJournalModal.tsx:L297](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/CreateJournalModal.tsx#L297) | `JSX node text` | USD - Amerikai dollár | **— (Prevesti na HR)** |
| [CreateJournalModal.tsx:L299](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/CreateJournalModal.tsx#L299) | `JSX node text` | CHF - Svájci frank | **— (Prevesti na HR)** |
| [CreateJournalModal.tsx:L305](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/CreateJournalModal.tsx#L305) | `JSX node text` | Kapcsolt főkönyvi szám | **— (Prevesti na HR)** |
| [CreateJournalModal.tsx:L315](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/CreateJournalModal.tsx#L315) | `JSX node text` | Nincs hozzárendelve | **— (Prevesti na HR)** |
| [ManageJournalsModal.tsx:L114](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/ManageJournalsModal.tsx#L114) | `JSX node text` | Könyvelési Naplótörzs Kezelése | **— (Prevesti na HR)** |
| [ManageJournalsModal.tsx:L126](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/ManageJournalsModal.tsx#L126) | `JSX node text` | Új Napló | **— (Prevesti na HR)** |
| [ManageJournalsModal.tsx:L134](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/ManageJournalsModal.tsx#L134) | `JSX node text` | Kód | **— (Prevesti na HR)** |
| [ManageJournalsModal.tsx:L135](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/ManageJournalsModal.tsx#L135) | `JSX node text` | Megnevezés | **— (Prevesti na HR)** |
| [ManageJournalsModal.tsx:L136](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/ManageJournalsModal.tsx#L136) | `JSX node text` | Típus | **— (Prevesti na HR)** |
| [ManageJournalsModal.tsx:L138](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/ManageJournalsModal.tsx#L138) | `JSX node text` | Kapcsolt Főkönyv | **— (Prevesti na HR)** |
| [ManageJournalsModal.tsx:L139](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/ManageJournalsModal.tsx#L139) | `JSX node text` | Státusz | **— (Prevesti na HR)** |
| [ManageJournalsModal.tsx:L140](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/ManageJournalsModal.tsx#L140) | `JSX node text` | Művelet | **— (Prevesti na HR)** |
| [OpeningCSVImportModal.tsx:L246](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/OpeningCSVImportModal.tsx#L246) | `JSX node text` | Összes Tartozik (T) | **— (Prevesti na HR)** |
| [OpeningCSVImportModal.tsx:L252](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/OpeningCSVImportModal.tsx#L252) | `JSX node text` | Összes Követel (K) | **— (Prevesti na HR)** |
| [OpeningCSVImportModal.tsx:L258](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/OpeningCSVImportModal.tsx#L258) | `JSX node text` | Mérlegegyezőség | **— (Prevesti na HR)** |
| [OpeningCSVImportModal.tsx:L289](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/OpeningCSVImportModal.tsx#L289) | `JSX node text` | Összesített Főkönyv | **— (Prevesti na HR)** |
| [OpeningCSVImportModal.tsx:L290](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/OpeningCSVImportModal.tsx#L290) | `JSX node text` | Ajánlott | **— (Prevesti na HR)** |
| [OpeningCSVImportModal.tsx:L308](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/OpeningCSVImportModal.tsx#L308) | `JSX node text` | Teljesen Tételes | **— (Prevesti na HR)** |
| [OpeningCSVImportModal.tsx:L340](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/OpeningCSVImportModal.tsx#L340) | `JSX node text` | Számlaszám | **— (Prevesti na HR)** |
| [OpeningCSVImportModal.tsx:L342](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/OpeningCSVImportModal.tsx#L342) | `JSX node text` | Összeg | **Iznos** |
| [OpeningCSVImportModal.tsx:L343](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/OpeningCSVImportModal.tsx#L343) | `JSX node text` | Megnevezés | **— (Prevesti na HR)** |
| [OpeningJournalWizardModal.tsx:L1282](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/OpeningJournalWizardModal.tsx#L1282) | `JSX node text` | Árfolyam: | **— (Prevesti na HR)** |
| [PeriodClosingSettings.tsx:L123](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/PeriodClosingSettings.tsx#L123) | `JSX node text` | Kiválasztott üzleti év | **— (Prevesti na HR)** |
| [AccountingPolicyRulesDialog.tsx:L131](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/settings/AccountingPolicyRulesDialog.tsx#L131) | `JSX node text` | Összefoglaló: | **— (Prevesti na HR)** |
| [AccountingPolicyRulesDialog.tsx:L272](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/settings/AccountingPolicyRulesDialog.tsx#L272) | `JSX node text` | Beállított érték: | **— (Prevesti na HR)** |
| [AccountingPolicySection.tsx:L248](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/settings/AccountingPolicySection.tsx#L248) | `JSX node text` | Letöltés | **Preuzmi** |
| [AccountingPolicySection.tsx:L263](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/settings/AccountingPolicySection.tsx#L263) | `JSX node text` | Új verzió | **— (Prevesti na HR)** |
| [AccountingPolicySection.tsx:L289](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/settings/AccountingPolicySection.tsx#L289) | `JSX node text` | A dokumentum szövegének elemzése és a számviteli szabályok automatikus k... | **— (Prevesti na HR)** |
| [BulkRoundingWriteOffModal.tsx:L103](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/subledger/BulkRoundingWriteOffModal.tsx#L103) | `JSX node text` | Kerekítési Különbözetek Csoportos Leírása (≤ 10 Ft) | **— (Prevesti na HR)** |
| [SubledgerExportDialog.tsx:L153](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/subledger/SubledgerExportDialog.tsx#L153) | `JSX node text` | Korosítási kategória | **— (Prevesti na HR)** |
| [SubledgerExportDialog.tsx:L154](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/subledger/SubledgerExportDialog.tsx#L154) | `JSX node text` | Tételek száma | **— (Prevesti na HR)** |
| [SubledgerExportDialog.tsx:L155](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/subledger/SubledgerExportDialog.tsx#L155) | `JSX node text` | Fennmaradó nyitott összeg | **— (Prevesti na HR)** |
| [SubledgerExportDialog.tsx:L159](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/subledger/SubledgerExportDialog.tsx#L159) | `JSX node text` | Még nem járt le | **— (Prevesti na HR)** |
| [SubledgerExportDialog.tsx:L160](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/subledger/SubledgerExportDialog.tsx#L160) | `JSX node text` | 1 - 30 napja lejárt | **— (Prevesti na HR)** |
| [SubledgerExportDialog.tsx:L161](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/subledger/SubledgerExportDialog.tsx#L161) | `JSX node text` | 31 - 60 napja lejárt | **— (Prevesti na HR)** |
| [SubledgerExportDialog.tsx:L162](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/subledger/SubledgerExportDialog.tsx#L162) | `JSX node text` | 61 - 90 napja lejárt | **— (Prevesti na HR)** |
| [SubledgerExportDialog.tsx:L163](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/subledger/SubledgerExportDialog.tsx#L163) | `JSX node text` | 90 napon túl lejárt | **— (Prevesti na HR)** |
| [SubledgerExportDialog.tsx:L171](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/subledger/SubledgerExportDialog.tsx#L171) | `JSX node text` | Bizonylatszám | **— (Prevesti na HR)** |
| [SubledgerExportDialog.tsx:L172](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/subledger/SubledgerExportDialog.tsx#L172) | `JSX node text` | Napló | **Dnevnik** |
| [SubledgerExportDialog.tsx:L173](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/subledger/SubledgerExportDialog.tsx#L173) | `JSX node text` | Könyvelés | **— (Prevesti na HR)** |
| [SubledgerExportDialog.tsx:L174](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/subledger/SubledgerExportDialog.tsx#L174) | `JSX node text` | Esedékesség | **— (Prevesti na HR)** |
| [SubledgerExportDialog.tsx:L175](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/subledger/SubledgerExportDialog.tsx#L175) | `JSX node text` | Partner | **Partner** |
| [SubledgerExportDialog.tsx:L176](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/subledger/SubledgerExportDialog.tsx#L176) | `JSX node text` | Főkönyv | **Glavna knjiga** |
| [SubledgerExportDialog.tsx:L178](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/subledger/SubledgerExportDialog.tsx#L178) | `JSX node text` | Eredeti összeg | **— (Prevesti na HR)** |
| [SubledgerExportDialog.tsx:L180](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/subledger/SubledgerExportDialog.tsx#L180) | `JSX node text` | Nyitott | **Otvoreno** |
| [SubledgerExportDialog.tsx:L223](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/subledger/SubledgerExportDialog.tsx#L223) | `JSX node text` | Folyószámla Kimutatás Export | **— (Prevesti na HR)** |
| [SubledgerItemMatchesModal.tsx:L46](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/subledger/SubledgerItemMatchesModal.tsx#L46) | `JSX node text` | Kapcsolódó rendezések és párosítások | **— (Prevesti na HR)** |
| [SubledgerItemMatchesModal.tsx:L56](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/subledger/SubledgerItemMatchesModal.tsx#L56) | `JSX node text` | Eredeti könyvelt összeg | **— (Prevesti na HR)** |
| [SubledgerItemMatchesModal.tsx:L83](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/subledger/SubledgerItemMatchesModal.tsx#L83) | `JSX node text` | Fennmaradó nyitott | **— (Prevesti na HR)** |
| [SubledgerPostingModal.tsx:L412](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/subledger/SubledgerPostingModal.tsx#L412) | `JSX node text` | Számla módosítása és kontírozása | **— (Prevesti na HR)** |
| [SubledgerPostingModal.tsx:L417](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/subledger/SubledgerPostingModal.tsx#L417) | `JSX node text` | Számla könyvelése (Kontírozás ellenőrzése) | **— (Prevesti na HR)** |
| [SubledgerPostingModal.tsx:L463](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/subledger/SubledgerPostingModal.tsx#L463) | `JSX node text` | Számlasorszám / Bizonylat: | **— (Prevesti na HR)** |
| [SubledgerPostingModal.tsx:L483](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/subledger/SubledgerPostingModal.tsx#L483) | `JSX node text` | Partner: | **Partner:** |
| [SubledgerPostingModal.tsx:L495](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/subledger/SubledgerPostingModal.tsx#L495) | `JSX node text` | Könyvelés: | **— (Prevesti na HR)** |
| [SubledgerPostingModal.tsx:L500](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/subledger/SubledgerPostingModal.tsx#L500) | `JSX node text` | Esedékesség: | **— (Prevesti na HR)** |
| [SubledgerPostingModal.tsx:L510](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/subledger/SubledgerPostingModal.tsx#L510) | `JSX node text` | Nettó összeg | **Neto iznos** |
| [SubledgerPostingModal.tsx:L526](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/subledger/SubledgerPostingModal.tsx#L526) | `JSX node text` | ÁFA összeg | **Iznos PDV-a** |
| [SubledgerPostingModal.tsx:L544](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/subledger/SubledgerPostingModal.tsx#L544) | `JSX node text` | Bruttó összeg | **Bruto iznos** |
| [SubledgerPostingModal.tsx:L613](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/subledger/SubledgerPostingModal.tsx#L613) | `JSX node text` | Új sor hozzáadása | **— (Prevesti na HR)** |
| [SubledgerPostingModal.tsx:L624](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/subledger/SubledgerPostingModal.tsx#L624) | `JSX node text` | Főkönyvi számla (Kontír) | **— (Prevesti na HR)** |
| [SubledgerPostingModal.tsx:L625](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/subledger/SubledgerPostingModal.tsx#L625) | `JSX node text` | Összeg (Ft) | **— (Prevesti na HR)** |
| [SubledgerPostingModal.tsx:L626](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/subledger/SubledgerPostingModal.tsx#L626) | `JSX node text` | Szerepkör | **— (Prevesti na HR)** |
| [SubledgerPostingModal.tsx:L627](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/subledger/SubledgerPostingModal.tsx#L627) | `JSX node text` | Megjegyzés / Sor leírás | **— (Prevesti na HR)** |
| [SubledgerPostingModal.tsx:L684](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/subledger/SubledgerPostingModal.tsx#L684) | `JSX node text` | Válassz számlát... | **— (Prevesti na HR)** |
| [SubledgerPostingModal.tsx:L699](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/subledger/SubledgerPostingModal.tsx#L699) | `JSX node text` | Nincs találat. | **— (Prevesti na HR)** |
| [SubledgerPostingModal.tsx:L791](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/subledger/SubledgerPostingModal.tsx#L791) | `JSX node text` | ∑ Követel (K): | **— (Prevesti na HR)** |
| [SubledgerPostingModal.tsx:L796](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/subledger/SubledgerPostingModal.tsx#L796) | `JSX node text` | Különbözet (Δ): | **— (Prevesti na HR)** |
| [SubledgerPostingModal.tsx:L811](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/subledger/SubledgerPostingModal.tsx#L811) | `JSX node text` | Mérlegben (∑T = ∑K) | **— (Prevesti na HR)** |
| [SubledgerPostingModal.tsx:L816](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/subledger/SubledgerPostingModal.tsx#L816) | `JSX node text` | Nincs egyensúlyban | **— (Prevesti na HR)** |
| [SubledgerPostingModal.tsx:L866](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/subledger/SubledgerPostingModal.tsx#L866) | `JSX node text` | Mentés piszkozatként | **— (Prevesti na HR)** |
| [SubledgerPostingModal.tsx:L880](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/subledger/SubledgerPostingModal.tsx#L880) | `JSX node text` | Végleges Könyvelés | **— (Prevesti na HR)** |
| [WriteOffSettlementModal.tsx:L91](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/subledger/WriteOffSettlementModal.tsx#L91) | `JSX node text` | Különbözet Leírás és Lezárás | **— (Prevesti na HR)** |
| [WriteOffSettlementModal.tsx:L102](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/subledger/WriteOffSettlementModal.tsx#L102) | `JSX node text` | Bizonylat / Partner: | **— (Prevesti na HR)** |
| [WriteOffSettlementModal.tsx:L108](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/subledger/WriteOffSettlementModal.tsx#L108) | `JSX node text` | Főkönyvi számla: | **— (Prevesti na HR)** |
| [WriteOffSettlementModal.tsx:L112](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/subledger/WriteOffSettlementModal.tsx#L112) | `JSX node text` | Eredeti könyvelt összeg: | **— (Prevesti na HR)** |
| [WriteOffSettlementModal.tsx:L125](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/subledger/WriteOffSettlementModal.tsx#L125) | `JSX node text` | Jelenlegi nyitott különbözet: | **— (Prevesti na HR)** |
| [WriteOffSettlementModal.tsx:L134](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/subledger/WriteOffSettlementModal.tsx#L134) | `JSX node text` | Különbözet Típusa | **— (Prevesti na HR)** |
| [ReturnHistoryTable.tsx:L30](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/vat/ReturnHistoryTable.tsx#L30) | `JSX node text` | Még nincs korábbi bevallás | **— (Prevesti na HR)** |
| [ReturnHistoryTable.tsx:L39](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/vat/ReturnHistoryTable.tsx#L39) | `JSX node text` | Időszak | **— (Prevesti na HR)** |
| [ReturnHistoryTable.tsx:L40](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/vat/ReturnHistoryTable.tsx#L40) | `JSX node text` | Státusz | **— (Prevesti na HR)** |
| [ReturnHistoryTable.tsx:L41](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/vat/ReturnHistoryTable.tsx#L41) | `JSX node text` | Fizetendő | **Za plaćanje** |
| [ReturnHistoryTable.tsx:L42](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/vat/ReturnHistoryTable.tsx#L42) | `JSX node text` | Levonható | **— (Prevesti na HR)** |
| [ReturnHistoryTable.tsx:L43](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/vat/ReturnHistoryTable.tsx#L43) | `JSX node text` | Egyenleg | **— (Prevesti na HR)** |
| [ReturnHistoryTable.tsx:L44](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/vat/ReturnHistoryTable.tsx#L44) | `JSX node text` | Utoljára | **— (Prevesti na HR)** |
| [VatCodeConfigTab.tsx:L115](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/vat/VatCodeConfigTab.tsx#L115) | `JSX node text` | NAV 2665 Kód * | **— (Prevesti na HR)** |
| [VatCodeConfigTab.tsx:L123](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/vat/VatCodeConfigTab.tsx#L123) | `JSX node text` | Könyvelői Kód (technikai) | **— (Prevesti na HR)** |
| [VatCodeConfigTab.tsx:L132](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/vat/VatCodeConfigTab.tsx#L132) | `JSX node text` | Megnevezés / Leírás (Számla Tooltip) * | **— (Prevesti na HR)** |
| [VatCodeConfigTab.tsx:L143](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/vat/VatCodeConfigTab.tsx#L143) | `JSX node text` | ÁFA % | **— (Prevesti na HR)** |
| [VatCodeConfigTab.tsx:L145](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/vat/VatCodeConfigTab.tsx#L145) | `JSX node text` | Irány | **— (Prevesti na HR)** |
| [VatCodeConfigTab.tsx:L149](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/vat/VatCodeConfigTab.tsx#L149) | `JSX node text` | Kimenő | **— (Prevesti na HR)** |
| [VatCodeConfigTab.tsx:L150](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/vat/VatCodeConfigTab.tsx#L150) | `JSX node text` | Bejövő | **— (Prevesti na HR)** |
| [VatCodeConfigTab.tsx:L157](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/vat/VatCodeConfigTab.tsx#L157) | `JSX node text` | Levonható | **— (Prevesti na HR)** |
| [VatCodeConfigTab.tsx:L158](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/vat/VatCodeConfigTab.tsx#L158) | `JSX node text` | Fordított | **— (Prevesti na HR)** |
| [VatCodeConfigTab.tsx:L164](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/vat/VatCodeConfigTab.tsx#L164) | `JSX node text` | Cél sorok (2665) | **— (Prevesti na HR)** |
| [VatCodeConfigTab.tsx:L165](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/vat/VatCodeConfigTab.tsx#L165) | `JSX node text` | Sor | **— (Prevesti na HR)** |
| [VatCodeConfigTab.tsx:L183](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/vat/VatCodeConfigTab.tsx#L183) | `JSX node text` | Adóalap | **— (Prevesti na HR)** |
| [VatCodeConfigTab.tsx:L184](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/vat/VatCodeConfigTab.tsx#L184) | `JSX node text` | Adó | **— (Prevesti na HR)** |
| [VatCodeConfigTab.tsx:L199](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/vat/VatCodeConfigTab.tsx#L199) | `JSX node text` | Mégse | **Odustani** |
| [VatCodeConfigTab.tsx:L319](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/vat/VatCodeConfigTab.tsx#L319) | `JSX node text` | Áfakód Beállítások | **— (Prevesti na HR)** |
| [VatCodeConfigTab.tsx:L320](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/vat/VatCodeConfigTab.tsx#L320) | `JSX node text` | Párosítsd össze az áfakódokat a 2665-ös nyomtatvány soraival és a számlá... | **— (Prevesti na HR)** |
| [VatCodeConfigTab.tsx:L341](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/vat/VatCodeConfigTab.tsx#L341) | `JSX node text` | Számlákon megjelenő áfakód rendszer | **— (Prevesti na HR)** |
| [VatCodeConfigTab.tsx:L397](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/vat/VatCodeConfigTab.tsx#L397) | `JSX node text` | Nincs áfakód ebben a kategóriában | **— (Prevesti na HR)** |
| [VatCodeConfigTab.tsx:L403](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/vat/VatCodeConfigTab.tsx#L403) | `JSX node text` | NAV 2665 Kód | **— (Prevesti na HR)** |
| [VatCodeConfigTab.tsx:L411](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/vat/VatCodeConfigTab.tsx#L411) | `JSX node text` | Könyvelői Kód | **— (Prevesti na HR)** |
| [VatCodeConfigTab.tsx:L418](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/vat/VatCodeConfigTab.tsx#L418) | `JSX node text` | Megnevezés / Leírás (Tooltip) | **— (Prevesti na HR)** |
| [VatCodeConfigTab.tsx:L420](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/vat/VatCodeConfigTab.tsx#L420) | `JSX node text` | 2665-ös Sorok | **— (Prevesti na HR)** |
| [VatCodeConfigTab.tsx:L422](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/vat/VatCodeConfigTab.tsx#L422) | `JSX node text` | Műveletek | **— (Prevesti na HR)** |
| [VatRowDrillDown.tsx:L138](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/vat/VatRowDrillDown.tsx#L138) | `JSX node text` | Nincs tétel ehhez a számlához | **— (Prevesti na HR)** |
| [VatRowDrillDown.tsx:L144](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/vat/VatRowDrillDown.tsx#L144) | `JSX node text` | Megnevezés | **— (Prevesti na HR)** |
| [VatRowDrillDown.tsx:L145](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/vat/VatRowDrillDown.tsx#L145) | `JSX node text` | Mennyiség | **— (Prevesti na HR)** |
| [VatRowDrillDown.tsx:L146](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/vat/VatRowDrillDown.tsx#L146) | `JSX node text` | Egységár | **— (Prevesti na HR)** |
| [VatRowDrillDown.tsx:L147](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/vat/VatRowDrillDown.tsx#L147) | `JSX node text` | Nettó | **— (Prevesti na HR)** |
| [VatRowDrillDown.tsx:L148](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/vat/VatRowDrillDown.tsx#L148) | `JSX node text` | ÁFA | **PDV** |
| [VatRowDrillDown.tsx:L922](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/vat/VatRowDrillDown.tsx#L922) | `JSX node text` | 66. sor szűrés: | **— (Prevesti na HR)** |
| [VatRowDrillDown.tsx:L964](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/vat/VatRowDrillDown.tsx#L964) | `JSX node text` | Számla | **Račun** |
| [VatRowDrillDown.tsx:L965](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/vat/VatRowDrillDown.tsx#L965) | `JSX node text` | Partner | **Partner** |
| [VatRowDrillDown.tsx:L966](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/vat/VatRowDrillDown.tsx#L966) | `JSX node text` | Teljesítés | **— (Prevesti na HR)** |
| [VatRowDrillDown.tsx:L1195](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/vat/VatRowDrillDown.tsx#L1195) | `JSX node text` | Ehhez a bizonylathoz nincsenek részletező tételsorok rögzítve (fejléc-sz... | **— (Prevesti na HR)** |
| [annualReportEngine.ts:L183](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/annual-report/core/annualReportEngine.ts#L183) | `JSX node text` | Mutató | **— (Prevesti na HR)** |
| [annualReportEngine.ts:L184](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/annual-report/core/annualReportEngine.ts#L184) | `JSX node text` | Érték | **— (Prevesti na HR)** |
| [annualReportEngine.ts:L188](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/annual-report/core/annualReportEngine.ts#L188) | `JSX node text` | Összes eszköz | **— (Prevesti na HR)** |
| [annualReportEngine.ts:L189](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/annual-report/core/annualReportEngine.ts#L189) | `JSX node text` | Aktív eszközök | **— (Prevesti na HR)** |
| [annualReportEngine.ts:L190](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/annual-report/core/annualReportEngine.ts#L190) | `JSX node text` | Kivezetett eszközök | **— (Prevesti na HR)** |
| [annualReportEngine.ts:L191](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/annual-report/core/annualReportEngine.ts#L191) | `JSX node text` | Bruttó érték összesen | **— (Prevesti na HR)** |
| [annualReportEngine.ts:L192](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/annual-report/core/annualReportEngine.ts#L192) | `JSX node text` | Aktív eszközök bruttó értéke | **— (Prevesti na HR)** |
| [annualReportEngine.ts:L197](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/annual-report/core/annualReportEngine.ts#L197) | `JSX node text` | Tárgyi eszköz adatok nem érhetők el. | **— (Prevesti na HR)** |
| [annualReportEngine.ts:L206](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/annual-report/core/annualReportEngine.ts#L206) | `JSX node text` | Sor | **— (Prevesti na HR)** |
| [annualReportEngine.ts:L207](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/annual-report/core/annualReportEngine.ts#L207) | `JSX node text` | Megnevezés | **— (Prevesti na HR)** |
| [annualReportEngine.ts:L208](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/annual-report/core/annualReportEngine.ts#L208) | `JSX node text` | Előző év | **— (Prevesti na HR)** |
| [annualReportEngine.ts:L209](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/annual-report/core/annualReportEngine.ts#L209) | `JSX node text` | Tárgyév | **— (Prevesti na HR)** |
| [annualReportEngine.ts:L229](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/annual-report/core/annualReportEngine.ts#L229) | `JSX node text` | Saját tőke adatok nem érhetők el. | **— (Prevesti na HR)** |
| [annualReportEngine.ts:L242](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/annual-report/core/annualReportEngine.ts#L242) | `JSX node text` | Átlagos statisztikai létszám | **— (Prevesti na HR)** |
| [annualReportEngine.ts:L243](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/annual-report/core/annualReportEngine.ts#L243) | `JSX node text` | Bérköltség | **— (Prevesti na HR)** |
| [annualReportEngine.ts:L244](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/annual-report/core/annualReportEngine.ts#L244) | `JSX node text` | Bérjárulékok | **— (Prevesti na HR)** |
| [annualReportEngine.ts:L245](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/annual-report/core/annualReportEngine.ts#L245) | `JSX node text` | Összes személyi jellegű ráfordítás | **— (Prevesti na HR)** |
| [annualReportEngine.ts:L250](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/annual-report/core/annualReportEngine.ts#L250) | `JSX node text` | Foglalkoztatotti adatok nem érhetők el. | **— (Prevesti na HR)** |
| [VatA60Table.tsx:L126](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/vat/components/VatA60Table.tsx#L126) | `JSX node text` | ÁNYK A60 Export | **— (Prevesti na HR)** |
| [VatA60Table.tsx:L143](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/vat/components/VatA60Table.tsx#L143) | `JSX node text` | Eltérés vagy hiányzó közösségi adószám észlelhető a 65-ös bevallás sorai... | **— (Prevesti na HR)** |
| [VatA60Table.tsx:L169](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/vat/components/VatA60Table.tsx#L169) | `JSX node text` | Termékértékesítés | **— (Prevesti na HR)** |
| [VatA60Table.tsx:L184](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/vat/components/VatA60Table.tsx#L184) | `JSX node text` | Számlák (Kimenő): | **— (Prevesti na HR)** |
| [VatA60Table.tsx:L190](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/vat/components/VatA60Table.tsx#L190) | `JSX node text` | Bevallás (02. sor): | **— (Prevesti na HR)** |
| ... | ... | *(További 545 elem a teljes JSON leltárban)* | ... |


---

## 🔑 5. Hiányzó vagy Nem Szinkronizált i18n Szótárkulcsok

| Forrás és sorszám | Elem | Megjelenő magyar szöveg | Javasolt horvát (HR) fordítás |
| :--- | :--- | :--- | :--- |
| [AssetActivationDialog.tsx:L431](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/AssetActivationDialog.tsx#L431) | `t('hr:fixed_assets.activation_dialog.policy_low_value_applied') missing in hr/hr.json` | hr:fixed_assets.activation_dialog.policy_low_value_applied | **— (Prevesti na HR)** |
| [GeneralLedgerTable.tsx:L652](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GeneralLedgerTable.tsx#L652) | `t('accounting:general_ledger.entries_sheet.delete_error_title') missing in hr/accounting.json` | Hiba történt a törlés során | **Došlo je do greške** |
| [GeneralLedgerTable.tsx:L653](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GeneralLedgerTable.tsx#L653) | `t('common:error_occurred') missing in hr/common.json` | Váratlan hiba történt. | **Došlo je do greške** |
| [GeneralLedgerTable.tsx:L2073](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GeneralLedgerTable.tsx#L2073) | `t('accounting:general_ledger.table.turnover_debit') missing in hr/accounting.json` | Forgalom T | **— (Prevesti na HR)** |
| [GeneralLedgerTable.tsx:L2074](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GeneralLedgerTable.tsx#L2074) | `t('accounting:general_ledger.table.turnover_credit') missing in hr/accounting.json` | Forgalom K | **— (Prevesti na HR)** |
| [GeneralLedgerTable.tsx:L2075](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GeneralLedgerTable.tsx#L2075) | `t('accounting:general_ledger.table.balance_debit') missing in hr/accounting.json` | Egyenleg T | **— (Prevesti na HR)** |
| [GeneralLedgerTable.tsx:L2076](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GeneralLedgerTable.tsx#L2076) | `t('accounting:general_ledger.table.balance_credit') missing in hr/accounting.json` | Egyenleg K | **— (Prevesti na HR)** |
| [GeneralLedgerTable.tsx:L2382](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GeneralLedgerTable.tsx#L2382) | `t('accounting:general_ledger.tooltips.view_document') missing in hr/accounting.json` | Számlakép / Bizonylat megtekintése | **— (Prevesti na HR)** |
| [GeneralLedgerTable.tsx:L2446](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GeneralLedgerTable.tsx#L2446) | `t('accounting:general_ledger.grouped_items_badge') missing in hr/accounting.json` | tétel | **— (Prevesti na HR)** |
| [GeneralLedgerTable.tsx:L2765](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GeneralLedgerTable.tsx#L2765) | `t('accounting:general_ledger.edit_category_modal.single_title') missing in hr/accounting.json` | Főkönyvi szám módosítása | **— (Prevesti na HR)** |
| [GeneralLedgerTable.tsx:L2766](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GeneralLedgerTable.tsx#L2766) | `t('accounting:general_ledger.edit_category_modal.bulk_title') missing in hr/accounting.json` | Átkontírozás másik számlára | **— (Prevesti na HR)** |
| [GeneralLedgerTable.tsx:L2858](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GeneralLedgerTable.tsx#L2858) | `t('accounting:general_ledger.edit_category_modal.execute_bulk') missing in hr/accounting.json` | Átkontírozás végrehajtása | **— (Prevesti na HR)** |
| [GeneralLedgerTable.tsx:L3003](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GeneralLedgerTable.tsx#L3003) | `t('common:cancel') missing in hr/common.json` | Mégse | **Odustani** |
| [GeneralLedgerTable.tsx:L3016](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GeneralLedgerTable.tsx#L3016) | `t('common:deleting') missing in hr/common.json` | Törlés folyamatban... | **— (Prevesti na HR)** |
| [GeneralLedgerTable.tsx:L3019](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GeneralLedgerTable.tsx#L3019) | `t('common:delete') missing in hr/common.json` | Törlés | **Obriši** |
| [GeneralLedgerTable.tsx:L3056](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GeneralLedgerTable.tsx#L3056) | `t('accounting:general_ledger.bulk.clear_selection') missing in hr/accounting.json` | Kijelölés törlése | **— (Prevesti na HR)** |
| [GlFilterBar.tsx:L83](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GlFilterBar.tsx#L83) | `t('accounting:general_ledger.expand_all_tooltip') missing in hr/accounting.json` | Összes főkönyvi szám és alábontás lenyitása | **— (Prevesti na HR)** |
| [GlFilterBar.tsx:L98](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GlFilterBar.tsx#L98) | `t('accounting:general_ledger.collapse_all_tooltip') missing in hr/accounting.json` | Összes alszámla becsukása a főkategóriák szintjére | **— (Prevesti na HR)** |
| [GlFilterBar.tsx:L327](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GlFilterBar.tsx#L327) | `t('accounting:general_ledger.item_grouping.by_invoice_tooltip') missing in hr/accounting.json` | Számlánkénti összevonás: egy számlán szereplő azonos kontírtételek egy s... | **— (Prevesti na HR)** |
| [GlFilterBar.tsx:L339](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GlFilterBar.tsx#L339) | `t('accounting:general_ledger.item_grouping.by_invoice') missing in hr/accounting.json` | Számlánként | **— (Prevesti na HR)** |
| [GlFilterBar.tsx:L342](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GlFilterBar.tsx#L342) | `t('accounting:general_ledger.item_grouping.detailed_tooltip') missing in hr/accounting.json` | Soronkénti bontás: minden könyvelt számlatétel különálló sorként jelenik... | **— (Prevesti na HR)** |
| [GlFilterBar.tsx:L354](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GlFilterBar.tsx#L354) | `t('accounting:general_ledger.item_grouping.detailed') missing in hr/accounting.json` | Tételenként | **— (Prevesti na HR)** |
| [GlKpiBar.tsx:L143](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GlKpiBar.tsx#L143) | `t('accounting:general_ledger.kpi.details') missing in hr/accounting.json` | Részletek | **Pojedinosti** |
| [GlKpiBar.tsx:L155](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GlKpiBar.tsx#L155) | `t('accounting:general_ledger.kpi.overview_title') missing in hr/accounting.json` | Főkönyvi Összesítés | **— (Prevesti na HR)** |
| [GlKpiBar.tsx:L164](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GlKpiBar.tsx#L164) | `t('accounting:general_ledger.kpi.compact') missing in hr/accounting.json` | Kompakt nézet | **— (Prevesti na HR)** |
| [GlToolbar.tsx:L111](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GlToolbar.tsx#L111) | `t('accounting:general_ledger.toolbar.preset_settings_tooltip') missing in hr/accounting.json` | Számlatükör sablonok kezelése és új sablon feltöltése | **— (Prevesti na HR)** |
| [GlToolbar.tsx:L120](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GlToolbar.tsx#L120) | `t('accounting:general_ledger.toolbar.manage_presets_short') missing in hr/accounting.json` | Kezelés | **— (Prevesti na HR)** |
| [GlToolbar.tsx:L130](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GlToolbar.tsx#L130) | `t('accounting:general_ledger.toolbar.manage_presets_sub') missing in hr/accounting.json` | Meglévő sablonok megtekintése, törlése | **— (Prevesti na HR)** |
| [GlToolbar.tsx:L138](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GlToolbar.tsx#L138) | `t('accounting:general_ledger.toolbar.upload_preset_sub') missing in hr/accounting.json` | Excel vagy CSV számlatükör beolvasása | **— (Prevesti na HR)** |
| [GlToolbar.tsx:L148](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GlToolbar.tsx#L148) | `t('accounting:general_ledger.toolbar.manual_entry_tooltip') missing in hr/accounting.json` | Kézi vegyes könyvelési tétel rögzítése | **— (Prevesti na HR)** |
| [GlToolbar.tsx:L160](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GlToolbar.tsx#L160) | `t('accounting:general_ledger.toolbar.add_account_tooltip') missing in hr/accounting.json` | Új egyedi számlaszám felvitele a számlatükörbe | **— (Prevesti na HR)** |
| [GlToolbar.tsx:L174](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GlToolbar.tsx#L174) | `t('accounting:general_ledger.toolbar.xml_menu_tooltip') missing in hr/accounting.json` | Audit XML fájl importálása vagy korábbi importok ellenőrzése | **— (Prevesti na HR)** |
| [GlToolbar.tsx:L188](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GlToolbar.tsx#L188) | `t('accounting:general_ledger.toolbar.xml_import_desc') missing in hr/accounting.json` | NAV / könyvelőprogram XML auditfájl | **— (Prevesti na HR)** |
| [GlToolbar.tsx:L195](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GlToolbar.tsx#L195) | `t('accounting:general_ledger.toolbar.xml_imports_desc') missing in hr/accounting.json` | Korábban feldolgozott XML-ek állapota | **— (Prevesti na HR)** |
| [GlToolbar.tsx:L202](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GlToolbar.tsx#L202) | `t('accounting:general_ledger.toolbar.ai_tooltip') missing in hr/accounting.json` | Tételek automatikus besorolása mesterséges intelligenciával | **— (Prevesti na HR)** |
| [GlToolbar.tsx:L213](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GlToolbar.tsx#L213) | `t('accounting:general_ledger.toolbar.ai_running') missing in hr/accounting.json` | AI Fut... | **— (Prevesti na HR)** |
| [JournalView.tsx:L349](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/JournalView.tsx#L349) | `t('accounting:general_ledger.journal_view.summary_error') missing in hr/accounting.json` | A tételek betöltése nem sikerült | **— (Prevesti na HR)** |
| [JournalView.tsx:L421](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/JournalView.tsx#L421) | `t('accounting:general_ledger.journal_view.error_title') missing in hr/accounting.json` | Hiba történt a könyvelési tételek betöltése közben | **Došlo je do greške** |
| [JournalView.tsx:L424](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/JournalView.tsx#L424) | `t('accounting:general_ledger.journal_view.error_desc') missing in hr/accounting.json` | Nem sikerült lekérdezni a könyvelési tételeket az adatbázisból. | **— (Prevesti na HR)** |
| [JournalView.tsx:L438](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/JournalView.tsx#L438) | `t('common:retry') missing in hr/common.json` | Újrapróbálás | **— (Prevesti na HR)** |
| [AddManualJournalEntryModal.tsx:L611](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/AddManualJournalEntryModal.tsx#L611) | `t('accounting:dialogs.manual_journal.title_clone') missing in hr/accounting.json` | Bizonylat klónozása (új tételként kerül rögzítésre) | **Nova stavka** |
| [OpeningJournalWizardModal.tsx:L270](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/OpeningJournalWizardModal.tsx#L270) | `t('common:error') missing in hr/common.json` | Hiba történt | **Došlo je do greške** |
| [OpeningJournalWizardModal.tsx:L391](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/OpeningJournalWizardModal.tsx#L391) | `t('dialogs.opening_wizard.validation.at_least_one_valid_line') missing in hr/accounting.json` | Legalább egy érvényes, kitöltött nyitó tételsor szükséges a könyveléshez. | **— (Prevesti na HR)** |
| [OpeningJournalWizardModal.tsx:L716](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/OpeningJournalWizardModal.tsx#L716) | `t('dialogs.opening_wizard.toasts.import_partial_title') missing in hr/accounting.json` | Részleges import | **— (Prevesti na HR)** |
| [OpeningJournalWizardModal.tsx:L717](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/OpeningJournalWizardModal.tsx#L717) | `t('dialogs.opening_wizard.toasts.import_partial_desc') missing in hr/accounting.json` | dialogs.opening_wizard.toasts.import_partial_desc | **— (Prevesti na HR)** |
| [OpeningJournalWizardModal.tsx:L723](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/OpeningJournalWizardModal.tsx#L723) | `t('dialogs.opening_wizard.toasts.import_success_title') missing in hr/accounting.json` | Sikeres import | **— (Prevesti na HR)** |
| [OpeningJournalWizardModal.tsx:L724](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/OpeningJournalWizardModal.tsx#L724) | `t('dialogs.opening_wizard.toasts.import_success_desc') missing in hr/accounting.json` | dialogs.opening_wizard.toasts.import_success_desc | **— (Prevesti na HR)** |
| [OpeningJournalWizardModal.tsx:L731](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/OpeningJournalWizardModal.tsx#L731) | `t('dialogs.opening_wizard.toasts.import_empty_title') missing in hr/accounting.json` | Sikertelen betöltés | **— (Prevesti na HR)** |
| [OpeningJournalWizardModal.tsx:L732](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/OpeningJournalWizardModal.tsx#L732) | `t('dialogs.opening_wizard.toasts.import_empty_desc') missing in hr/accounting.json` | Nem sikerült számlákat párosítani az aktív számlatükörrel. | **— (Prevesti na HR)** |
| [OpeningJournalWizardModal.tsx:L1030](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/OpeningJournalWizardModal.tsx#L1030) | `t('dialogs.opening_wizard.step1.currency') missing in hr/accounting.json` | Pénznem | **Valuta** |
| [OpeningJournalWizardModal.tsx:L1124](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/OpeningJournalWizardModal.tsx#L1124) | `t('dialogs.opening_wizard.step2.no_lines_warning') missing in hr/accounting.json` | Nincsenek nyitó összegek | **— (Prevesti na HR)** |
| [Step2Adatimport.tsx:L30](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/annual-report/components/steps/Step2Adatimport.tsx#L30) | `t('balance_sheet.units.thousand_huf') missing in hr/accounting.json` | E Ft | **— (Prevesti na HR)** |
| [Step6Export.tsx:L279](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/annual-report/components/steps/Step6Export.tsx#L279) | `t('common.error') missing in hr/accounting.json` | common.error | **— (Prevesti na HR)** |
| [VatCollectorAnalyticsView.tsx:L1196](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/vat/components/VatCollectorAnalyticsView.tsx#L1196) | `t('accounting:vat_return.analytics_view.toast_export_pdf_success_desc') missing in hr/accounting.json` | Az ÁFA Gyűjtőkódos Analitika PDF riport elkészült. | **— (Prevesti na HR)** |
| [VatCollectorAnalyticsView.tsx:L1830](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/vat/components/VatCollectorAnalyticsView.tsx#L1830) | `t('common:actions.previous') missing in hr/common.json` | Előző | **— (Prevesti na HR)** |
| [VatCollectorAnalyticsView.tsx:L1845](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/vat/components/VatCollectorAnalyticsView.tsx#L1845) | `t('common:actions.next') missing in hr/common.json` | Következő | **— (Prevesti na HR)** |
| [VatReturnViewTab.tsx:L516](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/vat/components/VatReturnViewTab.tsx#L516) | `t('accounting:vat_return.period.edit_representative') missing in hr/accounting.json` | Ügyintéző adatai (ÁNYK) | **— (Prevesti na HR)** |
| [VatReturnViewTab.tsx:L713](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/vat/components/VatReturnViewTab.tsx#L713) | `t('accounting:vat_return.steel_warning.title') missing in hr/accounting.json` | Hiányos 6/B Acélipari adatok! | **— (Prevesti na HR)** |
| [VatXmlExportModal.tsx:L209](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/vat/components/VatXmlExportModal.tsx#L209) | `t('accounting:vat_return.export_modal.errors.name_required') missing in hr/accounting.json` | Az ügyintéző neve kötelező az ÁNYK 0A főlaphoz! | **— (Prevesti na HR)** |
| [VatXmlExportModal.tsx:L261](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/vat/components/VatXmlExportModal.tsx#L261) | `t('accounting:vat_return.toasts.a60_xml_downloaded_title') missing in hr/accounting.json` | ÁNYK A60 XML letöltve | **— (Prevesti na HR)** |
| [VatXmlExportModal.tsx:L262](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/vat/components/VatXmlExportModal.tsx#L262) | `t('accounting:vat_return.toasts.a60_xml_downloaded_desc') missing in hr/accounting.json` | accounting:vat_return.toasts.a60_xml_downloaded_desc | **— (Prevesti na HR)** |
| [VatXmlExportModal.tsx:L319](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/vat/components/VatXmlExportModal.tsx#L319) | `t('accounting:vat_return.export_modal.title') missing in hr/accounting.json` | ÁNYK XML Export — Ügyintéző kijelölése | **— (Prevesti na HR)** |
| [VatXmlExportModal.tsx:L359](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/vat/components/VatXmlExportModal.tsx#L359) | `t('accounting:vat_return.export_modal.preset_label') missing in hr/accounting.json` | Ügyintéző kijelölése | **— (Prevesti na HR)** |
| [VatXmlExportModal.tsx:L386](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/vat/components/VatXmlExportModal.tsx#L386) | `t('accounting:vat_return.export_modal.rep_name_label') missing in hr/accounting.json` | Ügyintéző neve | **— (Prevesti na HR)** |
| [VatXmlExportModal.tsx:L396](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/vat/components/VatXmlExportModal.tsx#L396) | `t('accounting:vat_return.export_modal.rep_name_placeholder') missing in hr/accounting.json` | pl. Surányi Pál vagy Jámbor Viktor | **— (Prevesti na HR)** |
| [VatXmlExportModal.tsx:L402](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/vat/components/VatXmlExportModal.tsx#L402) | `t('accounting:vat_return.export_modal.rep_name_help') missing in hr/accounting.json` | A bevallás főlapjára (0A0001E007A) kerülő hivatalos kapcsolattartó. | **— (Prevesti na HR)** |
| [VatXmlExportModal.tsx:L410](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/vat/components/VatXmlExportModal.tsx#L410) | `t('accounting:vat_return.export_modal.phone_label') missing in hr/accounting.json` | Telefonszám | **— (Prevesti na HR)** |
| [VatXmlExportModal.tsx:L427](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/vat/components/VatXmlExportModal.tsx#L427) | `t('accounting:vat_return.export_modal.phone_help') missing in hr/accounting.json` | Az ÁNYK főlapra (0A0001E008A) tisztított formátumban kerül (pl. 36301234... | **— (Prevesti na HR)** |
| [VatXmlExportModal.tsx:L435](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/vat/components/VatXmlExportModal.tsx#L435) | `t('accounting:vat_return.export_modal.template_label') missing in hr/accounting.json` | ÁNYK sablon típusa | **— (Prevesti na HR)** |
| [VatXmlExportModal.tsx:L447](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/vat/components/VatXmlExportModal.tsx#L447) | `t('accounting:vat_return.export_modal.template_auto') missing in hr/accounting.json` | Automatikus | **— (Prevesti na HR)** |
| [VatXmlExportModal.tsx:L508](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/vat/components/VatXmlExportModal.tsx#L508) | `t('accounting:vat_return.export_modal.downloading') missing in hr/accounting.json` | Generálás... | **— (Prevesti na HR)** |
| [VatXmlExportModal.tsx:L513](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/vat/components/VatXmlExportModal.tsx#L513) | `t('accounting:vat_return.export_modal.save_and_download') missing in hr/accounting.json` | Mentés & XML letöltés | **— (Prevesti na HR)** |
| [BalanceSheet.tsx:L1054](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/BalanceSheet.tsx#L1054) | `t('accounting:profit_and_loss.table.no_items') missing in hr/accounting.json` | Nincsenek részletes tételek ehhez a főkönyvi számhoz a megadott időszakban. | **— (Prevesti na HR)** |
| [JournalsPage.tsx:L211](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/JournalsPage.tsx#L211) | `t('common:unknown_error') missing in hr/common.json` | Ismeretlen hiba történt | **Došlo je do greške** |
| [JournalsPage.tsx:L809](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/JournalsPage.tsx#L809) | `t('accounting:journals.toasts.bulk_gl_success_title') missing in hr/accounting.json` | Főkönyvi számlaszám sikeresen módosítva! | **— (Prevesti na HR)** |
| [JournalsPage.tsx:L810](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/JournalsPage.tsx#L810) | `t('accounting:journals.toasts.bulk_gl_success_desc') missing in hr/accounting.json` | accounting:journals.toasts.bulk_gl_success_desc | **— (Prevesti na HR)** |
| [JournalsPage.tsx:L815](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/JournalsPage.tsx#L815) | `t('accounting:journals.toasts.bulk_gl_error_title') missing in hr/accounting.json` | Hiba a kontírozás módosításakor | **— (Prevesti na HR)** |
| [JournalsPage.tsx:L1692](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/JournalsPage.tsx#L1692) | `t('accounting:journals.actions.clone_entry') missing in hr/accounting.json` | Bizonylat klónozása (másolása új tételként) | **Nova stavka** |
| [JournalsPage.tsx:L1702](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/JournalsPage.tsx#L1702) | `t('accounting:journals.actions.clone_entry') missing in hr/accounting.json` | Bizonylat klónozása | **— (Prevesti na HR)** |
| [JournalsPage.tsx:L2301](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/JournalsPage.tsx#L2301) | `t('accounting:journals.batch_bar.reassign_gl') missing in hr/accounting.json` | Tömeges kontírozás | **— (Prevesti na HR)** |
| [JournalsPage.tsx:L2522](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/JournalsPage.tsx#L2522) | `t('accounting:journals.bulk_gl.title') missing in hr/accounting.json` | Tömeges főkönyvi szám módosítás | **— (Prevesti na HR)** |
| [JournalsPage.tsx:L2525](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/JournalsPage.tsx#L2525) | `t('accounting:journals.bulk_gl.desc') missing in hr/accounting.json` | A kijelölt tételek Tartozik vagy Követel oldali főkönyvi számának tömege... | **— (Prevesti na HR)** |
| [JournalsPage.tsx:L2531](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/JournalsPage.tsx#L2531) | `t('accounting:journals.bulk_gl.side_label') missing in hr/accounting.json` | Módosítandó oldal | **— (Prevesti na HR)** |
| [JournalsPage.tsx:L2555](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/JournalsPage.tsx#L2555) | `t('accounting:journals.bulk_gl.account_label') missing in hr/accounting.json` | Új főkönyvi szám kiválasztása | **— (Prevesti na HR)** |
| [ProfitAndLoss.tsx:L941](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/ProfitAndLoss.tsx#L941) | `t('accounting:profit_and_loss.toasts.export_loading_items') missing in hr/accounting.json` | Részletes könyvelési tételek letöltése az exporthoz... | **— (Prevesti na HR)** |
| [ProfitAndLoss.tsx:L1436](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/ProfitAndLoss.tsx#L1436) | `t('common:labels.partner') missing in hr/common.json` | Partner | **Partner** |
| [ProfitAndLoss.tsx:L1460](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/ProfitAndLoss.tsx#L1460) | `t('accounting:profit_and_loss.table.no_items') missing in hr/accounting.json` | Nincsenek részletes tételek ehhez a főkönyvi számhoz a megadott időszakban. | **— (Prevesti na HR)** |
| [ProfitAndLoss.tsx:L1599](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/ProfitAndLoss.tsx#L1599) | `t('common:errors.no_company_selected') missing in hr/common.json` | Cég nincs kiválasztva. | **— (Prevesti na HR)** |
| [ProfitAndLoss.tsx:L1631](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/ProfitAndLoss.tsx#L1631) | `t('common:actions.print') missing in hr/common.json` | Nyomtatás | **Ispis** |


---

## 🚀 6. Moduláris Javítási Javaslat

1. A modulban szereplő hardkódolt feliratokat ki kell szervezni a `src/locales/hu/accounting.json` és `src/locales/hr/accounting.json` fájlokba.
2. A `toast({{ title: '...', description: '...' }})` hívásoknál kötelező bevezetni a `t('{ns}:toasts.title')` és `t('{ns}:toasts.desc')` formátumot.
3. A táblázatokban és badge-ekben szereplő hardkódolt magyar string literálokat (`'Fizetve'`, `'Függőben'`) fel kell váltani a központi állapotfordító segédfüggvénnyel vagy szótári kulccsal.
