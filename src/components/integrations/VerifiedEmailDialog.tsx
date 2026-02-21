import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, AlertTriangle, CheckCircle2, ExternalLink } from 'lucide-react';

interface VerifiedEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: 'resend' | 'sendgrid';
  onSuccess?: () => void;
}

export function VerifiedEmailDialog({ open, onOpenChange, provider, onSuccess }: VerifiedEmailDialogProps) {
  const [fromEmail, setFromEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const providerName = provider === 'resend' ? 'Resend' : 'SendGrid';
  const docsUrl = provider === 'resend' 
    ? 'https://resend.com/domains'
    : 'https://app.sendgrid.com/settings/sender_auth';

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fromEmail) {
      setError('Please enter an email address');
      return;
    }

    if (!validateEmail(fromEmail)) {
      setError('Please enter a valid email address');
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const normalizedEmail = fromEmail.trim().toLowerCase();

      // Check for duplicate: same provider + same from_email (case-insensitive)
      const { data: duplicate } = await supabase
        .from('crm_connections')
        .select('id')
        .eq('user_id', user.id)
        .eq('provider', provider)
        .eq('status', 'active')
        .ilike('from_email', normalizedEmail)
        .maybeSingle();

      if (duplicate) {
        setError(`You already have a ${providerName} sender with ${fromEmail}`);
        setIsSubmitting(false);
        return;
      }

      // Always create a new connection so user can have multiple senders (e.g. sales@talkweb.io + michael.o@bizboosters.co.uk)
      const { error: insertError } = await supabase
        .from('crm_connections')
        .insert({
          user_id: user.id,
          provider,
          connection_id: `${provider}_${Date.now()}`,
          status: 'active',
          from_email: normalizedEmail,
          sending_method: 'api',
          tracking_enabled: true,
          capabilities: {
            opens: true,
            clicks: true,
            replies: true,
            bounces: true,
          },
          metadata: {
            configured_via: 'ui',
            configured_at: new Date().toISOString(),
          }
        });

      if (insertError) throw insertError;

      toast.success(`${providerName} sender added`, {
        description: `Sending from ${fromEmail}`,
      });

      onSuccess?.();
      onOpenChange(false);
      setFromEmail('');
    } catch (err: any) {
      console.error('Error saving email configuration:', err);
      setError(err.message || 'Failed to save configuration');
      toast.error('Failed to save configuration');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add {providerName} Sender</DialogTitle>
          <DialogDescription>
            Add a verified sender email. You can have multiple senders (e.g. different domains) once each is verified in {providerName}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="from-email">Verified Sender Email</Label>
            <Input
              id="from-email"
              type="email"
              placeholder="your-name@yourdomain.com"
              value={fromEmail}
              onChange={(e) => setFromEmail(e.target.value)}
              disabled={isSubmitting}
              required
            />
            <p className="text-xs text-muted-foreground">
              This email must be verified in your {providerName} account
            </p>
          </div>

          <Alert className="border-blue-500/20 bg-blue-500/10">
            <CheckCircle2 className="h-4 w-4 text-blue-500" />
            <AlertDescription className="text-sm text-blue-600 dark:text-blue-400">
              <strong>Important:</strong> Make sure you've verified this email/domain in your {providerName} account before using it.
            </AlertDescription>
          </Alert>

          <Alert className="border-muted">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <div className="space-y-2">
                <p>
                  <strong>Before continuing:</strong> Verify your domain/email in {providerName}:
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => window.open(docsUrl, '_blank')}
                >
                  <ExternalLink className="h-3 w-3 mr-2" />
                  Open {providerName} {provider === 'resend' ? 'Domains' : 'Sender Auth'}
                </Button>
              </div>
            </AlertDescription>
          </Alert>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Configuration
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
