import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, XCircle, Loader2, Send, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ProviderConnectionTestProps {
  provider: string;
  connectionId: string;
}

export function ProviderConnectionTest({ provider, connectionId }: ProviderConnectionTestProps) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    details?: any;
  } | null>(null);

  // OAuth providers (Gmail, Outlook) are for receiving only
  const isOAuthProvider = ['gmail', 'gmail_direct', 'outlook', 'microsoft'].includes(provider.toLowerCase());

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      // Get user email for test
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        throw new Error('No user email found');
      }

      // Call test edge function
      // For API-key providers (resend, sendgrid), connectionId is optional
      const { data, error } = await supabase.functions.invoke('send-test-email', {
        body: {
          provider,
          senderConnectionId: connectionId || undefined, // Don't send if empty
          testEmail: user.email,
          recipientName: user.user_metadata?.full_name || 'Test User',
          recipientEmail: user.email,
          subject: 'Test Email',
          body: 'This is a test email to verify your email provider configuration.',
        },
      });

      if (error) throw error;

      if (data.success) {
        setTestResult({
          success: true,
          message: `Test email sent successfully via ${provider}`,
          details: data,
        });
        toast.success('Connection test successful', {
          description: `Test email sent to ${user.email}`,
        });
      } else {
        setTestResult({
          success: false,
          message: data.error || 'Test failed',
          details: data,
        });
        toast.error('Connection test failed', {
          description: data.error,
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setTestResult({
        success: false,
        message: errorMessage,
      });
      toast.error('Connection test failed', {
        description: errorMessage,
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Connection Test</CardTitle>
        <CardDescription>
          {isOAuthProvider 
            ? 'OAuth provider connection status' 
            : 'Send a test email to verify your provider configuration'
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isOAuthProvider ? (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="ml-2">
              <strong>Gmail/Outlook is for receiving emails only.</strong>
              <p className="mt-2 text-sm">
                Your {provider} connection is working and will receive inbound emails and parse replies. 
                To send test emails and campaigns, please connect Resend or SendGrid as your sending provider.
              </p>
            </AlertDescription>
          </Alert>
        ) : (
          <Button
            onClick={handleTest}
            disabled={testing}
            variant="outline"
            className="w-full"
          >
            {testing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending Test Email...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Test Email
              </>
            )}
          </Button>
        )}

        {testResult && (
          <Alert variant={testResult.success ? 'default' : 'destructive'}>
            <div className="flex items-start gap-2">
              {testResult.success ? (
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
              ) : (
                <XCircle className="h-5 w-5 mt-0.5" />
              )}
              <div className="flex-1 space-y-2">
                <AlertDescription>{testResult.message}</AlertDescription>
                
                {testResult.details && (
                  <div className="text-xs space-y-1 mt-2">
                    {testResult.details.messageId && (
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          Message ID: {testResult.details.messageId}
                        </Badge>
                      </div>
                    )}
                    {testResult.details.trackingEnabled !== undefined && (
                      <div className="flex items-center gap-2">
                        {testResult.details.trackingEnabled ? (
                          <Badge variant="default" className="text-xs bg-green-500">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Tracking Enabled
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            No Tracking
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </Alert>
        )}

        {!isOAuthProvider && (
          <div className="text-xs text-muted-foreground space-y-1">
            <p>• Test email will be sent to your account email</p>
            <p>• Check your inbox to confirm delivery</p>
            <p>• Verify tracking capabilities are working</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
