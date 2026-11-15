import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Bell, Mail, MessageSquare, Ban, Send, Newspaper, MousePointerClick, AlertCircle, Search, Check, Reply } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { NotificationBadge } from './NotificationBadge';

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  entity_type: string | null;
  entity_id: string | null;
  read_at: string | null;
  created_at: string;
}

const ICONS: Record<string, JSX.Element> = {
  email_reply: <Reply className="h-4 w-4 text-green-600" />,
  sequence_reply: <Reply className="h-4 w-4 text-green-600" />,
  sms_reply: <MessageSquare className="h-4 w-4 text-green-600" />,
  sms_opt_out: <Ban className="h-4 w-4 text-destructive" />,
  campaign_done: <Send className="h-4 w-4 text-blue-600" />,
  newsletter_sent: <Newspaper className="h-4 w-4 text-blue-600" />,
  sequence_click: <MousePointerClick className="h-4 w-4 text-purple-600" />,
  bounce: <AlertCircle className="h-4 w-4 text-destructive" />,
  lead_search_done: <Search className="h-4 w-4 text-primary" />,
};

export function useNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['notifications', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications' as any)
        .select('id, type, title, body, link, entity_type, entity_id, read_at, created_at')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as unknown as AppNotification[];
    },
    refetchInterval: 60_000,
  });

  // Live: new rows arrive over realtime (the table is in the publication).
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('notifications-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['notifications', user.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, queryClient]);

  const markRead = async (ids: string[]) => {
    if (!ids.length) return;
    await supabase.from('notifications' as any).update({ read_at: new Date().toISOString() }).in('id', ids).is('read_at', null);
    queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
  };
  return { ...query, markRead };
}

export function ActivityNotificationCenter() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { data: notifications = [], markRead } = useNotifications();

  const unread = useMemo(() => notifications.filter((n) => !n.read_at), [notifications]);

  const handleClick = (n: AppNotification) => {
    if (!n.read_at) void markRead([n.id]);
    setOpen(false);
    const target = n.link || '/conversations';
    setTimeout(() => navigate(target), 0);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={unread.length ? `${unread.length} unread notifications` : 'Notifications'}>
          <Bell className="h-5 w-5" />
          {unread.length > 0 && (
            <div className="absolute -top-1 -right-1">
              <NotificationBadge count={unread.length} />
            </div>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent side="right" align="start" sideOffset={12} className="w-[420px] max-w-[calc(100vw-2rem)] p-0 max-h-[min(560px,calc(100vh-8rem))] flex flex-col z-[100]">
        <Card className="border-0 shadow-none flex flex-col min-h-0">
          <CardHeader className="border-b shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Notifications</CardTitle>
                <CardDescription>Replies, texts, finished sends and alerts</CardDescription>
              </div>
              {unread.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => markRead(unread.map((n) => n.id))} className="text-xs">
                  <Check className="h-3 w-3 mr-1" /> Mark all read
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1 min-h-0">
            <ScrollArea className="h-[min(440px,calc(100vh-12rem))]">
              {notifications.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground text-sm">
                  Nothing yet. You'll be told here when someone replies by email or text, a campaign or newsletter finishes, a link is clicked, an email bounces, or a lead search completes.
                </div>
              ) : (
                <div className="divide-y">
                  {notifications.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => handleClick(n)}
                      className={`w-full text-left p-4 hover:bg-muted/50 transition-colors ${!n.read_at ? 'bg-muted/30' : ''}`}
                    >
                      <div className="flex gap-3">
                        <div className="mt-0.5">{ICONS[n.type] || <Mail className="h-4 w-4" />}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-medium text-sm truncate">{n.title}</span>
                            {!n.read_at && <Badge variant="default" className="h-5 text-[10px] px-1.5">New</Badge>}
                          </div>
                          {n.body && <p className="text-xs text-muted-foreground truncate">{n.body}</p>}
                          <p className="text-[11px] text-muted-foreground mt-1">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</p>
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
