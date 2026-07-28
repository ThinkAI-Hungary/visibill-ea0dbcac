# ☸️ Kubernetes (K8s) & Konténer Orkesztráció

> **Utoljára frissítve:** 2026-07-25  
> **Kapcsolódó doksi:** [Docker & Konténerizáció](./docker-containers.md) | [GLOSSARY Index](../index.md)

---

## 📖 Fogalom Meghatározása

A **Kubernetes (röviden K8s)** egy nyílt forráskódú **konténer-orkesztrációs (Container Orchestration) platform**, amelyet eredetileg a Google fejlesztett ki. A Kubernetes feladata a több szerverből álló konténeres infrastruktúrák automatikus skálázása, üzembe helyezése (deployment), terheléselosztása (load balancing) és öngyógyítása (self-healing).

---

## 🔑 Főbb K8s Koncepciók

| Kifejezés | Definíció |
|---|---|
| **Pod** | A Kubernetes legkisebb üzemeltetési egysége. Egy vagy több szorosan összetartozó Docker konténert tartalmaz, amelyek közös IP címen és hálózaton osztoznak. |
| **Node** | Egy fizikai vagy virtuális szerver (VM) a Kubernetes cluster-ben. |
| **Cluster** | Node-ok (szerverek) összessége, amelyeket a Kubernetes Master/Control Plane vezérel. |
| **Deployment** | Deklaratív leíró, amely meghatározza, hány példányban (replica) kell futnia egy Pod-nak, és hogyan kell frissíteni őket (rolling update). |
| **Service & Ingress** | A Pod-ok közötti belső hálózati kommunikációt (ClusterIP) és a külső internetes forgalom bevezetését (Ingress Controller, SSL cert) kezelő komponensek. |
| **HPA (Horizontal Pod Autoscaler)** | Automatikus skálázó: CPU, memória vagy queue hossz alapján automatikusan emeli a Pod-ok számát nagy terhelésnél, és csökkenti nyugalmi időszakban. |

---

## 💡 Hogyan viszonyul a Kubernetes a Visibillhez?

### Jelenlegi Architektúra (Docker Compose egy Droplet-en)
Jelenleg a Visibill worker konténerei **Docker Compose** segítségével futnak egyetlen erőteljes DigitalOcean Droplet szerveren. Ez a struktúra egyszerű, költséghatékony és könnyen karbantartható alacsony/közepes terhelés mellett.

### Jövőbeli Skálázódás (K8s / Managed Kubernetes)
Amennyiben a Visibill terhelése (pl. napi több százezer számla OCR és feldolgozása) meghaladja az 1 szerver kapacitását, a rendszer áttérhet **Managed Kubernetes (pl. DigitalOcean Kubernetes / DOKS vagy AWS EKS)** használatára:

```
[ Incoming PGMQ Queue Messages (pl. 5,000 feldolgozandó PDF) ]
                               ↓
                 [ Kubernetes HPA Autoscaler ]
                               ↓
   ┌───────────────────────────┼───────────────────────────┐
   ↓                           ↓                           ↓
[ Worker Pod 1 ]            [ Worker Pod 2 ]     ...   [ Worker Pod N ]
(Node A - Droplet 1)        (Node B - Droplet 2)       (Node C - Droplet 3)
```

**Előnyök nagy terhelésnél:**
- **Zero-Downtime Deployment:** Új verzió kibocsátásakor a meglévő Pod-ok addig futnak, amíg az újak fel nem állnak.
- **Self-Healing:** Ha egy worker pod megbukik (OOM hiba vagy fagyás), a Kubernetes azonnal újraindítja egy másik Node-on.
- **Queue-alapú Autoscaling:** A PGMQ várakozó számlák száma alapján dinamikusan skálázza 3-ról 30-ra a worker pod-ok számát.
