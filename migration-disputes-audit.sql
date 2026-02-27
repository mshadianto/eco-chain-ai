-- Migration: Disputes + Audit Trail

-- Disputes table for transaction dispute resolution
CREATE TABLE IF NOT EXISTS public.disputes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  transaction_id TEXT NOT NULL REFERENCES public.transactions(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'closed')),
  resolution TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "disputes_select" ON public.disputes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "disputes_insert" ON public.disputes
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "disputes_update" ON public.disputes
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('dp', 'bank')));

CREATE INDEX IF NOT EXISTS idx_disputes_tx ON public.disputes(transaction_id);
CREATE INDEX IF NOT EXISTS idx_disputes_user ON public.disputes(user_id);

-- Audit trail table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_select" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('dp', 'bank', 'pelapak')));

CREATE POLICY "audit_insert" ON public.audit_logs
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_audit_user ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_date ON public.audit_logs(created_at DESC);
