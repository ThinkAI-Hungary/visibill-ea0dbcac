# 🤖 Visibill AI Skills

AI asszisztens skillek az eaisybill fejlesztéshez. Ezek a skillek biztosítják a specification-driven development workflow-t, a zero silent decisions elvet, és a dokumentáció automatikus frissítését.

## Telepítés

### Windows (PowerShell — Admin vagy Developer Mode)

```powershell
# A projekt gyökérmappájából:
.\setup-skills.ps1
```

A script symlink-eket hoz létre a `~/.gemini/config/skills/` mappába, így:
- A skillek mindig a repóból töltődnek be
- `git pull` automatikusan frissíti őket
- Nem kell kézzel másolgatni

### Ellenőrzés

```powershell
# Megnézi hogy a symlink-ek léteznek-e:
Get-ChildItem "$env:USERPROFILE\.gemini\config\skills\visibill-*" | Select-Object Name, Target
```

## Skillek Áttekintése

### 🔍 Mindig aktív
| Skill | Mikor triggerel | Méret |
|---|---|---|
| **visibill-spec-lookup** | Minden Visibill kód módosítás | ~2K token |

### 📋 Tervezés & Implementáció
| Skill | Mikor triggerel | Méret |
|---|---|---|
| **visibill-feature-planner** | Komplex feature (3+ fájl, új modul) | ~4K token |
| **visibill-db-checklist** | DB munka (migration, RPC, RLS) | ~2K token |

### 📝 Audit & Dokumentáció
| Skill | Mikor triggerel | Méret |
|---|---|---|
| **codebase-audit** | Kódbázis átvizsgálás | ~7K token |
| **scalability-audit** | Skálázhatósági audit | ~6K token |
| **visibill-db-audit** | DB séma/RLS audit | ~2.5K token |
| **visibill-doc-audit** | Dokumentáció audit | ~1.5K token |
| **visibill-doc-sync** | Dokumentáció szinkronizálás | ~1.5K token |
| **visibill-adr-navigator** | ADR navigáció | ~1.5K token |

## Workflow

```
User kérés → spec-lookup (mindig) → komplexitás döntés
                                        ↓
                          ┌─────────────┼─────────────┐
                          ↓             ↓             ↓
                     Egyszerű      DB munka       Komplex
                     (direkt)    (db-checklist) (feature-planner)
                          ↓             ↓             ↓
                     Implementáció ← ← ← ← ← ← ← ← ┘
                          ↓
                     Build verify (rekurzív)
                          ↓
                     User validáció
                          ↓
                     Docs frissítés (automatikus)
                          ↓
                     Graphify update
```

## Frissítés

Ha a skillek frissülnek a repóban:
```bash
git pull  # A symlink-ek miatt automatikusan frissülnek
```

Ha új skill kerül hozzáadásra:
```powershell
.\setup-skills.ps1  # Idempotens — csak az újakat telepíti
```
