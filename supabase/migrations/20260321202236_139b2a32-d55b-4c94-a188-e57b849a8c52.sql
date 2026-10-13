-- 1. Create device_sessions table for JWT rotation & multi-device management
CREATE TABLE public.device_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  device_id_hash text NOT NULL,
  refresh_token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.device_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own device sessions" ON public.device_sessions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own device sessions" ON public.device_sessions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own device sessions" ON public.device_sessions
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all device sessions" ON public.device_sessions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 2. Add recurrence_rule to expert_availability for recurring weekly slots
ALTER TABLE public.expert_availability ADD COLUMN IF NOT EXISTS recurrence_rule text DEFAULT NULL;

-- 3. Add therapist to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'therapist';

-- 4. Performance indexes for 60k+ scale
CREATE INDEX IF NOT EXISTS idx_profiles_institution_role ON public.profiles(institution_id, role);
CREATE INDEX IF NOT EXISTS idx_profiles_role_active ON public.profiles(role, is_active);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_type ON public.credit_transactions(user_id, type);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created ON public.credit_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_appointments_student ON public.appointments(student_id, status);
CREATE INDEX IF NOT EXISTS idx_appointments_expert ON public.appointments(expert_id, status);
CREATE INDEX IF NOT EXISTS idx_appointments_slot_time ON public.appointments(slot_time DESC);
CREATE INDEX IF NOT EXISTS idx_peer_sessions_student ON public.peer_sessions(student_id, status);
CREATE INDEX IF NOT EXISTS idx_peer_sessions_intern ON public.peer_sessions(intern_id, status);
CREATE INDEX IF NOT EXISTS idx_blackbox_sessions_status ON public.blackbox_sessions(status);
CREATE INDEX IF NOT EXISTS idx_blackbox_sessions_therapist ON public.blackbox_sessions(therapist_id, status);
CREATE INDEX IF NOT EXISTS idx_blackbox_entries_user ON public.blackbox_entries(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_blackbox_entries_flag ON public.blackbox_entries(ai_flag_level DESC) WHERE ai_flag_level > 0;
CREATE INDEX IF NOT EXISTS idx_escalation_requests_status ON public.escalation_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_escalation_requests_spoc ON public.escalation_requests(spoc_id, status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_device_sessions_user ON public.device_sessions(user_id, revoked);
CREATE INDEX IF NOT EXISTS idx_quest_completions_user ON public.quest_completions(user_id, completed_date);

-- 5. Enable realtime for escalation_requests (for SPOC notifications)
ALTER PUBLICATION supabase_realtime ADD TABLE public.escalation_requests;