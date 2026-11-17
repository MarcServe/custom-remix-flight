import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, ShieldCheck, RefreshCw, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useIsPlatformAdmin } from "@/hooks/use-platform-admin";

const TIERS = ["free", "trial", "crm", "autopilot", "autopilot_pro", "agency", "legacy_full", "individual", "pro"];
const TIER_NAMES: Record<string, string> = {
  free: "Free", trial: "Trial", crm: "CRM", autopilot: "Autopilot", autopilot_pro: "Autopilot Pro", agency: "Agency",
  legacy_full: "Legacy (full)", individual: "Legacy Individual", pro: "Legacy Pro",
};
const PLAN_IDS = ["crm", "autopilot", "autopilot_pro", "agency"];

async function admin<T = any>(action: string, body: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke("admin-api", { body: { action, ...body } });
  if (error) {
    let msg = error.message;
    try { const j = await (error as any).context?.json(); if (j?.error) msg = j.error; } catch { /* keep */ }
    throw new Error(msg);
  }
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as T;
}

const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" }) : "—");
const fmtTime = (d?: string | null) => (d ? new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }) : "—");

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-2xl font-semibold mt-1 tabular-nums">{value}</div>
        {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
      </CardContent>
    </Card>
  );
}

function Overview() {
  const q = useQuery({ queryKey: ["admin", "overview"], queryFn: () => admin("overview") });
  const wh = useQuery({ queryKey: ["admin", "webhook"], queryFn: () => admin("webhook_status") });
  if (q.isLoading) return <Loader2 className="h-5 w-5 animate-spin" />;
  if (q.error) return <p className="text-sm text-destructive">{(q.error as Error).message}</p>;
  const o: any = q.data;
  const w: any = wh.data;
  const healthy = w?.endpoint?.status === "enabled";
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Estimated MRR" value={`£${Number(o.mrr_gbp).toLocaleString("en-GB")}`} hint={`${o.paying} paying (Stripe)`} />
        <Stat label="Users" value={o.users} hint={`${o.signups_30d} new in 30 days`} />
        <Stat label="Active in 30 days" value={o.active_30d} />
        <Stat label="Active trials" value={o.trials_active} />
        <Stat label="Autopilot accounts on" value={o.autopilot_enabled_accounts} />
        <Stat label="Discovery runs today" value={o.discovery_runs_today} />
        <Stat label="New leads this month" value={o.new_leads_this_month} />
        <Stat label="Campaigns this month" value={o.campaigns_this_month} />
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Users by plan</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(o.by_tier as Record<string, number>).sort((a, b) => b[1] - a[1]).map(([t, n]) => (
              <div key={t} className="flex items-center gap-3 text-sm">
                <span className="w-32 shrink-0">{TIER_NAMES[t] || t}</span>
                <div className="flex-1 h-2 rounded bg-muted overflow-hidden"><div className="h-full bg-primary" style={{ width: `${(n / Math.max(1, o.users)) * 100}%` }} /></div>
                <span className="w-10 text-right tabular-nums">{n}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              Stripe webhook
              {wh.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : healthy ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <AlertTriangle className="h-4 w-4 text-amber-500" />}
            </CardTitle>
            <CardDescription>Keeps plans in sync when people subscribe, change plan or cancel.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            {wh.error && <p className="text-destructive">{(wh.error as Error).message}</p>}
            {w && (
              <>
                <div>Endpoint: {w.endpoint ? <Badge variant={w.endpoint.status === "enabled" ? "default" : "destructive"}>{w.endpoint.status}</Badge> : <Badge variant="destructive">missing</Badge>}</div>
                <div>Last plan update from Stripe: <b>{fmtTime(w.last_plan_sync)}</b> (UK)</div>
                {!healthy && <p className="text-muted-foreground pt-1">Stripe has disabled the endpoint. Re-enable it in Stripe → Developers → Webhooks. Plans still update when users open the app.</p>}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function OverrideDialog({ user, onClose }: { user: any; onClose: () => void }) {
  const qc = useQueryClient();
  const [tier, setTier] = useState<string>(user?.override?.tier || "autopilot");
  const [note, setNote] = useState<string>(user?.override?.note || "");
  const [expires, setExpires] = useState<string>(user?.override?.expires_at ? user.override.expires_at.slice(0, 10) : "");
  const save = useMutation({
    mutationFn: (remove?: boolean) => admin("set_override", remove ? { user_id: user.id, tier: null } : { user_id: user.id, tier, note, expires_at: expires ? new Date(expires + "T23:59:59Z").toISOString() : null }),
    onSuccess: (_d, remove) => { toast.success(remove ? "Override removed" : "Plan granted"); qc.invalidateQueries({ queryKey: ["admin"] }); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Grant a plan</DialogTitle>
          <DialogDescription>{user.email}. A granted plan wins over Stripe and the trial. It doesn't charge anything.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label>Plan</Label>
            <Select value={tier} onValueChange={setTier}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TIERS.map((t) => <SelectItem key={t} value={t}>{TIER_NAMES[t]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label>Note (why)</Label><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Partner, comped for case study" /></div>
          <div className="space-y-1"><Label>Expires (optional)</Label><Input type="date" value={expires} onChange={(e) => setExpires(e.target.value)} /></div>
        </div>
        <DialogFooter className="gap-2">
          {user.override && <Button variant="outline" onClick={() => save.mutate(true)} disabled={save.isPending}>Remove override</Button>}
          <Button onClick={() => save.mutate(false)} disabled={save.isPending}>{save.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Users() {
  const [search, setSearch] = useState("");
  const [applied, setApplied] = useState("");
  const [editing, setEditing] = useState<any>(null);
  const q = useQuery({ queryKey: ["admin", "users", applied], queryFn: () => admin("users", { search: applied }) });
  const d: any = q.data;
  return (
    <div className="space-y-4">
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setApplied(search); }}>
        <Input placeholder="Search by email" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
        <Button type="submit" variant="outline">Search</Button>
      </form>
      {q.isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : q.error ? <p className="text-sm text-destructive">{(q.error as Error).message}</p> : (
        <>
          <p className="text-xs text-muted-foreground">{d.total} users{d.total > d.users.length ? `, newest ${d.users.length} shown` : ""}</p>
          <div className="overflow-x-auto rounded border">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Email</TableHead><TableHead>Plan</TableHead><TableHead>From</TableHead>
                <TableHead className="text-right">Leads this month</TableHead><TableHead>Joined</TableHead><TableHead>Last seen</TableHead><TableHead />
              </TableRow></TableHeader>
              <TableBody>
                {d.users.map((u: any) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium max-w-[220px] truncate">{u.email}</TableCell>
                    <TableCell><Badge variant={u.tier === "free" ? "outline" : "default"}>{TIER_NAMES[u.tier] || u.tier}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {u.source}{u.override?.note ? ` · ${u.override.note}` : ""}{u.override?.expires_at ? ` · until ${fmtDate(u.override.expires_at)}` : ""}
                      {u.subscription?.renews && u.source.startsWith("stripe") ? ` · renews ${fmtDate(u.subscription.renews)}` : ""}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{u.leads_used_this_month} / {u.leads_limit.toLocaleString("en-GB")}</TableCell>
                    <TableCell className="text-xs">{fmtDate(u.created_at)}</TableCell>
                    <TableCell className="text-xs">{fmtDate(u.last_sign_in_at)}</TableCell>
                    <TableCell>{u.is_admin ? <Badge variant="secondary">Admin</Badge> : <Button size="sm" variant="outline" onClick={() => setEditing(u)}>Plan…</Button>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
      {editing && <OverrideDialog user={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function LimitRow({ row }: { row: any }) {
  const qc = useQueryClient();
  const [v, setV] = useState({ autopilot: !!row.autopilot, leads_per_month: row.leads_per_month, personas: row.personas });
  const dirty = v.autopilot !== !!row.autopilot || Number(v.leads_per_month) !== row.leads_per_month || Number(v.personas) !== row.personas;
  const save = useMutation({
    mutationFn: () => admin("update_limits", { tier: row.tier, ...v }),
    onSuccess: () => { toast.success(`${TIER_NAMES[row.tier] || row.tier} limits saved`); qc.invalidateQueries({ queryKey: ["admin"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <TableRow>
      <TableCell className="font-medium">{TIER_NAMES[row.tier] || row.tier}</TableCell>
      <TableCell><Switch checked={v.autopilot} onCheckedChange={(c) => setV({ ...v, autopilot: c })} /></TableCell>
      <TableCell><Input type="number" min={0} className="w-28" value={v.leads_per_month} onChange={(e) => setV({ ...v, leads_per_month: e.target.value })} /></TableCell>
      <TableCell><Input type="number" min={0} className="w-20" value={v.personas} onChange={(e) => setV({ ...v, personas: e.target.value })} /></TableCell>
      <TableCell className="text-xs text-muted-foreground">{fmtTime(row.updated_at)}</TableCell>
      <TableCell><Button size="sm" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>Save</Button></TableCell>
    </TableRow>
  );
}

function Limits() {
  const q = useQuery({ queryKey: ["admin", "limits"], queryFn: () => admin("limits") });
  if (q.isLoading) return <Loader2 className="h-5 w-5 animate-spin" />;
  if (q.error) return <p className="text-sm text-destructive">{(q.error as Error).message}</p>;
  const rows = [...(q.data as any).limits].sort((a: any, b: any) => TIERS.indexOf(a.tier) - TIERS.indexOf(b.tier));
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Changes apply within a minute to everyone on that plan. No deploy needed.</p>
      <div className="overflow-x-auto rounded border">
        <Table>
          <TableHeader><TableRow><TableHead>Plan</TableHead><TableHead>Autopilot</TableHead><TableHead>New leads / month</TableHead><TableHead>Personas</TableHead><TableHead>Last changed</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>{rows.map((r: any) => <LimitRow key={r.tier + r.updated_at} row={r} />)}</TableBody>
        </Table>
      </div>
    </div>
  );
}

function Prices() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin", "prices"], queryFn: () => admin("prices") });
  const [edit, setEdit] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState<{ plan: string; interval: string; from: number; to: number } | null>(null);
  const change = useMutation({
    mutationFn: (c: { plan: string; interval: string; to: number }) => admin("change_price", { plan: c.plan, interval: c.interval, amount_gbp: c.to }),
    onSuccess: (d: any) => { toast.success(d.unchanged ? "Price unchanged" : `New price £${d.new_price.amount_gbp} is live for new sign-ups`); setConfirm(null); setEdit({}); qc.invalidateQueries({ queryKey: ["admin"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  if (q.isLoading) return <Loader2 className="h-5 w-5 animate-spin" />;
  if (q.error) return <p className="text-sm text-destructive">{(q.error as Error).message}</p>;
  const prices: any[] = (q.data as any).prices;
  const find = (plan: string, interval: string) => prices.find((p) => p.lookup_key === `lb_${plan}_${interval}`);
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Changing a price creates a new Stripe price. New sign-ups pay it straight away. Existing subscribers keep what they pay today. The pricing page shows fixed labels, so tell me if you want those updated too.</p>
      <div className="overflow-x-auto rounded border">
        <Table>
          <TableHeader><TableRow><TableHead>Plan</TableHead><TableHead>Monthly (£)</TableHead><TableHead>Yearly (£)</TableHead></TableRow></TableHeader>
          <TableBody>
            {PLAN_IDS.map((plan) => (
              <TableRow key={plan}>
                <TableCell className="font-medium">{TIER_NAMES[plan]}</TableCell>
                {["monthly", "yearly"].map((interval) => {
                  const p = find(plan, interval); const k = `${plan}_${interval}`;
                  return (
                    <TableCell key={interval}>
                      {p ? (
                        <div className="flex items-center gap-2">
                          <Input type="number" min={1} step="1" className="w-28" value={edit[k] ?? String(p.amount_gbp)} onChange={(e) => setEdit({ ...edit, [k]: e.target.value })} />
                          <Button size="sm" variant="outline" disabled={!edit[k] || Number(edit[k]) === p.amount_gbp} onClick={() => setConfirm({ plan, interval, from: p.amount_gbp, to: Number(edit[k]) })}>Change</Button>
                        </div>
                      ) : <span className="text-xs text-destructive">No price found</span>}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {confirm && (
        <Dialog open onOpenChange={(o) => !o && setConfirm(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Change {TIER_NAMES[confirm.plan]} {confirm.interval} price?</DialogTitle>
              <DialogDescription>£{confirm.from} becomes £{confirm.to} for new sign-ups. This changes your live Stripe account. Existing subscribers aren't affected.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirm(null)}>Cancel</Button>
              <Button onClick={() => change.mutate(confirm)} disabled={change.isPending}>{change.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Change price</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function Activity() {
  const q = useQuery({ queryKey: ["admin", "audit"], queryFn: () => admin("audit") });
  if (q.isLoading) return <Loader2 className="h-5 w-5 animate-spin" />;
  const entries: any[] = (q.data as any)?.entries || [];
  if (!entries.length) return <p className="text-sm text-muted-foreground">No admin changes yet.</p>;
  return (
    <div className="overflow-x-auto rounded border">
      <Table>
        <TableHeader><TableRow><TableHead>When (UK)</TableHead><TableHead>Action</TableHead><TableHead>Details</TableHead></TableRow></TableHeader>
        <TableBody>{entries.map((e) => (
          <TableRow key={e.id}>
            <TableCell className="text-xs whitespace-nowrap">{fmtTime(e.created_at)}</TableCell>
            <TableCell><Badge variant="outline">{e.action.replace(/_/g, " ")}</Badge></TableCell>
            <TableCell className="text-xs font-mono max-w-[480px] truncate">{JSON.stringify(e.details)}</TableCell>
          </TableRow>
        ))}</TableBody>
      </Table>
    </div>
  );
}

export default function Admin() {
  const isAdmin = useIsPlatformAdmin();
  const qc = useQueryClient();
  const who = useQuery({ queryKey: ["admin", "whoami"], queryFn: () => admin<{ admin: boolean }>("whoami") });
  if (who.isLoading) return <div className="p-8"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (!who.data?.admin && !isAdmin) return <div className="p-8 text-sm text-muted-foreground">This page is for LeadBoosters administrators.</div>;
  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><ShieldCheck className="h-6 w-6" />Admin</h1>
          <p className="text-sm text-muted-foreground">Customers, plans, limits and prices for LeadBoosters.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ["admin"] })}><RefreshCw className="h-4 w-4 mr-2" />Refresh</Button>
      </div>
      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="limits">Plans &amp; limits</TabsTrigger>
          <TabsTrigger value="prices">Prices</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="pt-4"><Overview /></TabsContent>
        <TabsContent value="users" className="pt-4"><Users /></TabsContent>
        <TabsContent value="limits" className="pt-4"><Limits /></TabsContent>
        <TabsContent value="prices" className="pt-4"><Prices /></TabsContent>
        <TabsContent value="activity" className="pt-4"><Activity /></TabsContent>
      </Tabs>
    </div>
  );
}
