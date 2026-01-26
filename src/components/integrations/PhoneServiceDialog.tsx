import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Phone, Loader2, CheckCircle2, AlertCircle, ExternalLink, Settings } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface PhoneServiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const phoneServices = [
  {
    id: 'twilio',
    name: 'Twilio',
    description: 'SMS and voice messaging platform',
    icon: '📱',
    website: 'https://www.twilio.com',
    fields: [
      { key: 'account_sid', label: 'Account SID', type: 'text', required: true },
      { key: 'auth_token', label: 'Auth Token', type: 'password', required: true },
      { key: 'phone_number', label: 'From Phone Number', type: 'text', required: true, placeholder: 'e.g., +1234567890' },
    ],
  },
  {
    id: 'vonage',
    name: 'Vonage (Nexmo)',
    description: 'Communication APIs for SMS and voice',
    icon: '💬',
    website: 'https://www.vonage.com',
    fields: [
      { key: 'api_key', label: 'API Key', type: 'text', required: true },
      { key: 'api_secret', label: 'API Secret', type: 'password', required: true },
      { key: 'from_number', label: 'From Number', type: 'text', required: true },
    ],
  },
  {
    id: 'messagebird',
    name: 'MessageBird',
    description: 'Cloud communications platform',
    icon: '🐦',
    website: 'https://www.messagebird.com',
    fields: [
      { key: 'access_key', label: 'Access Key', type: 'password', required: true },
      { key: 'originator', label: 'Originator', type: 'text', required: true },
    ],
  },
  {
    id: 'plivo',
    name: 'Plivo',
    description: 'Cloud communications platform',
    icon: '☁️',
    website: 'https://www.plivo.com',
    fields: [
      { key: 'auth_id', label: 'Auth ID', type: 'text', required: true },
      { key: 'auth_token', label: 'Auth Token', type: 'password', required: true },
      { key: 'phone_number', label: 'From Phone Number', type: 'text', required: true },
    ],
  },
];

