# Szállító-Projekt Alapértelmezett Hozzárendelés - KÉSZ ✅

## Implementált Funkcionalitás

### 1. Adatbázis Séma Módosítások ✅
- **partners.default_project_id**: UUID mező a szállító alapértelmezett projektjéhez
- **nav_invoices.supplier_partner_id**: UUID mező a szállító partner azonosításához
- **assign_supplier_default_projects()**: RPC függvény az automatikus projekt hozzárendeléshez
- **enforce_invoice_single_project()**: Javított trigger ID + név a hibaüzenetben

### 2. Edge Functions Frissítve ✅
- **nav-query-outbound-invoices**: 
  - `cachePartnersFromInvoices` visszaadja a partner ID map-ot
  - `supplier_partner_id` beállítása INBOUND számláknál
  - Post-upsert `assign_supplier_default_projects` RPC hívás
- **nav-auto-sync**: Ugyanezek a módosítások

### 3. Frontend Módosítások ✅
- **PartnersPage.tsx**:
  - Projektek lekérdezése a dropdown-hoz
  - default_project_id mező a form-ban
  - Partner szerkesztés dialog bővítve alapértelmezett projekt választóval
  - Táblázat bővítve "Alap. projekt" oszloppal
- **InvoicesPage.tsx**: Javított hibakezelés (ID + név kinyerése)
- **SupplierInvoiceAssignment.tsx**: Javított hibakezelés

## Működés

1. **Partnertörzs**: Szállító szerkesztésekor választható alapértelmezett projekt
2. **NAV Sync**: Új bejövő számlák automatikusan a szállító alapértelmezett projektjéhez rendelődnek
3. **Számla hozzárendelés**: Ha egy számla már projekthez van rendelve, a trigger megakadályozza a felülírást és visszaadja a projekt nevét
