# ⚖️ Load Balancer (Terheléselosztó)

> **Utoljára frissítve:** 2026-07-25  
> **Kapcsolódó doksi:** [Kubernetes (K8s)](../06-infrastructure-and-devops/kubernetes-k8s.md) | [Single Point of Failure](./single-point-of-failure-spof.md) | [GLOSSARY Index](../index.md)

---

## 📖 Fogalom Meghatározása

A **Load Balancer (Terheléselosztó)** egy olyan hálózati komponens (hardver vagy szoftver), amely a beérkező hálózati forgalmat (HTTP/HTTPS kérések vagy TCP csomagok) elosztja több háttérszerver (backend node, konténer) között.

A terheléselosztó fő célja az alkalmazás **készültségének (availability)** növelése, a válaszidők optimalizálása és a szerverek túlterhelődésének megakadályozása.

---

## 🔑 Főbb Elosztási Algoritmusok & Health Check-ek

| Kifejezés | Definíció & Működés |
|---|---|
| **Round Robin** | A beérkező kéréseket sorban egymás után osztja ki a szervereknek (1. szerver -> 2. szerver -> 3. szerver -> 1. szerver...). |
| **Least Connections** | A kérést annak a szervernek irányítja át, amely éppen a legkevesebb aktív kapcsolattal rendelkezik. |
| **IP Hash / Sticky Session** | Egy adott ügyfél (IP cím) kéréseit mindig ugyanahhoz a háttérszerverhez irányítja. |
| **Health Check (Egészség-ellenőrzés)** | A terheléselosztó rendszeresen pingeli a háttérszerverek egy kitüntetett végpontját (pl. `/health`). Ha egy szerver nem válaszol, automatikusan kiveszi a forgalomból. |

---

## 💡 Használat a Visibillben

1. **DigitalOcean Load Balancer / Cloudflare:**  
   Közvetíti a HTTPS forgalmat a frontend felé, és SSL/TLS terminációt végez.

2. **Worker Heartbeat Monitoring:**  
   A Python worker konténerek percenként elküldik az állapotukat a `worker_heartbeats` táblába. A Management Dashboard ezt a health-check logikát használja fel az elakadt konténerek kiszűrésére.
