import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SMTPModeToggle } from "./SMTPModeToggle";
import { ProviderConnectionTest } from "./ProviderConnectionTest";
import { CheckCircle2, XCircle, ChevronDown, AlertTriangle, Loader2, CheckCircle, Clock, AlertCircle, Mail } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface NangoConnection {
  id: string;
  connection_id: string;
  provider: string;
  status: string;
  from_email?: string;
  verified_at?: string;
  last_sync_at?: string;
  metadata?: any;
}

interface ProviderCapabilities {
  tracking: boolean;
  opens: boolean;
  clicks: boolean;
  replies: boolean;
  bounceDetection: boolean;
  dailyLimit: number | null;
  webhookSupport: boolean;
  advancedAnalytics?: boolean;
  sendingMethod: 'api' | 'direct' | 'relay';
}

interface EmailProvider {
  id: string;
  name: string;
  description: string;
  icon: string;
  isGoogleIcon?: boolean;
  isOutlookIcon?: boolean;
  capabilities: ProviderCapabilities;
}

interface EmailProviderCardProps {
  provider: EmailProvider;
  connection?: NangoConnection;
  onConnect: () => void;
  onDisconnect: (connectionId: string) => void;
}

export function EmailProviderCard({ provider, connection, onConnect, onDisconnect }: EmailProviderCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [isUpdatingMode, setIsUpdatingMode] = useState(false);

  const isConnected = connection && connection.status === 'active';
  const isPending = connection && connection.status === 'pending';
  const hasIssue = connection && connection.status === 'error';
  
  // Assign different gradient styles to each provider
  const getCardStyle = () => {
    switch(provider.id) {
      case 'gmail_direct':
        return 'bg-gradient-card border-primary/30 hover-lift shadow-lg';
      case 'resend':
        return 'bg-gradient-secondary border-secondary/30 hover-lift shadow-lg';
      case 'sendgrid':
        return 'bg-gradient-warm border-primary/30 hover-lift shadow-lg';
      case 'outlook':
        return 'bg-gradient-accent text-white border-accent/30 hover-lift shadow-lg';
      case 'smtp':
        return 'bg-gradient-card border-border hover-lift shadow-md';
      default:
        return 'bg-gradient-card border-border hover-lift shadow-md';
    }
  };
  
  const getButtonVariant = () => {
    switch(provider.id) {
      case 'gmail_direct':
        return 'default';
      case 'resend':
        return 'accent';
      case 'sendgrid':
        return 'warm';
      case 'outlook':
        return 'secondary';
      case 'smtp':
        return 'glow';
      default:
        return 'default';
    }
  };

  const handleModeChange = async (mode: 'direct' | 'resend') => {
    if (!connection) return;
    
    setIsUpdatingMode(true);
    try {
      const { error } = await supabase
        .from('crm_connections')
        .update({ metadata: { ...connection.metadata, smtp_mode: mode } })
        .eq('id', connection.id);

      if (error) throw error;
      
      toast.success(`Switched to ${mode === 'direct' ? 'Direct SMTP' : 'Resend Relay'}`);
    } catch (error) {
      console.error('Error updating SMTP mode:', error);
      toast.error('Failed to update SMTP mode');
    } finally {
      setIsUpdatingMode(false);
    }
  };

  return (
    <Card className={`relative hover:shadow-lg transition-shadow ${!provider.capabilities.tracking ? 'border-warning/30' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {provider.isGoogleIcon ? (
              <img src={provider.icon} alt={provider.name} className="w-8 h-8" />
            ) : provider.isOutlookIcon ? (
              <div className="w-8 h-8 flex items-center justify-center rounded-md bg-blue-600">
                <Mail className="w-5 h-5 text-white" />
              </div>
            ) : (
              <div className="text-2xl">{provider.icon}</div>
            )}
            <div>
              <CardTitle className="text-base">{provider.name}</CardTitle>
              <CardDescription className="text-xs">{provider.description}</CardDescription>
            </div>
          </div>
          {isConnected && (
            <Badge variant="outline" className="bg-success/10 text-success border-success/20">
              <CheckCircle className="h-3 w-3 mr-1" />
              Connected
            </Badge>
          )}
          {isPending && (
            <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">
              <Clock className="h-3 w-3 mr-1" />
              Setting up
            </Badge>
          )}
          {hasIssue && (
            <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
              <AlertCircle className="h-3 w-3 mr-1" />
              Issue
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3 pt-3">
        {/* Compact Capabilities */}
        <div className="flex flex-wrap gap-1.5">
          {provider.capabilities.tracking && (
            <>
              <Badge variant="outline" className="text-xs border-success/30 bg-success/5 text-success">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Tracking
              </Badge>
              <Badge variant="outline" className="text-xs border-success/30 bg-success/5 text-success">
                Webhooks
              </Badge>
            </>
          )}
          {!provider.capabilities.tracking && (
            <Badge variant="outline" className="text-xs border-destructive/30 bg-destructive/5 text-destructive">
              <XCircle className="h-3 w-3 mr-1" />
              No Tracking
            </Badge>
          )}
          {provider.capabilities.dailyLimit ? (
            <Badge variant="outline" className="text-xs border-warning/30 bg-warning/5 text-warning">
              {provider.capabilities.dailyLimit}/day
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs border-primary/30 bg-primary/5">
              Unlimited
            </Badge>
          )}
        </div>

        {/* Warning for SMTP without tracking */}
        {!provider.capabilities.tracking && isConnected && (
          <Alert className="border-warning bg-warning/10">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <AlertDescription className="text-sm text-warning">
              <strong>No Tracking:</strong> Emails sent via direct SMTP cannot be tracked. 
              Switch to Resend relay to enable engagement tracking.
            </AlertDescription>
          </Alert>
        )}

        {/* Connection Details - Always show for API providers, collapsible for others */}
        {isConnected && connection && (
          <>
            {['resend', 'sendgrid'].includes(provider.id) ? (
              // Always show email for API providers
              <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
                {connection.from_email && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Sending from:</span>
                    <span className="font-mono font-medium">{connection.from_email}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="h-3 w-3 text-success" />
                  <span>Configured and ready to send</span>
                </div>
              </div>
            ) : (
              // Collapsible for OAuth/SMTP providers
              <Collapsible open={showDetails} onOpenChange={setShowDetails}>
                <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <ChevronDown className={`h-4 w-4 transition-transform ${showDetails ? 'transform rotate-180' : ''}`} />
                  Connection Details
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-3 space-y-2">
                  {connection.from_email && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Email:</span>
                      <span className="font-mono">{connection.from_email}</span>
                    </div>
                  )}
                  {connection.verified_at && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Verified:</span>
                      <span className="text-success flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        {new Date(connection.verified_at).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  {connection.last_sync_at && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Last Active:</span>
                      <span>{new Date(connection.last_sync_at).toLocaleDateString()}</span>
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>
            )}
          </>
        )}

        {/* Error Message */}
        {hasIssue && connection?.metadata?.error && (
          <Alert className="border-destructive bg-destructive/10">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <AlertDescription className="text-sm text-destructive">
              {connection.metadata.error}
            </AlertDescription>
          </Alert>
        )}

        {/* SMTP Mode Toggle */}
        {isConnected && provider.id === 'smtp' && connection?.metadata?.smtp_direct && (
          <SMTPModeToggle
            mode={connection.metadata.smtp_mode || 'direct'}
            onModeChange={handleModeChange}
            isLoading={isUpdatingMode}
          />
        )}

        {/* Connection Test - Only show for connected providers */}
        {isConnected && connection && (
          <ProviderConnectionTest
            provider={provider.id}
            connectionId={connection.connection_id || ''}
          />
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          {!isConnected && !isPending && (
            <Button onClick={onConnect} size="sm" variant={getButtonVariant() as any} className="w-full">
              Connect
            </Button>
          )}
          {isConnected && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => connection && onDisconnect(connection.id)}
              className="w-full"
            >
              Disconnect
            </Button>
          )}
          {isPending && (
            <Button disabled size="sm" className="w-full">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Setting up...
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
