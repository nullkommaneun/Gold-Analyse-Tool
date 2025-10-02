# GoldRadar (GitHub Pages)

Ultra‑leichte, statische Webapp für **Live‑Goldpreis** plus eine simple, erklärte **Kauf‑Ampel** aus Makro‑Signalen. Läuft 100% client‑seitig auf GitHub Pages.

## Features
- Live‑Chart & Preis via **TradingView Widgets**
- Verständlicher **Kauf‑Score** (0–100) aus 10J‑Realzins, EURUSD, Öl & VIX (konfigurierbar)
- **DEMO** ohne API‑Keys out‑of‑the‑box — alles rendert sofort
- **LIVE** Modus mit optionalen öffentlichen APIs (ohne Server/Proxies)
- Schlankes Dark‑UI (Tailwind CDN), responsive, barrierearm
- Kein Tracking, keine Cookies (nur localStorage für Settings)

## Deploy
1. Repository erstellen, Ordner‑Inhalt hochladen.
2. GitHub Pages einschalten → Branch `main`, `/` (root).
3. Seite öffnen → läuft.

## Datenquellen
- **Goldpreis/Chart/Technik**: TradingView Widgets (XAUUSD)
- **Realzins 10J (USA)**: U.S. Treasury FiscalData API (JSON) *oder* XML‑Feed
- **EUR↔USD**: ECB Data Portal SDW (JSON, ohne Key)
- **WTI & VIX**: FRED (API‑Key nötig, optional)

### Doku / Referenzen
- TradingView XAUUSD & Widgets citeturn0search2turn0search17
- FRED API (Key erforderlich) citeturn0search3turn0search18
- U.S. Treasury Interest Rate Statistics & Real Yield Curve (Hintergrund) citeturn4search7turn0search10
- FiscalData API URL‑Schema (Beispiel) citeturn2search18
- ECB SDW JSON API (Beispiele) citeturn0search1turn0search6

## LIVE konfigurieren
- Rechts oben **⚙️ Konfigurieren** → FRED‑Key eintragen (für WTI & VIX).
- ECB & Treasury sind ohne Key möglich (Standard).

> **Hinweis:** Kein Finanzrat. Die Ampel ist eine **Heuristik** – transparent und erklärbar, nicht perfekt.

## Lizenz
MIT
