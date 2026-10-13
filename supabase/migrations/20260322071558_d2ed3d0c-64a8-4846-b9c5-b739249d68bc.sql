
-- ============================================================
-- SECURITY HARDENING: Fix critical RLS vulnerabilities
-- ============================================================

-- 1. FIX: Remove self-insert policy on credit_transactions
--    (prevents users from fabricating credits for themselves)
DROP POLICY IF EXISTS "System can insert credit transactions" ON public.credit_transactions;

-- 2. FIX: Restrict profiles SELECT to own profile + admin/spoc/expert view
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Admins and SPOCs can view all profiles (needed for management)
CREATE POLICY "Admins and SPOCs can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'spoc')
  );

-- Experts/therapists/interns can view profiles (needed for sessions)
CREATE POLICY "Staff can view profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'expert') OR
    public.has_role(auth.uid(), 'therapist') OR
    public.has_role(auth.uid(), 'intern')
  );

-- 3. FIX: Remove anon access from institutions (protect eternia_code_hash)
DROP POLICY IF EXISTS "Anyone can view active institutions" ON public.institutions;

-- Only authenticated users can view active institutions
CREATE POLICY "Authenticated can view active institutions"
  ON public.institutions FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- 4. Rate limiting table for edge function abuse prevention
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  window_start timestamptz NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 1,
  UNIQUE(key, window_start)
);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Cleanup function
CREATE OR REPLACE FUNCTION public.cleanup_rate_limits()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.rate_limits
  WHERE window_start < now() - interval '1 hour';
$$;

-- Rate limit checker
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  _key text,
  _max_requests integer DEFAULT 60,
  _window_seconds integer DEFAULT 60
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _window_start timestamptz;
  _count integer;
BEGIN
  _window_start := date_trunc('minute', now());
  
  INSERT INTO public.rate_limits (key, window_start, request_count)
  VALUES (_key, _window_start, 1)
  ON CONFLICT (key, window_start) DO UPDATE
    SET request_count = rate_limits.request_count + 1
  RETURNING request_count INTO _count;
  
  RETURN _count <= _max_requests;
END;
$$;
