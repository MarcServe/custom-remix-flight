import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Send, Loader2 } from 'lucide-react';

interface SendTestEmailButtonProps {
  templateStyle: string;
  brandColor: string;
  logoUrl?: string;
  companyName?: string;
  footerText?: string;
  signature?: string;
}

export function SendTestEmailButton({
  templateStyle,
  brandColor,
  logoUrl,
  companyName,
  footerText,
  signature,
}: SendTestEmailButtonProps) {
  const [sending, setSending] = useState(false);

  const handleSendTest = async () => {
    try {
      setSending(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        throw new Error('No email address found');
      }

      const { error } = await supabase.functions.invoke('send-test-email', {
        body: {
          templateStyle,
          brandColor,
          logoUrl,
          companyName,
          footerText,
          signature,
          recipientEmail: user.email,
        },
      });

      if (error) throw error;

      toast.success('Test email sent!', {
        description: `Check your inbox at ${user.email}`,
      });
    } catch (error: any) {
      toast.error('Failed to send test email', {
        description: error.message,
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