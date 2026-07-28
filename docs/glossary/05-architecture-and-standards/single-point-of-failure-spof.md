# 💥 SPOF — Single Point of Failure (Egyetlen Hibapont)

> **Utoljára frissítve:** 2026-07-25  
> **Kapcsolódó doksi:** [Load Balancer](./load-balancer.md) | [Kubernetes (K8s)](../06-infrastructure-and-devops/kubernetes-k8s.md) | [GLOSSARY Index](../index.md)

---

## 📖 Fogalom Meghatározása

A **Single Point of Failure (SPOF)** a rendszermérnöki gyakorlatban olyan **egyelemű komponenst vagy infrastruktúra elemet** jelent, amelynek meghibásodása a **teljes rendszer vagy szolgáltatás azonnali leállását (downtime)** eredményezi, mert nincs hozzá redundáns tartalék (failover).

A megbízható és magas rendelkezésre állású (High Availability - HA) rendszerek tervezésekor az elsődleges cél az összes SPOF elem felkutatása és kiváltása.

---

## 🚨 Rendszerelemek Kockázati Elemzése a Visibillben

| Architektúra Elem | SPOF Kockázat? | Jelenlegi Állapot & Védelem | Jövőbeli HA Megoldás |
|---|---|---|---|
| **Python Worker Szerver** | ⚠️ **Igen (Közepes)** | Egyetlen DigitalOcean Droplet-en futnak a konténerek. Ha a VM leáll, az aszinkron feldolgozás szünetel. (A webapp és a Supabase működik tovább!). | Több VM / DigitalOcean Kubernetes (DOKS) Node-on futtatott worker Pod-ok. |
| **Supabase Adatbázis** | ❌ **Nem (Alacsony)** | A Supabase felhő kezeli az adatbázis automatikus mentését, lemeztükrözését és az elsődleges felhős redundanciát. | Multi-Region Read Replicas (szükség esetén). |
| **Edge Function-ök** | ❌ **Nem (Nincs SPOF)** | Szervermentes (serverless) architektúra elosztott Edge csomópontokon. | Automatikus globális felhő-redundancia. |
| **Mailgun Webhook** | ❌ **Nem (Nincs SPOF)** | Ha a Visibill ideiglenesen elérhetetlen, a Mailgun automatikusan újrapróbálja a kézbesítést (retry policy) 24 órán át. | — |

---

## 🛡️ SPOF Elleni Védekezési Stratégiák

1. **Redundancia (Redundancy):** Minden kritikus elemből legalább 2 aktív példány futtatása.
2. **Failover (Automatikus Átállás):** Ha az elsődleges komponens megbukik, a terheléselosztó vagy a felhő platform azonnal átkapcsol a tartalék komponensre.
3. **Idempotens és Aszinkron Újrapróbálkozás:** A PGMQ üzenetsor és a Mailgun retry mechanizmusa biztosítja, hogy a leállások alatt sem vesznek el adatok.
