-- Fix: Add UPDATE policy for bank_sampah table
-- Allows authenticated users who own the bank_sampah record (user_id = auth.uid()) to update it
-- Also add UPDATE policy for drop_points (same pattern)

-- bank_sampah: allow owner to update their own record
CREATE POLICY "bank_sampah_update_own"
  ON public.bank_sampah FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- drop_points: allow owner to update their own record
CREATE POLICY "drop_points_update_own"
  ON public.drop_points FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Also directly fix the data: link Bank Sampah Pusani to Pelapak Nurdin
UPDATE public.bank_sampah
SET pelapak_id = 'c125dc86-7aa6-45d3-9536-56259d47c5be'
WHERE id = 'bs4';
