import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SMTPModeToggle } from "./SMTPModeToggle";
import { ProviderConnectionTest } from "./ProviderConnectionTest";
import { CheckCircle2, XCircle, ChevronDown, AlertTriangle, Loader2, CheckCircle, Clock, AlertCircle } from "lucide-react";
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
    <Card className={`relative ${!provider.capabilities.tracking ? 'border-warning/30' : ''}`}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="text-3xl">{provider.icon}</div>
            <div>
              <CardTitle className="text-lg">{provider.name}</CardTitle>
              <CardDescription>{provider.description}</CardDescription>
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
      
      <CardContent className="space-y-4">
        {/* Capabilities Section */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Capabilities</p>
          <div className="space-y-1.5">
            {provider.capabilities.tracking ? (
              <>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <span>Opens/Clicks tracked</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <span>Bounce detection</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <span>Reply monitoring</span>
                </div>
                {provider.capabilities.webhookSupport && (
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    <span>Webhook integration built-in</span>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center gap-2 text-sm">
                <XCircle className="h-4 w-4 text-destructive" />
                <span>NO tracking (opens/clicks/replies)</span>
              </div>
            )}
            
            {provider.capabilities.dailyLimit ? (
              <div className="flex items-center gap-2 text-sm">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <span>Daily send limit: {provider.capabilities.dailyLimit}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <span>No daily limits</span>
              </div>
            )}
          </div>
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

        {/* Connection Details */}
        {isConnected && connection && (
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

        {/* Connection Test - Only for OAuth/SMTP providers with actual connection records */}
        {isConnected && connection && !['resend', 'sendgrid'].includes(provider.id) && (
          <ProviderConnectionTest
            provider={provider.id}
            connectionId={connection.connection_id}
          />
        )}
        
        {/* API-key provider test - For Resend/SendGrid */}
        {['resend', 'sendgrid'].includes(provider.id) && (
          <ProviderConnectionTest
            provider={provider.id}
            connectionId="" 
          />
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          {!isConnected && !isPending && (
            <Button onClick={onConnect} className="w-full">
              Connect {provider.name}
            </Button>
          )}
          {isConnected && (
            <Button 
              variant="outline" 
              onClick={() => connection && onDisconnect(connection.id)}
              className="w-full"
            >
              Disconnect
            </Button>
          )}
          {isPending && (
            <Button disabled className="w-full">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Setting up...
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
