-- Create company_sequences table to link companies with email sequences
CREATE TABLE public.company_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  sequence_id UUID REFERENCES public.email_sequences(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'draft' NOT NULL CHECK (status IN ('draft', 'active', 'paused', 'completed', 'cancelled')),
  current_step INTEGER DEFAULT 0 NOT NULL,
  personalized_emails JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(company_id, sequence_id)
);

-- Create email_activities table to track individual email sends
CREATE TABLE public.email_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_sequence_id UUID REFERENCES public.company_sequences(id) ON DELETE CASCADE NOT NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  step_number INTEGER NOT NULL,
  subject TEXT,
  body TEXT,
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  bounced_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'sent', 'opened', 'replied', 'bounced', 'failed')),
  external_message_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create crm_connections table to store user CRM connections
CREATE TABLE public.crm_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('hubspot', 'salesforce', 'pipedrive', 'zoho')),
  connection_id TEXT NOT NULL,
  status TEXT DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'disconnected', 'error')),
  scopes TEXT[],
  metadata JSONB,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(user_id, provider)
);

-- Create crm_sync_state table to track sync status for each entity type
CREATE TABLE public.crm_sync_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID REFERENCES public.crm_connections(id) ON DELETE CASCADE NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('contacts', 'companies', 'emails', 'activities')),
  last_sync_token TEXT,
  last_synced_at TIMESTAMPTZ,
  sync_status TEXT DEFAULT 'pending' NOT NULL CHECK (sync_status IN ('pending', 'in_progress', 'completed', 'error')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.company_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_sync_state ENABLE ROW LEVEL SECURITY;

-- RLS Policies for company_sequences
CREATE POLICY "Authenticated users can view company_sequences"
  ON public.company_sequences
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert company_sequences"
  ON public.company_sequences
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update company_sequences"
  ON public.company_sequences
  FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete company_sequences"
  ON public.company_sequences
  FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- RLS Policies for email_activities
CREATE POLICY "Authenticated users can view email_activities"
  ON public.email_activities
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert email_activities"
  ON public.email_activities
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update email_activities"
  ON public.email_activities
  FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete email_activities"
  ON public.email_activities
  FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- RLS Policies for crm_connections (users can only see their own)
CREATE POLICY "Users can view their own crm_connections"
  ON public.crm_connections
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own crm_connections"
  ON public.crm_connections
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own crm_connections"
  ON public.crm_connections
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own crm_connections"
  ON public.crm_connections
  FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for crm_sync_state (users can only see their own via connection)
CREATE POLICY "Users can view their own crm_sync_state"
  ON public.crm_sync_state
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.crm_connections
      WHERE crm_connections.id = crm_sync_state.connection_id
        AND crm_connections.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own crm_sync_state"
  ON public.crm_sync_state
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.crm_connections
      WHERE crm_connections.id = crm_sync_state.connection_id
        AND crm_connections.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own crm_sync_state"
  ON public.crm_sync_state
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.crm_connections
      WHERE crm_connections.id = crm_sync_state.connection_id
        AND crm_connections.user_id = auth.uid()
    )
  );

-- Triggers for updated_at columns
CREATE TRIGGER update_company_sequences_updated_at
  BEFORE UPDATE ON public.company_sequences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_crm_connections_updated_at
  BEFORE UPDATE ON public.crm_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better query performance
CREATE INDEX idx_company_sequences_company_id ON public.company_sequences(company_id);
CREATE INDEX idx_company_sequences_sequence_id ON public.company_sequences(sequence_id);
CREATE INDEX idx_company_sequences_status ON public.company_sequences(status);
CREATE INDEX idx_email_activities_company_sequence_id ON public.email_activities(company_sequence_id);
CREATE INDEX idx_email_activities_contact_id ON public.email_activities(contact_id);
CREATE INDEX idx_email_activities_status ON public.email_activities(status);
CREATE INDEX idx_email_activities_external_message_id ON public.email_activities(external_message_id);
CREATE INDEX idx_crm_connections_user_id ON public.crm_connections(user_id);
CREATE INDEX idx_crm_connections_provider ON public.crm_connections(provider);
CREATE INDEX idx_crm_sync_state_connection_id ON public.crm_sync_state(connection_id);