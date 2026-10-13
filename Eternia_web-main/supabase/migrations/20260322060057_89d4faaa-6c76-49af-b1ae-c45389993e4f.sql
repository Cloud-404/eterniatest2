
CREATE POLICY "Interns can view blackbox sessions"
ON public.blackbox_sessions FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'intern'::app_role) AND (status = 'queued' OR therapist_id = auth.uid()));

CREATE POLICY "Interns can update blackbox sessions"
ON public.blackbox_sessions FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'intern'::app_role) AND (status = 'queued' OR therapist_id = auth.uid()));

CREATE POLICY "Therapists can view blackbox sessions"
ON public.blackbox_sessions FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'therapist'::app_role) AND (status = 'queued' OR therapist_id = auth.uid()));

CREATE POLICY "Therapists can update blackbox sessions"
ON public.blackbox_sessions FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'therapist'::app_role) AND (status = 'queued' OR therapist_id = auth.uid()));
