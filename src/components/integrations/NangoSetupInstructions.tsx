import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ExternalLink, AlertTriangle } from "lucide-react";

interface NangoSetupInstructionsProps {
  provider: 'gmail' | 'outlook';
}

export function NangoSetupInstructions({ provider }: NangoSetupInstructionsProps) {
  const integrationName = provider === 'gmail' ? 'google-mail' : 'microsoft-outlook';
  const providerName = provider === 'gmail' ? 'Google' : 'Microsoft';

  return (
    <Alert className="border-yellow-500/50 bg-yellow-500/10">
      <AlertTriangle className="h-4 w-4 text-yellow-500" />
      <AlertTitle className="text-yellow-500">Configuration Required</AlertTitle>
      <AlertDescription className="space-y-3 text-sm mt-2">
        <p>
          The {providerName} email integration needs to be configured before you can connect. 
          Please complete the following steps:
        </p>
        
        <div className="space-y-2 pl-4">
          <div className="flex items-start gap-2">
            <span className="font-semibold text-foreground">1.</span>
            <div>
              <p className="font-medium text-foreground">Configure Nango Integration</p>
              <p className="text-muted-foreground">
                Set up the <code className="bg-muted px-1 py-0.5 rounded text-xs">{integrationName}</code> integration 
                in your Nango dashboard with the required OAuth credentials.
              </p>
              <Button
                variant="link"
                className="h-auto p-0 text-blue-500 hover:text-blue-600"
                onClick={() => window.open('https://app.nango.dev/integrations', '_blank')}
              >
                Open Nango Integrations
                <ExternalLink className="ml-1 h-3 w-3" />
              </Button>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <span className="font-semibold text-foreground">2.</span>
            <div>
              <p className="font-medium text-foreground">Set OAuth Scopes</p>
              <p className="text-muted-foreground">
                Ensure the integration has the following scopes enabled:
              </p>
              {provider === 'gmail' ? (
                <ul className="list-disc list-inside text-xs text-muted-foreground ml-2 mt-1">
                  <li><code className="bg-muted px-1 py-0.5 rounded">https://www.googleapis.com/auth/gmail.send</code></li>
                  <li><code className="bg-muted px-1 py-0.5 rounded">https://www.googleapis.com/auth/gmail.readonly</code></li>
                </ul>
              ) : (
                <ul className="list-disc list-inside text-xs text-muted-foreground ml-2 mt-1">
                  <li><code className="bg-muted px-1 py-0.5 rounded">Mail.Send</code></li>
                  <li><code className="bg-muted px-1 py-0.5 rounded">Mail.Read</code></li>
                </ul>
              )}
            </div>
          </div>

          <div className="flex items-start gap-2">
            <span className="font-semibold text-foreground">3.</span>
            <div>
              <p className="font-medium text-foreground">Verify NANGO_SECRET_KEY</p>
              <p className="text-muted-foreground">
                Confirm that your <code className="bg-muted px-1 py-0.5 rounded text-xs">NANGO_SECRET_KEY</code> is 
                properly set in Supabase Edge Function secrets.
              </p>
              <Button
                variant="link"
                className="h-auto p-0 text-blue-500 hover:text-blue-600"
                onClick={() => window.open('https://supabase.com/dashboard/project/kgndpwzqohepotahnfeo/settings/functions', '_blank')}
              >
                Open Supabase Secrets
                <ExternalLink className="ml-1 h-3 w-3" />
              </Button>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <span className="font-semibold text-foreground">4.</span>
            <div>
              <p className="font-medium text-foreground">Configure OAuth Redirect URLs</p>
              <p className="text-muted-foreground">
                Add your application URLs to the {providerName} OAuth configuration:
              </p>
              <ul className="list-disc list-inside text-xs text-muted-foreground ml-2 mt-1">
                <li>Authorized JavaScript origins: <code className="bg-muted px-1 py-0.5 rounded">{window.location.origin}</code></li>
                <li>Redirect URLs: Configure in Nango dashboard</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="pt-2 mt-2 border-t border-border">
          <p className="text-xs text-muted-foreground">
            Need help? Check the{" "}
            <a
              href="https://docs.nango.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              Nango documentation
            </a>
            {" "}for detailed setup instructions.
          </p>
        </div>
      </AlertDescription>
    </Alert>
  );
}
