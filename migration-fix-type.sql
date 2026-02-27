ALTER TABLE public.drop_points DROP COLUMN IF EXISTS bank_sampah_id;

ALTER TABLE public.drop_points ADD COLUMN bank_sampah_id TEXT REFERENCES public.bank_sampah(id);

CREATE INDEX IF NOT EXISTS idx_drop_points_bank ON public.drop_points(bank_sampah_id);
