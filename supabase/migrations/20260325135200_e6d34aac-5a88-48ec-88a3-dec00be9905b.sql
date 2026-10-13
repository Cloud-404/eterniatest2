
CREATE TABLE public.password_reset_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  username text NOT NULL,
  reason text DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  admin_id uuid,
  admin_note text,
  temp_password text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

ALTER TABLE public.password_reset_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can submit reset requests"
  ON public.password_reset_requests FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "Anon can check request status"
  ON public.password_reset_requests FOR SELECT TO anon
  USING (true);

CREATE POLICY "Users can submit reset requests"
  ON public.password_reset_requests FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can view own requests"
  ON public.password_reset_requests FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage reset requests"
  ON public.password_reset_requests FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
