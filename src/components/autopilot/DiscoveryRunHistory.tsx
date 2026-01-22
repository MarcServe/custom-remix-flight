import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  History, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  Clock,
  Users,
  Mail,
  Zap,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  AlertTriangle
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { useState } from "react";

interface DiscoveryRun {
  id: string;
  discovery_run_id: string;
  user_id: string;
  status: string;
  trigger_type: string;
  total_leads_found: number | null;
  leads_enriched: number | null;
  leads_auto_approved: number | null;
  leads_pending: number | null;
  emails_extracted: number | null;
  contacts_created: number | null;
  campaigns_created: number | null;
  sequences_enrolled: number | null;
  source_breakdown: Record<string, number> | null;
  errors: string[] | null;
  error_message: string | null;
  settings_snapshot: any;
  created_at: string;
  completed_at: string | null;
}

export function DiscoveryRunHistory() {
  const { user } = useAuth();
  const [expandedRun, setExpandedRun] = useState<string | null>(null);

  const { data: runs, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['discovery-runs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('discovery_runs')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data as DiscoveryRun[];
    },
    enabled: !!user?.id,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-200">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Completed
          </Badge>
        );
      case 'running':
        return (
          <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-200">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Running
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getTriggerBadge = (trigger: string) => {
    switch (trigger) {
      case 'manual':
        return <Badge variant="outline">Manual</Badge>;
      case 'scheduled':
        return <Badge variant="outline" className="bg-primary/10 text-primary">Scheduled</Badge>;
      case 'catch_up':
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600">Catch-up</Badge>;
      default:
        return <Badge variant="secondary">{trigger}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Discovery Run History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Discovery Run History
            </CardTitle>
            <CardDescription>
              Track all automated discovery runs with their stats and outcomes
            </CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => refetch()}
            disabled={isRefetching}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!runs || runs.length === 0 ? (
          <div className="text-center py-8">
            <History className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <h3 className="font-semibold mb-1">No Discovery Runs Yet</h3>
            <p className="text-sm text-muted-foreground">
              Runs will appear here once the autopilot starts discovering leads.
            </p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]"></TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead className="text-right">Emails</TableHead>
                  <TableHead className="text-right">Campaigns</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((run) => (
                  <>
                    <TableRow 
                      key={run.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setExpandedRun(expandedRun === run.id ? null : run.id)}
                    >
                      <TableCell>
                        {expandedRun === run.id ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {format(new Date(run.created_at), 'MMM d, h:mm a')}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(run.created_at), { addSuffix: true })}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(run.status)}</TableCell>
                      <TableCell>{getTriggerBadge(run.trigger_type)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Users className="h-3 w-3 text-muted-foreground" />
                          <span className="font-medium">{run.total_leads_found || 0}</span>
                          {run.leads_auto_approved ? (
                            <span className="text-xs text-green-600">
                              (+{run.leads_auto_approved})
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Mail className="h-3 w-3 text-muted-foreground" />
                          <span className="font-medium">{run.emails_extracted || 0}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Zap className="h-3 w-3 text-muted-foreground" />
                          <span className="font-medium">{run.campaigns_created || 0}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                    {expandedRun === run.id && (
                      <TableRow>
                        <TableCell colSpan={7} className="bg-muted/30 p-4">
                          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                            {/* Detailed Stats */}
                            <div className="space-y-2">
                              <h4 className="text-sm font-semibold">Lead Stats</h4>
                              <div className="text-sm space-y-1">
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Total Found:</span>
                                  <span>{run.total_leads_found || 0}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Auto-Approved:</span>
                                  <span className="text-green-600">{run.leads_auto_approved || 0}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Pending Review:</span>
                                  <span>{run.leads_pending || 0}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Enriched:</span>
                                  <span>{run.leads_enriched || 0}</span>
                                </div>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <h4 className="text-sm font-semibold">Outreach Stats</h4>
                              <div className="text-sm space-y-1">
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Emails Extracted:</span>
                                  <span>{run.emails_extracted || 0}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Contacts Created:</span>
                                  <span>{run.contacts_created || 0}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Campaigns Created:</span>
                                  <span>{run.campaigns_created || 0}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Sequences Enrolled:</span>
                                  <span>{run.sequences_enrolled || 0}</span>
                                </div>
                              </div>
                            </div>

                            {/* Source Breakdown */}
                            {run.source_breakdown && Object.keys(run.source_breakdown).length > 0 && (
                              <div className="space-y-2">
                                <h4 className="text-sm font-semibold">Sources</h4>
                                <div className="text-sm space-y-1">
                                  {Object.entries(run.source_breakdown).map(([source, count]) => (
                                    <div key={source} className="flex justify-between">
                                      <span className="text-muted-foreground capitalize">{source}:</span>
                                      <span>{count as number}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Settings Used */}
                            {run.settings_snapshot && (
                              <div className="space-y-2">
                                <h4 className="text-sm font-semibold">Settings Used</h4>
                                <div className="flex flex-wrap gap-1">
                                  {run.settings_snapshot.full_auto_mode && (
                                    <Badge variant="outline" className="text-xs bg-purple-500/10">Full Auto</Badge>
                                  )}
                                  {run.settings_snapshot.deep_enrichment_mode && (
                                    <Badge variant="outline" className="text-xs bg-blue-500/10">Deep Enrich</Badge>
                                  )}
                                  {run.settings_snapshot.auto_extract_emails && (
                                    <Badge variant="outline" className="text-xs bg-green-500/10">Auto Extract</Badge>
                                  )}
                                  {run.settings_snapshot.auto_create_campaign && (
                                    <Badge variant="outline" className="text-xs bg-orange-500/10">Auto Campaign</Badge>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Error Message */}
                          {run.error_message && (
                            <div className="mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                              <div className="flex items-start gap-2">
                                <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
                                <div>
                                  <h4 className="text-sm font-semibold text-destructive">Error</h4>
                                  <p className="text-sm text-destructive/80">{run.error_message}</p>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Errors Array */}
                          {run.errors && run.errors.length > 0 && (
                            <div className="mt-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                              <h4 className="text-sm font-semibold text-yellow-600 mb-2">Warnings</h4>
                              <ul className="text-sm text-yellow-600/80 list-disc list-inside">
                                {run.errors.map((error, i) => (
                                  <li key={i}>{error}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Duration */}
                          {run.completed_at && (
                            <div className="mt-4 text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Duration: {Math.round(
                                (new Date(run.completed_at).getTime() - new Date(run.created_at).getTime()) / 1000
                              )} seconds
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
