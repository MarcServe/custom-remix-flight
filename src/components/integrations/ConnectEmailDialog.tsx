import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Info } from "lucide-react";
import { toast } from "sonner";
import { nangoClient } from "@/lib/integrations/nango";
import { gmailDirectClient } from "@/lib/integrations/gmail-direct";
import { NangoSetupInstructions } from "./NangoSetupInstructions";
import { EMAIL_PROVIDER_CONFIG } from "@/config/email-providers";

interface ConnectEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: 'gmail' | 'gmail_direct' | 'outlook' | 'smtp';
  onSuccess: () => void;
}

export function ConnectEmailDialog({
  open,
  onOpenChange,
  provider,
  onSuccess,
}: ConnectEmailDialogProps) {
  const [loading, setLoading] = useState(false);
  const [showSetupInstructions, setShowSetupInstructions] = useState(false);
  const [smtpConfig, setSMTPConfig] = useState({
    host: "",
    port: 587,
    username: "",
    password: "",
    secure: true,
  });

  const handleDirectGmailConnect = async () => {
    setLoading(true);
    try {
      // Use redirect flow instead of popup (better browser compatibility)
      const { error } = await gmailDirectClient.connectWithRedirect();
      
      if (error) {
        console.error('Direct Gmail OAuth error:', error);
        toast.error("Failed to connect Gmail", {
          description: error.message
        });
        setLoading(false);
        return;
      }

      // Redirect will happen, no need to handle success here
      // The page will reload after OAuth completes
    } catch (error) {
      console.error('Unexpected error:', error);
      toast.error("Connection failed", {
        description: "An unexpected error occurred. Please try again."
      });
      setLoading(false);
    }
  };

  const handleOAuthConnect = async () => {
    setLoading(true);
    try {
      const { data, error } = await nangoClient.initiateOAuth(provider as 'gmail' | 'outlook');
      
      if (error) {
        console.error('OAuth error:', error);
        
        // Handle popup blocker specifically
        if (error.message.includes('Popup blocked')) {
          toast.error("Pop-ups are blocked", {
            description: "Please allow pop-ups for this site and try again. Check your browser's address bar for a pop-up blocked icon."
          });
          return;
        }
        
        // Handle timeout
        if (error.message.includes('timeout')) {
          toast.error("Connection timed out", {
            description: "The authentication took too long. Please try again."
          });
          return;
        }
        
        // Handle connection not completed
        if (error.message.includes('not completed')) {
          toast.error("Connection not completed", {
            description: "The authentication window was closed before completing. Please try again and complete the authorization."
          });
          return;
        }
        
        // Handle connection limit errors
        if (error.message.includes('connection limit') || 
            error.message.includes('resource_capped') ||
            error.message.includes('maximum number of connections')) {
          toast.error("Nango Connection Limit Reached", {
            description: "Your Nango account has reached its maximum connections. Please upgrade your plan or disconnect unused connections at https://app.nango.dev",
            duration: 10000,
          });
          return;
        }
        
        // Handle configuration errors
        if (error.message.includes('NANGO_SECRET_KEY') || 
            error.message.includes('integration not configured') ||
            error.message.includes('authentication session')) {
          toast.error("Email integration needs setup", {
            description: "The integration is not properly configured. Please contact support or view setup instructions."
          });
          setShowSetupInstructions(true);
          return;
        }
        
        // Generic error
        toast.error(`Failed to connect ${provider}`, {
          description: error.message
        });
      } else if (data?.success) {
        toast.success(`${provider === 'gmail' ? 'Gmail' : 'Outlook'} connected successfully!`, {
          description: data.connection?.from_email ? `Connected: ${data.connection.from_email}` : undefined
        });
        onSuccess();
        onOpenChange(false);
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      toast.error("Connection failed", {
        description: "An unexpected error occurred. Please try again."
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSMTPConnect = async () => {
    if (!smtpConfig.host || !smtpConfig.username || !smtpConfig.password) {
      toast.error("Please fill in all SMTP fields");
      return;
    }

    setLoading(true);
    try {
      // Test connection first
      const { error: testError } = await nangoClient.testSMTPConnection(smtpConfig);
      if (testError) {
        toast.error("SMTP connection test failed", {
          description: "Please check your SMTP settings and try again."
        });
        setLoading(false);
        return;
      }

      // Save configuration with Direct SMTP as default
      const { error } = await nangoClient.configureSMTP(smtpConfig);
      if (error) {
        toast.error("Failed to save SMTP configuration");
      } else {
        toast.success("SMTP configured successfully!", {
          description: "Your emails will be sent directly from your SMTP server."
        });
        onSuccess();
        onOpenChange(false);
      }
    } catch (error) {
      toast.error("SMTP configuration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            Connect {provider === 'gmail_direct' ? 'Gmail (Direct)' : provider === 'gmail' ? 'Gmail' : provider === 'outlook' ? 'Outlook' : 'Business Email'}
          </DialogTitle>
          <DialogDescription>
            {provider === 'smtp'
              ? 'Enter your email server details to start sending'
              : provider === 'gmail_direct'
              ? 'Sign in with your Google account using direct OAuth'
              : `Sign in with your ${provider === 'gmail' ? 'Google' : 'Microsoft'} account`}
          </DialogDescription>
        </DialogHeader>

        {provider === 'smtp' ? (
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-4">
              <Alert className="border-primary/50 bg-primary/5">
                <Info className="h-4 w-4 text-primary" />
                <AlertDescription className="text-sm">
                  Connect your email server to send messages directly. No verification needed!
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="smtp-host">Email Server Address</Label>
                <Input
                  id="smtp-host"
                  placeholder="mail.yourdomain.com"
                  value={smtpConfig.host}
                  onChange={(e) =>
                    setSMTPConfig({ ...smtpConfig, host: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">Usually starts with "smtp" or "mail"</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="smtp-port">Port Number</Label>
                <Input
                  id="smtp-port"
                  type="number"
                  placeholder="587"
                  value={smtpConfig.port}
                  onChange={(e) =>
                    setSMTPConfig({ ...smtpConfig, port: parseInt(e.target.value) })
                  }
                />
                <p className="text-xs text-muted-foreground">Common ports: 587 or 465</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="smtp-username">Your Email Address</Label>
                <Input
                  id="smtp-username"
                  placeholder="you@yourdomain.com"
                  value={smtpConfig.username}
                  onChange={(e) =>
                    setSMTPConfig({ ...smtpConfig, username: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="smtp-password">Email Password</Label>
                <Input
                  id="smtp-password"
                  type="password"
                  placeholder="••••••••"
                  value={smtpConfig.password}
                  onChange={(e) =>
                    setSMTPConfig({ ...smtpConfig, password: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">Your email account password</p>
              </div>

              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div>
                  <Label htmlFor="smtp-secure" className="cursor-pointer">Secure Connection</Label>
                  <p className="text-xs text-muted-foreground">Recommended for security</p>
                </div>
                <Switch
                  id="smtp-secure"
                  checked={smtpConfig.secure}
                  onCheckedChange={(checked) =>
                    setSMTPConfig({ ...smtpConfig, secure: checked })
                  }
                />
              </div>

              <Button
                onClick={handleSMTPConnect}
                disabled={loading}
                className="w-full"
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Connect Email
              </Button>
            </div>
          </ScrollArea>
        ) : provider === 'gmail_direct' ? (
          <div className="space-y-4">
            <Alert className="border-primary/50 bg-primary/5">
              <Info className="h-4 w-4 text-primary" />
              <AlertDescription className="text-sm">
                Direct Gmail integration. You'll be redirected to Google to sign in, then returned here automatically.
              </AlertDescription>
            </Alert>

            <Button
              onClick={handleDirectGmailConnect}
              disabled={loading}
              className="w-full"
              size="lg"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? 'Connecting...' : 'Sign in with Google'}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {showSetupInstructions ? (
              <NangoSetupInstructions provider={provider as 'gmail' | 'outlook'} />
            ) : (
              <>
                <Alert className="border-primary/50 bg-primary/5">
                  <Info className="h-4 w-4 text-primary" />
                  <AlertDescription className="text-sm">
                    A new window will open to sign in. Make sure pop-ups are allowed in your browser.
                  </AlertDescription>
                </Alert>

                <Button
                  onClick={handleOAuthConnect}
                  disabled={loading}
                  className="w-full"
                  size="lg"
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {loading ? 'Connecting...' : `Sign in with ${provider === 'gmail' ? 'Google' : 'Microsoft'}`}
                </Button>

                <Button
                  variant="link"
                  onClick={() => setShowSetupInstructions(true)}
                  className="w-full text-xs text-muted-foreground"
                >
                  Need help? View instructions
                </Button>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
