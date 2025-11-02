import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { EmailProviderCard } from "@/components/integrations/EmailProviderCard";
import { ConnectEmailDialog } from "@/components/integrations/ConnectEmailDialog";
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
  const [selectedProvider, setSelectedProvider] = useState<'gmail' | 'outlook' | 'smtp'>('gmail');

  const { data: connections, isLoading } = useQuery({
    queryKey: ['nango-connections'],
    queryFn: async () => {
      const { data } = await nangoClient.getConnections();
      return data || [];
    },
  });

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

  const handleConnect = (provider: 'gmail' | 'outlook' | 'smtp') => {
    setSelectedProvider(provider);
    setConnectDialogOpen(true);
  };

  const handleDisconnect = (connectionId: string) => {
    disconnectMutation.mutate(connectionId);
  };

  const handleConnectionSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['nango-connections'], refetchType: 'active' });
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
      {!connections || connections.length === 0 && (
        <Alert className="border-info bg-info/10">
          <Info className="h-4 w-4 text-info" />
          <AlertDescription>
            <strong>Get Started:</strong> Connect an email provider to start sending campaigns. 
            We recommend Resend or Gmail for the best tracking and deliverability.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Sending Providers</CardTitle>
          <CardDescription>
            Choose how you send emails. Providers with tracking enabled will automatically monitor opens, clicks, and replies.
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
                  onConnect={() => handleConnect(provider.id as any)}
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
    </div>
  );
}
