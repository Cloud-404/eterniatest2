
ALTER TABLE public.blackbox_sessions
  ADD COLUMN IF NOT EXISTS student_joined_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS therapist_joined_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS last_join_error text NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_session_per_therapist
  ON public.blackbox_sessions (therapist_id)
  WHERE status IN ('accepted', 'active') AND therapist_id IS NOT NULL;
