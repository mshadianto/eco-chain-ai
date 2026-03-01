# EcoChain AI Marketplace

Marketplace ekonomi sirkular sampah berbasis AI untuk area Pondok Aren & Serpong Utara, Tangerang Selatan, Indonesia.

**Live:** [ecochain-ai-marketplace.sopian-hadianto.workers.dev](https://ecochain-ai-marketplace.sopian-hadianto.workers.dev)

## Fitur

- **Scan Sampah (AI Vision)** — Foto tumpukan sampah, AI identifikasi jenis & estimasi harga otomatis menggunakan Google Gemini Vision
- **Chat AI Assistant** — Tanya harga, lokasi drop point, tips sorting via Groq Llama 3 dengan konteks data live dari database
- **Harga Cascade Realtime** — Model harga 3 level (Pelapak → Bank Sampah → Drop Point) dengan margin per-entity yang bisa diatur
- **Multi-Role System** — UI berbeda untuk End User, Drop Point, Bank Sampah, dan Pelapak
- **Transaksi & Pickup** — Buat transaksi (DP & Bank Sampah), tracking status, jadwal pickup
- **Network Map** — Data drop point dan bank sampah real (GPS, stok, kapasitas)
- **Dashboard & Laporan** — Statistik transaksi, chart, export laporan
- **Dompet Digital** — Wallet transactions untuk setiap user
- **Marketplace** — Jual beli produk daur ulang
- **Komunitas** — Messaging, challenge quests, pengumuman

## Tech Stack

| Layer | Teknologi |
|-------|-----------|
| Frontend | React 19 + Vite |
| Backend | Supabase (PostgreSQL + Auth + Realtime) |
| AI Vision | Google Gemini 2.5 Flash |
| AI Chat | Groq Llama 3.3 70B |
| Hosting | Cloudflare Workers (Static Assets) |

## Quick Start

```bash
# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Isi API keys di .env

# Development
npm run dev

# Build & Deploy
npm run deploy
```

## Environment Variables

| Variable | Deskripsi |
|----------|-----------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `VITE_GEMINI_KEY` | Google Gemini API key |
| `VITE_GROQ_KEY` | Groq API key |

## Database

Schema SQL ada di `supabase-schema.sql` + migration files (`migration-*.sql`). Jalankan di Supabase Dashboard > SQL Editor.

**Tabel:** profiles, transactions, transaction_items, pelapak_prices, bank_sampah, drop_points, pickup_schedules, waste_categories, waste_items, price_history, reviews, wallet_transactions, recycled_products, disputes, audit_logs, announcements, margin_config (deprecated)

Harga dihitung di frontend via `effectivePrices` useMemo dari `pelapak_prices` + margin per-entity.

## Struktur Project

```
src/
  main.jsx                    — Entry point
  ecochain-live.jsx           — Aplikasi utama (production, ~3,860 lines)
ecochain-marketplace.jsx       — Legacy file (tidak dipakai)
supabase-schema.sql            — Database schema
migration-bank-sampah-rls.sql  — RLS policies untuk bank_sampah & drop_points
index.html                     — HTML shell
vite.config.js                 — Vite config
wrangler.jsonc                 — Cloudflare Workers config
```

## Role System

| Role | Akses |
|------|-------|
| **User** | Harga (pilih DP), Scan AI, Chat AI, Peta, Transaksi, Dashboard, Dompet, Marketplace, Komunitas |
| **Drop Point** | + Buat TX, Pengaturan (pilih Bank Sampah + margin), Pickup |
| **Bank Sampah** | + Buat TX (pilih DP), Pengaturan (pilih Pelapak + margin), Pickup |
| **Pelapak** | + Kelola Harga (input/upload harga per item) |

## Model Harga Per-Entity (3 Level)

```
Pelapak (harga pasar per item, tabel pelapak_prices)
  └─ Bank Sampah = Pelapak × (1 - margin)     default 15%
       └─ Drop Point = Bank × (1 - margin)     default 20%
```

End user melihat harga Drop Point. Setiap entity bisa set margin sendiri via Pengaturan. Harga dihitung di frontend via `effectivePrices` useMemo.

## AI Features

### Scan Sampah (Gemini Vision)
- Foto dari kamera HP → resize 1024px → Gemini analisis
- Identifikasi jenis sampah, estimasi berat, mapping ke kode database
- Tips sorting untuk dapat harga lebih tinggi
- Fallback demo mode tanpa API key

### Chat AI (Groq)
- RAG system prompt dari data live (harga, lokasi, margin)
- Konteks 10 pesan terakhir
- Quick-action buttons untuk pertanyaan umum
- Fallback demo mode tanpa API key

## License

ISC
