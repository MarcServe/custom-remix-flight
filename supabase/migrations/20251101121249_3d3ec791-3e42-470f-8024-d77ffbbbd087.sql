-- Create email_campaigns table
CREATE TABLE public.email_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subject_template TEXT NOT NULL,
  body_html_template TEXT NOT NULL,
  body_text_template TEXT NOT NULL,
  sender_connection_id UUID REFERENCES crm_connections(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'completed', 'failed')),
  total_recipients INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  opened_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  scheduled_at TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;

-- Create policies for email_campaigns
CREATE POLICY "Users can view their own campaigns"
ON public.email_campaigns
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own campaigns"
ON public.email_campaigns
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own campaigns"
ON public.email_campaigns
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own campaigns"
ON public.email_campaigns
FOR DELETE
USING (auth.uid() = user_id);

-- Create email_campaign_recipients table
CREATE TABLE public.email_campaign_recipients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES email_campaigns(id) ON DELETE CASCADE,
  person_id UUID REFERENCES people(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  personalized_subject TEXT NOT NULL,
  personalized_body_html TEXT NOT NULL,
  personalized_body_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'bounced', 'opened', 'clicked')),
  sent_at TIMESTAMP WITH TIME ZONE,
  opened_at TIMESTAMP WITH TIME ZONE,
  clicked_at TIMESTAMP WITH TIME ZONE,
  bounced_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  external_message_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_campaign_recipients ENABLE ROW LEVEL SECURITY;

-- Create policies for email_campaign_recipients
CREATE POLICY "Users can view recipients of their campaigns"
ON public.email_campaign_recipients
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM email_campaigns
    WHERE email_campaigns.id = email_campaign_recipients.campaign_id
    AND email_campaigns.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert recipients for their campaigns"
ON public.email_campaign_recipients
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM email_campaigns
    WHERE email_campaigns.id = email_campaign_recipients.campaign_id
    AND email_campaigns.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update recipients of their campaigns"
ON public.email_campaign_recipients
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM email_campaigns
    WHERE email_campaigns.id = email_campaign_recipients.campaign_id
    AND email_campaigns.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete recipients of their campaigns"
ON public.email_campaign_recipients
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM email_campaigns
    WHERE email_campaigns.id = email_campaign_recipients.campaign_id
    AND email_campaigns.user_id = auth.uid()
  )
);

-- Add trigger for updated_at
CREATE TRIGGER update_email_campaigns_updated_at
BEFORE UPDATE ON public.email_campaigns
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_email_campaign_recipients_updated_at
BEFORE UPDATE ON public.email_campaign_recipients
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add indexes for better performance
CREATE INDEX idx_email_campaigns_user_id ON email_campaigns(user_id);
CREATE INDEX idx_email_campaigns_status ON email_campaigns(status);
CREATE INDEX idx_email_campaign_recipients_campaign_id ON email_campaign_recipients(campaign_id);
CREATE INDEX idx_email_campaign_recipients_status ON email_campaign_recipients(status);

COMMENT ON TABLE public.email_campaigns IS 'Stores bulk email campaigns for sending to multiple contacts';
COMMENT ON TABLE public.email_campaign_recipients IS 'Stores individual recipients and their personalized emails for each campaign';