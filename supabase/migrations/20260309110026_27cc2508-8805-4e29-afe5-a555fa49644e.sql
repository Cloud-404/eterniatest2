
-- Allow anonymous (unauthenticated) users to view active institutions for the registration flow
DROP POLICY IF EXISTS "Anyone can view active institutions" ON public.institutions;

CREATE POLICY "Anyone can view active institutions"
  ON public.institutions
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);
