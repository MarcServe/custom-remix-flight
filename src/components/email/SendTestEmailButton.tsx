import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { apiClient } from '@/lib/api/client';
import { toast } from 'sonner';
import { Send, Loader2 } from 'lucide-react';

interface SendTestEmailButtonProps {
  templateStyle: string;
  brandColor: string;
  logoUrl?: string;
  companyName?: string;
  footerText?: string;
  signature?: string;
  websiteUrl?: string;
}

export function SendTestEmailButton({
  templateStyle,
  brandColor,
  logoUrl,
  companyName,
  footerText,
  signature,
  websiteUrl,
}: SendTestEmailButtonProps) {
  const [sending, setSending] = useState(false);

  const handleSendTest = async () => {
    try {
      setSending(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        throw new Error('No email address found');
      }

      const { data, error } = await apiClient.callFunction('send-test-email', {
        templateStyle,
        brandColor,
        logoUrl,
        companyName,
        footerText,
        signature,
        websiteUrl,
        recipientEmail: user.email,
      });

      if (error) throw error;

      toast.success('Test email sent!', {
        description: `Check your inbox at ${user.email}`,
      });
    } catch (error: any) {
      toast.error('Failed to send test email', {
        description: error?.message ?? 'Not authenticated or email provider not configured. Sign in again or set RESEND_API_KEY in Supabase Edge Function secrets.',
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Button
      variant="outline"
      onClick={handleSendTest}
      disabled={sending}
    >
      {sending ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Sending...
        </>
      ) : (
        <>
          <Send className="h-4 w-4 mr-2" />
          Send Test Email
        </>
      )}
    </Button>
  );
}