# Decision 003: Lokalizáció & Nyelv

**Status:** Partially Decided

**Category:** Célpiac & Üzleti Modell

**Question:** A Visibill kizárólag magyar nyelvű marad, vagy tervezünk angol (vagy más nyelvű) felületet is? Szükséges-e i18n keretrendszer bevezetése? Az adatbázis mező elnevezések egységesítése (jelenleg vegyes magyar/angol) szükséges-e?

**Decision:** A UI teljes egészében magyar nyelvű. Az adatbázis mezőnevek vegyesen magyar (pl. bizonylatsorszam, kibocsatas_datuma) és angol (pl. invoice_type, status). Az alapértelmezett pénznem HUF, de van többvalutás támogatás.

**Rationale:** A magyar piac és NAV-integráció miatt a magyar nyelv elsődleges. A vegyes DB mező elnevezések a fejlesztés során organikusan alakultak ki — a régebbi táblák magyarok, az újabbak angolok. Ez technikai adósság, de a felhasználók nem látják.
