# 🌐 Gráfalgoritmusok & Topológiai Rendezése (BFS, DFS, TopoSort)

> **Utoljára frissítve:** 2026-07-25  
> **Kapcsolódó doksi:** [GLOSSARY Index](../index.md)

---

## 📖 Fogalom Meghatározása

A **Gráf (Graph)** olyan adatszerkezet, amely **Csúcsokból (Nodes / Vertices)** és az azokat összekötő **Élekből (Edges)** áll. 

A gráfok segítségével modellhetők a való életbeli hálózatok, függőségi fák, workflow láncolatok és kód-architektúrák.

---

## 🔑 Főbb Gráfbejárási & Rendezési Algoritmusok

### 1. BFS (Breadth-First Search — Szélességi Keresés)
- **Működése:** A kezdőcsúcsból indulva először az összes közvetlen szomszédot (1. szint), majd azok szomszédait (2. szint) látogatja meg sorban (Queue adatszerkezettel).
- **Alkalmazása:** Legrövidebb útvonal megkeresése súlyozatlan gráfokban (pl. hálózati útvonalválasztás, ismerős ajánlás).

### 2. DFS (Depth-First Search — Mélységi Keresés)
- **Működése:** A kezdőcsúcsból indulva a lehető legmélyebbre megy az egyik ágon, amíg el nem éri a végét (vagy egy már meglátogatott csúcsot), majd visszalép (Backtracking / Stack adatszervezet).
- **Alkalmazása:** Ciklusok detektálása a gráfban, elérhetőség vizsgálata.

### 3. Topological Sort (Topológiai Rendezés — DAG)
- **Működése:** Egy **Irányított Ciklusmentes Gráf (DAG - Directed Acyclic Graph)** csúcsait olyan lineáris sorrendbe rendezi, hogy minden $(U \rightarrow V)$ él esetén az $U$ csúcs megelőzi a $V$ csúcsot.
- **Alkalmazása:** Függőségi fák feloldása (pl. build eszközök feladat-sorrendje, Python modul import függőségek).

```
[ A: Törzsadat ] ──► [ B: Számla Iktatás ] ──► [ C: Könyvelés ]
                                                      ▲
[ D: Partner ] ───────────────────────────────────────┘

Topológiai Sorrend: A, D, B, C (A feladatok csak ebben a sorrendben futhatnak le!)
```

---

## 💡 Használat a Visibill Projektben

1. **Graphify Kód-Architektúra Gráf:**  
   A projektben futó `graphify update` parancs a teljes Visibill kódalapot (React komponensek, Edge Function-ök, Python modulok) gráffá alakítja, ahol a csúcsok a fájlok/függvények, az élek pedig az importok és hívások. A Graphify a BFS/DFS algoritmusokkal deríti fel a csomópontokat és közösségeket (Communities).

2. **Pipeline Job Végrehajtási Láncolat:**  
   A számla feldolgozási lépések (Splitter → OCR → AI Extractor → DB Save) egy szigorúan topológiailag rendezett DAG-ot alkotnak.
