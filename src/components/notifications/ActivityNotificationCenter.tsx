import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Bell, Eye, MousePointerClick, Reply, AlertCircle, Check } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { NotificationBadge } from './NotificationBadge';

interface ActivityNotification {
  id: string;
  type: 'opened' | 'clicked' | 'replied' | 'bounced';
  companyName: string;
  subject?: string;
  timestamp: string;
  read: boolean;
  metadata?: any;
}

export function ActivityNotificationCenter() {
  const [open, setOpen] = useState(false);

  const { data: notifications = [], refetch } = useQuery({
    queryKey: ['activity-notifications'],
    queryFn: async () => {
      // Get recent email activities with engagement
      const { data, error } = await supabase
        .from('email_activities')
        .select(`
          id,
          status,
          opened_at,
          replied_at,
          subject,
          metadata,
          company_sequences(
            companies(name)
          )
        `)
        .not('opened_at', 'is', null)
        .or('replied_at.not.is.null,status.eq.bounced,metadata->>clicked.eq.true')
        .order('opened_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      // Transform to notification format
      const notifs: ActivityNotification[] = (data || []).map((activity: any) => {
        let type: 'opened' | 'clicked' | 'replied' | 'bounced' = 'opened';
        let timestamp = activity.opened_at;

        if (activity.replied_at) {
          type = 'replied';
          timestamp = activity.replied_at;
        } else if (activity.status === 'bounced') {
          type = 'bounced';
          timestamp = activity.metadata?.bounced_at || activity.opened_at;
        } else if (activity.metadata?.clicked) {
          type = 'clicked';
          timestamp = activity.metadata?.last_click || activity.opened_at;
        }

        return {
          id: activity.id,
          type,
          companyName: activity.company_sequences?.companies?.name || 'Unknown Company',
          subject: activity.subject,
          timestamp,
          read: false,
          metadata: activity.metadata,
        };
      });

      return notifs;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  const getIcon = (type: string) => {
    switch (type) {
      case 'opened':
        return <Eye className="h-4 w-4 text-blue-500" />;
      case 'clicked':
        return <MousePointerClick className="h-4 w-4 text-purple-500" />;
      case 'replied':
        return <Reply className="h-4 w-4 text-green-500" />;
      case 'bounced':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  const getLabel = (type: string) => {
    switch (type) {
      case 'opened':
        return 'Opened Email';
      case 'clicked':
        return 'Clicked Link';
      case 'replied':
        return 'Sent Reply';
      case 'bounced':
        return 'Email Bounced';
      default:
        return 'Activity';
    }
  };

  const markAllAsRead = () => {
    // In a real implementation, update the database
    refetch();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <div className="absolute -top-1 -right-1">
              <NotificationBadge count={unreadCount} />
            </div>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <Card className="border-0 shadow-none">
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Activity Notifications</CardTitle>
                <CardDescription>Recent email engagement</CardDescription>
              </div>
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={markAllAsRead}
                  className="text-xs"
                >
                  <Check className="h-3 w-3 mr-1" />
                  Mark all read
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[400px]">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Bell className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground">No recent activity</p>
                </div>
              ) : (
                <div className="divide-y">
                  {notifications.map((notif) => (
                    <div
                      key={notif.id}
                      className={`p-4 hover:bg-muted/50 transition-colors cursor-pointer ${
                        !notif.read ? 'bg-primary/5' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-1">{getIcon(notif.type)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium text-sm">{getLabel(notif.type)}</p>
                            {!notif.read && (
                              <div className="w-2 h-2 rounded-full bg-primary" />
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            {notif.companyName}
                          </p>
                          {notif.subject && (
                            <p className="text-xs text-muted-foreground mt-1 truncate">
                              "{notif.subject}"
                            </p>
                          )}
                          {notif.type === 'clicked' && notif.metadata?.clicked_links?.[0] && (
                            <p className="text-xs text-muted-foreground mt-1 truncate">
                              {notif.metadata.clicked_links[0]}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-2">
                            {formatDistanceToNow(new Date(notif.timestamp), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </PopoverContent>
    </Popover>
  );
}
