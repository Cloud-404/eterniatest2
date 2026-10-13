
CREATE TABLE public.training_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_number integer NOT NULL UNIQUE,
  title text NOT NULL,
  description text NOT NULL,
  duration text NOT NULL DEFAULT '30 min',
  objectives jsonb NOT NULL DEFAULT '[]'::jsonb,
  content text NOT NULL DEFAULT '',
  has_quiz boolean NOT NULL DEFAULT false,
  quiz_questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.training_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active training modules"
  ON public.training_modules FOR SELECT TO authenticated
  USING (is_active = true);

CREATE POLICY "Admins can manage training modules"
  ON public.training_modules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
