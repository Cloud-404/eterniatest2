
-- Create escalation_requests table
CREATE TABLE public.escalation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid REFERENCES public.blackbox_entries(id) ON DELETE SET NULL,
  session_id uuid REFERENCES public.peer_sessions(id) ON DELETE SET NULL,
  spoc_id uuid NOT NULL REFERENCES public.profiles(id),
  admin_id uuid REFERENCES public.profiles(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'resolved')),
  justification_encrypted text NOT NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.escalation_requests ENABLE ROW LEVEL SECURITY;

-- SPOC can create escalation requests
CREATE POLICY "SPOC can create escalation requests"
ON public.escalation_requests
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'spoc') OR public.has_role(auth.uid(), 'admin')
);

-- SPOC/Admin can view escalation requests
CREATE POLICY "SPOC and Admin can view escalation requests"
ON public.escalation_requests
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'spoc') OR public.has_role(auth.uid(), 'admin')
);

-- Admin can update escalation requests (approve/reject)
CREATE POLICY "Admin can update escalation requests"
ON public.escalation_requests
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Create audit_logs table (immutable - no UPDATE/DELETE policies)
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES public.profiles(id),
  action_type text NOT NULL,
  target_table text,
  target_id uuid,
  metadata jsonb DEFAULT '{}',
  ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view audit logs"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Authenticated users can insert audit logs (system writes)
CREATE POLICY "System can insert audit logs"
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = actor_id);

-- Create indexes
CREATE INDEX idx_escalation_requests_spoc ON public.escalation_requests(spoc_id);
CREATE INDEX idx_escalation_requests_status ON public.escalation_requests(status);
CREATE INDEX idx_escalation_requests_created ON public.escalation_requests(created_at DESC);
CREATE INDEX idx_audit_logs_actor ON public.audit_logs(actor_id);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action_type);
CREATE INDEX idx_audit_logs_created ON public.audit_logs(created_at DESC);

-- Also add missing indexes from PRD for existing tables
CREATE INDEX IF NOT EXISTS idx_blackbox_entries_flag ON public.blackbox_entries(ai_flag_level);
CREATE INDEX IF NOT EXISTS idx_blackbox_entries_created ON public.blackbox_entries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_type ON public.credit_transactions(type);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created ON public.credit_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON public.appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_slot_time ON public.appointments(slot_time);
CREATE INDEX IF NOT EXISTS idx_peer_sessions_status ON public.peer_sessions(status);
CREATE INDEX IF NOT EXISTS idx_peer_sessions_started ON public.peer_sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_institution ON public.profiles(institution_id);
CREATE INDEX IF NOT EXISTS idx_profiles_active ON public.profiles(is_active);
