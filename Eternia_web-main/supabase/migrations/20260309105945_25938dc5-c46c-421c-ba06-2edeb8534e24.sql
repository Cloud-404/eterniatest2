
-- Fix: "Anyone can view active institutions" must be PERMISSIVE, not RESTRICTIVE
-- Drop the restrictive policy and recreate as permissive
DROP POLICY IF EXISTS "Anyone can view active institutions" ON public.institutions;

CREATE POLICY "Anyone can view active institutions"
  ON public.institutions
  FOR SELECT
  TO authenticated
  USING (is_active = true);
