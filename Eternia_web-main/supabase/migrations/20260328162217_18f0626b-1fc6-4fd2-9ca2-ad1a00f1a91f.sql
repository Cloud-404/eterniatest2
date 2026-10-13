-- Make actor_id nullable on audit_logs
ALTER TABLE public.audit_logs ALTER COLUMN actor_id DROP NOT NULL;

-- Drop and recreate FK with ON DELETE SET NULL
ALTER TABLE public.audit_logs
  DROP CONSTRAINT IF EXISTS audit_logs_actor_id_fkey;

ALTER TABLE public.audit_logs
  ADD CONSTRAINT audit_logs_actor_id_fkey
  FOREIGN KEY (actor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;