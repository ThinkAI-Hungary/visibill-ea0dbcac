# 03. Bank, Partnerek és Tranzakciók — HR Lokalizációs Leltár

**Modul hatóköre:** Banki tranzakciók, automatikus és kézi párosítás, netting kompenzáció, pénzeszköz-átvezetések, partnertörzs és OIB kezelés, kintlévőségek és fizetési felszólítók, házipénztár bizonylatok és zárás, devizaárfolyamok.  
**Összes érintett fájl:** 40 db  
**Összes feltárt hiányosság:** 694 db  
**Elsődleges i18n névtér:** `transactions` (továbbá `common`)

---

## 📈 1. Modul Statisztika és Hotspotok

### Kategóriák szerinti megoszlás
| Elem típusa | Előfordulás | Súlyosság / Hatás |
| :--- | :---: | :--- |
| **Értesítési ablakok (Toast)** | 90 db | Magas (P1) — Művelet-visszajelzés a felhasználónak |
| **Modálok és megerősítések (Dialog)** | 2 db | Kritikus (P0/P1) — Űrlapok és felugró ablakok |
| **Státusz jelvények (Badge)** | 4 db | Magas (P1) — Bizonylat- és tranzakció állapotok |
| **Feltételes állapotok (Ternary)** | 259 db | Magas (P1) — Táblázatcellákban megjelenő státuszok |
| **Táblázat oszlopok és menüpontok** | 3 db | Közepes (P2) — Adatstruktúra fejlécek és legördülők |
| **Űrlap súgók és helykitöltők (Props)** | 42 db | Közepes (P2) — `placeholder`, `title`, `tooltip` |
| **Közvetlen felületi szövegek (JSX)** | 235 db | Kritikus (P0) — Gombok, címkék, kártya tartalom |
| **Hiányzó szótárkulcsok (Missing HR key)** | 59 db | Magas (P1) — `t(...)` hívás ami nincs a horvát JSON-ban |


### Legtöbb lokalizációs hiányosságot tartalmazó komponensek:
- [BankAccountsTab.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/settings/BankAccountsTab.tsx): **53 db** lefordítandó elem
- [useTransactionMatching.ts](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useTransactionMatching.ts): **46 db** lefordítandó elem
- [CashReportsTab.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/CashReportsTab.tsx): **45 db** lefordítandó elem
- [RegistersTab.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/RegistersTab.tsx): **44 db** lefordítandó elem
- [printCashReport.ts](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/print/printCashReport.ts): **41 db** lefordítandó elem
- [PartnersPage.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/PartnersPage.tsx): **41 db** lefordítandó elem
- [TransfersPage.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/TransfersPage.tsx): **37 db** lefordítandó elem
- [CashReportDetailDialog.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/CashReportDetailDialog.tsx): **32 db** lefordítandó elem

---

## 🔔 2. Értesítési Ablakok (Toasts) és Modális Megerősítések

