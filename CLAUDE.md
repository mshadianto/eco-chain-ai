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

**Database tables:** profiles, transactions, transaction_items, margin_config, bank_sampah, drop_points, pickup_schedules, price_history, waste_categories, waste_items

**Database view:** `v_prices` — pre-computes cascading prices per level (pelapak → bank → dp → user)

Schema: `supabase-schema.sql`

### AI Integrations (Live — Direct Frontend Calls)

- **Gemini Vision** (`gemini-2.5-flash`): Waste detection from camera photos. Prompt includes visual identification guide and weight estimation references. Response parsed with JSON auto-repair fallback.
- **Groq Chat** (`llama-3.3-70b-versatile`): AI assistant with RAG system prompt built from live DB data (prices, drop points, bank sampah, margins). Demo fallback when no API key.

### Cascading Price Model (Core Business Logic)

Four-level supply chain with configurable margins stored in `margin_config` table:
- **Pelapak** (industry aggregator) → base market price
- **Bank Sampah** → pelapak price minus ~15%
- **Drop Point** → bank price minus ~20%
- **End User** → drop point price minus ~25%

Prices are pre-computed by the `v_prices` database view. Margin changes via UI trigger view refresh.

### Multi-Role System

Auth via Supabase email/password. Role stored in `profiles` table.
- **user**: Prices, Scan (AI vision), Chat AI, Network, Transactions
- **dp** (Drop Point): + Create TX, Pickup schedules
- **bank** (Bank Sampah): + Margin management, Pickup schedules
- **pelapak**: + Margin management

### Data Flow

All data comes from Supabase (no hardcoded constants in live version):
- `prices` ← `v_prices` view (item_code, name, category, unit, pelapak_price, bank_price, dp_price, user_price)
- `dropPoints` ← `drop_points` table
- `bankSampah` ← `bank_sampah` table
- `categories` ← `waste_categories` table
- `margins` ← `margin_config` table (single-row)
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
