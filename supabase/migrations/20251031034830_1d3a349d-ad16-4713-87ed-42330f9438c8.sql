-- Create contacts table for storing individual company contacts
CREATE TABLE IF NOT EXISTS public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  email_verified BOOLEAN DEFAULT false,
  linkedin_url TEXT,
  title TEXT,
  department TEXT,
  phone TEXT,
  is_primary_contact BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_contacts_company_id ON public.contacts(company_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON public.contacts(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_is_primary ON public.contacts(is_primary_contact) WHERE is_primary_contact = true;

-- Enable RLS
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for contacts
CREATE POLICY "Authenticated users can view contacts"
  ON public.contacts FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert contacts"
  ON public.contacts FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update contacts"
  ON public.contacts FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete contacts"
  ON public.contacts FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- Add trigger for updated_at
CREATE TRIGGER update_contacts_updated_at
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_updated_at();