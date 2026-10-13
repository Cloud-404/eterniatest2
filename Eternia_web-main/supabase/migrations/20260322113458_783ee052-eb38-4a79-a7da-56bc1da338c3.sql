
CREATE TABLE public.intern_referral_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  created_by uuid NOT NULL,
  assigned_to uuid,
  used_at timestamptz,
  expires_at timestamptz,
  is_used boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.intern_referral_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage referral codes"
  ON public.intern_referral_codes
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can select referral codes"
  ON public.intern_referral_codes
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated can update referral codes"
  ON public.intern_referral_codes
  FOR UPDATE
  TO authenticated
  USING (is_used = false)
  WITH CHECK (true);
