# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

EcoChain AI Marketplace is a single-file React app for a waste management circular economy platform serving Pondok Aren & Serpong Utara, Tangerang Selatan, Indonesia. The production app lives in `src/ecochain-live.jsx` (~1,230 lines).

## Architecture

```
index.html → src/main.jsx → src/ecochain-live.jsx (PRODUCTION)
ecochain-marketplace.jsx (LEGACY — not used by build)
```

### Entry Point

`src/main.jsx` imports `src/ecochain-live.jsx`. The root `ecochain-marketplace.jsx` is a legacy file not used in production.

### Build & Deploy

```bash
npm run dev        # Vite dev server
npm run build      # Build to dist/
npm run deploy     # Build + deploy to Cloudflare Workers
```

- **Vite** builds the React app to `dist/`
- **Wrangler** deploys static assets to Cloudflare Workers
- Live URL: `ecochain-ai-marketplace.sopian-hadianto.workers.dev`

### Backend: Supabase (PostgreSQL + Auth + Realtime)

Lightweight client via raw `fetch` (no SDK in live version). Object `sb` provides: `query()`, `insert()`, `update()`, `rpc()`, `signUp()`, `signIn()`, `getUser()`.

**Database tables:** profiles, transactions, transaction_items, margin_config (deprecated), pelapak_prices, bank_sampah, drop_points, pickup_schedules, price_history, waste_categories, waste_items

Schema: `supabase-schema.sql`

### AI Integrations (Live — Direct Frontend Calls)

- **Gemini Vision** (`gemini-2.5-flash`): Waste detection from camera photos. Prompt includes visual identification guide and weight estimation references. Response parsed with JSON auto-repair fallback.
- **Groq Chat** (`llama-3.3-70b-versatile`): AI assistant with RAG system prompt built from live DB data (prices, drop points, bank sampah, margins). Demo fallback when no API key.

### Per-Entity Pricing Model (Core Business Logic)

Three-level supply chain with per-entity margins:
- **Pelapak** (industry aggregator) → sets base prices per item via input form or CSV upload. Stored in `pelapak_prices` table (unique per pelapak_id + item_code).
- **Bank Sampah** → selects a Pelapak + sets one margin %. Bank price = pelapak_price × (1 - margin). Columns `pelapak_id` and `margin` on `bank_sampah` table.
- **Drop Point** → selects a Bank Sampah + sets one margin %. DP price = bank_price × (1 - margin). Columns `bank_sampah_id` and `margin` on `drop_points` table.

End users see Drop Point prices (user level removed). Prices are computed on the frontend via `effectivePrices` useMemo. Multiple Pelapaks can coexist with different prices. Entity linking: `bank_sampah.user_id` and `drop_points.user_id` link to the managing user account.

### Multi-Role System

Auth via Supabase email/password. Role stored in `profiles` table.
- **user**: Prices (select DP to view), Scan (AI vision), Chat AI, Network, Transactions
- **dp** (Drop Point): + Create TX, Pengaturan (select Bank Sampah + margin), Pickup schedules
- **bank** (Bank Sampah): + Pengaturan (select Pelapak + margin), Pickup schedules
- **pelapak**: + Kelola Harga (input/upload prices per item)

### Data Flow

All data comes from Supabase (no hardcoded constants in live version):
- `pelapakPrices` ← `pelapak_prices` table (pelapak_id, item_code, item_name, category, unit, price_per_kg)
- `effectivePrices` ← computed via useMemo from pelapakPrices + entity chain (role-dependent)
- `dropPoints` ← `drop_points` table (includes bank_sampah_id, margin, user_id)
- `bankSampah` ← `bank_sampah` table (includes pelapak_id, margin, user_id)
- `pelapakList` ← `profiles` filtered by role='pelapak'
- `myEntity` ← resolved from bank_sampah/drop_points by user_id for logged-in bank/dp users
- `categories` ← `waste_categories` table
- `transactions` + `txItems` ← `transactions` + `transaction_items` tables

### Styling

CSS-in-JS with inline styles. Dark theme (`#080C14`). CSS vars shortened: `--g` (green), `--t` (text), `--t2` (text-secondary), `--w` (white), `--b` (blue), `--p` (purple), `--y` (yellow), `--r` (red), `--c` (cyan), `--bdr` (border).

Classes: `.c` (card), `.bt` (button), `.pl` (badge), `.fu` (fade-up animation).

Fonts: Sora (body), JetBrains Mono (data), Fraunces (display headings).

### Environment Variables

```
VITE_SUPABASE_URL       — Supabase project URL
VITE_SUPABASE_ANON_KEY  — Supabase anon/public key
VITE_GEMINI_KEY         — Google Gemini API key
VITE_GROQ_KEY           — Groq API key
```

## Language

UI text and data are in **Bahasa Indonesia**. Variable names and code comments are in English.
