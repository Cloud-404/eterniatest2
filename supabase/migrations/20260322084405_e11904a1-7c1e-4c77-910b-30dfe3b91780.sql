
-- Create temp_credentials table for bulk ID onboarding flow
CREATE TABLE public.temp_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  temp_username text NOT NULL UNIQUE,
  temp_password_hash text NOT NULL,
  temp_password_plain text NOT NULL,
  auth_user_id uuid,
  status text NOT NULL DEFAULT 'unused',
  assigned_at timestamptz,
  activated_at timestamptz,
  expires_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.temp_credentials ENABLE ROW LEVEL SECURITY;

-- Index for fast lookup of unused credentials per institution
CREATE INDEX idx_temp_credentials_institution_status ON public.temp_credentials(institution_id, status);
CREATE INDEX idx_temp_credentials_username ON public.temp_credentials(temp_username);

-- RLS: Admins have full access
CREATE POLICY "Admins can manage temp_credentials"
ON public.temp_credentials
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- RLS: SPOCs can view and update their institution's temp credentials
CREATE POLICY "SPOCs can view institution temp_credentials"
ON public.temp_credentials
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'spoc') AND
  institution_id = (SELECT institution_id FROM public.profiles WHERE id = auth.uid())
);

CREATE POLICY "SPOCs can update institution temp_credentials"
ON public.temp_credentials
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'spoc') AND
  institution_id = (SELECT institution_id FROM public.profiles WHERE id = auth.uid())
)
WITH CHECK (
  public.has_role(auth.uid(), 'spoc') AND
  institution_id = (SELECT institution_id FROM public.profiles WHERE id = auth.uid())
);
