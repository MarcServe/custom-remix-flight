import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Bot, Play, Plus, Pencil, Trash2, Loader2, Clock, CheckCircle2, XCircle, ChevronDown, ChevronUp } from 'lucide-react';

interface Automation {
  id: string; name: string; instruction: string; schedule_kind: 'hourly' | 'daily' | 'weekdays' | 'weekly';
  time_of_day: string; days_of_week: number[]; timezone: string; enabled: boolean; allow_sending: boolean; model: string | null;
  next_run_at: string | null; last_run_at: string | null; last_status: string | null; last_summary: string | null; running_since: string | null;
}
interface Run { id: string; started_at: string; finished_at: string | null; status: string; trigger: string; summary: string | null; steps: { tool: string; ok: boolean; result?: string }[]; error: string | null }

const TEMPLATES: { label: string; name: string; instruction: string; kind: Automation['schedule_kind']; time: string }[] = [
  { label: 'Daily lead hunt (fresh angles)', name: 'Daily lead hunt', kind: 'daily', time: '07:30',
    instruction: 'Read get_business_profile and list_personas. Call find_leads 4 times with DIFFERENT angles than the last few days (check list_discovery_runs for the angles already used): each call a specific niche + a specific city/region from the persona, max 15 each. Then list_discovered_leads with_email=true for today and report how many new contactable leads were saved, with the best 5 by name and website. Do not send anything.' },
  { label: 'Morning drafts (campaign + newsletter)', name: 'Morning drafts', kind: 'weekdays', time: '08:00',
    instruction: 'Draft one fresh outreach email campaign for the recipient group named "<group name>" and one newsletter for all active subscribers, both as DRAFTS (do not schedule or send). Write on-brand HTML using the business profile. Reply with the draft names and ids so I can review and send from the app.' },
  { label: 'Reply triage + deals', name: 'Reply triage', kind: 'daily', time: '09:00',
    instruction: 'Check unread notifications and text conversations from the last 24 hours. For every email or SMS reply that shows buying intent (asks for a call, price, demo or more info), create a deal at LEAD stage with the company and a short note quoting their message, and draft (do not send) a short reply as a note in the deal. Finish with a summary of who replied and what they want.' },
  { label: 'Follow-up health check', name: 'Follow-up check', kind: 'daily', time: '18:00',
    instruction: 'Run sequence_health and list_enrollments (active). Report how many follow-ups are active, how many are due now, anything that looks stuck, and any campaigns from the last 7 days that have follow-up switched off or no sequence. Do not change anything.' },
  { label: 'Weekly performance report', name: 'Weekly report', kind: 'weekly', time: '08:30',
    instruction: 'Produce a plain-text weekly report: campaigns sent in the last 7 days with sent/failed counts, newsletters sent, new deals by stage, text conversations received, and follow-ups sent. End with three concrete suggestions for next week.' },
];

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function scheduleText(a: Automation) {
  if (a.schedule_kind === 'hourly') return 'Every hour';
  if (a.schedule_kind === 'daily') return `Every day at ${a.time_of_day}`;
  if (a.schedule_kind === 'weekdays') return `Weekdays at ${a.time_of_day}`;
  return `Weekly on ${(a.days_of_week || []).map((d) => DAYS[d]).join(', ') || 'Mon'} at ${a.time_of_day}`;
}
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString('en-GB', { timeZone: 'Europe/London', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');

export function AiAutomationsPanel() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Partial<Automation> | null>(null);
  const [saving, setSaving] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: automations = [], isLoading } = useQuery({
    queryKey: ['ai-automations'],
    queryFn: async () => {
      const { data, error } = await supabase.from('ai_automations' as any).select('*').order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as Automation[];
    },
    refetchInterval: 20_000,
  });

  const { data: runs = [] } = useQuery({
    queryKey: ['ai-automation-runs', expanded],
    enabled: !!expanded,
    queryFn: async () => {
      const { data } = await supabase.from('ai_automation_runs' as any).select('id, started_at, finished_at, status, trigger, summary, steps, error').eq('automation_id', expanded!).order('started_at', { ascending: false }).limit(8);
      return (data || []) as unknown as Run[];
    },
    refetchInterval: 10_000,
  });

  useEffect(() => {
    const ch = supabase.channel('ai-automations-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ai_automations' }, () => queryClient.invalidateQueries({ queryKey: ['ai-automations'] }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ai_automation_runs' }, () => queryClient.invalidateQueries({ queryKey: ['ai-automation-runs'] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [queryClient]);

  const startNew = (tpl?: typeof TEMPLATES[number]) => setEditing({
    name: tpl?.name || '', instruction: tpl?.instruction || '', schedule_kind: tpl?.kind || 'daily', time_of_day: tpl?.time || '08:00',
    days_of_week: [1], timezone: 'Europe/London', enabled: true, allow_sending: false,
  });

  const save = async () => {
    if (!editing?.name?.trim() || !editing?.instruction?.trim()) { toast.error('Give it a name and tell it what to do.'); return; }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');
      const row: any = {
        name: editing.name.trim(), instruction: editing.instruction.trim(), schedule_kind: editing.schedule_kind || 'daily',
        time_of_day: editing.time_of_day || '08:00', days_of_week: editing.days_of_week || [1], timezone: 'Europe/London',
        enabled: editing.enabled !== false, allow_sending: !!editing.allow_sending, next_run_at: null, updated_at: new Date().toISOString(),
      };
      if (editing.id) {
        const { error } = await supabase.from('ai_automations' as any).update(row).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('ai_automations' as any).insert({ ...row, user_id: user.id });
        if (error) throw error;
      }
      // Let the server compute next_run_at straight away.
      await supabase.functions.invoke('api-campaigns', { body: { action: 'reschedule_automations' } }).catch(() => null);
      queryClient.invalidateQueries({ queryKey: ['ai-automations'] });
      setEditing(null);
      toast.success(editing.id ? 'Automation updated' : 'Automation created');
    } catch (e: any) {
      toast.error(e?.message || 'Could not save');
    } finally { setSaving(false); }
  };

  const toggle = async (a: Automation, enabled: boolean) => {
    await supabase.from('ai_automations' as any).update({ enabled, next_run_at: null, updated_at: new Date().toISOString() }).eq('id', a.id);
    if (enabled) await supabase.functions.invoke('api-campaigns', { body: { action: 'reschedule_automations' } }).catch(() => null);
    queryClient.invalidateQueries({ queryKey: ['ai-automations'] });
  };

  const remove = async (a: Automation) => {
    if (!window.confirm(`Delete "${a.name}"? Its run history goes with it.`)) return;
    const { error } = await supabase.from('ai_automations' as any).delete().eq('id', a.id);
    if (error) toast.error(error.message); else { toast.success('Deleted'); queryClient.invalidateQueries({ queryKey: ['ai-automations'] }); }
  };

  const runNow = async (a: Automation) => {
    setRunningId(a.id); setExpanded(a.id);
    try {
      const { data, error } = await supabase.functions.invoke('run-ai-automations', { body: { automation_id: a.id } });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      toast[data?.success ? 'success' : 'error'](data?.success ? `Ran "${a.name}" (${data.steps} tool calls)` : `"${a.name}" failed: ${data?.error}`);
    } catch (e: any) {
      toast.error(e?.message || 'Run failed');
    } finally {
      setRunningId(null);
      queryClient.invalidateQueries({ queryKey: ['ai-automations'] });
      queryClient.invalidateQueries({ queryKey: ['ai-automation-runs'] });
    }
  };

  const sorted = useMemo(() => [...automations].sort((a, b) => Number(b.enabled) - Number(a.enabled)), [automations]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg"><Bot className="h-5 w-5" /> Daily automations</CardTitle>
              <CardDescription>
                Describe a job in plain English and pick a schedule. LeadBoosters runs it on the server with the same tools Claude uses (contacts, groups, campaigns, newsletters, SMS, follow-ups, deals), logs every step and notifies you when it's done. Drafts only unless you allow sending.
              </CardDescription>
            </div>
            <Button onClick={() => startNew()} className="gap-1"><Plus className="h-4 w-4" /> New automation</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {automations.length === 0 && !isLoading && (
            <div className="rounded-lg border border-dashed p-4">
              <p className="text-sm font-medium mb-2">Start from a template</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {TEMPLATES.map((t) => (
                  <button key={t.label} type="button" onClick={() => startNew(t)} className="rounded-md border bg-muted/30 px-3 py-2 text-left text-sm hover:bg-muted">
                    <div className="font-medium">{t.label}</div>
                    <div className="text-xs text-muted-foreground">{t.kind === 'weekly' ? 'Weekly' : t.kind === 'weekdays' ? 'Weekdays' : 'Daily'} at {t.time}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {sorted.map((a) => {
            const isOpen = expanded === a.id;
            const running = runningId === a.id || (!!a.running_since && Date.now() - new Date(a.running_since).getTime() < 10 * 60_000);
            return (
              <div key={a.id} className={`rounded-lg border p-3 ${a.enabled ? '' : 'opacity-70'}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{a.name}</span>
                      {a.allow_sending ? <Badge variant="destructive" className="text-[10px]">can send</Badge> : <Badge variant="secondary" className="text-[10px]">drafts only</Badge>}
                      {running ? <Badge className="text-[10px] gap-1"><Loader2 className="h-3 w-3 animate-spin" /> running</Badge>
                        : a.last_status === 'success' ? <Badge variant="outline" className="text-[10px] gap-1 text-green-700 border-green-300"><CheckCircle2 className="h-3 w-3" /> last run ok</Badge>
                        : a.last_status === 'failed' ? <Badge variant="outline" className="text-[10px] gap-1 text-destructive border-destructive/40"><XCircle className="h-3 w-3" /> last run failed</Badge> : null}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{a.instruction}</p>
                    <p className="mt-1 text-xs text-muted-foreground flex flex-wrap items-center gap-x-3">
                      <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {scheduleText(a)}</span>
                      <span>Next: {a.enabled ? fmt(a.next_run_at) : 'paused'}</span>
                      <span>Last: {fmt(a.last_run_at)}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Switch checked={a.enabled} onCheckedChange={(v) => toggle(a, v)} aria-label="Enabled" />
                    <Button variant="outline" size="sm" onClick={() => runNow(a)} disabled={running} className="gap-1">{running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />} Run now</Button>
                    <Button variant="ghost" size="icon" onClick={() => setEditing(a)} aria-label="Edit"><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(a)} aria-label="Delete"><Trash2 className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => setExpanded(isOpen ? null : a.id)} aria-label="Runs">{isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</Button>
                  </div>
                </div>
                {a.last_summary && !isOpen && <p className="mt-2 rounded bg-muted/40 p-2 text-xs whitespace-pre-wrap line-clamp-3">{a.last_summary}</p>}
                {isOpen && (
                  <div className="mt-3 space-y-2 border-t pt-3">
                    {runs.length === 0 ? <p className="text-xs text-muted-foreground">No runs yet. Click Run now to try it.</p> : runs.map((r) => (
                      <details key={r.id} className="rounded border bg-muted/20 p-2 text-xs">
                        <summary className="cursor-pointer flex flex-wrap items-center gap-2">
                          {r.status === 'running' ? <Loader2 className="h-3 w-3 animate-spin" /> : r.status === 'success' ? <CheckCircle2 className="h-3 w-3 text-green-600" /> : <XCircle className="h-3 w-3 text-destructive" />}
                          <span>{fmt(r.started_at)}</span><span className="text-muted-foreground">· {r.trigger} · {(r.steps || []).length} tool calls</span>
                        </summary>
                        {r.error && <p className="mt-2 text-destructive">{r.error}</p>}
                        {r.summary && <p className="mt-2 whitespace-pre-wrap">{r.summary}</p>}
                        {(r.steps || []).length > 0 && (
                          <ol className="mt-2 space-y-1 pl-4 list-decimal text-muted-foreground">
                            {r.steps.map((s, i) => <li key={i}><span className={s.ok ? '' : 'text-destructive'}>{s.tool}</span>{s.result ? <span className="opacity-70"> — {String(s.result).slice(0, 140)}</span> : null}</li>)}
                          </ol>
                        )}
                      </details>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) setEditing(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing?.id ? 'Edit automation' : 'New automation'}</DialogTitle>
            <DialogDescription>Write it the way you'd brief an assistant. It can use everything in LeadBoosters.</DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              {!editing.id && (
                <div>
                  <Label className="text-xs">Template (optional)</Label>
                  <Select onValueChange={(v) => { const t = TEMPLATES.find((x) => x.label === v); if (t) setEditing({ ...editing, name: t.name, instruction: t.instruction, schedule_kind: t.kind, time_of_day: t.time }); }}>
                    <SelectTrigger><SelectValue placeholder="Pick a template or write your own" /></SelectTrigger>
                    <SelectContent>{TEMPLATES.map((t) => <SelectItem key={t.label} value={t.label}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label htmlFor="auto-name">Name</Label>
                <Input id="auto-name" value={editing.name || ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="e.g. Morning drafts" />
              </div>
              <div>
                <Label htmlFor="auto-instruction">What should it do?</Label>
                <Textarea id="auto-instruction" value={editing.instruction || ''} onChange={(e) => setEditing({ ...editing, instruction: e.target.value })} className="min-h-[140px]" placeholder="Every morning, draft an outreach campaign for the group “Manchester hotels” about…" />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <Label>How often</Label>
                  <Select value={editing.schedule_kind || 'daily'} onValueChange={(v) => setEditing({ ...editing, schedule_kind: v as Automation['schedule_kind'] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hourly">Every hour</SelectItem>
                      <SelectItem value="daily">Every day</SelectItem>
                      <SelectItem value="weekdays">Weekdays</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {editing.schedule_kind !== 'hourly' && (
                  <div>
                    <Label htmlFor="auto-time">Time (UK)</Label>
                    <Input id="auto-time" type="time" value={editing.time_of_day || '08:00'} onChange={(e) => setEditing({ ...editing, time_of_day: e.target.value })} />
                  </div>
                )}
                {editing.schedule_kind === 'weekly' && (
                  <div>
                    <Label>Days</Label>
                    <div className="flex flex-wrap gap-1 pt-1">
                      {DAYS.map((d, i) => {
                        const on = (editing.days_of_week || []).includes(i);
                        return <button key={d} type="button" onClick={() => setEditing({ ...editing, days_of_week: on ? (editing.days_of_week || []).filter((x) => x !== i) : [...(editing.days_of_week || []), i] })} className={`rounded px-2 py-1 text-xs border ${on ? 'bg-primary text-primary-foreground border-primary' : 'bg-background'}`}>{d}</button>;
                      })}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <div className="text-sm font-medium">Allow it to send</div>
                  <div className="text-xs text-muted-foreground">Off = it can only create drafts, groups, contacts and deals. On = it may send campaigns, texts, newsletters and sequence emails when the job says so.</div>
                </div>
                <Switch checked={!!editing.allow_sending} onCheckedChange={(v) => setEditing({ ...editing, allow_sending: v })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}{editing?.id ? 'Save' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
