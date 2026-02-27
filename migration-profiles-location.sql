-- Add lat/lng columns to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS lat NUMERIC(10,6);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS lng NUMERIC(10,6);

-- Update trigger function to also store lat/lng from user metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role, lat, lng)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'user'),
    (NEW.raw_user_meta_data->>'lat')::NUMERIC,
    (NEW.raw_user_meta_data->>'lng')::NUMERIC
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
