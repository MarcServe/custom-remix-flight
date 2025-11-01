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
import { Loader2, Info } from "lucide-react";
import { toast } from "sonner";
import { nangoClient } from "@/lib/integrations/nango";
import { NangoSetupInstructions } from "./NangoSetupInstructions";

interface ConnectEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: 'gmail' | 'outlook' | 'smtp';
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
        toast.error("SMTP connection test failed");
        setLoading(false);
        return;
      }

      // Save configuration
      const { error } = await nangoClient.configureSMTP(smtpConfig);
      if (error) {
        toast.error("Failed to save SMTP configuration");
      } else {
        toast.success("SMTP configured successfully");
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
            Connect {provider === 'gmail' ? 'Gmail' : provider === 'outlook' ? 'Outlook' : 'SMTP'}
          </DialogTitle>
          <DialogDescription>
            {provider === 'smtp'
              ? 'Configure your SMTP server settings'
              : `Authorize access to your ${provider} account`}
          </DialogDescription>
        </DialogHeader>

        {provider === 'smtp' ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="smtp-host">SMTP Host</Label>
              <Input
                id="smtp-host"
                placeholder="smtp.example.com"
                value={smtpConfig.host}
                onChange={(e) =>
                  setSMTPConfig({ ...smtpConfig, host: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="smtp-port">Port</Label>
              <Input
                id="smtp-port"
                type="number"
                placeholder="587"
                value={smtpConfig.port}
                onChange={(e) =>
                  setSMTPConfig({ ...smtpConfig, port: parseInt(e.target.value) })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="smtp-username">Username / Email</Label>
              <Input
                id="smtp-username"
                placeholder="user@example.com"
                value={smtpConfig.username}
                onChange={(e) =>
                  setSMTPConfig({ ...smtpConfig, username: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="smtp-password">Password</Label>
              <Input
                id="smtp-password"
                type="password"
                placeholder="••••••••"
                value={smtpConfig.password}
                onChange={(e) =>
                  setSMTPConfig({ ...smtpConfig, password: e.target.value })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="smtp-secure">Use TLS/SSL</Label>
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
              Test & Save Configuration
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {showSetupInstructions ? (
              <NangoSetupInstructions provider={provider as 'gmail' | 'outlook'} />
            ) : (
              <>
                <Alert className="border-blue-500/50 bg-blue-500/10">
                  <Info className="h-4 w-4 text-blue-500" />
                  <AlertDescription className="text-sm">
                    A popup window will open for {provider === 'gmail' ? 'Google' : 'Microsoft'} authorization. 
                    {' '}<strong>Please allow popups for this site.</strong>
                    {' '}If you don't see the popup, check your browser's address bar for a blocked popup icon.
                  </AlertDescription>
                </Alert>

                <Button
                  onClick={handleOAuthConnect}
                  disabled={loading}
                  className="w-full"
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Continue with {provider === 'gmail' ? 'Google' : 'Microsoft'}
                </Button>

                <Button
                  variant="link"
                  onClick={() => setShowSetupInstructions(true)}
                  className="w-full text-xs text-muted-foreground"
                >
                  Having trouble connecting? View setup instructions
                </Button>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
