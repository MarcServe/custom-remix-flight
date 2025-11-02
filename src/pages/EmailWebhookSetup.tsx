import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle2, Copy, ExternalLink, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function EmailWebhookSetup() {
  const webhookUrl = `https://kgndpwzqohepotahnfeo.supabase.co/functions/v1/process-inbound-emails`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Email Webhook Setup</h1>
        <p className="text-muted-foreground">
          Configure inbound email webhooks to enable reply detection and auto-responses
        </p>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Important:</strong> You must configure webhooks for your email provider to enable reply detection and auto-response features.
        </AlertDescription>
      </Alert>

      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Webhook Endpoint URL</h2>
        <div className="flex items-center gap-2 p-3 bg-muted rounded-md font-mono text-sm">
          <code className="flex-1 overflow-x-auto">{webhookUrl}</code>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => copyToClipboard(webhookUrl)}
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      </Card>

      <Tabs defaultValue="sendgrid" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="sendgrid">SendGrid Setup</TabsTrigger>
          <TabsTrigger value="resend">Resend Setup</TabsTrigger>
        </TabsList>

        <TabsContent value="sendgrid" className="space-y-4">
          <Card className="p-6 space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm">1</span>
                Go to SendGrid Inbound Parse Settings
              </h3>
              <p className="text-sm text-muted-foreground mb-3">
                Navigate to the SendGrid Inbound Parse configuration page
              </p>
              <Button
                variant="outline"
                onClick={() => window.open('https://app.sendgrid.com/settings/parse', '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open SendGrid Inbound Parse
              </Button>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm">2</span>
                Add MX Record to Your Domain DNS
              </h3>
              <p className="text-sm text-muted-foreground mb-3">
                Add this MX record to your domain's DNS settings (e.g., at your domain registrar like GoDaddy, Namecheap, Cloudflare):
              </p>
              <div className="space-y-2 bg-muted p-4 rounded-md">
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="font-semibold">Type</div>
                  <div className="font-semibold">Hostname</div>
                  <div className="font-semibold">Value</div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm font-mono">
                  <div>MX</div>
                  <div>inbound.yourdomain.com</div>
                  <div>mx.sendgrid.net</div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div></div>
                  <div></div>
                  <div className="font-semibold">Priority: 10</div>
                </div>
              </div>
              <Alert className="mt-3">
                <AlertDescription className="text-xs">
                  Replace <code>yourdomain.com</code> with your actual domain. The subdomain can be anything (e.g., <code>reply</code>, <code>inbound</code>, <code>mail</code>).
                </AlertDescription>
              </Alert>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm">3</span>
                Configure Inbound Parse Webhook
              </h3>
              <p className="text-sm text-muted-foreground mb-3">
                In SendGrid's Inbound Parse settings, add a new host & URL:
              </p>
              <div className="space-y-3 bg-muted p-4 rounded-md text-sm">
                <div>
                  <strong>Hostname:</strong>
                  <code className="ml-2 px-2 py-1 bg-background rounded">inbound.yourdomain.com</code>
                </div>
                <div>
                  <strong>Destination URL:</strong>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="flex-1 px-2 py-1 bg-background rounded overflow-x-auto text-xs">{webhookUrl}</code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(webhookUrl)}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span>Check "POST the raw, full MIME message"</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm">4</span>
                Verify Setup
              </h3>
              <p className="text-sm text-muted-foreground mb-3">
                Send a test email to <code>anything@inbound.yourdomain.com</code> and check the function logs to verify it's received.
              </p>
              <Button
                variant="outline"
                onClick={() => window.open(`https://supabase.com/dashboard/project/kgndpwzqohepotahnfeo/functions/process-inbound-emails/logs`, '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                View Function Logs
              </Button>
            </div>
          </Card>

          <Alert>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription>
              <strong>DNS Propagation:</strong> MX record changes can take 24-48 hours to fully propagate. Use a tool like{' '}
              <a href="https://mxtoolbox.com" target="_blank" rel="noopener noreferrer" className="underline">
                MXToolbox
              </a>{' '}
              to verify your MX records.
            </AlertDescription>
          </Alert>
        </TabsContent>

        <TabsContent value="resend" className="space-y-4">
          <Card className="p-6 space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Note:</strong> Resend inbound email webhooks are currently in beta. Contact Resend support to enable this feature for your account.
              </AlertDescription>
            </Alert>

            <div>
              <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm">1</span>
                Go to Resend Webhooks
              </h3>
              <p className="text-sm text-muted-foreground mb-3">
                Navigate to your Resend dashboard webhooks section
              </p>
              <Button
                variant="outline"
                onClick={() => window.open('https://resend.com/webhooks', '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open Resend Webhooks
              </Button>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm">2</span>
                Create New Webhook
              </h3>
              <p className="text-sm text-muted-foreground mb-3">
                Add a new webhook endpoint with these settings:
              </p>
              <div className="space-y-3 bg-muted p-4 rounded-md text-sm">
                <div>
                  <strong>Endpoint URL:</strong>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="flex-1 px-2 py-1 bg-background rounded overflow-x-auto text-xs">{webhookUrl}</code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(webhookUrl)}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div>
                  <strong>Events to listen for:</strong>
                  <div className="mt-1 space-y-1">
                    <Badge variant="secondary">email.received</Badge>
                    <Badge variant="secondary" className="ml-2">email.delivered</Badge>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm">3</span>
                Test the Webhook
              </h3>
              <p className="text-sm text-muted-foreground mb-3">
                Use Resend's webhook testing tool to send a test event and verify the endpoint is working.
              </p>
              <Button
                variant="outline"
                onClick={() => window.open(`https://supabase.com/dashboard/project/kgndpwzqohepotahnfeo/functions/process-inbound-emails/logs`, '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                View Function Logs
              </Button>
            </div>
          </Card>

          <Alert>
            <AlertDescription>
              <strong>Alternative:</strong> If Resend inbound webhooks aren't available yet, consider using SendGrid's Inbound Parse (see SendGrid tab) which is fully supported and battle-tested.
            </AlertDescription>
          </Alert>
        </TabsContent>
      </Tabs>

      <Card className="p-6 bg-muted/50">
        <h3 className="text-lg font-semibold mb-3">Testing Your Setup</h3>
        <ol className="space-y-2 text-sm list-decimal list-inside">
          <li>Configure the webhook as described above</li>
          <li>Start a sequence with a company and send the first email</li>
          <li>Reply to that email from the recipient's email address</li>
          <li>Check the function logs to verify the webhook received the reply</li>
          <li>Check the Conversations page to see the reply appear in the thread</li>
          <li>If auto-response is enabled, verify an AI response was generated</li>
        </ol>
      </Card>
    </div>
  );
}
