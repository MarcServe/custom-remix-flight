import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, MessageSquare, Send, Sparkles, Ban, Handshake, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface SmsMessage {
  id: string;
  counterparty: string;
  direction: 'inbound' | 'outbound';
  body: string;
  status: string;
  created_at: string;
  read_at: string | null;
  contact_name: string | null;
  campaign_id: string | null;
  person_id: string | null;
  error_message: string | null;
}

interface Thread {
  phone: string;
  name: string | null;
  last: SmsMessage;
  unread: number;
  count: number;
  personId: string | null;
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function SmsConversations({ onUnreadChange }: { onUnreadChange?: (n: number) => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [filter, setFilter] = useState('');
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['sms-messages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sms_messages' as any)
        .select('id, counterparty, direction, body, status, created_at, read_at, contact_name, campaign_id, person_id, error_message')
        .order('created_at', { ascending: false })
        .limit(2000);
      if (error) throw error;
      return (data || []) as unknown as SmsMessage[];
    },
    refetchInterval: 30_000,
  });

  const { data: optOuts = [] } = useQuery({
    queryKey: ['sms-opt-outs'],
    queryFn: async () => {
      const { data } = await supabase.from('sms_opt_outs' as any).select('phone');
      return ((data || []) as unknown as { phone: string }[]).map((o) => o.phone);
    },
  });

  // Live updates: new texts appear without a refresh.
  useEffect(() => {
    const channel = supabase
      .channel('sms-messages-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sms_messages' }, () => {
        queryClient.invalidateQueries({ queryKey: ['sms-messages'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const threads = useMemo<Thread[]>(() => {
    const map = new Map<string, Thread>();
    for (const m of messages) {
      const t = map.get(m.counterparty);
      if (!t) {
        map.set(m.counterparty, { phone: m.counterparty, name: m.contact_name, last: m, unread: 0, count: 0, personId: m.person_id });
      }
      const th = map.get(m.counterparty)!;
      if (!th.name && m.contact_name) th.name = m.contact_name;
      if (!th.personId && m.person_id) th.personId = m.person_id;
      th.count++;
      if (m.direction === 'inbound' && !m.read_at) th.unread++;
    }
    let list = Array.from(map.values()).sort((a, b) => new Date(b.last.created_at).getTime() - new Date(a.last.created_at).getTime());
    const q = filter.trim().toLowerCase();
    if (q) list = list.filter((t) => t.phone.includes(q) || (t.name || '').toLowerCase().includes(q) || t.last.body.toLowerCase().includes(q));
    return list;
  }, [messages, filter]);

  const totalUnread = useMemo(() => threads.reduce((n, t) => n + t.unread, 0), [threads]);
  useEffect(() => { onUnreadChange?.(totalUnread); }, [totalUnread, onUnreadChange]);

  const thread = useMemo(() => (selected ? messages.filter((m) => m.counterparty === selected).sort((a, b) => a.created_at.localeCompare(b.created_at)) : []), [messages, selected]);
  const selectedThread = threads.find((t) => t.phone === selected) || null;
  const isOptedOut = selected ? optOuts.includes(selected) : false;

  // Mark the open thread as read.
  useEffect(() => {
    if (!selected) return;
    const unreadIds = thread.filter((m) => m.direction === 'inbound' && !m.read_at).map((m) => m.id);
    if (!unreadIds.length) return;
    supabase.from('sms_messages' as any).update({ read_at: new Date().toISOString() }).in('id', unreadIds)
      .then(() => queryClient.invalidateQueries({ queryKey: ['sms-messages'] }));
  }, [selected, thread, queryClient]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ block: 'end' }); }, [thread.length, selected]);

  const handleSend = async () => {
    if (!selected || !reply.trim()) return;
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-sms-reply', { body: { to: selected, message: reply.trim() } });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Send failed');
      setReply('');
      queryClient.invalidateQueries({ queryKey: ['sms-messages'] });
    } catch (e: any) {
      toast({ title: 'Text not sent', description: e?.message || 'Send failed', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const handleDraft = async () => {
    if (!selected) return;
    setDrafting(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-sms-reply', { body: { to: selected, draft: true, instruction: reply.trim() || undefined } });
      if (error) throw new Error(error.message);
      if (!data?.draft) throw new Error(data?.error || 'No draft returned');
      setReply(data.draft);
    } catch (e: any) {
      toast({ title: 'Could not draft a reply', description: e?.message || 'Try again', variant: 'destructive' });
    } finally {
      setDrafting(false);
    }
  };

  const handleCreateDeal = async () => {
    if (!selectedThread) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      let companyId: string | null = null;
      if (selectedThread.personId) {
        const { data: p } = await supabase.from('people').select('company_id').eq('id', selectedThread.personId).maybeSingle();
        companyId = (p as any)?.company_id ?? null;
      }
      const notes = thread.slice(-6).map((m) => `${m.direction === 'inbound' ? 'Them' : 'Us'}: ${m.body}`).join('\n');
      const { error } = await supabase.from('deals').insert({
        user_id: user.id,
        title: `SMS lead: ${selectedThread.name || selectedThread.phone}`,
        stage: 'LEAD',
        company_id: companyId,
        notes: `From text conversation with ${selectedThread.phone}\n\n${notes}`,
      } as any);
      if (error) throw error;
      toast({ title: 'Deal created', description: 'Added to your pipeline at Lead stage.' });
      navigate('/deals');
    } catch (e: any) {
      toast({ title: 'Could not create deal', description: e?.message || 'Try again', variant: 'destructive' });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5" /> Text conversations</CardTitle>
            <CardDescription>Replies to your SMS campaigns and texts to your number. Answer them here from your Twilio number.</CardDescription>
          </div>
          {totalUnread > 0 && <Badge>{totalUnread} unread</Badge>}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading texts…</div>
        ) : threads.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            No texts yet. When someone replies to a campaign text or messages your number, it appears here within seconds.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-[280px_1fr]">
            <div className="min-w-0">
              <div className="relative mb-2">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search name, number or text" className="pl-8" />
              </div>
              <ScrollArea className="h-[420px] pr-2">
                <ul className="space-y-1">
                  {threads.map((t) => (
                    <li key={t.phone}>
                      <button
                        type="button"
                        onClick={() => setSelected(t.phone)}
                        className={`w-full rounded-md border px-3 py-2 text-left transition-colors hover:bg-muted ${selected === t.phone ? 'border-primary bg-muted' : 'border-transparent'}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium">{t.name || t.phone}</span>
                          <span className="shrink-0 text-[11px] text-muted-foreground">{fmtTime(t.last.created_at)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-xs text-muted-foreground">{t.last.direction === 'outbound' ? 'You: ' : ''}{t.last.body}</span>
                          {t.unread > 0 && <Badge className="h-5 min-w-5 justify-center px-1.5 text-[10px]">{t.unread}</Badge>}
                        </div>
                        {t.name && <div className="text-[11px] text-muted-foreground">{t.phone}</div>}
                      </button>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            </div>

            <div className="min-w-0 flex flex-col rounded-lg border">
              {!selected ? (
                <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">Pick a conversation</div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{selectedThread?.name || selected}</div>
                      <div className="text-xs text-muted-foreground">{selected}{isOptedOut && <span className="ml-2 inline-flex items-center gap-1 text-destructive"><Ban className="h-3 w-3" /> opted out</span>}</div>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleCreateDeal} className="gap-1"><Handshake className="h-3.5 w-3.5" /> Create deal</Button>
                  </div>
                  <ScrollArea className="h-[300px] px-3 py-3">
                    <div className="space-y-2">
                      {thread.map((m) => (
                        <div key={m.id} className={`flex ${m.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${m.direction === 'outbound' ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-muted rounded-bl-sm'}`}>
                            <div className="whitespace-pre-wrap break-words">{m.body}</div>
                            <div className={`mt-1 text-[10px] ${m.direction === 'outbound' ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                              {fmtTime(m.created_at)}{m.status === 'failed' ? ` · failed${m.error_message ? `: ${m.error_message}` : ''}` : ''}
                            </div>
                          </div>
                        </div>
                      ))}
                      <div ref={bottomRef} />
                    </div>
                  </ScrollArea>
                  <div className="border-t p-3 space-y-2">
                    <Textarea
                      id="sms-reply"
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      placeholder={isOptedOut ? 'This number replied STOP; you can’t text them unless they reply START.' : 'Type a reply… (or describe what to say and click Draft with AI)'}
                      className="min-h-[72px]"
                      disabled={sending || isOptedOut}
                      onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleSend(); }}
                    />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">{reply.length} characters{reply.length > 160 ? ` · ${Math.ceil(reply.length / 153)} SMS segments` : ''}</span>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={handleDraft} disabled={drafting || sending || isOptedOut} className="gap-1">
                          {drafting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Draft with AI
                        </Button>
                        <Button size="sm" onClick={handleSend} disabled={sending || !reply.trim() || isOptedOut} className="gap-1">
                          {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Send text
                        </Button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