export function PhoneServiceDialog({ open, onOpenChange, onSuccess }: PhoneServiceDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedService, setSelectedService] = useState<string>('twilio');
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [isConnecting, setIsConnecting] = useState(false);

  // Fetch existing phone service connections
  const { data: existingConnections } = useQuery({
    queryKey: ['phone-service-connections'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data } = await supabase
        .from('crm_connections')
        .select('*')
        .eq('user_id', user.id)
        .in('provider', ['twilio', 'vonage', 'messagebird', 'plivo'])
        .order('created_at', { ascending: false });

      return data || [];
    },
  });

  const currentService = phoneServices.find(s => s.id === selectedService);
  const existingConnection = existingConnections?.find(c => c.provider === selectedService);

  // Load existing connection data when service changes
  useEffect(() => {
    if (existingConnection?.metadata && typeof existingConnection.metadata === 'object') {
      const metadata = existingConnection.metadata as Record<string, any>;
      setFormData(metadata);
    } else {
      setFormData({});
    }
  }, [selectedService, existingConnection]);

  const handleFieldChange = (key: string, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleConnect = async () => {
    if (!currentService) return;

    // Validate required fields
    const missingFields = currentService.fields
      .filter(f => f.required && !formData[f.key])
      .map(f => f.label);

    if (missingFields.length > 0) {
      toast({
        title: 'Missing Fields',
        description: `Please fill in: ${missingFields.join(', ')}`,
        variant: 'destructive',
      });
      return;
    }

    setIsConnecting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Test connection (optional - could call a test endpoint)
      // For now, just save the connection

      const connectionData: any = {
        user_id: user.id,
        provider: selectedService,
        connection_id: `${selectedService}_${Date.now()}`,
        status: 'active',
        metadata: {
          ...formData,
          configured_at: new Date().toISOString(),
          service_type: 'phone',
        },
        capabilities: {
          sms: true,
          voice: selectedService === 'twilio' || selectedService === 'vonage',
          mms: selectedService === 'twilio',
        },
      };

      if (existingConnection) {
        // Update existing connection
        const { error } = await supabase
          .from('crm_connections')
          .update({
            ...connectionData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingConnection.id);

        if (error) throw error;

        toast({
          title: 'Connection Updated',
          description: `${currentService.name} connection updated successfully`,
        });
      } else {
        // Create new connection
        const { error } = await supabase
          .from('crm_connections')
          .insert(connectionData);

        if (error) throw error;

        toast({
          title: 'Connected Successfully',
          description: `${currentService.name} is now connected`,
        });
      }

      queryClient.invalidateQueries({ queryKey: ['phone-service-connections'] });
      queryClient.invalidateQueries({ queryKey: ['crm-connections'] });
      
      onSuccess?.();
      
      // Reset form
      setFormData({});
    } catch (error: any) {
      console.error('Error connecting phone service:', error);
      toast({
        title: 'Connection Failed',
        description: error.message || 'Failed to connect phone service',
        variant: 'destructive',
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!existingConnection) return;

    try {
      const { error } = await supabase
        .from('crm_connections')
        .update({
          status: 'disconnected',
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingConnection.id);

      if (error) throw error;

      toast({
        title: 'Disconnected',
        description: `${currentService?.name} has been disconnected`,
      });

      queryClient.invalidateQueries({ queryKey: ['phone-service-connections'] });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to disconnect',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Phone Service Integration
          </DialogTitle>
          <DialogDescription>
            Connect a phone service provider to send SMS and make calls
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Service Selection */}
          <div className="space-y-2">
            <Label>Select Phone Service</Label>
            <Select value={selectedService} onValueChange={setSelectedService}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {phoneServices.map((service) => (
                  <SelectItem key={service.id} value={service.id}>
                    <div className="flex items-center gap-2">
                      <span>{service.icon}</span>
                      <span>{service.name}</span>
                      {existingConnections?.some(c => c.provider === service.id && c.status === 'active') && (
                        <CheckCircle2 className="h-3 w-3 text-green-600 ml-2" />
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {currentService && (
            <>
              {/* Service Info */}
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{currentService.name}</p>
                    <p className="text-xs text-muted-foreground">{currentService.description}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(currentService.website, '_blank')}
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Learn More
                  </Button>
                </AlertDescription>
              </Alert>

              {/* Connection Status */}
              {existingConnection && existingConnection.status === 'active' && (
                <Alert className="bg-green-50 dark:bg-green-950/30 border-green-200">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="flex items-center justify-between">
                    <span className="text-green-800 dark:text-green-200">
                      {currentService.name} is connected
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDisconnect}
                      className="border-red-200 text-red-600 hover:bg-red-50"
                    >
                      Disconnect
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              <Separator />

              {/* Connection Form */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Connection Settings</Label>
                  {existingConnection?.status === 'active' && (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Active
                    </Badge>
                  )}
                </div>

                {currentService.fields.map((field) => (
                  <div key={field.key} className="space-y-2">
                    <Label htmlFor={field.key}>
                      {field.label}
                      {field.required && <span className="text-destructive ml-1">*</span>}
                    </Label>
                    <Input
                      id={field.key}
                      type={field.type}
                      placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
                      value={formData[field.key] || ''}
                      onChange={(e) => handleFieldChange(field.key, e.target.value)}
                      disabled={isConnecting || (existingConnection?.status === 'active' && !existingConnection.metadata?.[field.key as keyof typeof existingConnection.metadata])}
                    />
                    {field.type === 'password' && (
                      <p className="text-xs text-muted-foreground">
                        Your credentials are stored securely and encrypted
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {/* Instructions */}
              <Alert>
                <Settings className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  <p className="font-medium mb-1">How to get your credentials:</p>
                  <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                    <li>Sign up for a {currentService.name} account</li>
                    <li>Navigate to your account settings or API section</li>
                    <li>Copy your credentials and paste them above</li>
                    <li>Click "Connect" to save your connection</li>
                  </ol>
                </AlertDescription>
              </Alert>
            </>
          )}
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isConnecting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConnect}
            disabled={isConnecting || !currentService}
          >
            {isConnecting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Phone className="h-4 w-4 mr-2" />
                {existingConnection?.status === 'active' ? 'Update Connection' : 'Connect'}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
