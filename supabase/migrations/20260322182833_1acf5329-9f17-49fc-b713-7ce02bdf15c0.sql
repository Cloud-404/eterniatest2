
-- Prevent duplicate active peer sessions per intern
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_peer_intern 
ON public.peer_sessions (intern_id) 
WHERE status IN ('pending', 'active') AND intern_id IS NOT NULL;

-- Prevent duplicate open blackbox sessions per student
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_open_blackbox_student 
ON public.blackbox_sessions (student_id) 
WHERE status IN ('queued', 'accepted', 'active');
