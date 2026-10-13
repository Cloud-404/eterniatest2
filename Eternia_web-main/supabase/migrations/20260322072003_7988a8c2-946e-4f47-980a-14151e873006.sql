
-- Re-add limited anon access for institution code verification during onboarding
-- This is needed because the institution code page is accessed before login
CREATE POLICY "Anon can verify active institutions"
  ON public.institutions FOR SELECT
  TO anon
  USING (is_active = true);
