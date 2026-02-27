-- Migration: Wallet system + Membership tiers
-- Adds wallet_balance and membership_tier to profiles
-- Creates wallet_transactions table for transaction history

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS wallet_balance NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS membership_tier TEXT NOT NULL DEFAULT 'free';

CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
  amount NUMERIC(12,2) NOT NULL,
  description TEXT,
  reference_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wallet_tx_select" ON public.wallet_transactions
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "wallet_tx_insert" ON public.wallet_transactions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_wallet_tx_user ON public.wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_date ON public.wallet_transactions(created_at DESC);

-- RPC to credit wallet (called when TX status changes to done)
CREATE OR REPLACE FUNCTION public.credit_wallet(p_user_id UUID, p_amount NUMERIC, p_desc TEXT, p_ref TEXT)
RETURNS void AS $$
BEGIN
  UPDATE public.profiles SET wallet_balance = wallet_balance + p_amount WHERE id = p_user_id;
  INSERT INTO public.wallet_transactions (user_id, type, amount, description, reference_id)
  VALUES (p_user_id, 'credit', p_amount, p_desc, p_ref);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
