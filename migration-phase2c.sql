ALTER TABLE public.bank_sampah ADD COLUMN IF NOT EXISTS pelapak_id UUID REFERENCES auth.users(id);

ALTER TABLE public.bank_sampah ADD COLUMN IF NOT EXISTS margin NUMERIC(4,2) NOT NULL DEFAULT 0.15;

ALTER TABLE public.bank_sampah ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_bank_sampah_pelapak ON public.bank_sampah(pelapak_id);

CREATE INDEX IF NOT EXISTS idx_bank_sampah_user ON public.bank_sampah(user_id);

ALTER TABLE public.drop_points ADD COLUMN IF NOT EXISTS bank_sampah_id INT REFERENCES public.bank_sampah(id);

ALTER TABLE public.drop_points ADD COLUMN IF NOT EXISTS margin NUMERIC(4,2) NOT NULL DEFAULT 0.20;

ALTER TABLE public.drop_points ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_drop_points_bank ON public.drop_points(bank_sampah_id);

CREATE INDEX IF NOT EXISTS idx_drop_points_user ON public.drop_points(user_id);
