
-- Allow service role only on rate_limits (no user access)
CREATE POLICY "No user access to rate_limits"
  ON public.rate_limits FOR ALL
  TO authenticated
  USING (false);
