
-- 1. Add training_progress JSONB column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS training_progress jsonb DEFAULT '[]'::jsonb;

-- 2. Performance indexes per PRD Section 12.3
CREATE INDEX IF NOT EXISTS idx_profiles_institution_role_active ON public.profiles(institution_id, role, is_active);
CREATE INDEX IF NOT EXISTS idx_appointments_student_status ON public.appointments(student_id, status, slot_time);
CREATE INDEX IF NOT EXISTS idx_appointments_expert_status ON public.appointments(expert_id, status);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_type ON public.credit_transactions(user_id, type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_peer_sessions_student ON public.peer_sessions(student_id, status);
CREATE INDEX IF NOT EXISTS idx_peer_sessions_intern ON public.peer_sessions(intern_id, status);
CREATE INDEX IF NOT EXISTS idx_blackbox_entries_user ON public.blackbox_entries(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_blackbox_sessions_student ON public.blackbox_sessions(student_id, status);
CREATE INDEX IF NOT EXISTS idx_blackbox_sessions_therapist ON public.blackbox_sessions(therapist_id, status);
CREATE INDEX IF NOT EXISTS idx_expert_availability_expert ON public.expert_availability(expert_id, is_booked, start_time);
CREATE INDEX IF NOT EXISTS idx_escalation_requests_spoc ON public.escalation_requests(spoc_id, status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(actor_id, created_at DESC);

-- 3. Allow experts to INSERT escalation requests
CREATE POLICY "Experts can create escalation requests"
ON public.escalation_requests
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'expert'::app_role));

-- 4. Revoke UPDATE/DELETE on audit_logs for authenticated and anon roles
REVOKE UPDATE, DELETE ON public.audit_logs FROM authenticated;
REVOKE UPDATE, DELETE ON public.audit_logs FROM anon;
