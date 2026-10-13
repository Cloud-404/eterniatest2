
-- Create blackbox_sessions table for queue-based therapist model
CREATE TABLE public.blackbox_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  therapist_id uuid REFERENCES public.profiles(id),
  status text NOT NULL DEFAULT 'queued',
  room_id text,
  flag_level integer NOT NULL DEFAULT 0,
  escalation_reason text,
  escalation_history jsonb DEFAULT '[]'::jsonb,
  session_notes_encrypted text,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.blackbox_sessions ENABLE ROW LEVEL SECURITY;

-- Students can create sessions (own student_id)
CREATE POLICY "Students can create blackbox sessions"
ON public.blackbox_sessions FOR INSERT TO authenticated
WITH CHECK (auth.uid() = student_id);

-- Students can view own sessions
CREATE POLICY "Students can view own blackbox sessions"
ON public.blackbox_sessions FOR SELECT TO authenticated
USING (auth.uid() = student_id);

-- Experts can view queued sessions and their own assigned sessions
CREATE POLICY "Experts can view blackbox sessions"
ON public.blackbox_sessions FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'expert'::app_role)
  AND (status = 'queued' OR therapist_id = auth.uid())
);

-- Experts can update sessions (accept, complete, escalate)
CREATE POLICY "Experts can update blackbox sessions"
ON public.blackbox_sessions FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'expert'::app_role)
  AND (status = 'queued' OR therapist_id = auth.uid())
);

-- Students can update own sessions (cancel)
CREATE POLICY "Students can update own blackbox sessions"
ON public.blackbox_sessions FOR UPDATE TO authenticated
USING (auth.uid() = student_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.blackbox_sessions;
