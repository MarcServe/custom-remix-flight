import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Mail, Eye, MousePointerClick, Reply, AlertCircle, Clock } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

interface EngagementEvent {
  id: string;
  type: 'sent' | 'opened' | 'clicked' | 'replied' | 'bounced';
  timestamp: string;
  recipientEmail?: string;
  metadata?: {
    link?: string;
    bounce_reason?: string;
    subject?: string;
  };
}

interface EngagementTimelineProps {
  events: EngagementEvent[];
}

export function EngagementTimeline({ events }: EngagementTimelineProps) {
  const getEventIcon = (type: string) => {
    switch (type) {
      case 'sent':
        return <Mail className="h-4 w-4 text-blue-500" />;
      case 'opened':
        return <Eye className="h-4 w-4 text-green-500" />;
      case 'clicked':
        return <MousePointerClick className="h-4 w-4 text-purple-500" />;
      case 'replied':
        return <Reply className="h-4 w-4 text-emerald-500" />;
      case 'bounced':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getEventLabel = (type: string) => {
    switch (type) {
      case 'sent':
        return 'Email Sent';
      case 'opened':
        return 'Email Opened';
      case 'clicked':
        return 'Link Clicked';
      case 'replied':
        return 'Reply Received';
      case 'bounced':
        return 'Email Bounced';
      default:
        return 'Event';
    }
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'sent':
        return 'bg-blue-500/10 border-blue-500/20';
      case 'opened':
        return 'bg-green-500/10 border-green-500/20';
      case 'clicked':
        return 'bg-purple-500/10 border-purple-500/20';
      case 'replied':
        return 'bg-emerald-500/10 border-emerald-500/20';
      case 'bounced':
        return 'bg-destructive/10 border-destructive/20';
      default:
        return 'bg-muted border-border';
    }
  };

  const sortedEvents = [...events].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  if (events.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Engagement Timeline</CardTitle>
          <CardDescription>No engagement events yet</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Engagement Timeline</CardTitle>
        <CardDescription>Real-time activity tracking</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-3">
            {sortedEvents.map((event, index) => (
              <div
                key={event.id}
                className={`p-3 rounded-lg border ${getEventColor(event.type)} transition-all hover:shadow-sm`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">{getEventIcon(event.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="font-medium text-sm">{getEventLabel(event.type)}</p>
                      <Badge variant="outline" className="text-xs">
                        {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
                      </Badge>
                    </div>
                    
                    {event.recipientEmail && (
                      <p className="text-xs text-muted-foreground truncate">
                        {event.recipientEmail}
                      </p>
                    )}
                    
                    {event.metadata?.subject && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        "{event.metadata.subject}"
                      </p>
                    )}
                    
                    {event.metadata?.link && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        Clicked: {event.metadata.link}
                      </p>
                    )}
                    
                    {event.metadata?.bounce_reason && (
                      <p className="text-xs text-destructive mt-1">
                        Reason: {event.metadata.bounce_reason}
                      </p>
                    )}
                    
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(event.timestamp), 'MMM d, yyyy HH:mm:ss')}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
