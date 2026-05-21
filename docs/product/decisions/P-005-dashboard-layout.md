# P-005: Dashboard Widgetek & Elrendezés

**Status:** Decided  
**Category:** Dashboard & Navigáció  
**BRD Reference:** REQ-3.1

**Question:** Milyen widgeteket jelenít meg a dashboard és hogyan vannak elrendezve?

**Decision:** Fix elrendezés, preferences-szel (valuta, bruttó/nettó, section toggle-ök). Nincs widget drag & drop.

**Current Implementation:**
- DashboardWelcome: üdvözlés, valuta váltó, bruttó/nettó toggle
- DashboardMetrics: fő metrikák (bevétel, kiadás, ÁFA, házipénztár egyenleg)
- VatSection: ÁFA bontás (collapsible)
- UnmatchedSection: párosítatlan tételek figyelmeztetés
- InvoiceStatusTables: számlák státusz szerinti bontása
- RevenueExpensesChart: havi bevétel/kiadás diagram (chart line toggle-ök)
- RecentInvoices (2/3) + SubscriptionUsage + ProjectBreakdown (1/3)
- ProfileSummary + QuickActions

**Rationale:** Fix elrendezés konzisztens élményt ad. A meglévő preferences (valuta, bruttó/nettó, collapsible szekciók) elegendő testreszabhatóságot nyújtanak. Widget hide/show toggle-ök bevezetése akkor lesz aktuális ha userek kérik.
