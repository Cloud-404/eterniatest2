
-- Sequence for ticket numbers
CREATE SEQUENCE IF NOT EXISTS institution_inquiry_seq START 1;

-- Table
CREATE TABLE public.institution_inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number text UNIQUE,
  status text NOT NULL DEFAULT 'new',
  institution_name text NOT NULL,
  institution_type text NOT NULL DEFAULT 'university',
  address_line text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  state text NOT NULL DEFAULT '',
  pincode text NOT NULL DEFAULT '',
  google_maps_url text,
  contact_person_name text NOT NULL,
  contact_person_email text NOT NULL,
  contact_person_phone text NOT NULL,
  designation text NOT NULL DEFAULT '',
  pan_number text NOT NULL DEFAULT '',
  tan_number text NOT NULL DEFAULT '',
  gst_number text,
  student_count integer,
  website_url text,
  message text,
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Auto-generate ticket_number trigger
CREATE OR REPLACE FUNCTION public.generate_inquiry_ticket_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  NEW.ticket_number := 'ETN-INQ-' || LPAD(nextval('institution_inquiry_seq')::text, 5, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_generate_inquiry_ticket
  BEFORE INSERT ON public.institution_inquiries
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_inquiry_ticket_number();

-- RLS
ALTER TABLE public.institution_inquiries ENABLE ROW LEVEL SECURITY;

-- Anon can insert (public form)
CREATE POLICY "Anon can submit inquiries"
  ON public.institution_inquiries
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Authenticated can also insert
CREATE POLICY "Authenticated can submit inquiries"
  ON public.institution_inquiries
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Anon can select own ticket by ticket_number (for tracking)
CREATE POLICY "Anon can track inquiries by ticket number"
  ON public.institution_inquiries
  FOR SELECT
  TO anon
  USING (true);

-- Admin can view all
CREATE POLICY "Admins can view all inquiries"
  ON public.institution_inquiries
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Admin can update
CREATE POLICY "Admins can update inquiries"
  ON public.institution_inquiries
  FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
