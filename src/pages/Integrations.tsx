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
import { EmailConnectionCard } from "@/components/integrations/EmailConnectionCard";
import { ConnectEmailDialog } from "@/components/integrations/ConnectEmailDialog";
import { EmailDeliverabilityDialog } from "@/components/integrations/EmailDeliverabilityDialog";
import { nangoClient } from "@/lib/integrations/nango";
import { toast } from "sonner";
import { Mail, Shield, HelpCircle, Loader2, ArrowRight, Info } from "lucide-react";
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<'gmail' | 'outlook' | 'smtp'>('gmail');
  const [deliverabilityDialogOpen, setDeliverabilityDialogOpen] = useState(false);
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
            Email Settings
          </h1>
          <p className="text-muted-foreground mt-1">
            Connect your email account in just a few clicks to start sending campaigns
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
                Test Email
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
                Check Health
              </Button>
            </TooltipTrigger>
            <TooltipContent>View email deliverability and health metrics</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* New Email Providers Management Banner */}
      <Alert className="border-info bg-info/10">
        <Info className="h-4 w-4 text-info" />
        <AlertDescription className="flex items-center justify-between">
          <div>
            <strong className="text-info">New!</strong> 
            <span className="text-info ml-2">
              Manage all your email providers in one place with clear tracking status and capabilities.
            </span>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigate('/integrations/email-providers')}
            className="ml-4 border-info text-info hover:bg-info/10"
          >
            View Email Providers
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-xl">Your Email Accounts</CardTitle>
              <CardDescription>
                Choose how you want to send emails. Quick connect with Gmail or Outlook, or use your own business email server.
              </CardDescription>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon">
                  <HelpCircle className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-xs">
                <p className="text-sm">
                  <strong>Quick Connect (Recommended):</strong> Use Gmail or Outlook for instant setup with OAuth authentication.
                  <br /><br />
                  <strong>Business Email:</strong> Use SMTP if you have your own email server or use a service like Resend for better deliverability.
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
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
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-xl">Email Health</CardTitle>
              <CardDescription>
                Test your email content for spam triggers and deliverability
              </CardDescription>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon">
                  <HelpCircle className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-xs">
                <p className="text-sm">
                  Check your email content before sending to avoid spam filters and improve delivery rates. 
                  We analyze subject lines, body content, and technical setup to give you a health score.
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
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
