
ALTER TABLE public.institutions ADD COLUMN IF NOT EXISTS institution_type TEXT NOT NULL DEFAULT 'university';

ALTER TABLE public.user_private ADD COLUMN IF NOT EXISTS apaar_id_encrypted TEXT;
ALTER TABLE public.user_private ADD COLUMN IF NOT EXISTS erp_id_encrypted TEXT;
ALTER TABLE public.user_private ADD COLUMN IF NOT EXISTS apaar_verified BOOLEAN DEFAULT false;
ALTER TABLE public.user_private ADD COLUMN IF NOT EXISTS erp_verified BOOLEAN DEFAULT false;
