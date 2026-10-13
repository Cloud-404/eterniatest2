-- Add escalation columns to escalation_requests
ALTER TABLE public.escalation_requests 
  ADD COLUMN IF NOT EXISTS escalation_level integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS trigger_snippet text,
  ADD COLUMN IF NOT EXISTS trigger_timestamp timestamptz;

-- Add student_id to profiles for auto-generated IDs
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS student_id text UNIQUE;

-- Create sequence for student IDs
CREATE SEQUENCE IF NOT EXISTS student_id_seq START 1001;

-- Create function to auto-generate student IDs on profile creation
CREATE OR REPLACE FUNCTION public.generate_student_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inst_code TEXT;
  seq_num INTEGER;
BEGIN
  IF NEW.role = 'student' AND NEW.student_id IS NULL THEN
    IF NEW.institution_id IS NOT NULL THEN
      SELECT UPPER(LEFT(REGEXP_REPLACE(name, '[^a-zA-Z0-9]', '', 'g'), 4))
      INTO inst_code
      FROM public.institutions
      WHERE id = NEW.institution_id;
    END IF;
    
    inst_code := COALESCE(inst_code, 'INDP');
    seq_num := nextval('student_id_seq');
    NEW.student_id := 'ETN-' || inst_code || '-' || LPAD(seq_num::text, 5, '0');
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for auto-generating student IDs
DROP TRIGGER IF EXISTS trg_generate_student_id ON public.profiles;
CREATE TRIGGER trg_generate_student_id
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_student_id();