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
import { Loader2, Info, Sparkles, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { nangoClient } from "@/lib/integrations/nango";
import { gmailDirectClient } from "@/lib/integrations/gmail-direct";
import { NangoSetupInstructions } from "./NangoSetupInstructions";
import { EMAIL_PROVIDER_CONFIG } from "@/config/email-providers";

// ── SMTP auto-detect lookup ───────────────────────────────────────────────────
interface SmtpPreset { label: string; host: string; port: number; secure: boolean; note?: string; viaDetection?: string }

/** Known domain → SMTP preset (for consumer webmail) */
const SMTP_DOMAIN_PRESETS: Record<string, SmtpPreset> = {
  // Google consumer
  'gmail.com':           { label: 'Gmail',                host: 'smtp.gmail.com',              port: 587, secure: true,  note: 'Use an App Password, not your regular password.' },
  'googlemail.com':      { label: 'Gmail',                host: 'smtp.gmail.com',              port: 587, secure: true,  note: 'Use an App Password, not your regular password.' },
  // Microsoft consumer
  'outlook.com':         { label: 'Outlook.com',          host: 'smtp.office365.com',          port: 587, secure: true  },
  'hotmail.com':         { label: 'Hotmail',              host: 'smtp.office365.com',          port: 587, secure: true  },
  'live.com':            { label: 'Microsoft Live',       host: 'smtp.office365.com',          port: 587, secure: true  },
  'live.co.uk':          { label: 'Microsoft Live',       host: 'smtp.office365.com',          port: 587, secure: true  },
  'msn.com':             { label: 'MSN Mail',             host: 'smtp.office365.com',          port: 587, secure: true  },
  // Yahoo
  'yahoo.com':           { label: 'Yahoo Mail',           host: 'smtp.mail.yahoo.com',         port: 587, secure: true,  note: 'Use an App Password from Yahoo account security.' },
  'yahoo.co.uk':         { label: 'Yahoo Mail UK',        host: 'smtp.mail.yahoo.com',         port: 587, secure: true,  note: 'Use an App Password from Yahoo account security.' },
  'yahoo.com.au':        { label: 'Yahoo Mail AU',        host: 'smtp.mail.yahoo.com',         port: 587, secure: true  },
  'ymail.com':           { label: 'Yahoo Mail',           host: 'smtp.mail.yahoo.com',         port: 587, secure: true  },
  // Zoho (consumer addresses)
  'zoho.com':            { label: 'Zoho Mail',            host: 'smtp.zoho.com',               port: 587, secure: true  },
  'zohomail.com':        { label: 'Zoho Mail',            host: 'smtp.zoho.com',               port: 587, secure: true  },
  // Apple
  'icloud.com':          { label: 'iCloud Mail',          host: 'smtp.mail.me.com',            port: 587, secure: true,  note: 'Use an App-Specific Password from Apple ID settings.' },
  'me.com':              { label: 'iCloud Mail',          host: 'smtp.mail.me.com',            port: 587, secure: true,  note: 'Use an App-Specific Password from Apple ID settings.' },
  'mac.com':             { label: 'iCloud Mail',          host: 'smtp.mail.me.com',            port: 587, secure: true  },
  // ProtonMail (Bridge required)
  'proton.me':           { label: 'ProtonMail',           host: '127.0.0.1',                   port: 1025, secure: false, note: 'Requires Proton Bridge running locally.' },
  'protonmail.com':      { label: 'ProtonMail',           host: '127.0.0.1',                   port: 1025, secure: false, note: 'Requires Proton Bridge running locally.' },
  'pm.me':               { label: 'ProtonMail',           host: '127.0.0.1',                   port: 1025, secure: false, note: 'Requires Proton Bridge running locally.' },
  // Fastmail
  'fastmail.com':        { label: 'Fastmail',             host: 'smtp.fastmail.com',           port: 587, secure: true  },
  'fastmail.fm':         { label: 'Fastmail',             host: 'smtp.fastmail.com',           port: 587, secure: true  },
  // AOL
  'aol.com':             { label: 'AOL Mail',             host: 'smtp.aol.com',                port: 587, secure: true  },
  // GMX
  'gmx.com':             { label: 'GMX Mail',             host: 'mail.gmx.com',                port: 587, secure: true  },
  'gmx.net':             { label: 'GMX Mail',             host: 'mail.gmx.net',                port: 587, secure: true  },
  // Web.de
  'web.de':              { label: 'Web.de',               host: 'smtp.web.de',                 port: 587, secure: true  },
};

/**
 * MX record substring → SMTP preset (for custom business domains).
 * Ordered from most-specific to least-specific. First match wins.
 */
const MX_PRESETS: Array<{ match: string; preset: SmtpPreset }> = [
  // Google Workspace
  { match: 'google.com',         preset: { label: 'Google Workspace',   host: 'smtp.gmail.com',          port: 587, secure: true,  note: 'Use an App Password from your Google account.' } },
  { match: 'googlemail.com',     preset: { label: 'Google Workspace',   host: 'smtp.gmail.com',          port: 587, secure: true,  note: 'Use an App Password from your Google account.' } },
  // Microsoft 365 / Exchange Online
  { match: 'outlook.com',        preset: { label: 'Microsoft 365',      host: 'smtp.office365.com',      port: 587, secure: true  } },
  { match: 'protection.outlook', preset: { label: 'Microsoft 365',      host: 'smtp.office365.com',      port: 587, secure: true  } },
  // Zoho Business
  { match: 'zoho.com',           preset: { label: 'Zoho Mail Business', host: 'smtp.zoho.com',           port: 587, secure: true  } },
  // ProtonMail Business
  { match: 'protonmail.ch',      preset: { label: 'ProtonMail Business',host: '127.0.0.1',               port: 1025, secure: false, note: 'Requires Proton Bridge running locally.' } },
  // Fastmail Business
  { match: 'fastmail.com',       preset: { label: 'Fastmail Business',  host: 'smtp.fastmail.com',       port: 587, secure: true  } },
  // Hostinger
  { match: 'hostinger.com',      preset: { label: 'Hostinger',          host: 'smtp.hostinger.com',      port: 587, secure: true,  note: 'Use your full email and webmail password.' } },
  // Namecheap Private Email
  { match: 'privateemail.com',   preset: { label: 'Namecheap Private Email', host: 'mail.privateemail.com', port: 587, secure: true, note: 'Use your full email address as username.' } },
  // Rackspace
  { match: 'rackspace.com',      preset: { label: 'Rackspace Email',    host: 'secure.emailsrvr.com',    port: 587, secure: true  } },
  // MXroute
  { match: 'mxroute.com',        preset: { label: 'MXroute',            host: 'smtp.mxrouting.net',      port: 587, secure: true  } },
  // Titan Email (Namecheap / Hostinger bundle)
  { match: 'titan.email',        preset: { label: 'Titan Email',        host: 'smtp.titan.email',        port: 587, secure: true  } },
  { match: 'enom.com',           preset: { label: 'eNom/Namecheap',     host: 'smtp.emailsrvr.com',      port: 587, secure: true  } },
  // Ionos / 1&1
  { match: 'ionos.com',          preset: { label: 'IONOS',              host: 'smtp.ionos.com',          port: 587, secure: true  } },
  { match: '1and1.com',          preset: { label: '1&1 Mail',           host: 'smtp.1and1.com',          port: 587, secure: true  } },
  // GoDaddy
  { match: 'godaddy.com',        preset: { label: 'GoDaddy Email',      host: 'smtpout.secureserver.net',port: 587, secure: true  } },
  { match: 'secureserver.net',   preset: { label: 'GoDaddy Email',      host: 'smtpout.secureserver.net',port: 587, secure: true  } },
  // Bluehost / HostGator / SiteGround (cPanel)
  { match: 'bluehost.com',       preset: { label: 'Bluehost',           host: 'mail.yourdomain.com',     port: 587, secure: true,  note: 'Replace "yourdomain.com" with your actual domain.' } },
  { match: 'hostgator.com',      preset: { label: 'HostGator',          host: 'mail.yourdomain.com',     port: 587, secure: true,  note: 'Replace "yourdomain.com" with your actual domain.' } },
  { match: 'siteground.com',     preset: { label: 'SiteGround',        host: 'mail.yourdomain.com',     port: 587, secure: true,  note: 'Use your cPanel email credentials.' } },
  // Dreamhost
  { match: 'dreamhost.com',      preset: { label: 'DreamHost',          host: 'smtp.dreamhost.com',      port: 587, secure: true  } },
  // Yahoo Business
  { match: 'yahoodns.net',       preset: { label: 'Yahoo Business Mail',host: 'smtp.mail.yahoo.com',     port: 587, secure: true  } },
];

/** Fetch MX records for a domain using Google DNS-over-HTTPS (no CORS issues) */
async function getMxRecords(domain: string): Promise<string[]> {
  try {
    const res = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=MX`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return [];
    const json = await res.json();
    return (json.Answer ?? []).map((a: { data: string }) => (a.data ?? '').toLowerCase());
  } catch {
    return [];
  }
}

/** Match a list of MX records against the presets table */
function matchMxToPreset(mxRecords: string[]): SmtpPreset | null {
  for (const { match, preset } of MX_PRESETS) {
    if (mxRecords.some(mx => mx.includes(match))) {
      return { ...preset, viaDetection: 'MX record' };
    }
  }
  return null;
}

/**
 * Detect SMTP settings from an email address.
 * 1. Check known consumer domain presets (instant).
 * 2. If no match, do a DNS MX lookup to detect business providers.
 * Returns a preset or null.
 */
async function detectSmtpFromEmail(email: string): Promise<SmtpPreset | null> {
  const at = email.indexOf('@');
  if (at < 0) return null;
  const domain = email.slice(at + 1).toLowerCase().trim();
  if (!domain || !domain.includes('.')) return null;
  // 1. Exact domain match
  if (SMTP_DOMAIN_PRESETS[domain]) return SMTP_DOMAIN_PRESETS[domain];
  // 2. DNS MX lookup for custom business domains
  const mxRecords = await getMxRecords(domain);
  return matchMxToPreset(mxRecords);
}

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
  const [detectedPreset, setDetectedPreset] = useState<SmtpPreset | null>(null);
  const [autoFilled, setAutoFilled] = useState(false);
  const [detecting, setDetecting] = useState(false);

  const handleEmailBlur = async (email: string) => {
    if (!email || !email.includes('@')) return;
    setDetecting(true);
    setDetectedPreset(null);
    setAutoFilled(false);
    try {
      const preset = await detectSmtpFromEmail(email);
      setDetectedPreset(preset);
      if (preset && !smtpConfig.host) {
        // Auto-fill only when host hasn't been manually set yet
        setSMTPConfig(prev => ({
          ...prev,
          host: preset.host,
          port: preset.port,
          secure: preset.secure,
          username: email,
        }));
        setAutoFilled(true);
      }
    } finally {
      setDetecting(false);
    }
  };

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

              {/* ── Email address first — triggers auto-detect on blur ── */}
              <div className="space-y-2">
                <Label htmlFor="smtp-username">Your Email Address</Label>
                <div className="relative">
                  <Input
                    id="smtp-username"
                    type="email"
                    placeholder="you@yourdomain.com"
                    value={smtpConfig.username}
                    onChange={(e) => {
                      setSMTPConfig({ ...smtpConfig, username: e.target.value });
                      setAutoFilled(false);
                      setDetectedPreset(null);
                    }}
                    onBlur={(e) => handleEmailBlur(e.target.value)}
                    className={detecting ? 'pr-8' : ''}
                  />
                  {detecting && <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
                </div>
                <p className="text-xs text-muted-foreground">
                  {detecting ? 'Detecting your email provider via DNS…' : 'Enter your email — we\'ll auto-detect your server settings.'}
                </p>
              </div>

              {/* ── Auto-detected settings banner ── */}
              {smtpConfig.username.includes('@') && !detecting && !detectedPreset && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-300/50 bg-amber-50 dark:bg-amber-950/30 px-3 py-2.5 text-sm text-amber-700 dark:text-amber-400">
                  <Info className="h-4 w-4 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium">Provider not detected — fill in manually</p>
                    <p className="text-xs mt-0.5 opacity-80">Your email host isn't recognised. Check with your provider for SMTP settings (usually on their help page).</p>
                  </div>
                </div>
              )}
              {detectedPreset && !detecting && (
                <div className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm ${autoFilled ? 'border-emerald-400/50 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400' : 'border-primary/30 bg-primary/5 text-primary'}`}>
                  {autoFilled ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" /> : <Sparkles className="h-4 w-4 mt-0.5 shrink-0" />}
                  <div>
                    <p className="font-medium">
                      {autoFilled ? `${detectedPreset.label} settings auto-filled` : `${detectedPreset.label} detected`}
                      {detectedPreset.viaDetection && <span className="ml-1.5 text-xs font-normal opacity-60">via {detectedPreset.viaDetection}</span>}
                    </p>
                    {detectedPreset.note && <p className="text-xs mt-0.5 opacity-80">{detectedPreset.note}</p>}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="smtp-host">Email Server Address</Label>
                <Input
                  id="smtp-host"
                  placeholder="mail.yourdomain.com"
                  value={smtpConfig.host}
                  onChange={(e) => {
                    setSMTPConfig({ ...smtpConfig, host: e.target.value });
                    setAutoFilled(false);
                  }}
                />
                <p className="text-xs text-muted-foreground">Usually starts with "smtp" or "mail"</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="smtp-port">Port</Label>
                  <Input
                    id="smtp-port"
                    type="number"
                    placeholder="587"
                    value={smtpConfig.port}
                    onChange={(e) =>
                      setSMTPConfig({ ...smtpConfig, port: parseInt(e.target.value) || 587 })
                    }
                  />
                  <p className="text-xs text-muted-foreground">Usually 587 or 465</p>
                </div>
                <div className="flex flex-col justify-between space-y-2">
                  <Label htmlFor="smtp-secure" className="cursor-pointer">Secure (TLS)</Label>
                  <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg h-10">
                    <Switch
                      id="smtp-secure"
                      checked={smtpConfig.secure}
                      onCheckedChange={(checked) =>
                        setSMTPConfig({ ...smtpConfig, secure: checked })
                      }
                    />
                    <span className="text-xs text-muted-foreground">{smtpConfig.secure ? 'On' : 'Off'}</span>
                  </div>
                </div>
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
                <p className="text-xs text-muted-foreground">
                  {detectedPreset?.label === 'Gmail' || detectedPreset?.label === 'Yahoo Mail' || detectedPreset?.label === 'iCloud Mail'
                    ? '⚠️ Use an App Password, not your regular login password.'
                    : 'Your email account password or app password.'}
                </p>
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
