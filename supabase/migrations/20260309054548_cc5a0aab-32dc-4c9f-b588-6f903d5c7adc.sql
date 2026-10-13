-- Recovery credentials table for fragment pairs + emoji pattern
CREATE TABLE public.recovery_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  fragment_pairs_encrypted text NOT NULL,
  emoji_pattern_encrypted text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.recovery_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own recovery credentials"
  ON public.recovery_credentials FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Function to check daily earn cap (5 ECC/day max)
CREATE OR REPLACE FUNCTION public.get_daily_earn_total(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT COALESCE(SUM(delta), 0)::integer
  FROM public.credit_transactions
  WHERE user_id = _user_id
    AND type = 'earn'
    AND created_at >= (CURRENT_DATE AT TIME ZONE 'UTC')
$$;

-- Add contact_is_self field to user_private
ALTER TABLE public.user_private ADD COLUMN IF NOT EXISTS contact_is_self boolean DEFAULT false;