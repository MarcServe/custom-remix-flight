import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Play, Pause, Trash2, ChevronDown, Mail, Building2, Clock, Send, CheckCircle2, Eye, MousePointerClick } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import { useSendSequenceEmail, useEmailActivities } from "@/hooks/use-company-sequences";

interface PersonalizedEmail {
  subject: string;
  body: string;
  delayDays: number;
  stepNumber: number;
}

interface CompanySequence {
  id: string;
  status: 'draft' | 'active' | 'paused' | 'completed';
  current_step: number;
  personalized_emails: PersonalizedEmail[];
  created_at: string;
  sequence?: { name: string };
  company?: { name: string; website?: string };
}

interface PersonalizedSequenceCardProps {
  companySequence: CompanySequence;
  onStatusChange: (id: string, status: 'draft' | 'active' | 'paused' | 'completed') => void;
  onDelete: (id: string) => void;
}

const statusConfig = {
  draft: { label: 'Draft', color: 'bg-muted text-muted-foreground' },
  active: { label: 'Active', color: 'bg-green-500/10 text-green-500' },
  paused: { label: 'Paused', color: 'bg-yellow-500/10 text-yellow-500' },
  completed: { label: 'Completed', color: 'bg-blue-500/10 text-blue-500' },
};

export function PersonalizedSequenceCard({ companySequence, onStatusChange, onDelete }: PersonalizedSequenceCardProps) {
  const [expandedSteps, setExpandedSteps] = useState<number[]>([]);
  const sendEmail = useSendSequenceEmail();
  const { data: activitiesData } = useEmailActivities(companySequence.id);

  const activities = activitiesData?.data || [];

  const toggleStep = (stepNumber: number) => {
    setExpandedSteps(prev =>
      prev.includes(stepNumber)
        ? prev.filter(n => n !== stepNumber)
        : [...prev, stepNumber]
    );
  };

  const handleStatusToggle = () => {
    if (companySequence.status === 'active') {
      onStatusChange(companySequence.id, 'paused');
    } else if (companySequence.status === 'draft' || companySequence.status === 'paused') {
      onStatusChange(companySequence.id, 'active');
    }
  };

  const handleSendNext = () => {
    const nextStep = companySequence.current_step + 1;
    if (nextStep < (companySequence.personalized_emails?.length || 0)) {
      sendEmail.mutate({
        companySequenceId: companySequence.id,
        stepNumber: nextStep,
      });
    }
  };

  const getStepActivity = (stepNumber: number) => {
    return activities.find((a: any) => a.step_number === stepNumber);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              {companySequence.company?.name || 'Unknown Company'}
            </CardTitle>
            <CardDescription>
              {companySequence.sequence?.name || 'Unnamed Sequence'} • {companySequence.personalized_emails?.length || 0} steps
            </CardDescription>
          </div>
          <Badge className={statusConfig[companySequence.status].color}>
            {statusConfig[companySequence.status].label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Metadata */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            Created {format(new Date(companySequence.created_at), 'MMM d, yyyy')}
          </div>
          <div className="flex items-center gap-1">
            <Mail className="h-3.5 w-3.5" />
            Step {companySequence.current_step + 1} of {companySequence.personalized_emails?.length || 0}
          </div>
        </div>

        {/* Personalized Emails */}
        <div className="space-y-2">
          {companySequence.personalized_emails?.map((email, index) => {
            const activity = getStepActivity(email.stepNumber);
            const isSent = !!activity?.sent_at;
            const isOpened = !!activity?.opened_at;
            const metadata = activity?.metadata as any;
            const isClicked = metadata?.clicked;

            return (
              <Collapsible
                key={index}
                open={expandedSteps.includes(email.stepNumber)}
                onOpenChange={() => toggleStep(email.stepNumber)}
              >
                <CollapsibleTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-between hover:bg-accent/50"
                    size="sm"
                  >
                    <span className="flex items-center gap-2">
                      <Badge 
                        variant={isSent ? "default" : "secondary"} 
                        className="h-5 w-5 rounded-full p-0 flex items-center justify-center"
                      >
                        {isSent ? <CheckCircle2 className="h-3 w-3" /> : email.stepNumber}
                      </Badge>
                      <span className="font-medium truncate">{email.subject}</span>
                      {isOpened && <Eye className="h-3 w-3 text-blue-500" />}
                      {isClicked && <MousePointerClick className="h-3 w-3 text-green-500" />}
                    </span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${expandedSteps.includes(email.stepNumber) ? 'rotate-180' : ''}`} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 p-4 border rounded-lg bg-muted/30">
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Subject</p>
                      <p className="text-sm font-medium">{email.subject}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Body</p>
                      <p className="text-sm whitespace-pre-wrap text-muted-foreground">{email.body}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Delay: {email.delayDays} {email.delayDays === 1 ? 'day' : 'days'}
                      </p>
                    </div>
                    {activity && (
                      <div className="pt-2 border-t">
                        <p className="text-xs font-medium mb-1">Activity</p>
                        <div className="flex flex-wrap gap-2">
                          {activity.sent_at && (
                            <Badge variant="outline" className="text-xs">
                              <Send className="h-3 w-3 mr-1" />
                              Sent {format(new Date(activity.sent_at), 'MMM d, h:mm a')}
                            </Badge>
                          )}
                          {activity.opened_at && (
                            <Badge variant="outline" className="text-xs text-blue-600">
                              <Eye className="h-3 w-3 mr-1" />
                              Opened
                            </Badge>
                          )}
                          {isClicked && (
                            <Badge variant="outline" className="text-xs text-green-600">
                              <MousePointerClick className="h-3 w-3 mr-1" />
                              Clicked
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          {companySequence.status === 'draft' && (
            <Button
              variant="default"
              size="sm"
              onClick={handleSendNext}
              disabled={sendEmail.isPending}
              className="flex-1"
            >
              <Send className="h-3.5 w-3.5 mr-2" />
              {sendEmail.isPending ? 'Sending...' : 'Send First Email'}
            </Button>
          )}
          {(companySequence.status === 'paused') && (
            <Button
              variant="default"
              size="sm"
              onClick={handleStatusToggle}
              className="flex-1"
            >
              <Play className="h-3.5 w-3.5 mr-2" />
              Resume Sequence
            </Button>
          )}
          {companySequence.status === 'active' && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleStatusToggle}
              className="flex-1"
            >
              <Pause className="h-3.5 w-3.5 mr-2" />
              Pause
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDelete(companySequence.id)}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
