import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmailConnectionCard } from "@/components/integrations/EmailConnectionCard";
import { ConnectEmailDialog } from "@/components/integrations/ConnectEmailDialog";
import { EmailDeliverabilityDialog } from "@/components/integrations/EmailDeliverabilityDialog";
import { nangoClient } from "@/lib/integrations/nango";
import { toast } from "sonner";
import { Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const emailProviders = [
  {
    id: 'gmail' as const,
    name: 'Gmail',
    description: 'Quick connect with Google',
    icon: '📧',
  },
  {
    id: 'outlook' as const,
    name: 'Outlook',
    description: 'Quick connect with Microsoft',
    icon: '📨',
  },
  {
    id: 'smtp' as const,
    name: 'Business Email',
    description: 'Use your own email server',
    icon: '⚙️',
  },
];

export default function Integrations() {
  const queryClient = useQueryClient();
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<'gmail' | 'outlook' | 'smtp'>('gmail');
  const [deliverabilityDialogOpen, setDeliverabilityDialogOpen] = useState(false);

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

  // Extract domain from SMTP connection
  const smtpConnection = connections?.find(c => c.provider === 'smtp' && c.status === 'active');
  const businessDomain = smtpConnection?.from_email?.split('@')[1];

  if (isLoading) {
    return <div className="flex items-center justify-center h-96">Loading integrations...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Mail className="h-7 w-7 text-primary" />
          Email Settings
        </h1>
        <p className="text-muted-foreground mt-1">
          Connect your email to send and track messages
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Your Email Accounts</CardTitle>
          <CardDescription>
            Choose how you want to send emails. Quick connect with Gmail or Outlook, or use your own business email server.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {emailProviders.map((provider) => {
              const connection = connections?.find(
                (c) => c.provider === provider.id && c.status !== 'disconnected'
              );
              return (
                <EmailConnectionCard
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

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Email Health</CardTitle>
          <CardDescription>
            Check how your emails are performing
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {businessDomain ? (
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Domain: {businessDomain}</p>
                  <p className="text-sm text-muted-foreground">Your email domain is set up</p>
                </div>
                <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                  🟢 Active
                </Badge>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">Connect a business email to see domain health</p>
            </div>
          )}
          
          <Button 
            variant="outline" 
            onClick={() => setDeliverabilityDialogOpen(true)}
            className="w-full"
          >
            Test Email Content
          </Button>
        </CardContent>
      </Card>

      <ConnectEmailDialog
        open={connectDialogOpen}
        onOpenChange={setConnectDialogOpen}
        provider={selectedProvider}
        onSuccess={handleConnectionSuccess}
      />
      
      <EmailDeliverabilityDialog
        open={deliverabilityDialogOpen}
        onOpenChange={setDeliverabilityDialogOpen}
      />
    </div>
  );
}
