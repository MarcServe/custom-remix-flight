import { useState, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
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

const STORAGE_KEY_PREFIX = 'activity-notifications-read';

function storageKeyForUser(userId?: string | null) {
  return userId ? `${STORAGE_KEY_PREFIX}:${userId}` : STORAGE_KEY_PREFIX;
}

function getStoredReadIds(userId?: string | null): Set<string> {
  try {
    const raw = localStorage.getItem(storageKeyForUser(userId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function setStoredReadIds(ids: Set<string>, userId?: string | null) {
  try {
    // Cap growth so quota failures don't leave the badge stuck forever
    const pruned = [...ids].slice(-200);
    localStorage.setItem(storageKeyForUser(userId), JSON.stringify(pruned));
  } catch {
    /* ignore quota / private mode */
  }
}

interface ActivityNotification {
  id: string;
  type: 'opened' | 'clicked' | 'replied' | 'bounced';
  companyName: string;
  subject?: string;
  timestamp: string;
  read: boolean;
  companySequenceId?: string | null;
  metadata?: any;
}

export function ActivityNotificationCenter() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(() => getStoredReadIds(user?.id));
  const navigate = useNavigate();

  useEffect(() => {
    setReadIds(getStoredReadIds(user?.id));
  }, [user?.id]);

  const markAsRead = useCallback((id: string) => {
    setReadIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      setStoredReadIds(next, user?.id);
      return next;
    });
  }, [user?.id]);

  const markAllAsReadInState = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    setReadIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      setStoredReadIds(next, user?.id);
      return next;
    });
  }, [user?.id]);

  const { data: notifications = [], refetch } = useQuery({
    queryKey: ['activity-notifications'],
    queryFn: async () => {
      // Get recent email activities with engagement
      const { data, error } = await supabase
        .from('email_activities')
        .select(`
          id,
          company_sequence_id,
          status,
          opened_at,
          replied_at,
          subject,
          metadata,
          company_sequences(
            companies(name)
          )
        `)
        .or('replied_at.not.is.null,status.eq.bounced,metadata->>clicked.eq.true,opened_at.not.is.null')
        .order('sent_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      // Transform to notification format
      const notifs: ActivityNotification[] = (data || []).map((activity: any) => {
        let type: 'opened' | 'clicked' | 'replied' | 'bounced' = 'opened';
        let timestamp = activity.opened_at || activity.replied_at || new Date().toISOString();

        if (activity.replied_at) {
          type = 'replied';
          timestamp = activity.replied_at;
        } else if (activity.status === 'bounced') {
          type = 'bounced';
          timestamp = activity.metadata?.bounced_at || activity.opened_at || timestamp;
        } else if (activity.metadata?.clicked) {
          type = 'clicked';
          timestamp = activity.metadata?.last_click || activity.opened_at || timestamp;
        }

        return {
          id: activity.id,
          type,
          companyName: activity.company_sequences?.companies?.name || 'Unknown Company',
          subject: activity.subject,
          timestamp,
          read: false,
          companySequenceId: activity.company_sequence_id,
          metadata: activity.metadata,
        };
      });

      return notifs;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // If the panel is already open when data arrives, mark the listed items read
  useEffect(() => {
    if (open && notifications.length > 0) {
      markAllAsReadInState(notifications.map((n) => n.id));
    }
  }, [open, notifications, markAllAsReadInState]);

  const unreadCount = notifications.filter((n) => !readIds.has(n.id)).length;

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
    markAllAsReadInState(notifications.map((n) => n.id));
  };

  const handleNotificationClick = (notif: ActivityNotification) => {
    markAsRead(notif.id);
    setOpen(false);
    // Use setTimeout so popover closes before navigation (avoids focus/portal issues)
    const target = notif.companySequenceId
      ? `/conversations?sequence=${notif.companySequenceId}`
      : '/conversations';
    setTimeout(() => navigate(target), 0);
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    // Mark currently listed notifications read when opening OR closing the panel
    if (notifications.length > 0) {
      markAllAsReadInState(notifications.map((n) => n.id));
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
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
      <PopoverContent
        side="right"
        align="start"
        sideOffset={12}
        className="w-[420px] max-w-[calc(100vw-2rem)] p-0 max-h-[min(560px,calc(100vh-8rem))] flex flex-col z-[100]"
      >
        <Card className="border-0 shadow-none flex flex-col min-h-0">
          <CardHeader className="border-b shrink-0">
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
          <CardContent className="p-0 flex-1 min-h-0">
            <ScrollArea className="h-[min(440px,calc(100vh-12rem))]">
              {notifications.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground text-sm">
                  No recent activity
                </div>
              ) : (
                <div className="divide-y">
                  {notifications.map((notif) => (
                    <button
                      key={notif.id}
                      type="button"
                      onClick={() => handleNotificationClick(notif)}
                      className={`w-full text-left p-4 hover:bg-muted/50 transition-colors ${
                        !readIds.has(notif.id) ? 'bg-muted/30' : ''
                      }`}
                    >
                      <div className="flex gap-3">
                        <div className="mt-0.5">{getIcon(notif.type)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm truncate">{notif.companyName}</span>
                            {!readIds.has(notif.id) && (
                              <Badge variant="default" className="h-5 text-[10px] px-1.5">New</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mb-1">{getLabel(notif.type)}</p>
                          {notif.subject && (
                            <p className="text-xs truncate text-muted-foreground/80">{notif.subject}</p>
                          )}
                          <p className="text-[11px] text-muted-foreground mt-1">
                            {notif.timestamp
                              ? formatDistanceToNow(new Date(notif.timestamp), { addSuffix: true })
                              : ''}
                          </p>
                        </div>
                      </div>
                    </button>
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
