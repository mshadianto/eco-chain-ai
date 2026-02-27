CREATE TABLE IF NOT EXISTS public.pelapak_prices (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  pelapak_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_code TEXT NOT NULL,
  item_name TEXT NOT NULL,
  "category" TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'kg',
  price_per_kg NUMERIC(10,2) NOT NULL CHECK (price_per_kg >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(pelapak_id, item_code)
);
