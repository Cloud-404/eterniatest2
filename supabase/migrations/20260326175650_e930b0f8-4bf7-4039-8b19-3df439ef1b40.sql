
-- Update expert SELECT policy to include active sessions with flag_level >= 3
DROP POLICY IF EXISTS "Experts can view blackbox sessions" ON public.blackbox_sessions;
CREATE POLICY "Experts can view blackbox sessions" ON public.blackbox_sessions
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'expert'::app_role)
    AND (
      status = 'queued'
      OR status = 'escalated'
      OR therapist_id = auth.uid()
      OR (flag_level >= 3 AND status IN ('active', 'accepted'))
    )
  );

-- Update expert UPDATE policy to include active L3 sessions
DROP POLICY IF EXISTS "Experts can update blackbox sessions" ON public.blackbox_sessions;
CREATE POLICY "Experts can update blackbox sessions" ON public.blackbox_sessions
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'expert'::app_role)
    AND (
      status = 'queued'
      OR status = 'escalated'
      OR therapist_id = auth.uid()
      OR (flag_level >= 3 AND status IN ('active', 'accepted'))
    )
  );

-- Update therapist SELECT policy
DROP POLICY IF EXISTS "Therapists can view blackbox sessions" ON public.blackbox_sessions;
CREATE POLICY "Therapists can view blackbox sessions" ON public.blackbox_sessions
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'therapist'::app_role)
    AND (
      status = 'queued'
      OR status = 'escalated'
      OR therapist_id = auth.uid()
      OR (flag_level >= 3 AND status IN ('active', 'accepted'))
    )
  );

-- Update therapist UPDATE policy
DROP POLICY IF EXISTS "Therapists can update blackbox sessions" ON public.blackbox_sessions;
CREATE POLICY "Therapists can update blackbox sessions" ON public.blackbox_sessions
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'therapist'::app_role)
    AND (
      status = 'queued'
      OR status = 'escalated'
      OR therapist_id = auth.uid()
      OR (flag_level >= 3 AND status IN ('active', 'accepted'))
    )
  );

-- Update intern SELECT policy
DROP POLICY IF EXISTS "Interns can view blackbox sessions" ON public.blackbox_sessions;
CREATE POLICY "Interns can view blackbox sessions" ON public.blackbox_sessions
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'intern'::app_role)
    AND (
      status = 'queued'
      OR status = 'escalated'
      OR therapist_id = auth.uid()
      OR (flag_level >= 3 AND status IN ('active', 'accepted'))
    )
  );

-- Update intern UPDATE policy
DROP POLICY IF EXISTS "Interns can update blackbox sessions" ON public.blackbox_sessions;
CREATE POLICY "Interns can update blackbox sessions" ON public.blackbox_sessions
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'intern'::app_role)
    AND (
      status = 'queued'
      OR status = 'escalated'
      OR therapist_id = auth.uid()
      OR (flag_level >= 3 AND status IN ('active', 'accepted'))
    )
  );
