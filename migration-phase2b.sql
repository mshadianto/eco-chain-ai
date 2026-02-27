ALTER TABLE public.pelapak_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pelapak_prices_select" ON public.pelapak_prices FOR SELECT TO authenticated USING (true);

CREATE POLICY "pelapak_prices_insert" ON public.pelapak_prices FOR INSERT TO authenticated WITH CHECK (auth.uid() = pelapak_id AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'pelapak'));

CREATE POLICY "pelapak_prices_update" ON public.pelapak_prices FOR UPDATE TO authenticated WITH CHECK (auth.uid() = pelapak_id);

CREATE POLICY "pelapak_prices_delete" ON public.pelapak_prices FOR DELETE TO authenticated USING (auth.uid() = pelapak_id);

CREATE INDEX IF NOT EXISTS idx_pelapak_prices_pelapak ON public.pelapak_prices(pelapak_id);

CREATE INDEX IF NOT EXISTS idx_pelapak_prices_item ON public.pelapak_prices(item_code);

ALTER PUBLICATION supabase_realtime ADD TABLE public.pelapak_prices;
