import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Shield, CheckCircle2, XCircle, AlertTriangle, ExternalLink, Loader2, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

interface DNSRecord {
  type: 'SPF' | 'DKIM' | 'DMARC';
  status: 'valid' | 'invalid' | 'missing';
  value?: string;
  expected?: string;
  message: string;
}

interface DeliverabilityCheck {
  dnsRecords?: DNSRecord[];
  domainScore?: number;
  timestamp?: string;
}

export function DomainVerificationCard({ domain }: { domain?: string }) {
  const [isChecking, setIsChecking] = useState(false);
  const [copiedRecord, setCopiedRecord] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: deliverabilityData, refetch } = useQuery<DeliverabilityCheck>({
    queryKey: ['deliverability', domain],
    queryFn: async () => {
      if (!domain) return {};

      const { data, error } = await supabase.functions.invoke('check-email-deliverability', {
        body: { domain }
      });

      if (error) throw error;
      return data;
    },
    enabled: !!domain,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const handleCheckDomain = async () => {
    if (!domain) {
      toast({
        title: "No domain configured",
        description: "Please verify your business email first",
        variant: "destructive",
      });
      return;
    }

    setIsChecking(true);
    try {
      await refetch();
      toast({
        title: "Domain check complete",
        description: "DNS records have been verified",
      });
    } catch (error: any) {
      toast({
        title: "Check failed",
        description: error.message || "Unable to verify domain",
        variant: "destructive",
      });
    } finally {
      setIsChecking(false);
    }
  };

  const copyToClipboard = (text: string, recordType: string) => {
    navigator.clipboard.writeText(text);
    setCopiedRecord(recordType);
    setTimeout(() => setCopiedRecord(null), 2000);
    toast({
      title: "Copied!",
      description: `${recordType} record copied to clipboard`,
    });
  };

  const getScoreColor = (score?: number) => {
    if (!score) return "text-muted-foreground";
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getScoreBadge = (score?: number) => {
    if (!score) return null;
    if (score >= 80) return <Badge className="bg-green-100 text-green-800">Excellent</Badge>;
    if (score >= 60) return <Badge className="bg-yellow-100 text-yellow-800">Good</Badge>;
    return <Badge variant="destructive">Needs Improvement</Badge>;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'valid':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'invalid':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'missing':
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      default:
        return null;
    }
  };

  if (!domain) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            <CardTitle>Domain Verification</CardTitle>
          </div>
          <CardDescription>
            Verify your business email to check domain authentication
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertDescription>
              Please verify your business email address first to enable domain verification checks.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            <div>
              <CardTitle>Domain Authentication</CardTitle>
              <CardDescription>{domain}</CardDescription>
            </div>
          </div>
          <Button
            onClick={handleCheckDomain}
            disabled={isChecking}
            size="sm"
            variant="outline"
          >
            {isChecking ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Checking...
              </>
            ) : (
              'Check Domain'
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {deliverabilityData?.domainScore !== undefined && (
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div>
              <div className="text-sm text-muted-foreground">Deliverability Score</div>
              <div className={`text-3xl font-bold ${getScoreColor(deliverabilityData.domainScore)}`}>
                {deliverabilityData.domainScore}/100
              </div>
            </div>
            {getScoreBadge(deliverabilityData.domainScore)}
          </div>
        )}

        {deliverabilityData?.dnsRecords && deliverabilityData.dnsRecords.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium text-sm">DNS Records Status</h4>
            
            {deliverabilityData.dnsRecords.map((record) => (
              <div
                key={record.type}
                className="flex items-start gap-3 p-3 border rounded-lg"
              >
                {getStatusIcon(record.status)}
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{record.type}</span>
                    <Badge variant={record.status === 'valid' ? 'default' : 'secondary'}>
                      {record.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{record.message}</p>
                  
                  {record.expected && record.status !== 'valid' && (
                    <div className="mt-2 p-2 bg-muted rounded text-xs font-mono break-all">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-muted-foreground">Record to add:</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(record.expected!, record.type)}
                          className="h-6 px-2"
                        >
                          {copiedRecord === record.type ? (
                            <Check className="h-3 w-3" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                      <code>{record.expected}</code>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="setup-guide">
            <AccordionTrigger className="text-sm">
              How to fix domain authentication?
            </AccordionTrigger>
            <AccordionContent className="space-y-3 text-sm">
              <div>
                <h5 className="font-medium mb-2">Step 1: Verify Domain in Resend</h5>
                <p className="text-muted-foreground mb-2">
                  First, add and verify your domain in Resend to get the correct DNS records.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open('https://resend.com/domains', '_blank')}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open Resend Domains
                </Button>
              </div>

              <div>
                <h5 className="font-medium mb-2">Step 2: Add DNS Records</h5>
                <p className="text-muted-foreground mb-2">
                  Copy the DNS records shown above and add them to your domain's DNS settings (usually in your domain registrar's control panel).
                </p>
              </div>

              <div>
                <h5 className="font-medium mb-2">Step 3: Wait for Propagation</h5>
                <p className="text-muted-foreground">
                  DNS changes can take up to 48 hours to propagate, but usually complete within a few hours. Use the "Check Domain" button above to verify.
                </p>
              </div>

              <Alert>
                <AlertDescription>
                  <strong>Why this matters:</strong> Proper domain authentication (SPF, DKIM, DMARC) significantly improves email deliverability and prevents your emails from landing in spam folders.
                </AlertDescription>
              </Alert>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {deliverabilityData?.timestamp && (
          <p className="text-xs text-muted-foreground text-center">
            Last checked: {new Date(deliverabilityData.timestamp).toLocaleString()}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
