
-- ECC Stability Pool table
CREATE TABLE public.ecc_stability_pool (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid REFERENCES public.institutions(id) ON DELETE CASCADE,
  balance integer NOT NULL DEFAULT 0,
  total_contributed integer NOT NULL DEFAULT 0,
  total_disbursed integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ecc_stability_pool ENABLE ROW LEVEL SECURITY;

-- Only admins/SPOCs can view pool
CREATE POLICY "Admins can view stability pool" ON public.ecc_stability_pool
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'spoc'::app_role));

CREATE POLICY "System can update stability pool" ON public.ecc_stability_pool
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Add training_status to profiles for intern gate
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS training_status text NOT NULL DEFAULT 'not_started';

-- Function to get pool balance for an institution
CREATE OR REPLACE FUNCTION public.get_pool_balance(_institution_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(balance, 0)
  FROM public.ecc_stability_pool
  WHERE institution_id = _institution_id
  LIMIT 1
$$;
