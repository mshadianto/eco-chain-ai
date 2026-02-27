-- ═══════════════════════════════════════════════════════════════
-- ECOCHAIN AI — SUPABASE SCHEMA (Phase 1)
-- Jalankan di Supabase Dashboard > SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- 1. PROFILES — extends auth.users with app role
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'dp', 'bank', 'pelapak')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'user')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_authenticated"
  ON public.profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- 2. TRANSACTIONS
CREATE TABLE public.transactions (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL DEFAULT '',
  drop_point_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transactions_select"
  ON public.transactions FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('dp', 'bank', 'pelapak'))
  );

CREATE POLICY "transactions_insert"
  ON public.transactions FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('dp', 'bank'))
  );

CREATE POLICY "transactions_update"
  ON public.transactions FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('dp', 'bank'))
  );

-- 3. TRANSACTION ITEMS
CREATE TABLE public.transaction_items (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  transaction_id TEXT NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  waste_code TEXT NOT NULL,
  waste_name TEXT NOT NULL,
  weight_kg NUMERIC(8,2) NOT NULL CHECK (weight_kg > 0)
);

ALTER TABLE public.transaction_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tx_items_select"
  ON public.transaction_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = transaction_items.transaction_id
      AND (t.user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('dp', 'bank', 'pelapak')))
    )
  );

CREATE POLICY "tx_items_insert"
  ON public.transaction_items FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('dp', 'bank'))
  );

-- 4. MARGIN CONFIG (single-row, realtime)
CREATE TABLE public.margin_config (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  pelapak_to_bank NUMERIC(4,2) NOT NULL DEFAULT 0.15,
  bank_to_drop_point NUMERIC(4,2) NOT NULL DEFAULT 0.20,
  drop_point_to_user NUMERIC(4,2) NOT NULL DEFAULT 0.25,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

INSERT INTO public.margin_config (id) VALUES (1);

ALTER TABLE public.margin_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "margin_config_select"
  ON public.margin_config FOR SELECT TO authenticated USING (true);

CREATE POLICY "margin_config_update"
  ON public.margin_config FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('bank', 'pelapak')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('bank', 'pelapak')));

-- 5. INDEXES
CREATE INDEX idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX idx_transactions_created ON public.transactions(created_at DESC);
CREATE INDEX idx_tx_items_transaction ON public.transaction_items(transaction_id);

-- 6. ENABLE REALTIME
ALTER PUBLICATION supabase_realtime ADD TABLE public.margin_config;
ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;

-- ═══════════════════════════════════════════════════════════════
-- PHASE 2 MIGRATION — Per-Entity Pricing Model
-- ═══════════════════════════════════════════════════════════════

-- 7. PELAPAK PRICES — each pelapak sets their own prices per item
CREATE TABLE public.pelapak_prices (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  pelapak_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_code TEXT NOT NULL,
  item_name TEXT NOT NULL,
  category TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'kg',
  price_per_kg NUMERIC(10,2) NOT NULL CHECK (price_per_kg >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(pelapak_id, item_code)
);

ALTER TABLE public.pelapak_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pelapak_prices_select"
  ON public.pelapak_prices FOR SELECT TO authenticated USING (true);

CREATE POLICY "pelapak_prices_insert"
  ON public.pelapak_prices FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = pelapak_id
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'pelapak')
  );

CREATE POLICY "pelapak_prices_update"
  ON public.pelapak_prices FOR UPDATE TO authenticated
  USING (auth.uid() = pelapak_id)
  WITH CHECK (auth.uid() = pelapak_id);

CREATE POLICY "pelapak_prices_delete"
  ON public.pelapak_prices FOR DELETE TO authenticated
  USING (auth.uid() = pelapak_id);

CREATE INDEX idx_pelapak_prices_pelapak ON public.pelapak_prices(pelapak_id);
CREATE INDEX idx_pelapak_prices_item ON public.pelapak_prices(item_code);

ALTER PUBLICATION supabase_realtime ADD TABLE public.pelapak_prices;

-- 8. ADD COLUMNS TO BANK_SAMPAH — link to pelapak + per-entity margin
ALTER TABLE public.bank_sampah ADD COLUMN pelapak_id UUID REFERENCES auth.users(id);
ALTER TABLE public.bank_sampah ADD COLUMN margin NUMERIC(4,2) NOT NULL DEFAULT 0.15;
ALTER TABLE public.bank_sampah ADD COLUMN user_id UUID REFERENCES auth.users(id);

CREATE INDEX idx_bank_sampah_pelapak ON public.bank_sampah(pelapak_id);
CREATE INDEX idx_bank_sampah_user ON public.bank_sampah(user_id);

-- 9. ADD COLUMNS TO DROP_POINTS — link to bank_sampah + per-entity margin
ALTER TABLE public.drop_points ADD COLUMN bank_sampah_id INT REFERENCES public.bank_sampah(id);
ALTER TABLE public.drop_points ADD COLUMN margin NUMERIC(4,2) NOT NULL DEFAULT 0.20;
ALTER TABLE public.drop_points ADD COLUMN user_id UUID REFERENCES auth.users(id);

CREATE INDEX idx_drop_points_bank ON public.drop_points(bank_sampah_id);
CREATE INDEX idx_drop_points_user ON public.drop_points(user_id);

-- NOTE: margin_config and v_prices kept for rollback. Stop querying them from frontend.
