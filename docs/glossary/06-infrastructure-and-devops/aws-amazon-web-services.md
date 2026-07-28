# ☁️ AWS — Amazon Web Services (Felhő Infrastruktúra)

> **Utoljára frissítve:** 2026-07-25  
> **Kapcsolódó doksi:** [AWS S3 Object Storage](./aws-s3-object-storage.md) | [Kubernetes (K8s)](./kubernetes-k8s.md) | [GLOSSARY Index](../index.md)

---

## 📖 Fogalom Meghatározása

Az **AWS (Amazon Web Services)** a világ vezető, legátfogóbb és legszélesebb körben használt **felhőalapú számítástechnikai platformja (Cloud Computing Platform)**, amelyet az Amazon nyújt.

Az AWS több mint 200 teljes értékű szolgáltatást kínál globális adatközpontokból, beleértve a virtuális szervereket (EC2), objektumtárolást (S3), felhős adatbázisokat (RDS, DynamoDB), szervermentes kódfuttatást (Lambda) és konténer-orkesztrációt (EKS).

---

## 🔑 Főbb AWS Szolgáltatások & Fogalmak

| AWS Szolgáltatás | Kategória | Funkció & Megfelelője a Visibill Stackben |
|---|---|---|
| **AWS S3** | Storage | Skálázható objektumtároló fájlokhoz (PDF számlák, csatolmányok). Supabase Storage S3-kompatibilis API-t használ. |
| **AWS EC2** | Compute | Virtuális szerverek (VM). Vállalati megfelelője a Visibillben használt **DigitalOcean Droplet** szervereknek. |
| **AWS EKS** | Containers | Elastic Kubernetes Service — Managed Kubernetes cluster nagy terhelésű konténer-skálázáshoz. |
| **AWS Lambda** | Serverless | Eseményvezérelt szervermentes kódfuttatás. Vállalati megfelelője a **Supabase Edge Function-öknek**. |
| **AWS CloudFront** | CDN | Globális tartalomterjesztő hálózat (Content Delivery Network) a statikus assets és webappok gyorsítására. |
| **AWS IAM** | Security | Identity and Access Management — Finomhangolt hozzáférés-kezelési és szerepkör jogosultsági rendszer. |

---

## 💡 Hogyan Viszonyul az AWS a Visibillhez?

### Jelenlegi Architektúra (Supabase + DigitalOcean)
A Visibill jelenleg a **Supabase (BaaS)** és a **DigitalOcean** felhő-struktúráját használja:
- **Gyorsabb fejlesztési tempó:** Nem kell bonyolult IAM szabályokat és VPC hálózatokat konfigurálni.
- **Költséghatékonyság:** A Supabase és a DigitalOcean átlátható, kiszámítható havi árazást biztosít KKV platform méretnél.

### AWS Vállalati Migrációs Útvonal (Nagy Vállalati Skálázódás)
Ha a Visibill eléri a nagyvállalati (Enterprise) szintet, az architektúra elemei zökkenőmentesen átültethetők AWS infrastruktúrára:
1. **Fájlok:** Supabase Storage → **AWS S3 Bucket** (S3 SDK kompatibilitás miatt kódmódosítás nélkül).
2. **Worker Scaling:** DigitalOcean Docker Compose → **AWS EKS (Kubernetes)** vagy **AWS ECS Fargate**.
3. **Adatbázis:** Managed PostgreSQL → **AWS Aurora PostgreSQL** (magas rendelkezésre állású több-zónás felhőadatbázis).
