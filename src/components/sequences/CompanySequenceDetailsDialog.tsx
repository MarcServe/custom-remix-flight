import { useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { 
  Mail, 
  Building2, 
  Eye, 
  MousePointerClick, 
  ReplyAll,
  CheckCircle2,
  Clock,
  Send,
  Calendar,
  TrendingUp,
  Play,
  Pause,
  AlertCircle,
  AlertTriangle
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";
import { useUpdateSequenceStatus, useSendSequenceEmail } from "@/hooks/use-company-sequences";
import { useMarkCampaignAsViewed } from "@/hooks/use-campaign-views";
import { SequenceSettingsCard } from "./SequenceSettingsCard";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface CompanySequenceDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sequence: {
    id: string;
    status: string;
    current_step: number;
    created_at?: string;
    auto_respond_enabled?: boolean;
    automation_rules?: any;
    companies: {
      name: string;
      industry?: string;
      geography?: string;
    };
    email_sequences: {
      name: string;
      steps: Array<{
        subject: string;
        body: string;
        delay_days?: number;
      }>;
    };
    email_activities?: Array<{
      id: string;
      step_number: number;
      status: string;
      subject?: string;
      sent_at?: string;
      opened_at?: string;
      clicked_at?: string;
      replied_at?: string;
      bounced_at?: string;
      metadata?: any;
    }>;
    personalized_emails?: any;
  };
}

export function CompanySequenceDetailsDialog({
  open,
  onOpenChange,
  sequence,
}: CompanySequenceDetailsDialogProps) {
  const updateStatusMutation = useUpdateSequenceStatus();
  const sendEmailMutation = useSendSequenceEmail();
  const markCampaignAsViewed = useMarkCampaignAsViewed();

  // Mark campaign as viewed when dialog opens
  useEffect(() => {
    if (open && sequence?.id) {
      markCampaignAsViewed.mutate(sequence.id);
    }
  }, [open, sequence?.id]);

  const handleStatusChange = async (status: 'active' | 'paused') => {
    await updateStatusMutation.mutateAsync({ id: sequence.id, status });
  };

  const handleActivateAndSend = async () => {
    try {
      // First activate the sequence
      await updateStatusMutation.mutateAsync({ id: sequence.id, status: 'active' });
      // Then send the first email
      await sendEmailMutation.mutateAsync({
        companySequenceId: sequence.id,
        stepNumber: 0
      });
      toast.success('Sequence activated and first email sent!');
    } catch (error) {
      console.error('Failed to activate sequence:', error);
      toast.error('Failed to activate sequence. Please try again.');
    }
  };

  const totalSteps = sequence.email_sequences.steps?.length || 0;
  const progress = totalSteps > 0 ? Math.round(((sequence.current_step + 1) / totalSteps) * 100) : 0;

  const activities = sequence.email_activities || [];
  const sent = activities.filter(a => a.sent_at).length;
  const opened = activities.filter(a => a.opened_at).length;
  const replied = activities.filter(a => a.replied_at).length;
  const bounced = activities.filter(a => a.bounced_at).length;
  
  const openRate = sent > 0 ? Math.round((opened / sent) * 100) : 0;
  const replyRate = sent > 0 ? Math.round((replied / sent) * 100) : 0;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500/10 text-green-600 border-green-500/20';
      case 'paused': return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
      case 'completed': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getActivityStatus = (stepNumber: number) => {
    return activities.find(a => a.step_number === stepNumber);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] overflow-hidden">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-gradient-primary flex items-center justify-center">
                <Building2 className="h-6 w-6 text-white" />
              </div>
              <div>
                <DialogTitle className="text-2xl">{sequence.companies.name}</DialogTitle>
                <DialogDescription className="text-sm mt-1">
                  {sequence.email_sequences.name}
                </DialogDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={getStatusColor(sequence.status)}>
                {sequence.status}
              </Badge>
              {sequence.status === 'draft' && (
                <Button
                  size="sm"
                  variant="default"
                  onClick={handleActivateAndSend}
                  disabled={updateStatusMutation.isPending || sendEmailMutation.isPending}
                  className="bg-gradient-primary"
                >
                  <Send className="h-4 w-4 mr-2" />
                  {sendEmailMutation.isPending ? 'Sending...' : 'Activate & Send First Email'}
                </Button>
              )}
              {sequence.status === 'active' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleStatusChange('paused')}
                  disabled={updateStatusMutation.isPending}
                >
                  <Pause className="h-4 w-4 mr-2" />
                  Pause
                </Button>
              )}
              {sequence.status === 'paused' && (
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => handleStatusChange('active')}
                  disabled={updateStatusMutation.isPending}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Resume
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="h-[calc(90vh-120px)] pr-4">
          <div className="space-y-6 py-4">
            {/* Overall Progress */}
            <Card className="border-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Sequence Progress
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Current Step</span>
                    <span className="font-semibold">
                      {sequence.current_step + 1} of {totalSteps}
                    </span>
                  </div>
                  <Progress value={progress} className="h-2" />
                  <p className="text-xs text-muted-foreground text-right">{progress}% complete</p>
                </div>

                <Separator />

                {/* Engagement Stats */}
                <div className="grid grid-cols-5 gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Send className="h-3.5 w-3.5" />
                      <span className="text-xs font-medium">Sent</span>
                    </div>
                    <p className="text-2xl font-bold">{sent}</p>
                  </div>
                  
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Eye className="h-3.5 w-3.5" />
                      <span className="text-xs font-medium">Opens</span>
                    </div>
                    <p className="text-2xl font-bold">{opened}</p>
                    <p className="text-xs text-muted-foreground">{openRate}%</p>
                  </div>
                  
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <ReplyAll className="h-3.5 w-3.5" />
                      <span className="text-xs font-medium">Replies</span>
                    </div>
                    <p className="text-2xl font-bold">{replied}</p>
                    <p className="text-xs text-muted-foreground">{replyRate}%</p>
                  </div>
                  
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <AlertCircle className="h-3.5 w-3.5" />
                      <span className="text-xs font-medium">Bounced</span>
                    </div>
                    <p className="text-2xl font-bold">{bounced}</p>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      <span className="text-xs font-medium">Created</span>
                    </div>
                    <p className="text-xs font-medium">
                      {sequence.created_at ? format(new Date(sequence.created_at), "MMM d") : "N/A"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Company Info */}
            <Card className="bg-muted/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Company Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {sequence.companies.industry && (
                    <Badge variant="secondary">{sequence.companies.industry}</Badge>
                  )}
                  {sequence.companies.geography && (
                    <Badge variant="outline">{sequence.companies.geography}</Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Sequence Settings */}
            <SequenceSettingsCard
              sequenceId={sequence.id}
              autoRespondEnabled={sequence.auto_respond_enabled || false}
              automationRules={sequence.automation_rules || {
                enabled: true,
                rules: [
                  { type: 'no_open', action: 'send_next', wait_hours: 48 },
                  { type: 'opened_not_clicked', action: 'send_next', wait_hours: 72 },
                  { type: 'clicked_not_replied', action: 'send_next', wait_hours: 96 },
                ],
              }}
              steps={sequence.email_sequences.steps}
            />

            <Separator />

            {/* Email Steps */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Mail className="h-5 w-5 text-primary" />
                Email Timeline
              </h3>

              {sequence.email_sequences.steps.map((step, idx) => {
                const activity = getActivityStatus(idx);
                const isCurrent = idx === sequence.current_step;
                const isPast = idx < sequence.current_step;

                return (
                  <Card 
                    key={idx} 
                    className={`border-2 transition-all ${
                      isCurrent ? 'border-primary shadow-lg' : 
                      isPast ? 'border-green-500/30 bg-green-500/5' : 
                      'border-muted'
                    }`}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            isCurrent ? 'bg-gradient-primary' :
                            isPast ? 'bg-green-500' :
                            'bg-muted'
                          }`}>
                            <span className={`font-bold ${
                              isCurrent || isPast ? 'text-white' : 'text-muted-foreground'
                            }`}>
                              {idx + 1}
                            </span>
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="font-mono text-xs">
                                Step {idx + 1}
                              </Badge>
                              {step.delay_days !== undefined && step.delay_days > 0 && (
                                <Badge variant="secondary" className="text-xs">
                                  <Clock className="h-3 w-3 mr-1" />
                                  {step.delay_days}d delay
                                </Badge>
                              )}
                              {isCurrent && (
                                <Badge className="bg-primary text-xs">Current</Badge>
                              )}
                              {activity && (
                                <>
                                  {activity.opened_at && (
                                    <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-600">
                                      <Eye className="h-3 w-3 mr-1" />
                                      Opened
                                    </Badge>
                                  )}
                                  {activity.replied_at && (
                                    <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600">
                                      <CheckCircle2 className="h-3 w-3 mr-1" />
                                      Replied
                                    </Badge>
                                  )}
                                </>
                              )}
                            </div>
                            <CardTitle className="text-base font-semibold">{step.subject}</CardTitle>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    
                    {activity?.sent_at && (
                      <CardContent>
                        <div className="flex items-center flex-wrap gap-4 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1.5">
                            <Send className="h-3 w-3" />
                            Sent: {format(new Date(activity.sent_at), "MMM d, h:mm a")}
                          </div>
                          {activity.metadata?.provider && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <div className="flex items-center gap-1.5">
                                    <Mail className="h-3 w-3" />
                                    via {activity.metadata.provider}
                                    {!activity.metadata.tracking_enabled && (
                                      <AlertTriangle className="h-3 w-3 text-yellow-500" />
                                    )}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-xs font-semibold mb-1">Provider: {activity.metadata.provider}</p>
                                  <p className="text-xs">Method: {activity.metadata.sending_method || 'unknown'}</p>
                                  <p className="text-xs font-semibold mt-2 mb-1">Tracking:</p>
                                  <p className="text-xs">Opens: {activity.metadata.can_track_opens ? '✓' : '✗'}</p>
                                  <p className="text-xs">Clicks: {activity.metadata.can_track_clicks ? '✓' : '✗'}</p>
                                  <p className="text-xs">Replies: {activity.metadata.can_track_replies ? '✓' : '✗'}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          {activity.opened_at && (
                            <div className="flex items-center gap-1.5">
                              <Eye className="h-3 w-3" />
                              Opened: {format(new Date(activity.opened_at), "MMM d, h:mm a")}
                            </div>
                          )}
                          {activity.replied_at && (
                            <div className="flex items-center gap-1.5 text-green-600">
                              <ReplyAll className="h-3 w-3" />
                              Replied: {format(new Date(activity.replied_at), "MMM d, h:mm a")}
                            </div>
                          )}
                          {!activity.metadata?.tracking_enabled && !activity.opened_at && !activity.replied_at && (
                            <Badge variant="outline" className="text-xs text-yellow-600 border-yellow-400">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              No tracking data available
                            </Badge>
                          )}
                        </div>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
