import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { EmailProviderCard } from "@/components/integrations/EmailProviderCard";
import { ConnectEmailDialog } from "@/components/integrations/ConnectEmailDialog";
import { VerifiedEmailDialog } from "@/components/integrations/VerifiedEmailDialog";
import { nangoClient } from "@/lib/integrations/nango";
import { toast } from "sonner";
import { Mail, AlertTriangle, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const emailProviders = [
  {
    id: 'gmail' as const,
    name: 'Gmail OAuth',
    description: 'Quick setup, reliable',
    icon: '📧',
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
    name: 'Resend API',
    description: 'Best deliverability',
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
    name: 'SendGrid API',
    description: 'Enterprise-grade',
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
    name: 'Outlook OAuth',
    description: 'Microsoft integration',
    icon: '📨',
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
    name: 'SMTP Direct',
    description: 'Direct SMTP server',
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
  const [selectedProvider, setSelectedProvider] = useState<'gmail' | 'outlook' | 'smtp'>('gmail');
  const [selectedApiProvider, setSelectedApiProvider] = useState<'resend' | 'sendgrid'>('resend');

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

    // Gmail, Outlook, and SMTP use the OAuth/setup dialog
    if (providerId === 'gmail' || providerId === 'outlook' || providerId === 'smtp') {
      setSelectedProvider(providerId as 'gmail' | 'outlook' | 'smtp');
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
    c.status === 'active' && ['gmail', 'outlook', 'resend', 'sendgrid'].includes(c.provider)
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
          <div className="grid gap-4 lg:grid-cols-2">
            {emailProviders.map((provider) => {
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
                    ['gmail', 'outlook', 'resend', 'sendgrid'].includes(c.provider)
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
