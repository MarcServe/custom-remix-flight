import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { EmailProviderCard } from "@/components/integrations/EmailProviderCard";
import { ConnectEmailDialog } from "@/components/integrations/ConnectEmailDialog";
import { EmailDeliverabilityDialog } from "@/components/integrations/EmailDeliverabilityDialog";
import { nangoClient } from "@/lib/integrations/nango";
import { toast } from "sonner";
import { Mail, Shield, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const emailProviders = [
  {
    id: 'gmail' as const,
    name: 'Gmail',
    description: 'Quick connect with Google OAuth',
    icon: '📧',
    capabilities: {
      tracking: false,
      opens: false,
      clicks: false,
      replies: false,
      bounceDetection: false,
      dailyLimit: 500,
      webhookSupport: false,
      sendingMethod: 'direct' as const,
    },
  },
  {
    id: 'outlook' as const,
    name: 'Outlook',
    description: 'Quick connect with Microsoft OAuth',
    icon: '📨',
    capabilities: {
      tracking: false,
      opens: false,
      clicks: false,
      replies: false,
      bounceDetection: false,
      dailyLimit: 300,
      webhookSupport: false,
      sendingMethod: 'direct' as const,
    },
  },
  {
    id: 'smtp' as const,
    name: 'Business Email',
    description: 'SMTP with optional Resend relay for tracking',
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
    },
  },
];

export default function Integrations() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<'gmail' | 'outlook' | 'smtp'>('gmail');
  const [testEmailDialogOpen, setTestEmailDialogOpen] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState("");
  const [sendingTest, setSendingTest] = useState(false);

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

  const handleSendTestEmail = async () => {
    try {
      setSendingTest(true);
      
      const { error } = await supabase.functions.invoke('send-test-email', {
        body: { to: testEmailAddress },
      });

      if (error) throw error;

      toast.success(`Test email sent to ${testEmailAddress}!`);
      
      setTestEmailDialogOpen(false);
      setTestEmailAddress("");
    } catch (error: any) {
      console.error('Error sending test email:', error);
      toast.error(error.message || "Failed to send test email. Please check your email configuration.");
    } finally {
      setSendingTest(false);
    }
  };

  // Extract domain from SMTP connection
  const smtpConnection = connections?.find(c => c.provider === 'smtp' && c.status === 'active');
  const businessDomain = smtpConnection?.from_email?.split('@')[1];

  if (isLoading) {
    return <div className="flex items-center justify-center h-96">Loading integrations...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Mail className="h-7 w-7 text-primary" />
            Email Connections
          </h1>
          <p className="text-muted-foreground mt-1">
            Connect and manage your email accounts with detailed tracking capabilities
          </p>
        </div>
        <div className="flex gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  const activeConnection = connections?.find(c => c.status === 'active');
                  if (!activeConnection) {
                    toast.error("Please connect an email account first");
                    return;
                  }
                  setTestEmailDialogOpen(true);
                }}
              >
                <Mail className="h-4 w-4 mr-2" />
                Send Test
              </Button>
            </TooltipTrigger>
            <TooltipContent>Send a test email to verify your connection</TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open('/campaigns?tab=health', '_self')}
              >
                <Shield className="h-4 w-4 mr-2" />
                Email Health
              </Button>
            </TooltipTrigger>
            <TooltipContent>View email deliverability metrics</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <Tabs defaultValue="providers" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-1">
          <TabsTrigger value="providers">Email Providers</TabsTrigger>
        </TabsList>

        <TabsContent value="providers" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Connected Email Providers</CardTitle>
              <CardDescription>
                Connect Gmail, Outlook, or your own SMTP server. Each provider shows detailed capabilities and connection status.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
        </TabsContent>
      </Tabs>

      <ConnectEmailDialog
        open={connectDialogOpen}
        onOpenChange={setConnectDialogOpen}
        provider={selectedProvider}
        onSuccess={handleConnectionSuccess}
      />

      {/* Test Email Dialog */}
      <Dialog open={testEmailDialogOpen} onOpenChange={setTestEmailDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Test Email</DialogTitle>
            <DialogDescription>
              Send a test email to verify your email connection is working properly
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="test-email">Email Address</Label>
              <Input
                id="test-email"
                type="email"
                placeholder="you@example.com"
                value={testEmailAddress}
                onChange={(e) => setTestEmailAddress(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                We'll send a simple test message to this address
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setTestEmailDialogOpen(false);
                setTestEmailAddress("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendTestEmail}
              disabled={!testEmailAddress || sendingTest}
            >
              {sendingTest ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  Send Test
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
