-- Migration: Referral system columns on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referred_by TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS points INT NOT NULL DEFAULT 0;

-- Set referral_code for existing users
UPDATE public.profiles SET referral_code = LEFT(id::text, 8) WHERE referral_code IS NULL;

-- RPC to award referral points
CREATE OR REPLACE FUNCTION public.award_referral_points(referrer_code TEXT, bonus INT DEFAULT 50)
RETURNS void AS $$
BEGIN
  UPDATE public.profiles SET points = points + bonus WHERE referral_code = referrer_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