| Forrás és sorszám | Elem | Megjelenő magyar szöveg | Javasolt horvát (HR) fordítás |
| :--- | :--- | :--- | :--- |
| [CashReportsTab.tsx:L127](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/CashReportsTab.tsx#L127) | `toast_title` | Pénztárjelentés újranyitva | **— (Prevesti na HR)** |
| [CashReportsTab.tsx:L134](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/CashReportsTab.tsx#L134) | `toast_title` | Hiba az újranyitás során | **— (Prevesti na HR)** |
| [CashReportsTab.tsx:L155](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/CashReportsTab.tsx#L155) | `toast_title` | Hiba az ellenőrzés során | **— (Prevesti na HR)** |
| [CashReportsTab.tsx:L173](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/CashReportsTab.tsx#L173) | `toast_title` | Pénztárjelentés feladva a főkönyvbe | **— (Prevesti na HR)** |
| [CashReportsTab.tsx:L180](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/CashReportsTab.tsx#L180) | `toast_title` | Hiba a főkönyvi feladás során | **— (Prevesti na HR)** |
| [CashReportsTab.tsx:L202](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/CashReportsTab.tsx#L202) | `toast_title` | Főkönyvi feladás visszavonva | **— (Prevesti na HR)** |
| [CashReportsTab.tsx:L209](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/CashReportsTab.tsx#L209) | `toast_title` | Hiba a visszavonás során | **— (Prevesti na HR)** |
| [RegistersTab.tsx:L99](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/RegistersTab.tsx#L99) | `toast_title` | Pénztár mentve | **— (Prevesti na HR)** |
| [RegistersTab.tsx:L101](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/RegistersTab.tsx#L101) | `toast_title` | Hiba | **Greška** |
| [RegistersTab.tsx:L121](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/RegistersTab.tsx#L121) | `toast_title` | Alapértelmezett pénztár módosítva | **— (Prevesti na HR)** |
| [RegistersTab.tsx:L133](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/RegistersTab.tsx#L133) | `toast_title` | Pénztár törölve | **— (Prevesti na HR)** |
| [RegistersTab.tsx:L587](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/RegistersTab.tsx#L587) | `toast_title` | Nyitó egyenlegek mentve | **— (Prevesti na HR)** |
| [RoutingRulesTab.tsx:L87](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/RoutingRulesTab.tsx#L87) | `toast_title` | Szabály mentve | **— (Prevesti na HR)** |
| [RoutingRulesTab.tsx:L89](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/RoutingRulesTab.tsx#L89) | `toast_title` | Hiba | **Greška** |
| [RoutingRulesTab.tsx:L99](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/RoutingRulesTab.tsx#L99) | `toast_title` | Szabály törölve | **— (Prevesti na HR)** |
| [CashClosingWizardDialog.tsx:L247](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/closing-wizard/CashClosingWizardDialog.tsx#L247) | `toast_title` | Pénztár sikeresen lezárva! | **— (Prevesti na HR)** |
| [CashClosingWizardDialog.tsx:L254](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/closing-wizard/CashClosingWizardDialog.tsx#L254) | `toast_title` | Hiba a zárás során | **— (Prevesti na HR)** |
| [BankAccountsTab.tsx:L410](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/settings/BankAccountsTab.tsx#L410) | `toast_desc` | Bankszámla könyvelési beállításai frissítve. | **— (Prevesti na HR)** |
| [BankAccountsTab.tsx:L421](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/settings/BankAccountsTab.tsx#L421) | `toast_title` | Hiba | **Greška** |
| [BankAccountsTab.tsx:L421](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/settings/BankAccountsTab.tsx#L421) | `toast_desc` | Nem sikerült frissíteni a beállításokat. | **— (Prevesti na HR)** |
| [BankAccountsTab.tsx:L442](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/settings/BankAccountsTab.tsx#L442) | `toast_desc` | Kérjük, add meg a bank nevét. | **— (Prevesti na HR)** |
| [BankAccountsTab.tsx:L461](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/settings/BankAccountsTab.tsx#L461) | `toast_desc` | Bankszámla sikeresen hozzáadva. | **— (Prevesti na HR)** |
| [BankAccountsTab.tsx:L476](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/settings/BankAccountsTab.tsx#L476) | `toast_desc` | Nem sikerült hozzáadni a bankszámlát. | **— (Prevesti na HR)** |
| [BankAccountsTab.tsx:L493](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/settings/BankAccountsTab.tsx#L493) | `toast_desc` | Bankszámla törölve. | **— (Prevesti na HR)** |
| [BankAccountsTab.tsx:L503](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/settings/BankAccountsTab.tsx#L503) | `toast_desc` | Nem sikerült törölni a bankszámlát. | **— (Prevesti na HR)** |
| [TransactionCard.tsx:L63](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/transaction-details/TransactionCard.tsx#L63) | `toast_title` | Sikeres letöltés | **— (Prevesti na HR)** |
| [TransactionCard.tsx:L76](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/transaction-details/TransactionCard.tsx#L76) | `toast_title` | Hiba a letöltés során | **— (Prevesti na HR)** |
| [TransactionFilesDialog.tsx:L151](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/transactions/TransactionFilesDialog.tsx#L151) | `toast_title` | Sikeres letöltés | **— (Prevesti na HR)** |
| [TransactionFilesDialog.tsx:L153](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/transactions/TransactionFilesDialog.tsx#L153) | `toast_title` | Hiba a letöltés során | **— (Prevesti na HR)** |
| [TransactionTable.tsx:L855](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/transactions/TransactionTable.tsx#L855) | `toast_title` | Sikeres jóváhagyás | **— (Prevesti na HR)** |
| [TransactionTable.tsx:L855](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/transactions/TransactionTable.tsx#L855) | `toast_desc` | A tranzakció párosítása jóváhagyva. | **— (Prevesti na HR)** |
| [TransactionTable.tsx:L860](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/transactions/TransactionTable.tsx#L860) | `toast_title` | Hiba | **Greška** |
| [TransactionTable.tsx:L860](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/transactions/TransactionTable.tsx#L860) | `toast_desc` | Nem sikerült a jóváhagyás. | **— (Prevesti na HR)** |
| [TransactionTable.tsx:L864](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/transactions/TransactionTable.tsx#L864) | `toast_title` | Jóváhagyás | **Odobri** |
| [TransactionTable.tsx:L864](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/transactions/TransactionTable.tsx#L864) | `toast_desc` | Csak javasolt párosítások hagyhatóak jóvá így. | **— (Prevesti na HR)** |
| [useTransactionData.ts:L294](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useTransactionData.ts#L294) | `toast_title` | Tranzakciók frissítve! | **— (Prevesti na HR)** |
| [useTransactionData.ts:L297](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useTransactionData.ts#L297) | `toast_title` | Frissítés sikertelen | **— (Prevesti na HR)** |
| [useTransactionData.ts:L315](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useTransactionData.ts#L315) | `toast_title` | Újrapárosítás elindítva | **— (Prevesti na HR)** |
| [useTransactionData.ts:L315](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useTransactionData.ts#L315) | `toast_desc` | A háttérfolyamat elindult. Pár másodperc múlva automatikusan frissül a f... | **— (Prevesti na HR)** |
| [useTransactionData.ts:L326](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useTransactionData.ts#L326) | `toast_title` | Újrapárosítás sikertelen | **— (Prevesti na HR)** |
| [useTransactionData.ts:L370](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useTransactionData.ts#L370) | `toast_title` | Hiba | **Greška** |
| [useTransactionMatcher.ts:L90](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useTransactionMatcher.ts#L90) | `toast_title` | Hiba a tranzakciók betöltésekor | **— (Prevesti na HR)** |
| [useTransactionMatcher.ts:L134](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useTransactionMatcher.ts#L134) | `toast_title` | Tranzakció sikeresen párosítva! | **— (Prevesti na HR)** |
| [useTransactionMatcher.ts:L146](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useTransactionMatcher.ts#L146) | `toast_title` | Hiba a párosítás mentésekor | **— (Prevesti na HR)** |
| [useTransactionMatcher.ts:L160](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useTransactionMatcher.ts#L160) | `toast_title` | Párosítás megszüntetve! | **— (Prevesti na HR)** |
| [useTransactionMatcher.ts:L171](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useTransactionMatcher.ts#L171) | `toast_title` | Hiba a párosítás megszüntetésekor | **— (Prevesti na HR)** |
| [useTransactionMatcher.ts:L185](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useTransactionMatcher.ts#L185) | `toast_title` | Párosítás jóváhagyva! | **— (Prevesti na HR)** |
| [useTransactionMatcher.ts:L196](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useTransactionMatcher.ts#L196) | `toast_title` | Hiba a jóváhagyás során | **— (Prevesti na HR)** |
| [useTransactionMatcher.ts:L210](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useTransactionMatcher.ts#L210) | `toast_title` | Tranzakció megjelölve: Nincs hozzá számla | **— (Prevesti na HR)** |
| [useTransactionMatcher.ts:L221](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useTransactionMatcher.ts#L221) | `toast_title` | Hiba a jelölés mentésekor | **— (Prevesti na HR)** |
| [useTransactionMatcher.ts:L235](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useTransactionMatcher.ts#L235) | `toast_title` | Tranzakció megjelölve: Számla nincs feltöltve | **— (Prevesti na HR)** |
| [useTransactionMatcher.ts:L260](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useTransactionMatcher.ts#L260) | `toast_title` | Státusz visszavonva | **— (Prevesti na HR)** |
| [useTransactionMatcher.ts:L271](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useTransactionMatcher.ts#L271) | `toast_title` | Hiba a visszavonás során | **— (Prevesti na HR)** |
| [useTransactionMatching.ts:L229](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useTransactionMatching.ts#L229) | `toast_title` | Hiba a párosítás mentésekor | **— (Prevesti na HR)** |
| [useTransactionMatching.ts:L240](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useTransactionMatching.ts#L240) | `toast_title` | Párosítás megszüntetve! | **— (Prevesti na HR)** |
| [useTransactionMatching.ts:L246](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useTransactionMatching.ts#L246) | `toast_title` | Hiba a párosítás megszüntetésekor | **— (Prevesti na HR)** |
| [useTransactionMatching.ts:L257](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useTransactionMatching.ts#L257) | `toast_title` | Tranzakció jóváhagyva! | **— (Prevesti na HR)** |
| [useTransactionMatching.ts:L263](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useTransactionMatching.ts#L263) | `toast_title` | Hiba a jóváhagyás során | **— (Prevesti na HR)** |
| [useTransactionMatching.ts:L274](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useTransactionMatching.ts#L274) | `toast_title` | Tranzakció megjelölve: Nincs hozzá számla | **— (Prevesti na HR)** |
| [useTransactionMatching.ts:L280](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useTransactionMatching.ts#L280) | `toast_title` | Hiba a jelölés mentésekor | **— (Prevesti na HR)** |
| [useTransactionMatching.ts:L291](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useTransactionMatching.ts#L291) | `toast_title` | Tranzakció megjelölve: Számla nincs feltöltve | **— (Prevesti na HR)** |
| [useTransactionMatching.ts:L308](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useTransactionMatching.ts#L308) | `toast_title` | Státusz visszavonva | **— (Prevesti na HR)** |
| [useTransactionMatching.ts:L314](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useTransactionMatching.ts#L314) | `toast_title` | Hiba a visszavonás során | **— (Prevesti na HR)** |
| [useTransactionMatching.ts:L352](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useTransactionMatching.ts#L352) | `toast_title` | Ez a számla már hozzá van rendelve ehhez a tranzakcióhoz | **— (Prevesti na HR)** |
| [useTransactionMatching.ts:L354](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useTransactionMatching.ts#L354) | `toast_title` | Hiba a számla hozzáadásakor | **— (Prevesti na HR)** |
| [useTransactionMatching.ts:L365](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useTransactionMatching.ts#L365) | `toast_title` | További számla eltávolítva | **— (Prevesti na HR)** |
| [useTransactionMatching.ts:L371](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useTransactionMatching.ts#L371) | `toast_title` | Hiba az eltávolításkor | **— (Prevesti na HR)** |
| [useTransactionMatching.ts:L381](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useTransactionMatching.ts#L381) | `toast_title` | Tranzakció közvetlenül kontírozva! | **— (Prevesti na HR)** |
| [useTransactionMatching.ts:L388](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useTransactionMatching.ts#L388) | `toast_title` | Hiba a kontírozás mentésekor | **— (Prevesti na HR)** |
| [useTransactionMatching.ts:L404](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useTransactionMatching.ts#L404) | `toast_title` | Közvetlen kontírozás törölve! | **— (Prevesti na HR)** |
| [useTransactionMatching.ts:L412](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useTransactionMatching.ts#L412) | `toast_title` | Hiba a törlés során | **— (Prevesti na HR)** |
| [useTransactionMatching.ts:L422](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useTransactionMatching.ts#L422) | `toast_title` | Futár tételek sikeresen összerendelve a tranzakcióval! | **— (Prevesti na HR)** |
| [useTransactionMatching.ts:L429](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useTransactionMatching.ts#L429) | `toast_title` | Hiba a futár tételek összerendelésekor | **— (Prevesti na HR)** |
| [TransfersPage.tsx:L1631](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/TransfersPage.tsx#L1631) | `toast_desc` | Átutalási állomány generálva és letöltve! Az utalások elmentve párosításra. | **— (Prevesti na HR)** |
| [TransfersPage.tsx:L1636](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/TransfersPage.tsx#L1636) | `toast_title` | Minta letöltve | **— (Prevesti na HR)** |
| [TransfersPage.tsx:L1636](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/TransfersPage.tsx#L1636) | `toast_desc` | A minta átutalási állomány sikeresen generálva és letöltve! | **— (Prevesti na HR)** |
| [TransfersPage.tsx:L1648](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/TransfersPage.tsx#L1648) | `toast_title` | Hiba | **Greška** |
| [TransfersPage.tsx:L1648](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/TransfersPage.tsx#L1648) | `toast_desc` | Nem sikerült az utalások mentése a rendszerben. | **— (Prevesti na HR)** |
| [TransfersPage.tsx:L2306](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/TransfersPage.tsx#L2306) | `toast_title` | Tételek kijelölve! | **— (Prevesti na HR)** |
| [Aggreg8BankConnections.tsx:L445](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/banking/Aggreg8BankConnections.tsx#L445) | `Dialog Title/Description` | Biztosan bontani szeretnéd ezt a bankkapcsolatot? | **— (Prevesti na HR)** |
| [RoutingRulesTab.tsx:L254](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/RoutingRulesTab.tsx#L254) | `Dialog Title/Description` | Ha egy tétel megfelel a feltételeknek, automatikusan a cél pénztárba kerül. | **— (Prevesti na HR)** |


---

## 🏷️ 3. Státusz Badge-ek, Jelvények és Feltételes Állapotok

| Forrás és sorszám | Elem | Megjelenő magyar szöveg | Javasolt horvát (HR) fordítás |
| :--- | :--- | :--- | :--- |
| [ApprovalTab.tsx:L221](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/ApprovalTab.tsx#L221) | `Badge JSX` | Pénztárgép zárás | **— (Prevesti na HR)** |
| [RoutingRulesTab.tsx:L162](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/RoutingRulesTab.tsx#L162) | `Badge JSX` | Típus: {SOURCE_LABELS[rule.match_source_type] \|\| rule.match_source_type} | **— (Prevesti na HR)** |
| [RoutingRulesTab.tsx:L163](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/RoutingRulesTab.tsx#L163) | `Badge JSX` | Leírás: {rule.match_description_pattern} | **— (Prevesti na HR)** |
| [BankAccountsTab.tsx:L682](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/settings/BankAccountsTab.tsx#L682) | `Badge JSX` | Opcionális | **— (Prevesti na HR)** |
| [Aggreg8BankConnections.tsx:L383](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/banking/Aggreg8BankConnections.tsx#L383) | `ternary condition literal` | Frissítés... | **Osvježi...** |
| [Aggreg8BankConnections.tsx:L383](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/banking/Aggreg8BankConnections.tsx#L383) | `ternary condition literal` | Frissítés most | **— (Prevesti na HR)** |
| [Aggreg8BankConnections.tsx:L407](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/banking/Aggreg8BankConnections.tsx#L407) | `ternary condition literal` | Megújítás... | **— (Prevesti na HR)** |
| [Aggreg8BankConnections.tsx:L407](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/banking/Aggreg8BankConnections.tsx#L407) | `ternary condition literal` | 180 napos megújítás | **— (Prevesti na HR)** |
| [KintlevoAgingChart.tsx:L56](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/kintlevo/KintlevoAgingChart.tsx#L56) | `ternary condition literal` | bruttó | **— (Prevesti na HR)** |
| [KintlevoAgingChart.tsx:L57](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/kintlevo/KintlevoAgingChart.tsx#L57) | `ternary condition literal` | nettó | **— (Prevesti na HR)** |
| [PartnerRankingCard.tsx:L220](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/partners/PartnerRankingCard.tsx#L220) | `ternary condition literal` | Top ${data.length} arányos áttekintés | **— (Prevesti na HR)** |
| [PartnerRankingCard.tsx:L275](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/partners/PartnerRankingCard.tsx#L275) | `ternary condition literal` | Top ${data.length} összeg | **— (Prevesti na HR)** |
| [PartnerRankingCard.tsx:L291](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/partners/PartnerRankingCard.tsx#L291) | `ternary condition literal` | Top ${data.length} arány | **— (Prevesti na HR)** |
| [RelatedPartyTurnoverTab.tsx:L165](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/partners/RelatedPartyTurnoverTab.tsx#L165) | `ternary condition literal` | IGEN (1.5M túllépve) | **— (Prevesti na HR)** |
| [RelatedPartyTurnoverTab.tsx:L165](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/partners/RelatedPartyTurnoverTab.tsx#L165) | `ternary condition literal` | NEM | **— (Prevesti na HR)** |
| [RelatedPartyTurnoverTab.tsx:L166](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/partners/RelatedPartyTurnoverTab.tsx#L166) | `ternary condition literal` | KÖTELEZŐ (>100M) | **— (Prevesti na HR)** |
| [RelatedPartyTurnoverTab.tsx:L267](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/partners/RelatedPartyTurnoverTab.tsx#L267) | `ternary condition literal` | Követelés többlet | **— (Prevesti na HR)** |
| [RelatedPartyTurnoverTab.tsx:L267](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/partners/RelatedPartyTurnoverTab.tsx#L267) | `ternary condition literal` | Kötelezettség többlet | **— (Prevesti na HR)** |
| [RelatedPartyTurnoverTab.tsx:L302](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/partners/RelatedPartyTurnoverTab.tsx#L302) | `ternary condition literal` | ${totals?.cashExceededPartnerCount} cég túllépte | **— (Prevesti na HR)** |
| [RelatedPartyTurnoverTab.tsx:L533](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/partners/RelatedPartyTurnoverTab.tsx#L533) | `ternary condition literal` | Követelés | **— (Prevesti na HR)** |
| [RelatedPartyTurnoverTab.tsx:L533](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/partners/RelatedPartyTurnoverTab.tsx#L533) | `ternary condition literal` | Tartozás | **— (Prevesti na HR)** |
| [RelatedPartyTurnoverTab.tsx:L645](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/partners/RelatedPartyTurnoverTab.tsx#L645) | `ternary condition literal` | Kimenő (912) | **— (Prevesti na HR)** |
| [RelatedPartyTurnoverTab.tsx:L645](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/partners/RelatedPartyTurnoverTab.tsx#L645) | `ternary condition literal` | Bejövő (4551) | **— (Prevesti na HR)** |
| [CashReportDetailDialog.tsx:L80](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/CashReportDetailDialog.tsx#L80) | `ternary condition literal` | Készpénzes vásárló | **— (Prevesti na HR)** |
| [CashReportDetailDialog.tsx:L80](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/CashReportDetailDialog.tsx#L80) | `ternary condition literal` | Készpénzes partner | **— (Prevesti na HR)** |
| [CashReportDetailDialog.tsx:L85](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/CashReportDetailDialog.tsx#L85) | `ternary condition literal` | Készpénzes értékesítés | **— (Prevesti na HR)** |
| [CashReportDetailDialog.tsx:L85](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/CashReportDetailDialog.tsx#L85) | `ternary condition literal` | Készpénzes kifizetés | **— (Prevesti na HR)** |
| [CashReportDetailDialog.tsx:L232](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/CashReportDetailDialog.tsx#L232) | `ternary condition literal` | Bevétel | **— (Prevesti na HR)** |
| [CashReportDetailDialog.tsx:L232](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/CashReportDetailDialog.tsx#L232) | `ternary condition literal` | Kiadás | **— (Prevesti na HR)** |
| [CashReportDetailDialog.tsx:L254](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/CashReportDetailDialog.tsx#L254) | `ternary condition literal` | Bevételi pénztárbizonylat (BPB) nyomtatása | **— (Prevesti na HR)** |
| [CashReportDetailDialog.tsx:L254](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/CashReportDetailDialog.tsx#L254) | `ternary condition literal` | Kiadási pénztárbizonylat (KPB) nyomtatása | **— (Prevesti na HR)** |
| [CashReportDetailDialog.tsx:L335](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/CashReportDetailDialog.tsx#L335) | `ternary condition literal` | Hiányként lekönyvelve (3681 ellenszámla) | **— (Prevesti na HR)** |
| [CashReportDetailDialog.tsx:L336](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/CashReportDetailDialog.tsx#L336) | `ternary condition literal` | Többletként lekönyvelve (4791 ellenszámla) | **— (Prevesti na HR)** |
| [CashReportDetailDialog.tsx:L337](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/CashReportDetailDialog.tsx#L337) | `ternary condition literal` | Pénztáros által megtérítve | **— (Prevesti na HR)** |
| [CashReportsTab.tsx:L128](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/CashReportsTab.tsx#L128) | `ternary condition literal` | Pénztárjelentés újranyitva | **— (Prevesti na HR)** |
| [CashReportsTab.tsx:L135](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/CashReportsTab.tsx#L135) | `ternary condition literal` | Hiba az újranyitás során | **— (Prevesti na HR)** |
| [CashReportsTab.tsx:L156](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/CashReportsTab.tsx#L156) | `ternary condition literal` | Hiba az ellenőrzés során | **— (Prevesti na HR)** |
| [CashReportsTab.tsx:L174](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/CashReportsTab.tsx#L174) | `ternary condition literal` | Pénztárjelentés feladva a főkönyvbe | **— (Prevesti na HR)** |
| [CashReportsTab.tsx:L181](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/CashReportsTab.tsx#L181) | `ternary condition literal` | Hiba a főkönyvi feladás során | **— (Prevesti na HR)** |
| [CashReportsTab.tsx:L203](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/CashReportsTab.tsx#L203) | `ternary condition literal` | Főkönyvi feladás visszavonva | **— (Prevesti na HR)** |
| [CashReportsTab.tsx:L210](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/CashReportsTab.tsx#L210) | `ternary condition literal` | Hiba a visszavonás során | **— (Prevesti na HR)** |
| [CashReportsTab.tsx:L458](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/CashReportsTab.tsx#L458) | `ternary condition literal` | Pénztár | **— (Prevesti na HR)** |
| [EntriesTab.tsx:L42](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/EntriesTab.tsx#L42) | `ternary condition literal` | Nyitó egyenleg | **— (Prevesti na HR)** |
| [EntriesTab.tsx:L750](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/EntriesTab.tsx#L750) | `ternary condition literal` | Pénztárgép zárás | **— (Prevesti na HR)** |
| [EntriesTab.tsx:L1907](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/EntriesTab.tsx#L1907) | `ternary condition literal` | Összes (${openInvoices.length}) | **— (Prevesti na HR)** |
| [EntriesTab.tsx:L1917](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/EntriesTab.tsx#L1917) | `ternary condition literal` | Vevői (${outboundCount}) | **— (Prevesti na HR)** |
| [EntriesTab.tsx:L1927](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/EntriesTab.tsx#L1927) | `ternary condition literal` | Szállítói (${inboundCount}) | **— (Prevesti na HR)** |
| [RegistersTab.tsx:L99](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/RegistersTab.tsx#L99) | `ternary condition literal` | Pénztár mentve | **— (Prevesti na HR)** |
| [RegistersTab.tsx:L101](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/RegistersTab.tsx#L101) | `ternary condition literal` | Hiba | **Greška** |
| [RegistersTab.tsx:L121](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/RegistersTab.tsx#L121) | `ternary condition literal` | Alapértelmezett pénztár módosítva | **— (Prevesti na HR)** |
| [RegistersTab.tsx:L133](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/RegistersTab.tsx#L133) | `ternary condition literal` | Pénztár törölve | **— (Prevesti na HR)** |
| [RegistersTab.tsx:L228](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/RegistersTab.tsx#L228) | `ternary condition literal` | Napi zárás | **— (Prevesti na HR)** |
| [RegistersTab.tsx:L229](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/RegistersTab.tsx#L229) | `ternary condition literal` | Heti zárás | **— (Prevesti na HR)** |
| [RegistersTab.tsx:L230](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/RegistersTab.tsx#L230) | `ternary condition literal` | Dekád zárás | **— (Prevesti na HR)** |
| [RegistersTab.tsx:L231](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/RegistersTab.tsx#L231) | `ternary condition literal` | ${reg.custom_days \|\| 30} napos zárás | **— (Prevesti na HR)** |
| [RegistersTab.tsx:L231](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/RegistersTab.tsx#L231) | `ternary condition literal` | Havi zárás | **— (Prevesti na HR)** |
| [RegistersTab.tsx:L351](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/RegistersTab.tsx#L351) | `ternary condition literal` | Pénztár és szabályzat szerkesztése | **— (Prevesti na HR)** |
| [RegistersTab.tsx:L351](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/RegistersTab.tsx#L351) | `ternary condition literal` | Új pénztár létrehozása | **— (Prevesti na HR)** |
| [RegistersTab.tsx:L587](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/RegistersTab.tsx#L587) | `ternary condition literal` | Nyitó egyenlegek mentve | **— (Prevesti na HR)** |
| [RoutingRulesTab.tsx:L87](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/RoutingRulesTab.tsx#L87) | `ternary condition literal` | Szabály mentve | **— (Prevesti na HR)** |
| [RoutingRulesTab.tsx:L89](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/RoutingRulesTab.tsx#L89) | `ternary condition literal` | Hiba | **Greška** |
| [RoutingRulesTab.tsx:L99](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/RoutingRulesTab.tsx#L99) | `ternary condition literal` | Szabály törölve | **— (Prevesti na HR)** |
| [RoutingRulesTab.tsx:L253](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/RoutingRulesTab.tsx#L253) | `ternary condition literal` | Szabály szerkesztése | **— (Prevesti na HR)** |
| [RoutingRulesTab.tsx:L253](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/RoutingRulesTab.tsx#L253) | `ternary condition literal` | Új routing szabály | **— (Prevesti na HR)** |
| [types.ts:L193](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/types.ts#L193) | `ternary condition literal` | KP felvétel | **— (Prevesti na HR)** |
| [types.ts:L194](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/types.ts#L194) | `ternary condition literal` | KP befizetés | **— (Prevesti na HR)** |
| [types.ts:L195](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/types.ts#L195) | `ternary condition literal` | KP értékesítés | **— (Prevesti na HR)** |
| [types.ts:L196](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/types.ts#L196) | `ternary condition literal` | KP kiadás | **— (Prevesti na HR)** |
| [types.ts:L197](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/types.ts#L197) | `ternary condition literal` | Manuális | **— (Prevesti na HR)** |
| [types.ts:L198](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/types.ts#L198) | `ternary condition literal` | Átvezetés | **— (Prevesti na HR)** |
| [types.ts:L199](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/types.ts#L199) | `ternary condition literal` | Számla rendezés | **— (Prevesti na HR)** |
| [types.ts:L260](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/types.ts#L260) | `ternary condition literal` | Pénztár kiválasztása kötelező! | **— (Prevesti na HR)** |
| [types.ts:L264](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/types.ts#L264) | `ternary condition literal` | Legalább egy számla kiválasztása kötelező! | **— (Prevesti na HR)** |
| [types.ts:L268](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/types.ts#L268) | `ternary condition literal` | Az összegnek 0-nál nagyobbnak kell lennie! | **— (Prevesti na HR)** |
| [types.ts:L271](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/types.ts#L271) | `ternary condition literal` | A leírás megadása kötelező! | **— (Prevesti na HR)** |
| [CashClosingWizardDialog.tsx:L248](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/closing-wizard/CashClosingWizardDialog.tsx#L248) | `ternary condition literal` | Pénztár sikeresen lezárva! | **— (Prevesti na HR)** |
| [CashClosingWizardDialog.tsx:L255](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/closing-wizard/CashClosingWizardDialog.tsx#L255) | `ternary condition literal` | Hiba a zárás során | **— (Prevesti na HR)** |
| [WizardStep1Check.tsx:L199](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/closing-wizard/WizardStep1Check.tsx#L199) | `ternary condition literal` | Keretösszeg túllépés — Zárás tiltva! | **— (Prevesti na HR)** |
| [WizardStep1Check.tsx:L199](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/closing-wizard/WizardStep1Check.tsx#L199) | `ternary condition literal` | Pénztári keretösszeg túllépés | **— (Prevesti na HR)** |
| [WizardStep2Denominations.tsx:L92](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/closing-wizard/WizardStep2Denominations.tsx#L92) | `ternary condition literal` | 0 Ft (Nincs eltérés) | **— (Prevesti na HR)** |
| [WizardStep2Denominations.tsx:L163](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/closing-wizard/WizardStep2Denominations.tsx#L163) | `ternary condition literal` | Pénztári többlet észlelve! | **— (Prevesti na HR)** |
| [WizardStep2Denominations.tsx:L163](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/closing-wizard/WizardStep2Denominations.tsx#L163) | `ternary condition literal` | Pénztári hiány észlelve! | **— (Prevesti na HR)** |
| [WizardStep3Protocol.tsx:L95](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/closing-wizard/WizardStep3Protocol.tsx#L95) | `ternary condition literal` | +${fmtBalance(difference, currency)} (Többlet) | **— (Prevesti na HR)** |
| [WizardStep3Protocol.tsx:L95](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/closing-wizard/WizardStep3Protocol.tsx#L95) | `ternary condition literal` | ${fmtBalance(difference, currency)} (Hiány) | **— (Prevesti na HR)** |
| [WizardStep3Protocol.tsx:L156](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/closing-wizard/WizardStep3Protocol.tsx#L156) | `ternary condition literal` | ${cashierName} (Egyszemélyes mód) | **— (Prevesti na HR)** |
| [WizardStep3Protocol.tsx:L156](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/closing-wizard/WizardStep3Protocol.tsx#L156) | `ternary condition literal` | Könyvelő / Ellenőr | **— (Prevesti na HR)** |
| [printCashReceipt.ts:L27](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/print/printCashReceipt.ts#L27) | `ternary condition literal` | BEVÉTELI PÉNZTÁRBIZONYLAT (BPB) | **— (Prevesti na HR)** |
| [printCashReceipt.ts:L27](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/print/printCashReceipt.ts#L27) | `ternary condition literal` | KIADÁSI PÉNZTÁRBIZONYLAT (KPB) | **— (Prevesti na HR)** |
| [printCashReceipt.ts:L28](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/print/printCashReceipt.ts#L28) | `ternary condition literal` | Befizető (Partner): | **— (Prevesti na HR)** |
| [printCashReceipt.ts:L28](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/print/printCashReceipt.ts#L28) | `ternary condition literal` | Kedvezményezett / Átvevő: | **— (Prevesti na HR)** |
| [printCashReceipt.ts:L63](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/print/printCashReceipt.ts#L63) | `ternary condition literal` | <div>Adószám: ${companyTaxNumber}</div> | **— (Prevesti na HR)** |
| [printCashReceipt.ts:L102](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/print/printCashReceipt.ts#L102) | `ternary condition literal` | Befizető átadta | **— (Prevesti na HR)** |
| [printCashReceipt.ts:L102](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/print/printCashReceipt.ts#L102) | `ternary condition literal` | Átvevő átvette | **— (Prevesti na HR)** |
| [printCashReport.ts:L121](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/print/printCashReport.ts#L121) | `ternary condition literal` | (v${report.version} Helyesbített) | **— (Prevesti na HR)** |
| [printCashReport.ts:L212](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/print/printCashReport.ts#L212) | `ternary condition literal` | 0 Ft (Nincs eltérés) | **— (Prevesti na HR)** |
| [printCashReport.ts:L214](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/print/printCashReport.ts#L214) | `ternary condition literal` | Pénztári hiányként lekönyvelve (3681) | **— (Prevesti na HR)** |
| [printCashReport.ts:L214](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/print/printCashReport.ts#L214) | `ternary condition literal` | Pénztári többletként lekönyvelve (4791) | **— (Prevesti na HR)** |
| [printCashReport.ts:L239](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/print/printCashReport.ts#L239) | `ternary condition literal` | IDŐSZAKI PÉNZTÁRZÁRÓ ÍV | **— (Prevesti na HR)** |
| [BankAccountsTab.tsx:L410](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/settings/BankAccountsTab.tsx#L410) | `ternary condition literal` | Bankszámla könyvelési beállításai frissítve. | **— (Prevesti na HR)** |
| [BankAccountsTab.tsx:L421](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/settings/BankAccountsTab.tsx#L421) | `ternary condition literal` | Hiba | **Greška** |
| [BankAccountsTab.tsx:L421](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/settings/BankAccountsTab.tsx#L421) | `ternary condition literal` | Nem sikerült frissíteni a beállításokat. | **— (Prevesti na HR)** |
| [BankAccountsTab.tsx:L442](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/settings/BankAccountsTab.tsx#L442) | `ternary condition literal` | Kérjük, add meg a bank nevét. | **— (Prevesti na HR)** |
| [BankAccountsTab.tsx:L461](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/settings/BankAccountsTab.tsx#L461) | `ternary condition literal` | Bankszámla sikeresen hozzáadva. | **— (Prevesti na HR)** |
| [BankAccountsTab.tsx:L476](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/settings/BankAccountsTab.tsx#L476) | `ternary condition literal` | Nem sikerült hozzáadni a bankszámlát. | **— (Prevesti na HR)** |
| [BankAccountsTab.tsx:L493](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/settings/BankAccountsTab.tsx#L493) | `ternary condition literal` | Bankszámla törölve. | **— (Prevesti na HR)** |
| [BankAccountsTab.tsx:L503](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/settings/BankAccountsTab.tsx#L503) | `ternary condition literal` | Nem sikerült törölni a bankszámlát. | **— (Prevesti na HR)** |
| [BankAccountsTab.tsx:L556](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/settings/BankAccountsTab.tsx#L556) | `ternary condition literal` | Bankkapcsolatok kezelése | **— (Prevesti na HR)** |
| [BankAccountsTab.tsx:L556](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/settings/BankAccountsTab.tsx#L556) | `ternary condition literal` | Bankcsatlakozás beállítása | **— (Prevesti na HR)** |
| [BankAccountsTab.tsx:L708](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/settings/BankAccountsTab.tsx#L708) | `ternary condition literal` | ⚠️ (Eltérő deviza) | **— (Prevesti na HR)** |
| [BankAccountsTab.tsx:L757](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/settings/BankAccountsTab.tsx#L757) | `ternary condition literal` | Mentés... | **Spremi...** |
| [BankAccountsTab.tsx:L934](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/settings/BankAccountsTab.tsx#L934) | `ternary condition literal` | — (Inaktív) | **— (Prevesti na HR)** |
| [BankAccountsTab.tsx:L999](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/settings/BankAccountsTab.tsx#L999) | `ternary condition literal` | Beállítások mentése | **— (Prevesti na HR)** |
| [MatchedCourierReportsCard.tsx:L105](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/transaction-details/MatchedCourierReportsCard.tsx#L105) | `ternary condition literal` | Futár tételek összerendelése ({{count}} számla) | **— (Prevesti na HR)** |
| [TransactionCard.tsx:L63](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/transaction-details/TransactionCard.tsx#L63) | `ternary condition literal` | Sikeres letöltés | **— (Prevesti na HR)** |
| [TransactionCard.tsx:L63](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/transaction-details/TransactionCard.tsx#L63) | `ternary condition literal` | ${fileName} letöltve. | **— (Prevesti na HR)** |
| [TransactionCard.tsx:L77](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/transaction-details/TransactionCard.tsx#L77) | `ternary condition literal` | Hiba a letöltés során | **— (Prevesti na HR)** |
| [BulkBookTransactionsDialog.tsx:L208](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/transactions/BulkBookTransactionsDialog.tsx#L208) | `ternary condition literal` | ...és további ${selectedTransactions.length - 6} db tétel | **— (Prevesti na HR)** |
| [TransactionFilesDialog.tsx:L75](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/transactions/TransactionFilesDialog.tsx#L75) | `ternary condition literal` | Gránit | **— (Prevesti na HR)** |
| [TransactionFilesDialog.tsx:L151](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/transactions/TransactionFilesDialog.tsx#L151) | `ternary condition literal` | Sikeres letöltés | **— (Prevesti na HR)** |
| [TransactionFilesDialog.tsx:L151](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/transactions/TransactionFilesDialog.tsx#L151) | `ternary condition literal` | ${targets.length} fájl letöltése elindítva. | **— (Prevesti na HR)** |
| [TransactionFilesDialog.tsx:L153](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/transactions/TransactionFilesDialog.tsx#L153) | `ternary condition literal` | Hiba a letöltés során | **— (Prevesti na HR)** |
| [TransactionFilesDialog.tsx:L636](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/transactions/TransactionFilesDialog.tsx#L636) | `ternary condition literal` | Kivonat egyenlegellenőrzés: Rendben | **— (Prevesti na HR)** |
| [TransactionFilesDialog.tsx:L636](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/transactions/TransactionFilesDialog.tsx#L636) | `ternary condition literal` | Figyelem: Egyenlegeltérés! | **— (Prevesti na HR)** |
| [TransactionFilesDialog.tsx:L929](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/transactions/TransactionFilesDialog.tsx#L929) | `ternary condition literal` | Kivonat egyenlegellenőrzés egyezik (0 Ft eltérés) | **— (Prevesti na HR)** |
| [TransactionTable.tsx:L684](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/transactions/TransactionTable.tsx#L684) | `ternary condition literal` | Rögzítette: ${note.profile_name} | **— (Prevesti na HR)** |
| [TransactionTable.tsx:L855](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/transactions/TransactionTable.tsx#L855) | `ternary condition literal` | Sikeres jóváhagyás | **— (Prevesti na HR)** |
| [TransactionTable.tsx:L855](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/transactions/TransactionTable.tsx#L855) | `ternary condition literal` | A tranzakció párosítása jóváhagyva. | **— (Prevesti na HR)** |
| [TransactionTable.tsx:L860](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/transactions/TransactionTable.tsx#L860) | `ternary condition literal` | Hiba | **Greška** |
| [TransactionTable.tsx:L860](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/transactions/TransactionTable.tsx#L860) | `ternary condition literal` | Nem sikerült a jóváhagyás. | **— (Prevesti na HR)** |
| [TransactionTable.tsx:L864](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/transactions/TransactionTable.tsx#L864) | `ternary condition literal` | Jóváhagyás | **Odobri** |
| [TransactionTable.tsx:L864](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/transactions/TransactionTable.tsx#L864) | `ternary condition literal` | Csak javasolt párosítások hagyhatóak jóvá így. | **— (Prevesti na HR)** |
| [TransactionTable.tsx:L1381](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/transactions/TransactionTable.tsx#L1381) | `ternary condition literal` | Törlés (${selectedIds.size} db) | **— (Prevesti na HR)** |
| [useKintlevoData.ts:L194](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useKintlevoData.ts#L194) | `ternary condition literal` | Ismeretlen partner | **— (Prevesti na HR)** |
| [useTransactionData.ts:L294](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useTransactionData.ts#L294) | `ternary condition literal` | Tranzakciók frissítve! | **— (Prevesti na HR)** |
| [useTransactionData.ts:L298](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useTransactionData.ts#L298) | `ternary condition literal` | Frissítés sikertelen | **— (Prevesti na HR)** |
| [useTransactionData.ts:L316](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useTransactionData.ts#L316) | `ternary condition literal` | Újrapárosítás elindítva | **— (Prevesti na HR)** |
| [useTransactionData.ts:L327](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useTransactionData.ts#L327) | `ternary condition literal` | Újrapárosítás sikertelen | **— (Prevesti na HR)** |
| [useTransactionData.ts:L348](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useTransactionData.ts#L348) | `ternary condition literal` | Párosított | **— (Prevesti na HR)** |
| [useTransactionData.ts:L351](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useTransactionData.ts#L351) | `ternary condition literal` | Nincs hozzá számla | **— (Prevesti na HR)** |
| [useTransactionData.ts:L352](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useTransactionData.ts#L352) | `ternary condition literal` | Számla nincs feltöltve | **— (Prevesti na HR)** |
| [useTransactionData.ts:L353](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useTransactionData.ts#L353) | `ternary condition literal` | Párosítatlan | **— (Prevesti na HR)** |
| [useTransactionData.ts:L369](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useTransactionData.ts#L369) | `ternary condition literal` | Export error: | **— (Prevesti na HR)** |
| [useTransactionData.ts:L370](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useTransactionData.ts#L370) | `ternary condition literal` | Hiba | **Greška** |
| [useTransactionData.ts:L458](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useTransactionData.ts#L458) | `ternary condition literal` | Rendezettnek jelölve | **— (Prevesti na HR)** |
| [useTransactionData.ts:L458](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useTransactionData.ts#L458) | `ternary condition literal` | Nincs számla jelölés | **— (Prevesti na HR)** |
| [useTransactionData.ts:L459](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useTransactionData.ts#L459) | `ternary condition literal` | ${ids.length} tranzakció frissítve | **— (Prevesti na HR)** |
| [useTransactionData.ts:L502](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useTransactionData.ts#L502) | `ternary condition literal` | ${ids.length} tranzakció exportálva | **— (Prevesti na HR)** |
| [useTransactionData.ts:L504](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useTransactionData.ts#L504) | `ternary condition literal` | Bulk export error: | **— (Prevesti na HR)** |
| [useTransactionData.ts:L535](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useTransactionData.ts#L535) | `ternary condition literal` | ${ids.length} tranzakció törölve | **— (Prevesti na HR)** |
| [useTransactionMatcher.ts:L90](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useTransactionMatcher.ts#L90) | `ternary condition literal` | Hiba a tranzakciók betöltésekor | **— (Prevesti na HR)** |
| ... | ... | *(További 88 elem a teljes JSON leltárban)* | ... |


---

## 🖥️ 4. Felületi Kezelőszervek, Gombok, Fejlécek és Mezők (JSX & Props)

| Forrás és sorszám | Elem | Megjelenő magyar szöveg | Javasolt horvát (HR) fordítás |
| :--- | :--- | :--- | :--- |
| [PartnerCombobox.tsx:L107](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/PartnerCombobox.tsx#L107) | `JSX node text` | Betöltés... | **— (Prevesti na HR)** |
| [PartnerCombobox.tsx:L109](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/PartnerCombobox.tsx#L109) | `JSX node text` | Nincs találat | **— (Prevesti na HR)** |
| [Aggreg8BankConnections.tsx:L160](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/banking/Aggreg8BankConnections.tsx#L160) | `JSX node text` | Hiba történt a banki kapcsolatok betöltésekor | **Došlo je do greške** |
| [Aggreg8BankConnections.tsx:L237](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/banking/Aggreg8BankConnections.tsx#L237) | `JSX node text` | Még nincs csatlakoztatott bankszámlád | **— (Prevesti na HR)** |
| [Aggreg8BankConnections.tsx:L343](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/banking/Aggreg8BankConnections.tsx#L343) | `JSX node text` | Még nem történt | **— (Prevesti na HR)** |
| [Aggreg8BankConnections.tsx:L356](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/banking/Aggreg8BankConnections.tsx#L356) | `JSX node text` | Nincsenek aktív számlák ehhez a kapcsolathoz. | **— (Prevesti na HR)** |
| [Aggreg8BankConnections.tsx:L445](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/banking/Aggreg8BankConnections.tsx#L445) | `JSX node text` | Biztosan bontani szeretnéd ezt a bankkapcsolatot? | **— (Prevesti na HR)** |
| [Aggreg8BankConnections.tsx:L451](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/banking/Aggreg8BankConnections.tsx#L451) | `JSX node text` | Mégsem | **— (Prevesti na HR)** |
| [RelatedPartyTurnoverTab.tsx:L337](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/partners/RelatedPartyTurnoverTab.tsx#L337) | `JSX node text` | Minden kapcsolati típus | **— (Prevesti na HR)** |
| [RelatedPartyTurnoverTab.tsx:L338](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/partners/RelatedPartyTurnoverTab.tsx#L338) | `JSX node text` | Anyavállalat | **— (Prevesti na HR)** |
| [RelatedPartyTurnoverTab.tsx:L339](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/partners/RelatedPartyTurnoverTab.tsx#L339) | `JSX node text` | Leányvállalat | **— (Prevesti na HR)** |
| [RelatedPartyTurnoverTab.tsx:L340](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/partners/RelatedPartyTurnoverTab.tsx#L340) | `JSX node text` | Közös vezetésű / Testvér | **— (Prevesti na HR)** |
| [RelatedPartyTurnoverTab.tsx:L341](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/partners/RelatedPartyTurnoverTab.tsx#L341) | `JSX node text` | Tulajdonosi érdekeltség | **— (Prevesti na HR)** |
| [RelatedPartyTurnoverTab.tsx:L342](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/partners/RelatedPartyTurnoverTab.tsx#L342) | `JSX node text` | Egyéb | **— (Prevesti na HR)** |
| [RelatedPartyTurnoverTab.tsx:L356](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/partners/RelatedPartyTurnoverTab.tsx#L356) | `JSX node text` | CSV Export | **— (Prevesti na HR)** |
| [RelatedPartyTurnoverTab.tsx:L401](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/partners/RelatedPartyTurnoverTab.tsx#L401) | `JSX node text` | Forgalmi adatok számítása... | **— (Prevesti na HR)** |
| [RelatedPartyTurnoverTab.tsx:L533](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/partners/RelatedPartyTurnoverTab.tsx#L533) | `JSX node text` | 0 ? 'Követelés' : item.netBalance | **— (Prevesti na HR)** |
| [RelatedPartyTurnoverTab.tsx:L620](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/partners/RelatedPartyTurnoverTab.tsx#L620) | `JSX node text` | Irány | **— (Prevesti na HR)** |
| [RelatedPartyTurnoverTab.tsx:L621](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/partners/RelatedPartyTurnoverTab.tsx#L621) | `JSX node text` | Számlaszám | **— (Prevesti na HR)** |
| [RelatedPartyTurnoverTab.tsx:L623](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/partners/RelatedPartyTurnoverTab.tsx#L623) | `JSX node text` | Teljesítés | **— (Prevesti na HR)** |
| [RelatedPartyTurnoverTab.tsx:L624](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/partners/RelatedPartyTurnoverTab.tsx#L624) | `JSX node text` | Fizetési mód | **— (Prevesti na HR)** |
| [RelatedPartyTurnoverTab.tsx:L625](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/partners/RelatedPartyTurnoverTab.tsx#L625) | `JSX node text` | Nettó | **— (Prevesti na HR)** |
| [RelatedPartyTurnoverTab.tsx:L626](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/partners/RelatedPartyTurnoverTab.tsx#L626) | `JSX node text` | ÁFA | **PDV** |
| [RelatedPartyTurnoverTab.tsx:L627](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/partners/RelatedPartyTurnoverTab.tsx#L627) | `JSX node text` | Bruttó | **— (Prevesti na HR)** |
| [ApprovalTab.tsx:L221](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/ApprovalTab.tsx#L221) | `JSX node text` | Pénztárgép zárás | **— (Prevesti na HR)** |
| [CashReportDetailDialog.tsx:L144](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/CashReportDetailDialog.tsx#L144) | `JSX node text` | Pénztárjelentés adatainak betöltése... | **— (Prevesti na HR)** |
| [CashReportDetailDialog.tsx:L152](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/CashReportDetailDialog.tsx#L152) | `JSX node text` | Nyitó egyenleg: | **— (Prevesti na HR)** |
| [CashReportDetailDialog.tsx:L159](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/CashReportDetailDialog.tsx#L159) | `JSX node text` | Összes bevétel (+): | **— (Prevesti na HR)** |
| [CashReportDetailDialog.tsx:L166](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/CashReportDetailDialog.tsx#L166) | `JSX node text` | Összes kiadás (-): | **— (Prevesti na HR)** |
| [CashReportDetailDialog.tsx:L173](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/CashReportDetailDialog.tsx#L173) | `JSX node text` | Záró készpénzállomány: | **— (Prevesti na HR)** |
| [CashReportDetailDialog.tsx:L200](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/CashReportDetailDialog.tsx#L200) | `JSX node text` | Sor | **— (Prevesti na HR)** |
| [CashReportDetailDialog.tsx:L201](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/CashReportDetailDialog.tsx#L201) | `JSX node text` | Dátum | **Datum** |
| [CashReportDetailDialog.tsx:L202](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/CashReportDetailDialog.tsx#L202) | `JSX node text` | Irány | **— (Prevesti na HR)** |
| [CashReportDetailDialog.tsx:L203](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/CashReportDetailDialog.tsx#L203) | `JSX node text` | Jogcím | **— (Prevesti na HR)** |
| [CashReportDetailDialog.tsx:L204](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/CashReportDetailDialog.tsx#L204) | `JSX node text` | Partner / Leírás | **— (Prevesti na HR)** |
| [CashReportDetailDialog.tsx:L205](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/CashReportDetailDialog.tsx#L205) | `JSX node text` | Ellenszámla | **— (Prevesti na HR)** |
| [CashReportDetailDialog.tsx:L206](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/CashReportDetailDialog.tsx#L206) | `JSX node text` | Összeg | **Iznos** |
| [CashReportDetailDialog.tsx:L207](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/CashReportDetailDialog.tsx#L207) | `JSX node text` | Bizonylat | **Dokument** |
| [CashReportDetailDialog.tsx:L273](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/CashReportDetailDialog.tsx#L273) | `JSX node text` | Ehhez a jelentéshez még nincs rögzített címletjegyzék. | **— (Prevesti na HR)** |
| [CashReportDetailDialog.tsx:L300](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/CashReportDetailDialog.tsx#L300) | `JSX node text` | Nincs lezárt jegyzőkönyv csatolva. | **— (Prevesti na HR)** |
| [CashReportDetailDialog.tsx:L306](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/CashReportDetailDialog.tsx#L306) | `JSX node text` | Könyv szerinti záró: | **— (Prevesti na HR)** |
| [CashReportDetailDialog.tsx:L310](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/CashReportDetailDialog.tsx#L310) | `JSX node text` | Tényleges záró: | **— (Prevesti na HR)** |
| [CashReportDetailDialog.tsx:L314](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/CashReportDetailDialog.tsx#L314) | `JSX node text` | Eltérés: | **— (Prevesti na HR)** |
| [CashReportDetailDialog.tsx:L326](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/CashReportDetailDialog.tsx#L326) | `JSX node text` | Eltérés indoklása: | **— (Prevesti na HR)** |
| [CashReportDetailDialog.tsx:L333](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/CashReportDetailDialog.tsx#L333) | `JSX node text` | Elrendelt intézkedés: | **— (Prevesti na HR)** |
| [CashReportDetailDialog.tsx:L344](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/CashReportDetailDialog.tsx#L344) | `JSX node text` | Jelentés megjegyzései: | **— (Prevesti na HR)** |
| [CashReportsTab.tsx:L233](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/CashReportsTab.tsx#L233) | `JSX node text` | Minden pénztár | **— (Prevesti na HR)** |
| [CashReportsTab.tsx:L248](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/CashReportsTab.tsx#L248) | `JSX node text` | Minden státusz | **— (Prevesti na HR)** |
| [CashReportsTab.tsx:L249](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/CashReportsTab.tsx#L249) | `JSX node text` | Nyitott | **Otvoreno** |
| [CashReportsTab.tsx:L250](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/CashReportsTab.tsx#L250) | `JSX node text` | Lezárt | **— (Prevesti na HR)** |
| [CashReportsTab.tsx:L252](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/CashReportsTab.tsx#L252) | `JSX node text` | Újranyitott | **— (Prevesti na HR)** |
| [CashReportsTab.tsx:L283](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/CashReportsTab.tsx#L283) | `JSX node text` | Pénztárjelentések betöltése... | **— (Prevesti na HR)** |
| [CashReportsTab.tsx:L288](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/CashReportsTab.tsx#L288) | `JSX node text` | Nem található időszaki pénztárjelentés a megadott szűrésre. | **Nema podataka** |
| [CashReportsTab.tsx:L297](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/CashReportsTab.tsx#L297) | `JSX node text` | Sorszám | **— (Prevesti na HR)** |
| [CashReportsTab.tsx:L298](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/CashReportsTab.tsx#L298) | `JSX node text` | Pénztár | **— (Prevesti na HR)** |
| [CashReportsTab.tsx:L299](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/CashReportsTab.tsx#L299) | `JSX node text` | Időszak | **— (Prevesti na HR)** |
| [CashReportsTab.tsx:L300](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/CashReportsTab.tsx#L300) | `JSX node text` | Nyitó | **— (Prevesti na HR)** |
| [CashReportsTab.tsx:L301](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/CashReportsTab.tsx#L301) | `JSX node text` | Bevétel (+) | **— (Prevesti na HR)** |
| [CashReportsTab.tsx:L302](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/CashReportsTab.tsx#L302) | `JSX node text` | Kiadás (-) | **— (Prevesti na HR)** |
| [CashReportsTab.tsx:L303](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/CashReportsTab.tsx#L303) | `JSX node text` | Záró készlet | **— (Prevesti na HR)** |
| [CashReportsTab.tsx:L304](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/CashReportsTab.tsx#L304) | `JSX node text` | Státusz | **— (Prevesti na HR)** |
| [CashReportsTab.tsx:L305](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/CashReportsTab.tsx#L305) | `JSX node text` | Műveletek | **— (Prevesti na HR)** |
| [CashReportsTab.tsx:L476](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/CashReportsTab.tsx#L476) | `JSX node text` | Sorszám: | **— (Prevesti na HR)** |
| [CashReportsTab.tsx:L481](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/CashReportsTab.tsx#L481) | `JSX node text` | Újranyitás indoklása (kötelező) * | **— (Prevesti na HR)** |
| [CashReportsTab.tsx:L524](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/CashReportsTab.tsx#L524) | `JSX node text` | Bizonylatszám: | **— (Prevesti na HR)** |
| [CashReportsTab.tsx:L532](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/CashReportsTab.tsx#L532) | `JSX node text` | Sztv. és kontírozási szabályok ellenőrzése... | **— (Prevesti na HR)** |
| [CashReportsTab.tsx:L540](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/CashReportsTab.tsx#L540) | `JSX node text` | Feladásra kész! | **— (Prevesti na HR)** |
| [CashReportsTab.tsx:L548](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/CashReportsTab.tsx#L548) | `JSX node text` | A feladás nem hajtható végre a következő okok miatt: | **— (Prevesti na HR)** |
| [RegistersTab.tsx:L367](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/RegistersTab.tsx#L367) | `JSX node text` | Pénztár megnevezése * | **— (Prevesti na HR)** |
| [RegistersTab.tsx:L371](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/RegistersTab.tsx#L371) | `JSX node text` | Helyszín / Telephely (opcionális) | **— (Prevesti na HR)** |
| [RegistersTab.tsx:L377](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/RegistersTab.tsx#L377) | `JSX node text` | Kezelt valuták | **— (Prevesti na HR)** |
| [RegistersTab.tsx:L406](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/RegistersTab.tsx#L406) | `JSX node text` | Zárási gyakoriság | **— (Prevesti na HR)** |
| [RegistersTab.tsx:L412](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/RegistersTab.tsx#L412) | `JSX node text` | Napi zárás (minden forgalmas nap) | **— (Prevesti na HR)** |
| [RegistersTab.tsx:L413](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/RegistersTab.tsx#L413) | `JSX node text` | Heti zárás (hétfő - vasárnap) | **— (Prevesti na HR)** |
| [RegistersTab.tsx:L414](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/RegistersTab.tsx#L414) | `JSX node text` | Dekád zárás (10 napos) | **— (Prevesti na HR)** |
| [RegistersTab.tsx:L415](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/RegistersTab.tsx#L415) | `JSX node text` | Havi zárás (hónap utolsó napja) | **— (Prevesti na HR)** |
| [RegistersTab.tsx:L434](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/RegistersTab.tsx#L434) | `JSX node text` | Készpénz keretösszeg (Ft) | **— (Prevesti na HR)** |
| [RegistersTab.tsx:L444](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/RegistersTab.tsx#L444) | `JSX node text` | Kerettúllépési intézkedés | **— (Prevesti na HR)** |
| [RegistersTab.tsx:L450](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/RegistersTab.tsx#L450) | `JSX node text` | Figyelmeztetés a jegyzőkönyvben | **— (Prevesti na HR)** |
| [RegistersTab.tsx:L451](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/RegistersTab.tsx#L451) | `JSX node text` | Zárás tiltása (befizetés szükséges) | **— (Prevesti na HR)** |
| [RegistersTab.tsx:L466](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/RegistersTab.tsx#L466) | `JSX node text` | Pénztárbizonylat (BPB/KPB) szabályzat | **— (Prevesti na HR)** |
| [RegistersTab.tsx:L472](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/RegistersTab.tsx#L472) | `JSX node text` | Csak ha nincs alapbizonylat | **— (Prevesti na HR)** |
| [RegistersTab.tsx:L473](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/RegistersTab.tsx#L473) | `JSX node text` | Minden tételhez kötelező BPB/KPB | **— (Prevesti na HR)** |
| [RegistersTab.tsx:L479](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/RegistersTab.tsx#L479) | `JSX node text` | Utalványozási összeghatár (Ft) | **— (Prevesti na HR)** |
| [RegistersTab.tsx:L486](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/RegistersTab.tsx#L486) | `JSX node text` | Efölötti kiadáshoz külön jóváhagyás kell. | **— (Prevesti na HR)** |
| [RegistersTab.tsx:L490](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/RegistersTab.tsx#L490) | `JSX node text` | Főkönyvi számlaszám | **— (Prevesti na HR)** |
| [RegistersTab.tsx:L504](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/RegistersTab.tsx#L504) | `JSX node text` | Pénztáros és ellenőr azonos személy lehet. | **— (Prevesti na HR)** |
| [RegistersTab.tsx:L517](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/RegistersTab.tsx#L517) | `JSX node text` | Mégse | **Odustani** |
| [RegistersTab.tsx:L616](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/RegistersTab.tsx#L616) | `JSX node text` | Kezdő dátum | **— (Prevesti na HR)** |
| [RoutingRulesTab.tsx:L118](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/RoutingRulesTab.tsx#L118) | `JSX node text` | Routing szabályok | **— (Prevesti na HR)** |
| [RoutingRulesTab.tsx:L119](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/RoutingRulesTab.tsx#L119) | `JSX node text` | Automatikus hozzárendelés szabályok — a magasabb prioritású fut előbb | **— (Prevesti na HR)** |
| [RoutingRulesTab.tsx:L130](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/RoutingRulesTab.tsx#L130) | `JSX node text` | Legalább 2 pénztár szükséges a routing szabályokhoz | **— (Prevesti na HR)** |
| [RoutingRulesTab.tsx:L137](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/RoutingRulesTab.tsx#L137) | `JSX node text` | Nincs routing szabály — minden tétel a default pénztárba kerül | **— (Prevesti na HR)** |
| [RoutingRulesTab.tsx:L146](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/RoutingRulesTab.tsx#L146) | `JSX node text` | Prioritás | **— (Prevesti na HR)** |
| [RoutingRulesTab.tsx:L147](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/RoutingRulesTab.tsx#L147) | `JSX node text` | Feltétel | **— (Prevesti na HR)** |
| [RoutingRulesTab.tsx:L148](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/RoutingRulesTab.tsx#L148) | `JSX node text` | Cél pénztár | **— (Prevesti na HR)** |
| [RoutingRulesTab.tsx:L149](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/RoutingRulesTab.tsx#L149) | `JSX node text` | Aktív | **Aktivno** |
| [RoutingRulesTab.tsx:L166](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/RoutingRulesTab.tsx#L166) | `JSX node text` | Nincs feltétel (mindent elkapó) | **— (Prevesti na HR)** |
| [RoutingRulesTab.tsx:L254](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/RoutingRulesTab.tsx#L254) | `JSX node text` | Ha egy tétel megfelel a feltételeknek, automatikusan a cél pénztárba kerül. | **— (Prevesti na HR)** |
| [RoutingRulesTab.tsx:L273](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/RoutingRulesTab.tsx#L273) | `JSX node text` | Feltételek (üres = nem szűr) | **— (Prevesti na HR)** |
| [RoutingRulesTab.tsx:L280](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/RoutingRulesTab.tsx#L280) | `JSX node text` | Bármelyik | **— (Prevesti na HR)** |
| [RoutingRulesTab.tsx:L286](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/RoutingRulesTab.tsx#L286) | `JSX node text` | Forrás típus | **— (Prevesti na HR)** |
| [RoutingRulesTab.tsx:L296](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/RoutingRulesTab.tsx#L296) | `JSX node text` | Leírás minta | **— (Prevesti na HR)** |
| [RoutingRulesTab.tsx:L300](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/RoutingRulesTab.tsx#L300) | `JSX node text` | Partner minta | **— (Prevesti na HR)** |
| [RoutingRulesTab.tsx:L307](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/RoutingRulesTab.tsx#L307) | `JSX node text` | Mégse | **Odustani** |
| [TransferDialog.tsx:L300](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/TransferDialog.tsx#L300) | `JSX node text` | Az összeg meghaladja a forrás pénztár jelenlegi egyenlegét! | **— (Prevesti na HR)** |
| [TransferDialog.tsx:L308](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/TransferDialog.tsx#L308) | `JSX node text` | Nagy összegű készpénzmozgás — kérjük, ellenőrizd a bizonylatot. | **— (Prevesti na HR)** |
| [WizardStep1Check.tsx:L56](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/closing-wizard/WizardStep1Check.tsx#L56) | `JSX node text` | Zárandó házipénztár | **— (Prevesti na HR)** |
| [WizardStep1Check.tsx:L72](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/closing-wizard/WizardStep1Check.tsx#L72) | `JSX node text` | Zárandó devizanem: | **— (Prevesti na HR)** |
| [WizardStep1Check.tsx:L92](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/closing-wizard/WizardStep1Check.tsx#L92) | `JSX node text` | Zárási időszak | **— (Prevesti na HR)** |
| [WizardStep1Check.tsx:L98](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/closing-wizard/WizardStep1Check.tsx#L98) | `JSX node text` | Sztv. 165. §: nem léphet át naptári hónaphatárt. | **— (Prevesti na HR)** |
| [WizardStep1Check.tsx:L167](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/closing-wizard/WizardStep1Check.tsx#L167) | `JSX node text` | Figyelmeztetés: Negatív készpénzegyenleg! | **— (Prevesti na HR)** |
| [WizardStep1Check.tsx:L212](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/closing-wizard/WizardStep1Check.tsx#L212) | `JSX node text` | Minden ellenőrzés sikeres! A pénztár állománya zárásra kész. | **— (Prevesti na HR)** |
| [WizardStep2Denominations.tsx:L60](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/closing-wizard/WizardStep2Denominations.tsx#L60) | `JSX node text` | Könyv szerinti záró | **— (Prevesti na HR)** |
| [WizardStep2Denominations.tsx:L70](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/closing-wizard/WizardStep2Denominations.tsx#L70) | `JSX node text` | Ténylegesen megszámolt | **— (Prevesti na HR)** |
| [WizardStep2Denominations.tsx:L87](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/closing-wizard/WizardStep2Denominations.tsx#L87) | `JSX node text` | Eltérés (tényleges − könyv) | **— (Prevesti na HR)** |
| [WizardStep2Denominations.tsx:L115](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/closing-wizard/WizardStep2Denominations.tsx#L115) | `JSX node text` | Címlet | **— (Prevesti na HR)** |
| [WizardStep2Denominations.tsx:L116](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/closing-wizard/WizardStep2Denominations.tsx#L116) | `JSX node text` | Megszámolt darab | **— (Prevesti na HR)** |
| [WizardStep2Denominations.tsx:L117](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/closing-wizard/WizardStep2Denominations.tsx#L117) | `JSX node text` | Részösszeg | **— (Prevesti na HR)** |
| [WizardStep2Denominations.tsx:L144](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/closing-wizard/WizardStep2Denominations.tsx#L144) | `JSX node text` | Összesen megszámolt készpénzállomány: | **— (Prevesti na HR)** |
| [WizardStep3Protocol.tsx:L62](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/closing-wizard/WizardStep3Protocol.tsx#L62) | `JSX node text` | Zárási Jegyzőkönyv Összefoglaló | **— (Prevesti na HR)** |
| [WizardStep3Protocol.tsx:L71](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/closing-wizard/WizardStep3Protocol.tsx#L71) | `JSX node text` | Időszak: | **— (Prevesti na HR)** |
| [WizardStep3Protocol.tsx:L75](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/closing-wizard/WizardStep3Protocol.tsx#L75) | `JSX node text` | Nyitó egyenleg: | **— (Prevesti na HR)** |
| [WizardStep3Protocol.tsx:L79](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/closing-wizard/WizardStep3Protocol.tsx#L79) | `JSX node text` | Könyv szerinti záró: | **— (Prevesti na HR)** |
| [WizardStep3Protocol.tsx:L83](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/closing-wizard/WizardStep3Protocol.tsx#L83) | `JSX node text` | Tényleges záró: | **— (Prevesti na HR)** |
| [WizardStep3Protocol.tsx:L90](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/closing-wizard/WizardStep3Protocol.tsx#L90) | `JSX node text` | Jegyzőkönyvezett eltérés: | **— (Prevesti na HR)** |
| [WizardStep3Protocol.tsx:L106](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/closing-wizard/WizardStep3Protocol.tsx#L106) | `JSX node text` | Kötelező eltérés indoklás és intézkedés (Sztv. 165. §) | **— (Prevesti na HR)** |
| [WizardStep3Protocol.tsx:L111](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/closing-wizard/WizardStep3Protocol.tsx#L111) | `JSX node text` | (Mi okozta a hiányt/többletet?) | **— (Prevesti na HR)** |
| [WizardStep3Protocol.tsx:L122](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/closing-wizard/WizardStep3Protocol.tsx#L122) | `JSX node text` | Előírt intézkedés / Kezelés módja * | **— (Prevesti na HR)** |
| [WizardStep3Protocol.tsx:L128](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/closing-wizard/WizardStep3Protocol.tsx#L128) | `JSX node text` | Hiányként lekönyvelendő (3681 ellenszámla) | **— (Prevesti na HR)** |
| [WizardStep3Protocol.tsx:L129](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/closing-wizard/WizardStep3Protocol.tsx#L129) | `JSX node text` | Többletként lekönyvelendő (4791 ellenszámla) | **— (Prevesti na HR)** |
| [WizardStep3Protocol.tsx:L130](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/closing-wizard/WizardStep3Protocol.tsx#L130) | `JSX node text` | Pénztáros azonnal megtéríti készpénzben | **— (Prevesti na HR)** |
| [WizardStep3Protocol.tsx:L131](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/closing-wizard/WizardStep3Protocol.tsx#L131) | `JSX node text` | Kivizsgálás alatt, függőben tartva | **— (Prevesti na HR)** |
| [WizardStep3Protocol.tsx:L168](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/closing-wizard/WizardStep3Protocol.tsx#L168) | `JSX node text` | Zárási jegyzőkönyv egyéb megjegyzései (opcionális) | **— (Prevesti na HR)** |
| [printCashReceipt.ts:L64](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/print/printCashReceipt.ts#L64) | `JSX node text` | Pénztár: | **— (Prevesti na HR)** |
| [printCashReceipt.ts:L82](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/print/printCashReceipt.ts#L82) | `JSX node text` | Jogcím / Hivatkozás: | **— (Prevesti na HR)** |
| [printCashReceipt.ts:L90](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/print/printCashReceipt.ts#L90) | `JSX node text` | Összeg: | **Iznos:** |
| [printCashReceipt.ts:L99](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/print/printCashReceipt.ts#L99) | `JSX node text` | Kiállította | **— (Prevesti na HR)** |
| [printCashReceipt.ts:L100](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/print/printCashReceipt.ts#L100) | `JSX node text` | Pénztáros | **— (Prevesti na HR)** |
| [printCashReceipt.ts:L101](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/print/printCashReceipt.ts#L101) | `JSX node text` | Utalványozó | **— (Prevesti na HR)** |
| [printCashReceipt.ts:L107](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/print/printCashReceipt.ts#L107) | `JSX node text` | Szigorú számadású pénztárbizonylat • eaisybill Házipénztár Modul | **— (Prevesti na HR)** |
| [printCashReport.ts:L65](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/print/printCashReport.ts#L65) | `JSX node text` | Nincs rögzített címletjegyzék. | **— (Prevesti na HR)** |
| [printCashReport.ts:L116](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/print/printCashReport.ts#L116) | `JSX node text` | Pénztár: | **— (Prevesti na HR)** |
| [printCashReport.ts:L119](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/print/printCashReport.ts#L119) | `JSX node text` | Időszaki Pénztárjelentés | **— (Prevesti na HR)** |
| [printCashReport.ts:L123](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/print/printCashReport.ts#L123) | `JSX node text` | Időszak: | **— (Prevesti na HR)** |
| [printCashReport.ts:L133](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/print/printCashReport.ts#L133) | `JSX node text` | Nyitó készpénzállomány | **— (Prevesti na HR)** |
| [printCashReport.ts:L137](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/print/printCashReport.ts#L137) | `JSX node text` | Időszaki bevételek (+) | **— (Prevesti na HR)** |
| [printCashReport.ts:L141](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/print/printCashReport.ts#L141) | `JSX node text` | Időszaki kiadások (-) | **— (Prevesti na HR)** |
| [printCashReport.ts:L145](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/print/printCashReport.ts#L145) | `JSX node text` | Könyv szerinti záró | **— (Prevesti na HR)** |
| [printCashReport.ts:L149](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/print/printCashReport.ts#L149) | `JSX node text` | Tényleges záróállomány | **— (Prevesti na HR)** |
| [printCashReport.ts:L154](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/print/printCashReport.ts#L154) | `JSX node text` | Eltérés | **— (Prevesti na HR)** |
| [printCashReport.ts:L165](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/print/printCashReport.ts#L165) | `JSX node text` | Sor | **— (Prevesti na HR)** |
| [printCashReport.ts:L166](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/print/printCashReport.ts#L166) | `JSX node text` | Dátum | **Datum** |
| [printCashReport.ts:L167](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/print/printCashReport.ts#L167) | `JSX node text` | Típus | **— (Prevesti na HR)** |
| [printCashReport.ts:L168](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/print/printCashReport.ts#L168) | `JSX node text` | Jogcím | **— (Prevesti na HR)** |
| [printCashReport.ts:L169](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/print/printCashReport.ts#L169) | `JSX node text` | Partner / Szöveges leírás | **— (Prevesti na HR)** |
| [printCashReport.ts:L171](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/print/printCashReport.ts#L171) | `JSX node text` | Bevétel (+) | **— (Prevesti na HR)** |
| [printCashReport.ts:L172](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/print/printCashReport.ts#L172) | `JSX node text` | Kiadás (-) | **— (Prevesti na HR)** |
| [printCashReport.ts:L173](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/print/printCashReport.ts#L173) | `JSX node text` | Futó egyenleg | **— (Prevesti na HR)** |
| [printCashReport.ts:L177](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/print/printCashReport.ts#L177) | `JSX node text` | Ebben az időszakban nem volt pénztári tétel. | **— (Prevesti na HR)** |
| [printCashReport.ts:L185](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/print/printCashReport.ts#L185) | `JSX node text` | Címletjegyzék (Tényleges számlálás) | **— (Prevesti na HR)** |
| [printCashReport.ts:L189](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/print/printCashReport.ts#L189) | `JSX node text` | Címlet | **— (Prevesti na HR)** |
| [printCashReport.ts:L190](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/print/printCashReport.ts#L190) | `JSX node text` | Mennyiség | **— (Prevesti na HR)** |
| [printCashReport.ts:L191](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/print/printCashReport.ts#L191) | `JSX node text` | Érték | **— (Prevesti na HR)** |
| [printCashReport.ts:L199](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/print/printCashReport.ts#L199) | `JSX node text` | Összesen: | **Ukupno:** |
| [printCashReport.ts:L208](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/print/printCashReport.ts#L208) | `JSX node text` | Zárási Jegyzőkönyv (Sztv. 165–168. §) | **— (Prevesti na HR)** |
| [printCashReport.ts:L210](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/print/printCashReport.ts#L210) | `JSX node text` | A pénztár tényleges záró készpénzállománya a címletjegyzék alapján: | **— (Prevesti na HR)** |
| [printCashReport.ts:L211](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/print/printCashReport.ts#L211) | `JSX node text` | Könyv szerinti záró egyenleg: | **— (Prevesti na HR)** |
| [printCashReport.ts:L212](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/print/printCashReport.ts#L212) | `JSX node text` | Megállapított eltérés: | **— (Prevesti na HR)** |
| [printCashReport.ts:L213](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/print/printCashReport.ts#L213) | `JSX node text` | Eltérés indoklása: | **— (Prevesti na HR)** |
| [printCashReport.ts:L214](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/print/printCashReport.ts#L214) | `JSX node text` | Elrendelt intézkedés: | **— (Prevesti na HR)** |
| [printCashReport.ts:L223](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/print/printCashReport.ts#L223) | `JSX node text` | Készítette (Pénztáros) | **— (Prevesti na HR)** |
| [printCashReport.ts:L227](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/print/printCashReport.ts#L227) | `JSX node text` | Pénztári Ellenőr | **— (Prevesti na HR)** |
| [printCashReport.ts:L228](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/print/printCashReport.ts#L228) | `JSX node text` | Szakmai és formai ellenőrzés | **— (Prevesti na HR)** |
| [printCashReport.ts:L231](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/print/printCashReport.ts#L231) | `JSX node text` | Utalványozó / Cégvezető | **— (Prevesti na HR)** |
| [printCashReport.ts:L232](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/print/printCashReport.ts#L232) | `JSX node text` | Jóváhagyás | **Odobri** |
| [printCashReport.ts:L238](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/print/printCashReport.ts#L238) | `JSX node text` | Szigorú számadású számviteli bizonylat • Rendszer: eaisybill Házipénztár... | **— (Prevesti na HR)** |
| [BankAccountsTab.tsx:L525](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/settings/BankAccountsTab.tsx#L525) | `JSX node text` | Automatikus banki szinkronizáció | **— (Prevesti na HR)** |
| [BankAccountsTab.tsx:L642](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/settings/BankAccountsTab.tsx#L642) | `JSX node text` | Egyéb bank / Egyedi név | **— (Prevesti na HR)** |
| [BankAccountsTab.tsx:L681](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/settings/BankAccountsTab.tsx#L681) | `JSX node text` | Könyvelési összerendelés (eaisyBooks) | **— (Prevesti na HR)** |
| ... | ... | *(További 82 elem a teljes JSON leltárban)* | ... |


---

## 🔑 5. Hiányzó vagy Nem Szinkronizált i18n Szótárkulcsok

| Forrás és sorszám | Elem | Megjelenő magyar szöveg | Javasolt horvát (HR) fordítás |
| :--- | :--- | :--- | :--- |
| [CashClosingDialog.tsx:L280](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/CashClosingDialog.tsx#L280) | `t('pettyCash:closing_dialog.pdf.closing_summary') missing in hr/pettyCash.json` | Záró készpénzállomány levezetése (lista végén) | **— (Prevesti na HR)** |
| [CashClosingDialog.tsx:L397](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/CashClosingDialog.tsx#L397) | `t('pettyCash:closing_dialog.policy_limit_exceeded') missing in hr/pettyCash.json` | Számviteli politika figyelmeztetés | **— (Prevesti na HR)** |
| [CashClosingDialog.tsx:L399](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/CashClosingDialog.tsx#L399) | `t('pettyCash:closing_dialog.policy_limit_desc') missing in hr/pettyCash.json` | pettyCash:closing_dialog.policy_limit_desc | **— (Prevesti na HR)** |
| [CashClosingDialog.tsx:L456](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/CashClosingDialog.tsx#L456) | `t('pettyCash:closing_dialog.footer_summary') missing in hr/pettyCash.json` | Összesítés | **— (Prevesti na HR)** |
| [EntriesTab.tsx:L534](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/EntriesTab.tsx#L534) | `t('common:error') missing in hr/common.json` | Hiba | **Greška** |
| [EntriesTab.tsx:L731](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/EntriesTab.tsx#L731) | `t('pettyCash:entries.actions.view_invoice_image') missing in hr/pettyCash.json` | Számlakép megtekintése | **— (Prevesti na HR)** |
| [EntriesTab.tsx:L835](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/EntriesTab.tsx#L835) | `t('common:edit') missing in hr/common.json` | Szerkesztés | **Uredi** |
| [EntriesTab.tsx:L1751](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/EntriesTab.tsx#L1751) | `t('pettyCash:manual_entry_dialog.error_no_invoice_selected') missing in hr/pettyCash.json` | Legalább egy számla kiválasztása kötelező! | **— (Prevesti na HR)** |
| [EntriesTab.tsx:L1761](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/EntriesTab.tsx#L1761) | `t('pettyCash:manual_entry_dialog.error_no_register') missing in hr/pettyCash.json` | Pénztár kiválasztása kötelező! | **— (Prevesti na HR)** |
| [EntriesTab.tsx:L1769](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/EntriesTab.tsx#L1769) | `t('pettyCash:manual_entry_dialog.error_amount_required') missing in hr/pettyCash.json` | Az összeg megadása kötelező! | **— (Prevesti na HR)** |
| [EntriesTab.tsx:L1778](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/EntriesTab.tsx#L1778) | `t('pettyCash:manual_entry_dialog.error_description_required') missing in hr/pettyCash.json` | A leírás megadása kötelező! | **— (Prevesti na HR)** |
| [EntriesTab.tsx:L1848](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/EntriesTab.tsx#L1848) | `t('pettyCash:manual_entry_dialog.no_registers_warning') missing in hr/pettyCash.json` | Nincs elérhető házipénztár. Először hozz létre egy pénztárat a Pénztárak... | **— (Prevesti na HR)** |
| [EntriesTab.tsx:L2062](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/EntriesTab.tsx#L2062) | `t('pettyCash:manual_entry_dialog.choose_register') missing in hr/pettyCash.json` | Válassz pénztárat... | **— (Prevesti na HR)** |
| [EntriesTab.tsx:L2140](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/EntriesTab.tsx#L2140) | `t('pettyCash:entries.currency_label') missing in hr/pettyCash.json` | Pénznem | **Valuta** |
| [EntriesTab.tsx:L2203](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/EntriesTab.tsx#L2203) | `t('pettyCash:manual_entry_dialog.policy_single_payment_warning') missing in hr/pettyCash.json` | pettyCash:manual_entry_dialog.policy_single_payment_warning | **— (Prevesti na HR)** |
| [TransferDialog.tsx:L336](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/TransferDialog.tsx#L336) | `t('common:cancel') missing in hr/common.json` | Mégse | **Odustani** |
| [TransferDialog.tsx:L349](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/petty-cash/TransferDialog.tsx#L349) | `t('common:saving') missing in hr/common.json` | Mentés... | **Spremi...** |
| [BulkBookTransactionsDialog.tsx:L279](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/transactions/BulkBookTransactionsDialog.tsx#L279) | `t('common:cancel') missing in hr/common.json` | Mégse | **Odustani** |
| [partner-type-filter.tsx:L32](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/ui/partner-type-filter.tsx#L32) | `t('partners:filter_aria') missing in hr/partners.json` | Partner típus szűrő | **— (Prevesti na HR)** |
| [PartnersPage.tsx:L851](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/PartnersPage.tsx#L851) | `t('partners:toasts.invalid_tax_title') missing in hr/partners.json` | Érvénytelen adószám | **— (Prevesti na HR)** |
| [PartnersPage.tsx:L852](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/PartnersPage.tsx#L852) | `t('partners:toasts.invalid_tax_desc') missing in hr/partners.json` | Kérjük, adj meg legalább 8 számjegyet a NAV lekérdezéshez. | **— (Prevesti na HR)** |
| [PartnersPage.tsx:L863](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/PartnersPage.tsx#L863) | `t('partners:toasts.nav_lookup_failed') missing in hr/partners.json` | NAV lekérdezés sikertelen | **— (Prevesti na HR)** |
| [PartnersPage.tsx:L864](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/PartnersPage.tsx#L864) | `t('partners:toasts.nav_not_found') missing in hr/partners.json` | Az adószám nem található a NAV nyilvántartásában. | **Nema podataka** |
| [PartnersPage.tsx:L883](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/PartnersPage.tsx#L883) | `t('partners:toasts.nav_success') missing in hr/partners.json` | NAV adatok betöltve | **— (Prevesti na HR)** |
| [PartnersPage.tsx:L888](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/PartnersPage.tsx#L888) | `t('partners:toasts.nav_lookup_failed') missing in hr/partners.json` | NAV lekérdezési hiba | **— (Prevesti na HR)** |
| [PartnersPage.tsx:L907](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/PartnersPage.tsx#L907) | `t('partners:toasts.nav_enrich_failed') missing in hr/partners.json` | Kiegészítés sikertelen | **— (Prevesti na HR)** |
| [PartnersPage.tsx:L955](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/PartnersPage.tsx#L955) | `t('partners:toasts.nav_enriched_success') missing in hr/partners.json` | Adószám sikeresen kiegészítve | **— (Prevesti na HR)** |
| [PartnersPage.tsx:L1126](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/PartnersPage.tsx#L1126) | `t('common:no_permission') missing in hr/common.json` | Nincs írási jogosultságod | **— (Prevesti na HR)** |
| [PartnersPage.tsx:L1534](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/PartnersPage.tsx#L1534) | `t('partners:details.skonto_setting') missing in hr/partners.json` | Gyorsfizetési kedvezmény (Skontó) | **— (Prevesti na HR)** |
| [PartnersPage.tsx:L2092](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/PartnersPage.tsx#L2092) | `t('partners:modal.skonto_subtitle') missing in hr/partners.json` | Kettős fizetési határidő és kedvezményes összeg. | **— (Prevesti na HR)** |
| [PartnersPage.tsx:L2108](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/PartnersPage.tsx#L2108) | `t('partners:modal.skonto_days') missing in hr/partners.json` | Kedvezményes napok | **— (Prevesti na HR)** |
| [PartnersPage.tsx:L2125](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/PartnersPage.tsx#L2125) | `t('partners:modal.skonto_percent') missing in hr/partners.json` | Kedvezmény mértéke | **— (Prevesti na HR)** |
| [PartnersPage.tsx:L2157](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/PartnersPage.tsx#L2157) | `t('partners:modal.skonto_excludes_shipping') missing in hr/partners.json` | Szállítási költség kizárása a kedvezményalapból | **— (Prevesti na HR)** |
| [PartnersPage.tsx:L2160](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/PartnersPage.tsx#L2160) | `t('partners:modal.skonto_excludes_shipping_hint') missing in hr/partners.json` | A fuvardíjból nem vonható le a skontó, csak a termékek árából. | **— (Prevesti na HR)** |
| [PettyCashPage.tsx:L147](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/PettyCashPage.tsx#L147) | `t('common:select_company_continue') missing in hr/common.json` | Válassz egy céget a folytatáshoz | **— (Prevesti na HR)** |
| [PettyCashPage.tsx:L317](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/PettyCashPage.tsx#L317) | `t('pettyCash:tabs.reports') missing in hr/pettyCash.json` | Pénztárjelentések | **— (Prevesti na HR)** |
| [TransactionsPage.tsx:L544](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/TransactionsPage.tsx#L544) | `t('common:select_company') missing in hr/common.json` | Válassz egy céget a folytatáshoz | **— (Prevesti na HR)** |
| [TransactionsPage.tsx:L1318](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/TransactionsPage.tsx#L1318) | `t('common:export') missing in hr/common.json` | Exportálás | **— (Prevesti na HR)** |
| [TransactionsPage.tsx:L1325](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/TransactionsPage.tsx#L1325) | `t('transactions:export.excel') missing in hr/transactions.json` | Excel export (.xlsx) | **— (Prevesti na HR)** |
| [TransactionsPage.tsx:L1329](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/TransactionsPage.tsx#L1329) | `t('transactions:export.csv') missing in hr/transactions.json` | CSV export (.csv) | **— (Prevesti na HR)** |
| [TransactionsPage.tsx:L1334](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/TransactionsPage.tsx#L1334) | `t('transactions:export.pdf') missing in hr/transactions.json` | Nyomtatási nézet / PDF | **— (Prevesti na HR)** |
| [TransfersPage.tsx:L202](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/TransfersPage.tsx#L202) | `t('transfers:validation.invalid_cdv') missing in hr/transfers.json` | Érvénytelen bankszámlaszám (hibás CDV ellenőrzőösszeg) | **— (Prevesti na HR)** |
| [TransfersPage.tsx:L995](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/TransfersPage.tsx#L995) | `t('common:error') missing in hr/common.json` | Hiba | **Greška** |
| [TransfersPage.tsx:L1092](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/TransfersPage.tsx#L1092) | `t('common:success') missing in hr/common.json` | Sikeres művelet | **— (Prevesti na HR)** |


---

## 🚀 6. Moduláris Javítási Javaslat

1. A modulban szereplő hardkódolt feliratokat ki kell szervezni a `src/locales/hu/transactions.json` és `src/locales/hr/transactions.json` fájlokba.
2. A `toast({{ title: '...', description: '...' }})` hívásoknál kötelező bevezetni a `t('{ns}:toasts.title')` és `t('{ns}:toasts.desc')` formátumot.
3. A táblázatokban és badge-ekben szereplő hardkódolt magyar string literálokat (`'Fizetve'`, `'Függőben'`) fel kell váltani a központi állapotfordító segédfüggvénnyel vagy szótári kulccsal.
