
-- Drop and recreate expert SELECT policy
DROP POLICY "Experts can view blackbox sessions" ON public.blackbox_sessions;
CREATE POLICY "Experts can view blackbox sessions" ON public.blackbox_sessions
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'expert'::app_role) AND (
      status = 'queued' OR status = 'escalated' OR therapist_id = auth.uid()
    )
  );

-- Drop and recreate expert UPDATE policy
DROP POLICY "Experts can update blackbox sessions" ON public.blackbox_sessions;
CREATE POLICY "Experts can update blackbox sessions" ON public.blackbox_sessions
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'expert'::app_role) AND (
      status = 'queued' OR status = 'escalated' OR therapist_id = auth.uid()
    )
  );

-- Same for therapists
DROP POLICY "Therapists can view blackbox sessions" ON public.blackbox_sessions;
CREATE POLICY "Therapists can view blackbox sessions" ON public.blackbox_sessions
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'therapist'::app_role) AND (
      status = 'queued' OR status = 'escalated' OR therapist_id = auth.uid()
    )
  );

DROP POLICY "Therapists can update blackbox sessions" ON public.blackbox_sessions;
CREATE POLICY "Therapists can update blackbox sessions" ON public.blackbox_sessions
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'therapist'::app_role) AND (
      status = 'queued' OR status = 'escalated' OR therapist_id = auth.uid()
    )
  );

-- Same for interns
DROP POLICY "Interns can view blackbox sessions" ON public.blackbox_sessions;
CREATE POLICY "Interns can view blackbox sessions" ON public.blackbox_sessions
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'intern'::app_role) AND (
      status = 'queued' OR status = 'escalated' OR therapist_id = auth.uid()
    )
  );

DROP POLICY "Interns can update blackbox sessions" ON public.blackbox_sessions;
CREATE POLICY "Interns can update blackbox sessions" ON public.blackbox_sessions
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'intern'::app_role) AND (
      status = 'queued' OR status = 'escalated' OR therapist_id = auth.uid()
    )
  );
