-- Migration: Recycled Products Marketplace
CREATE TABLE IF NOT EXISTS public.recycled_products (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(12,2) NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  stock INT NOT NULL DEFAULT 1,
  image_url TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'sold', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.recycled_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "products_select" ON public.recycled_products
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "products_insert" ON public.recycled_products
  FOR INSERT TO authenticated WITH CHECK (seller_id = auth.uid());

CREATE POLICY "products_update" ON public.recycled_products
  FOR UPDATE TO authenticated USING (seller_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_products_seller ON public.recycled_products(seller_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON public.recycled_products(status);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.recycled_products(category);
