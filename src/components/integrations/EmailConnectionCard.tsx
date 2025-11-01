import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Mail, Check, AlertCircle, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { NangoConnection } from "@/lib/integrations/nango";
import { SMTPModeToggle } from "./SMTPModeToggle";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface EmailConnectionCardProps {
  provider: {
    id: 'gmail' | 'outlook' | 'smtp' | 'verified_email';
    name: string;
    description: string;
    icon: string;
  };
  connection?: NangoConnection;
  onConnect: () => void;
  onDisconnect: (connectionId: string) => void;
}

export function EmailConnectionCard({
  provider,
  connection,
  onConnect,
  onDisconnect,
}: EmailConnectionCardProps) {
  const isConnected = connection?.status === 'active';
  const isPending = connection?.status === 'pending';
  const hasError = connection?.status === 'error';
  const [isUpdatingMode, setIsUpdatingMode] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const currentMode = (connection?.metadata as any)?.smtp_mode || 'direct';
  const hasDirectSMTP = (connection?.metadata as any)?.smtp_host;

  const handleModeChange = async (newMode: 'direct' | 'resend') => {
    if (!connection) return;

    setIsUpdatingMode(true);
    try {
      const { error } = await supabase
        .from('crm_connections')
        .update({
          metadata: {
            ...connection.metadata,
            smtp_mode: newMode,
          },
        })
        .eq('id', connection.id);

      if (error) throw error;

      toast.success(`Using ${newMode === 'direct' ? 'your email server' : 'cloud relay'} now`);

      // Trigger a refresh
      window.location.reload();
    } catch (error: any) {
      toast.error(error.message || "Failed to update mode. Please try again.");
    } finally {
      setIsUpdatingMode(false);
    }
  };

  return (
    <Card className="hover:shadow-lg transition-all">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="text-3xl">{provider.icon}</div>
            <div>
              <CardTitle className="text-base">{provider.name}</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                {provider.description}
              </CardDescription>
            </div>
          </div>
          {isConnected && (
            <Badge variant="outline" className="bg-success/10 text-success border-success/20">
              <Check className="h-3 w-3 mr-1" />
              Connected
            </Badge>
          )}
          {isPending && (
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              Setting up...
            </Badge>
          )}
          {hasError && (
            <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
              <AlertCircle className="h-3 w-3 mr-1" />
              Issue
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {connection && (
          <>
            {(connection.from_email || connection.metadata?.email) && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{connection.from_email || connection.metadata?.email}</span>
              </div>
            )}
            
            <Collapsible open={showDetails} onOpenChange={setShowDetails}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full justify-between text-xs h-7">
                  <span className="text-muted-foreground">
                    {showDetails ? 'Hide details' : 'Show details'}
                  </span>
                  {showDetails ? (
                    <ChevronUp className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2 pt-2">
                {connection.verified_at && (
                  <p className="text-xs text-muted-foreground">
                    ✓ Verified and ready to use
                  </p>
                )}
                {connection.last_sync_at && (
                  <p className="text-xs text-muted-foreground">
                    Last active: Recently
                  </p>
                )}
              </CollapsibleContent>
            </Collapsible>
            
            {hasError && (connection as any).error_message && (
              <Alert variant="destructive" className="mt-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  <strong>Connection Issue:</strong> {(connection as any).error_message}
                  <br />
                  <span className="text-xs mt-1 block">
                    Try reconnecting your account or check your email provider settings.
                  </span>
                </AlertDescription>
              </Alert>
            )}
          </>
        )}

        {/* SMTP Mode Toggle - Only show for SMTP provider if connected and has direct SMTP configured */}
        {provider.id === 'smtp' && isConnected && hasDirectSMTP && (
          <SMTPModeToggle
            mode={currentMode}
            onModeChange={handleModeChange}
            isLoading={isUpdatingMode}
          />
        )}
        
        <div className="flex gap-2 pt-1">
          {isConnected ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => connection && onDisconnect(connection.id)}
              className="w-full"
            >
              Disconnect
            </Button>
          ) : isPending ? (
            <Button
              disabled
              size="sm"
              className="w-full"
            >
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Setting up...
            </Button>
          ) : (
            <Button
              onClick={onConnect}
              size="sm"
              className="w-full"
            >
              Connect
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
