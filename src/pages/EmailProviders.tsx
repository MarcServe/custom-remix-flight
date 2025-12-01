import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { EmailProviderCard } from "@/components/integrations/EmailProviderCard";
import { ConnectEmailDialog } from "@/components/integrations/ConnectEmailDialog";
import { VerifiedEmailDialog } from "@/components/integrations/VerifiedEmailDialog";
import { nangoClient } from "@/lib/integrations/nango";
import { toast } from "sonner";
import { Mail, AlertTriangle, Info, Webhook, ArrowRight, CheckCircle2, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { EMAIL_PROVIDER_CONFIG } from "@/config/email-providers";

const emailProviders = [
  {
    id: 'gmail_direct' as const,
    name: 'Gmail',
    description: 'Connect with Google OAuth',
    icon: 'https://www.google.com/favicon.ico',
    isGoogleIcon: true,
    capabilities: {
      tracking: true,
      opens: true,
      clicks: true,
      replies: true,
      bounceDetection: true,
      dailyLimit: 500,
      webhookSupport: true,
      sendingMethod: 'api' as const,
    }
  },
  {
    id: 'resend' as const,
    name: 'Resend',
    description: 'API-based, best deliverability',
    icon: '🚀',
    capabilities: {
      tracking: true,
      opens: true,
      clicks: true,
      replies: true,
      bounceDetection: true,
      dailyLimit: null,
      webhookSupport: true,
      sendingMethod: 'api' as const,
    }
  },
  {
    id: 'sendgrid' as const,
    name: 'SendGrid',
    description: 'API-based, enterprise scale',
    icon: '📬',
    capabilities: {
      tracking: true,
      opens: true,
      clicks: true,
      replies: true,
      bounceDetection: true,
      dailyLimit: null,
      webhookSupport: true,
      advancedAnalytics: true,
      sendingMethod: 'api' as const,
    }
  },
  {
    id: 'outlook' as const,
    name: 'Outlook',
    description: 'Connect with Microsoft',
    icon: 'https://upload.wikimedia.org/wikipedia/commons/d/df/Microsoft_Office_Outlook_%282018%E2%80%93present%29.svg',
    isOutlookIcon: true,
    capabilities: {
      tracking: true,
      opens: true,
      clicks: true,
      replies: true,
      bounceDetection: true,
      dailyLimit: 500,
      webhookSupport: true,
      sendingMethod: 'api' as const,
    }
  },
  {
    id: 'smtp' as const,
    name: 'Custom SMTP',
    description: 'Your own email server',
    icon: '⚙️',
    capabilities: {
      tracking: false,
      opens: false,
      clicks: false,
      replies: false,
      bounceDetection: false,
      dailyLimit: null,
      webhookSupport: false,
      sendingMethod: 'direct' as const,
    }
  },
];

export default function EmailProviders() {
  const queryClient = useQueryClient();
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [verifiedEmailDialogOpen, setVerifiedEmailDialogOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<'gmail' | 'gmail_direct' | 'outlook' | 'smtp'>('gmail');
  const [selectedApiProvider, setSelectedApiProvider] = useState<'resend' | 'sendgrid'>('resend');

  // Handle OAuth callback from redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const gmailConnected = params.get('gmail_connected');
    const gmailError = params.get('gmail_error');

    if (gmailConnected === 'true') {
      toast.success("Gmail connected successfully!", {
        description: "Your Gmail account is now connected"
      });
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
      // Refresh connections
      queryClient.invalidateQueries({ queryKey: ['nango-connections'] });
      queryClient.invalidateQueries({ queryKey: ['api-key-connections'] });
    } else if (gmailError) {
      toast.error("Failed to connect Gmail", {
        description: decodeURIComponent(gmailError)
      });
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [queryClient]);

  const { data: oauthConnections, isLoading: isLoadingOAuth } = useQuery({
    queryKey: ['nango-connections'],
    queryFn: async () => {
      // Get OAuth/SMTP connections from Nango
      const { data } = await nangoClient.getConnections();
      return data || [];
    },
  });

  // Query for API-key provider connections (Resend/SendGrid)
  const { data: apiConnections, isLoading: isLoadingApi } = useQuery({
    queryKey: ['api-key-connections'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('crm_connections')
        .select('*')
        .eq('user_id', user.id)
        .in('provider', ['resend', 'sendgrid'])
        .eq('status', 'active');

      if (error) {
        console.error('Error fetching API connections:', error);
        return [];
      }

      return data || [];
    },
  });

  // Merge both connection types
  const connections = [...(oauthConnections || []), ...(apiConnections || [])];
  const isLoading = isLoadingOAuth || isLoadingApi;

  // Real-time subscription for automatic updates
  useEffect(() => {
    const channel = supabase
      .channel('crm-connections-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'crm_connections'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['nango-connections'], refetchType: 'active' });
          queryClient.invalidateQueries({ queryKey: ['api-key-connections'], refetchType: 'active' });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const disconnectMutation = useMutation({
    mutationFn: (connectionId: string) => nangoClient.disconnect(connectionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nango-connections'] });
      toast.success('Connection removed');
    },
    onError: () => {
      toast.error('Failed to disconnect');
    },
  });

  const handleConnect = (providerId: string) => {
    // Resend and SendGrid now use the verified email dialog
    if (providerId === 'resend' || providerId === 'sendgrid') {
      setSelectedApiProvider(providerId as 'resend' | 'sendgrid');
      setVerifiedEmailDialogOpen(true);
      return;
    }

    // Gmail Direct, Outlook, and SMTP use the OAuth/setup dialog
    if (providerId === 'gmail_direct' || providerId === 'outlook' || providerId === 'smtp') {
      setSelectedProvider(providerId as 'gmail_direct' | 'outlook' | 'smtp');
      setConnectDialogOpen(true);
    }
  };

  const handleDisconnect = async (connectionId: string) => {
    // Check if this is an API-key connection (stored in crm_connections)
    const apiConnection = apiConnections?.find(c => c.id === connectionId);
    
    if (apiConnection) {
      // Delete from crm_connections table
      const { error } = await supabase
        .from('crm_connections')
        .delete()
        .eq('id', connectionId);

      if (error) {
        toast.error('Failed to disconnect');
        console.error('Error disconnecting:', error);
      } else {
        toast.success('Connection removed');
        queryClient.invalidateQueries({ queryKey: ['api-key-connections'] });
      }
    } else {
      // OAuth/SMTP connection - use Nango
      disconnectMutation.mutate(connectionId);
    }
  };

  const handleConnectionSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['nango-connections'], refetchType: 'active' });
    queryClient.invalidateQueries({ queryKey: ['api-key-connections'], refetchType: 'active' });
  };

  // Check if user has any tracking-enabled connections
  const hasTrackingEnabled = connections?.some(c => 
    c.status === 'active' && ['gmail', 'gmail_direct', 'outlook', 'resend', 'sendgrid'].includes(c.provider)
  );

  const hasOnlySMTP = connections?.some(c => c.status === 'active' && c.provider === 'smtp') 
    && !hasTrackingEnabled;

  if (isLoading) {
    return <div className="flex items-center justify-center h-96">Loading email providers...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Mail className="h-7 w-7 text-primary" />
            Email Providers Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure how you send emails and track engagement
          </p>
        </div>
      </div>

      {/* Warning for SMTP only users */}
      {hasOnlySMTP && (
        <Alert className="border-warning bg-warning/10">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <AlertDescription className="text-warning">
            <strong>Tracking Disabled:</strong> Emails sent via direct SMTP cannot be tracked. 
            Switch to Resend relay or connect Gmail/SendGrid for engagement tracking (opens, clicks, replies).
          </AlertDescription>
        </Alert>
      )}

      {/* Info banner for no connections */}
      {(!connections || connections.length === 0) && (
        <Alert className="border-blue-500/20 bg-blue-500/10">
          <Info className="h-4 w-4 text-blue-500" />
          <AlertDescription className="text-blue-600 dark:text-blue-400">
            <strong>Get Started:</strong> Connect an email provider to start sending campaigns. 
            We recommend Gmail (quick OAuth) or configure Resend/SendGrid API keys for production use.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Email Sending Providers</CardTitle>
          <CardDescription>
            <strong>OAuth Providers (Gmail, Outlook):</strong> Click connect for quick setup<br/>
            <strong>API Providers (Resend, SendGrid):</strong> Require API key configuration in Supabase secrets<br/>
            <strong>SMTP Direct:</strong> Configure your own SMTP server
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {emailProviders
              .filter((provider) => {
                // Filter out Outlook if disabled in config
                if (provider.id === 'outlook' && !EMAIL_PROVIDER_CONFIG.outlook_enabled) {
                  return false;
                }
                return true;
              })
              .map((provider) => {
                const connection = connections?.find(
                  (c) => c.provider === provider.id && c.status !== 'disconnected'
                );
                
                return (
                  <EmailProviderCard
                    key={provider.id}
                    provider={provider}
                    connection={connection}
                    onConnect={() => handleConnect(provider.id)}
                    onDisconnect={handleDisconnect}
                  />
                );
              })}
          </div>
        </CardContent>
      </Card>

      {/* Tracking Status Summary */}
      {connections && connections.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Tracking Status</CardTitle>
            <CardDescription>
              Overview of your email tracking capabilities
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">Connected Providers</p>
                <p className="text-2xl font-bold mt-1">
                  {connections.filter(c => c.status === 'active').length}
                </p>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">With Tracking</p>
                <p className="text-2xl font-bold mt-1">
                  {connections.filter(c => 
                    c.status === 'active' && 
                    ['gmail', 'gmail_direct', 'outlook', 'resend', 'sendgrid'].includes(c.provider)
                  ).length}
                </p>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">Without Tracking</p>
                <p className="text-2xl font-bold mt-1">
                  {connections.filter(c => 
                    c.status === 'active' && c.provider === 'smtp'
                  ).length}
                </p>
              </div>
            </div>

            {hasTrackingEnabled && (
              <Alert className="border-success bg-success/10">
                <Info className="h-4 w-4 text-success" />
                <AlertDescription className="text-success">
                  <strong>Tracking Enabled:</strong> Your emails are being monitored for opens, clicks, and replies. 
                  View engagement data in your campaigns dashboard.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Reply Tracking Setup Guide */}
      {hasTrackingEnabled && (
        <Card className="border-2 border-primary/20">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-gradient-primary flex items-center justify-center">
                <Webhook className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl">Email Reply Tracking Setup</CardTitle>
                <CardDescription>
                  Configure webhooks to automatically detect and track email responses
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <Alert className="border-blue-500/20 bg-blue-500/5">
              <Info className="h-4 w-4 text-blue-500" />
              <AlertDescription>
                <strong>How it works:</strong> When prospects reply to your emails, webhooks notify our system in real-time. 
                This allows you to see replies instantly in your dashboard and triggers auto-response workflows.
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <h4 className="font-semibold flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                Setup Instructions by Provider
              </h4>

              {/* Resend Webhook Setup */}
              {connections.some(c => c.provider === 'resend' && c.status === 'active') && (
                <div className="p-4 rounded-lg border-2 bg-card space-y-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">🚀</span>
                      <h5 className="font-semibold">Resend Webhooks</h5>
                    </div>
                  </div>
                  <Separator />
                  <ol className="space-y-2 text-xs sm:text-sm leading-relaxed">
                    <li className="flex items-start gap-2">
                      <span className="font-semibold shrink-0">1.</span>
                      <span>Go to <a href="https://resend.com/webhooks" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Resend Webhooks Dashboard</a></span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-semibold shrink-0">2.</span>
                      <span>Create a new webhook endpoint with this URL:</span>
                    </li>
                    <li className="pl-6 md:pl-8">
                      <div className="w-full overflow-hidden rounded border bg-muted">
                        <div className="flex items-start gap-2 p-2">
                          <code className="flex-1 break-all text-xs font-mono leading-relaxed text-foreground/90">
                            https://kgndpwzqohepotahnfeo.supabase.co/functions/v1/email-webhook
                          </code>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="mt-1 h-7 w-7 p-0 shrink-0"
                            onClick={() => {
                              navigator.clipboard.writeText('https://kgndpwzqohepotahnfeo.supabase.co/functions/v1/email-webhook');
                              toast.success('Webhook URL copied');
                            }}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-semibold shrink-0">3.</span>
                      <span>Enable these events: <code className="bg-muted px-1 py-0.5 rounded text-xs">email.delivered</code>, <code className="bg-muted px-1 py-0.5 rounded text-xs">email.bounced</code>, <code className="bg-muted px-1 py-0.5 rounded text-xs">email.complained</code></span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-semibold shrink-0">4.</span>
                      <span>For reply tracking, configure your domain's inbound email forwarding to your CRM email address</span>
                    </li>
                  </ol>
                </div>
              )}

              {/* SendGrid Webhook Setup */}
              {connections.some(c => c.provider === 'sendgrid' && c.status === 'active') && (
                <div className="p-4 rounded-lg border-2 bg-card space-y-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">📬</span>
                      <h5 className="font-semibold">SendGrid Event Webhooks</h5>
                    </div>
                  </div>
                  <Separator />
                  <ol className="space-y-2 text-xs sm:text-sm leading-relaxed">
                    <li className="flex items-start gap-2">
                      <span className="font-semibold shrink-0">1.</span>
                      <span>Go to <a href="https://app.sendgrid.com/settings/mail_settings" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">SendGrid Mail Settings</a></span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-semibold shrink-0">2.</span>
                      <span>Navigate to Mail Settings → Event Webhook</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-semibold shrink-0">3.</span>
                      <span>Add this HTTP Post URL:</span>
                    </li>
                    <li className="pl-6 md:pl-8">
                      <div className="w-full overflow-hidden rounded border bg-muted">
                        <div className="flex items-start gap-2 p-2">
                          <code className="flex-1 break-all text-xs font-mono leading-relaxed text-foreground/90">
                            https://kgndpwzqohepotahnfeo.supabase.co/functions/v1/email-webhook
                          </code>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="mt-1 h-7 w-7 p-0 shrink-0"
                            onClick={() => {
                              navigator.clipboard.writeText('https://kgndpwzqohepotahnfeo.supabase.co/functions/v1/email-webhook');
                              toast.success('Webhook URL copied');
                            }}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-semibold shrink-0">4.</span>
                      <span>Enable tracking for: Delivered, Opened, Clicked, Bounced, Spam Reports</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-semibold shrink-0">5.</span>
                      <span>Set up Inbound Parse webhook for reply tracking</span>
                    </li>
                  </ol>
                </div>
              )}

              {/* Gmail/Outlook OAuth */}
              {connections.some(c => ['gmail', 'outlook'].includes(c.provider) && c.status === 'active') && (
                <div className="p-4 rounded-lg border-2 bg-card space-y-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">📧</span>
                      <h5 className="font-semibold">Gmail / Outlook OAuth</h5>
                    </div>
                    <Badge variant="outline" className="bg-success/10 text-success">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Auto-Configured
                    </Badge>
                  </div>
                  <Separator />
                  <Alert className="border-success/20 bg-success/5">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    <AlertDescription className="text-sm">
                      <strong>Good news!</strong> Reply tracking for OAuth providers (Gmail/Outlook) is automatically enabled. 
                      The system periodically checks your inbox for new responses and updates the dashboard in real-time.
                    </AlertDescription>
                  </Alert>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p className="flex items-center gap-2">
                      <ArrowRight className="h-4 w-4" />
                      Replies are detected within 5 minutes
                    </p>
                    <p className="flex items-center gap-2">
                      <ArrowRight className="h-4 w-4" />
                      Email threads are automatically tracked
                    </p>
                    <p className="flex items-center gap-2">
                      <ArrowRight className="h-4 w-4" />
                      Auto-responses can be configured per sequence
                    </p>
                  </div>
                </div>
              )}
            </div>

            <Alert className="border-primary/20 bg-primary/5">
              <Info className="h-4 w-4 text-primary" />
              <AlertDescription>
                <strong>Need help?</strong> Once webhooks are configured, responses will appear in your Dashboard 
                within seconds. Test by sending yourself an email and replying to it.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      <ConnectEmailDialog
        open={connectDialogOpen}
        onOpenChange={setConnectDialogOpen}
        provider={selectedProvider}
        onSuccess={handleConnectionSuccess}
      />

      <VerifiedEmailDialog
        open={verifiedEmailDialogOpen}
        onOpenChange={setVerifiedEmailDialogOpen}
        provider={selectedApiProvider}
        onSuccess={handleConnectionSuccess}
      />
    </div>
  );
}
