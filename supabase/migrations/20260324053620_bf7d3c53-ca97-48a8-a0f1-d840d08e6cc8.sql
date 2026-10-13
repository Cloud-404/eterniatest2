
CREATE TABLE public.institution_student_ids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  id_type text NOT NULL,
  student_id_hash text NOT NULL,
  is_claimed boolean NOT NULL DEFAULT false,
  claimed_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institution_id, id_type, student_id_hash)
);

ALTER TABLE public.institution_student_ids ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access on institution_student_ids"
ON public.institution_student_ids FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "SPOCs can select institution_student_ids"
ON public.institution_student_ids FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'spoc') AND
  institution_id = (SELECT institution_id FROM public.profiles WHERE id = auth.uid())
);

CREATE POLICY "SPOCs can insert institution_student_ids"
ON public.institution_student_ids FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'spoc') AND
  institution_id = (SELECT institution_id FROM public.profiles WHERE id = auth.uid())
);

CREATE POLICY "SPOCs can update institution_student_ids"
ON public.institution_student_ids FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'spoc') AND
  institution_id = (SELECT institution_id FROM public.profiles WHERE id = auth.uid())
)
WITH CHECK (
  public.has_role(auth.uid(), 'spoc') AND
  institution_id = (SELECT institution_id FROM public.profiles WHERE id = auth.uid())
);
