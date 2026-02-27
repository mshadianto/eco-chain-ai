-- Migration: Price History table
-- Drop if exists from failed previous attempt
DROP TABLE IF EXISTS public.price_history CASCADE;

CREATE TABLE public.price_history (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  item_code TEXT NOT NULL,
  item_name TEXT NOT NULL,
  category TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  pelapak_id UUID REFERENCES auth.users(id),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "price_history_select" ON public.price_history
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "price_history_insert" ON public.price_history
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'pelapak'));

CREATE INDEX idx_price_history_item ON public.price_history(item_code);
CREATE INDEX idx_price_history_date ON public.price_history(recorded_at DESC);
