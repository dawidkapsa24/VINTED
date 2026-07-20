# VINTED — Vougly+ (roboczo)

AI: zdjęcie ubrania → zdjęcie na modelu + gotowy opis pod Vinted. Zobacz pełną wizję:
[`docs/wizja-aplikacji.md`](docs/wizja-aplikacji.md).

Status: **Faza 1, krok 1** — chudy prototyp (upload zdjęcia modela + ubrania → fal.ai
FASHN v1.6 → wynik na ekranie). Bez logowania, bez bazy danych.

## Struktura

```
/frontend   – React + Vite + TypeScript
/backend    – Node/TS + Fastify, endpoint POST /api/tryon
/docs       – dokumentacja projektu
```

## Uruchomienie lokalnie

### Backend

```bash
cd backend
cp .env.example .env   # wklej swój FAL_KEY
npm install
npm run dev             # http://localhost:8080
```

### Frontend

```bash
cd frontend
cp .env.example .env    # domyślnie wskazuje na localhost:8080
npm install
npm run dev              # http://localhost:5173
```

Klucze API (`FAL_KEY`, `ANTHROPIC_API_KEY`) nigdy nie trafiają do gita — trzymane
lokalnie w plikach `.env`, które są w `.gitignore`.
