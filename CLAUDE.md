# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

EcoChain AI Marketplace is a single-file React production prototype for a waste management circular economy platform serving Pondok Aren, Tangerang Selatan, Indonesia. The entire application lives in `ecochain-marketplace.jsx` (~1,225 lines).

## How to Use

There is no build system, package.json, or test suite. The file is a standalone React component:

```jsx
import EcoChain from './ecochain-marketplace';
// Use: <EcoChain />
```

Requires React 16.8+ (Hooks). No other runtime dependencies — fonts are loaded via CSS `@import`.

## Architecture

**Single-component app** with role-based conditional rendering. The component exports `EcoChain()` as default.

### Cascading Price Model (Core Business Logic)

Four-level supply chain with configurable margins:
- **Pelapak** (industry aggregator) → base market price
- **Bank Sampah** → pelapak price minus ~15%
- **Drop Point** → bank price minus ~20%
- **End User** → drop point price minus ~25%

The `CASCADE` function computes all four price levels from a pelapak price and margin config. Margins are adjustable via sliders in Bank/Pelapak roles.

### Multi-Role System

The app renders entirely different UIs based on `role` state:
- **user**: Scan tab (waste detection), Map tab (drop point locations), Chat tab (AI assistant), Wallet tab
- **dp** (Drop Point): Price table, rapid cashier flow
- **bank** (Bank Sampah): Logistics routing, margin management
- **pelapak**: Price updates, cascading price table

### Key Data Constants

- `WASTE_DB` — 7 categories, ~53 waste item types with pelapak-level prices (Rp/kg), digitized from a real Bank Sampah document dated 02 Jan 2026
- `NETWORK` — Real GPS coordinates for drop points, bank sampah locations, and pelapak partners
- `SCAN_SCENARIOS` — Three simulation scenarios for the waste detection feature
- `TRANSACTIONS` — Sample transaction history

### Planned Backend Stack (Configured but Currently Simulated)

- **AI**: Groq Llama 3 (chat), Google Gemini Vision (waste detection + OCR), Tesseract (scale reading)
- **Backend**: n8n (workflow automation), Supabase (PostgreSQL + Auth + Realtime)
- **Mapping**: OpenStreetMap
- **Messaging**: Telegram Bot API

All AI/backend interactions are currently simulated with hardcoded delays and sample responses.

### Styling

CSS-in-JS with inline styles. Dark theme (`#080C14` background). Fonts: Sora (body), JetBrains Mono (data), Fraunces (display headings). Six CSS keyframe animations defined in a `<style>` block within the component.

## Language

UI text and data are in **Bahasa Indonesia**. Variable names and code comments are in English.
