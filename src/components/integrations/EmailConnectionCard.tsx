import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, Check, AlertCircle, Unplug, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { NangoConnection } from "@/lib/integrations/nango";
import { SMTPModeToggle } from "./SMTPModeToggle";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

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

  const currentMode = (connection?.metadata as any)?.smtp_mode || 'resend';
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

      toast({
        title: "SMTP mode updated",
        description: `Now using ${newMode === 'direct' ? 'Direct SMTP' : 'Resend Relay'}`,
      });

      // Trigger a refresh
      window.location.reload();
    } catch (error: any) {
      toast({
        title: "Failed to update mode",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsUpdatingMode(false);
    }
  };

  const providerColors: Record<string, string> = {
    gmail: "bg-red-50 text-red-600 border-red-200",
    outlook: "bg-blue-50 text-blue-600 border-blue-200",
    smtp: "bg-purple-50 text-purple-600 border-purple-200",
    verified_email: "bg-green-50 text-green-600 border-green-200",
  };

  return (
    <Card className={`${providerColors[provider.id]} border-2`}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="text-4xl">{provider.icon}</div>
            <div>
              <CardTitle className="text-lg">{provider.name}</CardTitle>
              <CardDescription className="text-sm">
                {provider.description}
              </CardDescription>
            </div>
          </div>
          {isConnected && (
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              <Check className="h-3 w-3 mr-1" />
              Connected
            </Badge>
          )}
          {isPending && (
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              Connecting
            </Badge>
          )}
          {hasError && (
            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
              <AlertCircle className="h-3 w-3 mr-1" />
              Error
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {connection && (
          <>
            {connection.from_email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4" />
                <span className="font-medium">{connection.from_email}</span>
              </div>
            )}
            {connection.metadata?.email && !connection.from_email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4" />
                <span className="font-medium">{connection.metadata.email}</span>
              </div>
            )}
            {connection.verified_at && (
              <p className="text-xs text-muted-foreground">
                Verified: {format(new Date(connection.verified_at), "MMM dd, yyyy 'at' h:mm a")}
              </p>
            )}
            {connection.last_sync_at && (
              <p className="text-xs text-muted-foreground">
                Last synced: {format(new Date(connection.last_sync_at), "MMM dd, yyyy 'at' h:mm a")}
              </p>
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
        
        <div className="flex gap-2">
          {isConnected ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => connection && onDisconnect(connection.id)}
              className="w-full"
            >
              <Unplug className="h-4 w-4 mr-2" />
              Disconnect
            </Button>
          ) : isPending ? (
            <Button
              disabled
              size="sm"
              className="w-full"
            >
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Connecting...
            </Button>
          ) : (
            <Button
              onClick={onConnect}
              size="sm"
              className="w-full"
            >
              Connect {provider.name}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
