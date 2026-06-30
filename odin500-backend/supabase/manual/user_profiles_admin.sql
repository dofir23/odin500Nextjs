-- Admin role flag on user profiles.
-- Run in Supabase SQL editor, then promote your first admin:
--
-- UPDATE public.user_profiles
-- SET is_admin = true
-- WHERE id = (SELECT id FROM auth.users WHERE email = 'your-admin@email.com');

ALTER TABLE IF EXISTS public.user_profiles
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS user_profiles_is_admin_idx
  ON public.user_profiles (is_admin)
  WHERE is_admin = true;
