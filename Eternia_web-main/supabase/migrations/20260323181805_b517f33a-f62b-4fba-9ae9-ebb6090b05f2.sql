-- 1. Auto-expire function that cleans up stale sessions
CREATE OR REPLACE FUNCTION public.auto_expire_stale_peer_sessions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE peer_sessions 
  SET status = 'completed', ended_at = now()
  WHERE status IN ('active', 'pending') 
    AND created_at < now() - interval '2 hours';
  RETURN NEW;
END;
$$;

-- 2. Trigger: on every INSERT to peer_sessions, clean stale ones first
CREATE TRIGGER trg_auto_expire_peer_sessions
  BEFORE INSERT ON public.peer_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_expire_stale_peer_sessions();

-- 3. Tighten INSERT policy: only students can create peer sessions
DROP POLICY IF EXISTS "Students can create peer sessions" ON public.peer_sessions;
CREATE POLICY "Students can create peer sessions"
  ON public.peer_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = student_id
    AND public.has_role(auth.uid(), 'student')
  );

-- 4. Restrict message insertion to active sessions only
DROP POLICY IF EXISTS "Session participants can send messages" ON public.peer_messages;
CREATE POLICY "Session participants can send messages"
  ON public.peer_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM peer_sessions
      WHERE peer_sessions.id = peer_messages.session_id
        AND peer_sessions.status = 'active'
        AND (peer_sessions.student_id = auth.uid() OR peer_sessions.intern_id = auth.uid())
    )
  );