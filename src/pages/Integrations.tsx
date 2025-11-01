import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmailConnectionCard } from "@/components/integrations/EmailConnectionCard";
import { ConnectEmailDialog } from "@/components/integrations/ConnectEmailDialog";
import { nangoClient } from "@/lib/integrations/nango";
import { toast } from "sonner";
import { Plug2, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const emailProviders = [
  {
    id: 'gmail' as const,
    name: 'Gmail',
    description: 'Connect your Gmail account via OAuth',
    icon: '📧',
  },
  {
    id: 'outlook' as const,
    name: 'Outlook',
    description: 'Connect your Outlook/Microsoft 365 account',
    icon: '📨',
  },
  {
    id: 'smtp' as const,
    name: 'SMTP',
    description: 'Configure custom SMTP server',
    icon: '⚙️',
  },
];

export default function Integrations() {
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

  if (isLoading) {
    return <div className="flex items-center justify-center h-96">Loading integrations...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Plug2 className="h-8 w-8 text-primary" />
          Integrations
        </h1>
        <p className="text-muted-foreground">
          Connect your email accounts and configure integrations
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            <CardTitle>Email Connections</CardTitle>
          </div>
          <CardDescription>
            Connect email providers to send and track emails from your CRM
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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

      <ConnectEmailDialog
        open={connectDialogOpen}
        onOpenChange={setConnectDialogOpen}
        provider={selectedProvider}
        onSuccess={handleConnectionSuccess}
      />
    </div>
  );
}
