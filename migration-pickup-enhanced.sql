-- Migration: Enhanced pickup_schedules
ALTER TABLE public.pickup_schedules ADD COLUMN IF NOT EXISTS requested_by UUID REFERENCES auth.users(id);
ALTER TABLE public.pickup_schedules ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.pickup_schedules ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Update status check constraint (drop old if exists, add new)
ALTER TABLE public.pickup_schedules DROP CONSTRAINT IF EXISTS pickup_schedules_status_check;
ALTER TABLE public.pickup_schedules ADD CONSTRAINT pickup_schedules_status_check
  CHECK (status IN ('requested', 'scheduled', 'in_progress', 'completed', 'cancelled'));

-- Allow users to insert pickup requests
CREATE POLICY "pickup_insert_user" ON public.pickup_schedules
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = requested_by);

-- Allow DP/Bank operators to update pickup status
CREATE POLICY "pickup_update_operator" ON public.pickup_schedules
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('dp', 'bank')));
