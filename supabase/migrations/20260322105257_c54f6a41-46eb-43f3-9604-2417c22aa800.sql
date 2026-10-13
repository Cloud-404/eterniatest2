ALTER TABLE public.blackbox_sessions ADD COLUMN refunded boolean NOT NULL DEFAULT false;
ALTER TABLE public.blackbox_sessions ADD COLUMN silence_duration_sec integer;