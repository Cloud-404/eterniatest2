
-- Revoke direct API access to materialized view (security best practice)
REVOKE ALL ON public.credit_balance_view FROM anon, authenticated;

-- Create a security definer function to read from the materialized view
CREATE OR REPLACE FUNCTION public.get_credit_balance_fast(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT balance FROM public.credit_balance_view WHERE user_id = _user_id),
    0
  )
$$;
