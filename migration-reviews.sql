-- Migration: Reviews table
CREATE TABLE IF NOT EXISTS public.reviews (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  drop_point_id TEXT NOT NULL,
  transaction_id TEXT REFERENCES public.transactions(id),
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, transaction_id)
);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reviews_select" ON public.reviews
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "reviews_insert" ON public.reviews
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_reviews_dp ON public.reviews(drop_point_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user ON public.reviews(user_id);
