import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { apiClient } from "@/lib/api/client";
import { callingTables } from "@/lib/calling/db";
import {
  CALL_OUTCOMES,
  CALLING_PRODUCTS,
  DEFAULT_SCRIPTS,
  OUTCOME_LABELS,
  fillScript,
  type CallOutcome,
  type CallingCampaign,
  type CallingProduct,
  type CallingQueueItem,
  type ScreeningStatus,
} from "@/lib/calling/types";
import { PhoneServiceDialog } from "@/components/integrations/PhoneServiceDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Phone, PhoneCall, MessageSquare, Mail, Loader2, Plus, ArrowLeft,
  ShieldAlert, Pause, Play, CheckCircle2, Settings, Ban,
} from "lucide-react";

function statusBadge(status: string) {
  const map: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    ready: "bg-sky-100 text-sky-800",
    active: "bg-emerald-100 text-emerald-800",
    paused: "bg-amber-100 text-amber-800",
    completed: "bg-violet-100 text-violet-800",
    pending: "bg-muted",
    calling: "bg-sky-100 text-sky-800",
    blocked: "bg-red-100 text-red-800",
    listed: "bg-red-100 text-red-800",
    clear: "bg-emerald-100 text-emerald-800",
    unknown: "bg-amber-50 text-amber-800",
  };
  return map[status] || "bg-muted";
}

export default function Calling() {
  const { campaignId } = useParams();
  if (campaignId) return <CallingConsole campaignId={campaignId} />;
  return <CallingList />;
}

function CallingList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [name, setName] = useState("");
  const [product, setProduct] = useState<CallingProduct>("TalkStay");
  const [callerPhone, setCallerPhone] = useState("");
  const [limit, setLimit] = useState(20);

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ["calling-campaigns"],
    queryFn: async () => {
      const { data, error } = await callingTables.campaigns()
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as CallingCampaign[];
    },
  });

  const { data: companies } = useQuery({
    queryKey: ["companies-with-phone"],
    queryFn: async () => {
      const { data } = await supabase
        .from("companies")
        .select("id, name, company_phone, general_email, industry")
        .not("company_phone", "is", null)
        .order("name")
        .limit(200);
      return data || [];
    },
  });

  const { data: phoneConnections } = useQuery({
    queryKey: ["phone-service-connections"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase
        .from("crm_connections")
        .select("*")
        .eq("user_id", user.id)
        .eq("provider", "twilio")
        .eq("status", "active");
      return data || [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      if (!name.trim()) throw new Error("Give the campaign a name");
      const leads = (companies || []).slice(0, limit);
      if (leads.length === 0) throw new Error("No companies with phone numbers to queue");

      const { data: campaign, error } = await callingTables.campaigns().insert({
        user_id: user.id,
        name: name.trim(),
        product,
        status: "draft",
        script: DEFAULT_SCRIPTS[product],
        caller_phone: callerPhone.trim() || null,
        connection_id: phoneConnections?.[0]?.id || null,
        max_queue_size: limit,
        notes: "Human-assisted calling. Screen TPS/CTPS before going live.",
      }).select("*").single();
      if (error || !campaign) throw error || new Error("Failed to create campaign");

      const rows = leads.map((c, i) => ({
        campaign_id: (campaign as CallingCampaign).id,
        user_id: user.id,
        company_id: c.id,
        company_name: c.name,
        phone: c.company_phone,
        email: c.general_email,
        queue_position: i + 1,
        status: "pending",
        tps_status: "unknown",
        ctps_status: "unknown",
      }));
      const { error: qErr } = await callingTables.queue().insert(rows);
      if (qErr) throw qErr;
      return campaign as CallingCampaign;
    },
    onSuccess: (campaign) => {
      queryClient.invalidateQueries({ queryKey: ["calling-campaigns"] });
      toast.success("Draft calling campaign created — screen numbers before calling");
      setCreating(false);
      setName("");
      navigate(`/calling/${campaign.id}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <PhoneCall className="h-7 w-7" />
            Calling campaigns
          </h1>
          <p className="text-muted-foreground mt-1 max-w-2xl">
            Human-assisted click-to-call. Twilio rings your phone first, then connects the property.
            No AI cold-calling. Numbers must be screened against TPS/CTPS and your do-not-call list.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setPhoneOpen(true)}>
            <Settings className="h-4 w-4 mr-2" />
            Twilio
          </Button>
          <Button onClick={() => setCreating((v) => !v)}>
            <Plus className="h-4 w-4 mr-2" />
            New campaign
          </Button>
        </div>
      </div>

      {!phoneConnections?.length && (
        <Alert>
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription>
            Connect Twilio (Account SID, Auth Token, UK number, and your caller handset) before placing live calls.
          </AlertDescription>
        </Alert>
      )}

      {creating && (
        <Card>
          <CardHeader>
            <CardTitle>Create a calling queue</CardTitle>
            <CardDescription>
              First version queues up to 20 companies that already have a phone number. Work/ChatGPT can also create drafts via the API — it cannot auto-dial.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Campaign name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="TalkStay Cardiff hotels — week 1" />
            </div>
            <div className="space-y-2">
              <Label>Product</Label>
              <Select value={product} onValueChange={(v) => setProduct(v as CallingProduct)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CALLING_PRODUCTS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Queue size (max 20)</Label>
              <Input type="number" min={1} max={20} value={limit} onChange={(e) => setLimit(Math.min(20, Math.max(1, Number(e.target.value) || 20)))} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Your phone (Twilio rings this first)</Label>
              <Input value={callerPhone} onChange={(e) => setCallerPhone(e.target.value)} placeholder="+4477..." />
            </div>
            <div className="sm:col-span-2 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCreating(false)}>Cancel</Button>
              <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create draft queue
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : !campaigns?.length ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            No calling campaigns yet. Create a draft queue of up to 20 screened properties.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {campaigns.map((c) => (
            <Card key={c.id} className="cursor-pointer hover:border-primary/40" onClick={() => navigate(`/calling/${c.id}`)}>
              <CardContent className="py-4 flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{c.name}</p>
                    <Badge className={statusBadge(c.status)}>{c.status}</Badge>
                    <Badge variant="outline">{c.product}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Created {new Date(c.created_at).toLocaleString()} · max {c.max_queue_size} leads
                  </p>
                </div>
                <Button variant="outline" size="sm">Open console</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <PhoneServiceDialog open={phoneOpen} onOpenChange={setPhoneOpen} />
    </div>
  );
}

function CallingConsole({ campaignId }: { campaignId: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [smsDraft, setSmsDraft] = useState("");
  const [notes, setNotes] = useState("");
  const [calling, setCalling] = useState(false);
  const [sendingSms, setSendingSms] = useState(false);

  const { data: campaign } = useQuery({
    queryKey: ["calling-campaign", campaignId],
    queryFn: async () => {
      const { data, error } = await callingTables.campaigns().select("*").eq("id", campaignId).maybeSingle();
      if (error) throw error;
      return data as CallingCampaign | null;
    },
  });

  const { data: queue } = useQuery({
    queryKey: ["calling-queue", campaignId],
    queryFn: async () => {
      const { data, error } = await callingTables.queue()
        .select("*")
        .eq("campaign_id", campaignId)
        .order("queue_position");
      if (error) throw error;
      return (data || []) as CallingQueueItem[];
    },
  });

  const current = useMemo(
    () => (queue || []).find((q) => q.status === "calling") || (queue || []).find((q) => q.status === "pending"),
    [queue],
  );

  const updateCampaign = useMutation({
    mutationFn: async (patch: Partial<CallingCampaign>) => {
      const { error } = await callingTables.campaigns().update(patch).eq("id", campaignId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["calling-campaign", campaignId] }),
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<CallingQueueItem> }) => {
      const { error } = await callingTables.queue().update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["calling-queue", campaignId] }),
  });

  const startCall = async () => {
    if (!current) return;
    if (current.tps_status === "listed" || current.ctps_status === "listed") {
      toast.error("This number is TPS/CTPS listed — mark it blocked or skip it.");
      return;
    }
    if (campaign?.status === "draft") {
      await updateCampaign.mutateAsync({ status: "ready" });
    }
    setCalling(true);
    const { data, error } = await apiClient.callFunction("twilio-click-to-call", { queue_item_id: current.id });
    setCalling(false);
    if (error || (data as { error?: string })?.error) {
      toast.error((data as { error?: string })?.error || error?.message || "Call failed");
      return;
    }
    toast.success("Twilio is ringing your phone. Answer, then you'll be connected to the property.");
    queryClient.invalidateQueries({ queryKey: ["calling-queue", campaignId] });
    queryClient.invalidateQueries({ queryKey: ["calling-campaign", campaignId] });
  };

  const recordOutcome = async (outcome: CallOutcome) => {
    if (!current) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const followUpAt = outcome === "call_back"
      ? new Date(Date.now() + 4 * 3600_000).toISOString()
      : outcome === "no_answer"
        ? new Date(Date.now() + 24 * 3600_000).toISOString()
        : null;

    await updateItem.mutateAsync({
      id: current.id,
      patch: { outcome, status: "completed", notes: notes || current.notes, follow_up_at: followUpAt },
    });

    if (outcome === "do_not_call" || outcome === "not_interested" || outcome === "invalid_number") {
      await callingTables.suppression().upsert({
        user_id: user.id,
        phone: current.phone,
        email: current.email,
        reason: outcome === "invalid_number" ? "invalid" : "dnc",
        source: "call_outcome",
        notes: notes || outcome,
      });
    }

    setNotes("");
    toast.success(`Logged: ${OUTCOME_LABELS[outcome]}`);
  };

  const sendSms = async () => {
    if (!current || !smsDraft.trim()) return;
    setSendingSms(true);
    const { data, error } = await apiClient.callFunction("send-campaign-sms", {
      queue_item_id: current.id,
      message: smsDraft.trim(),
    });
    setSendingSms(false);
    if (error || (data as { error?: string })?.error) {
      toast.error((data as { error?: string })?.error || error?.message || "SMS failed");
      return;
    }
    toast.success("SMS queued via Twilio");
    setSmsDraft("");
  };

  const sendEmailFollowup = async () => {
    if (!current?.email) {
      toast.error("This lead has no email on file");
      return;
    }
    const subject = campaign?.email_followup_subject || `Following up — ${campaign?.product || "LeadBoosters"}`;
    const bodyText = campaign?.email_followup_body || `Hi ${current.contact_name || current.company_name || "there"},\n\nThanks for the conversation just now. I'll send the details we discussed.\n\nBest`;
    const { error } = await apiClient.callFunction("send-crm-email", {
      toEmail: current.email,
      toName: current.contact_name || current.company_name,
      subject,
      bodyText,
      body: bodyText,
      companyId: current.company_id,
    });
    if (error) toast.error(error.message);
    else toast.success("Follow-up email sent");
  };

  if (!campaign) {
    return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const script = fillScript(campaign.script || DEFAULT_SCRIPTS[campaign.product], {
    company: current?.company_name || "the business",
    caller: campaign.assigned_caller || "me",
    product: campaign.product,
  });

  const blocked = current && (current.tps_status === "listed" || current.ctps_status === "listed" || current.status === "blocked");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/calling")}><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <h1 className="text-2xl font-bold">{campaign.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge className={statusBadge(campaign.status)}>{campaign.status}</Badge>
              <Badge variant="outline">{campaign.product}</Badge>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {campaign.status !== "paused" && campaign.status !== "completed" && (
            <Button variant="outline" onClick={() => updateCampaign.mutate({ status: "paused" })}>
              <Pause className="h-4 w-4 mr-2" /> Pause
            </Button>
          )}
          {(campaign.status === "paused" || campaign.status === "draft") && (
            <Button variant="outline" onClick={() => updateCampaign.mutate({ status: "ready" })}>
              <Play className="h-4 w-4 mr-2" /> Ready to call
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Current lead</CardTitle>
            <CardDescription>
              {current
                ? "Twilio calls you first, then connects this number. Identify yourself and display a valid CLI."
                : "Queue is empty or finished."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {current ? (
              <>
                <div>
                  <p className="text-xl font-semibold">{current.company_name || current.contact_name || "Unknown"}</p>
                  <p className="text-sm text-muted-foreground">{current.contact_name}</p>
                  <p className="font-mono text-sm mt-1">{current.phone}</p>
                  {current.email && <p className="text-sm">{current.email}</p>}
                </div>

                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-xs text-muted-foreground">TPS</span>
                  <Select value={current.tps_status} onValueChange={(v) => updateItem.mutate({ id: current.id, patch: { tps_status: v as ScreeningStatus } })}>
                    <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unknown">unknown</SelectItem>
                      <SelectItem value="pending">pending</SelectItem>
                      <SelectItem value="clear">clear</SelectItem>
                      <SelectItem value="listed">listed</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-xs text-muted-foreground">CTPS</span>
                  <Select value={current.ctps_status} onValueChange={(v) => updateItem.mutate({ id: current.id, patch: { ctps_status: v as ScreeningStatus } })}>
                    <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unknown">unknown</SelectItem>
                      <SelectItem value="pending">pending</SelectItem>
                      <SelectItem value="clear">clear</SelectItem>
                      <SelectItem value="listed">listed</SelectItem>
                    </SelectContent>
                  </Select>
                  <label className="flex items-center gap-2 text-xs">
                    <Checkbox checked={current.sms_consent} onCheckedChange={(c) => updateItem.mutate({ id: current.id, patch: { sms_consent: !!c } })} />
                    SMS consent
                  </label>
                </div>

                {blocked && (
                  <Alert className="border-red-300 bg-red-50">
                    <Ban className="h-4 w-4" />
                    <AlertDescription>This number is blocked (TPS/CTPS listed or suppressed). Do not call.</AlertDescription>
                  </Alert>
                )}

                <div className="rounded-lg border bg-muted/40 p-4 whitespace-pre-wrap text-sm">{script}</div>

                <Button size="lg" className="w-full" onClick={startCall} disabled={calling || !!blocked}>
                  {calling ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Phone className="h-4 w-4 mr-2" />}
                  Call next lead
                </Button>

                <div className="space-y-2">
                  <Label>Call notes</Label>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Who you spoke to, what they asked for…" />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {CALL_OUTCOMES.map((o) => (
                    <Button key={o} variant="outline" size="sm" onClick={() => recordOutcome(o)}>
                      {OUTCOME_LABELS[o]}
                    </Button>
                  ))}
                </div>

                <div className="grid gap-3 sm:grid-cols-2 pt-2">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2"><MessageSquare className="h-4 w-4" /> SMS follow-up</Label>
                    <Textarea
                      value={smsDraft}
                      onChange={(e) => setSmsDraft(e.target.value)}
                      placeholder={campaign.sms_template || "Thanks for the chat — I'll send the TalkStay overview."}
                    />
                    <Button variant="outline" size="sm" onClick={sendSms} disabled={sendingSms}>
                      {sendingSms ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                      Send SMS
                    </Button>
                    <p className="text-[11px] text-muted-foreground">Blocked unless the contact consented or you logged a live-call outcome.</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2"><Mail className="h-4 w-4" /> Email follow-up</Label>
                    <p className="text-sm text-muted-foreground">Uses your connected email provider (Gmail / Resend / SMTP).</p>
                    <Button variant="outline" size="sm" onClick={sendEmailFollowup} disabled={!current.email}>
                      Send email follow-up
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="py-10 text-center text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2" />
                No pending leads. Mark the campaign complete or add more companies.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Queue</CardTitle>
            <CardDescription>{queue?.length || 0} leads</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[32rem]">
              <div className="space-y-2">
                {(queue || []).map((q) => (
                  <div key={q.id} className={`rounded-md border p-2 text-sm ${q.id === current?.id ? "border-primary" : ""}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium truncate">{q.company_name || q.phone}</span>
                      <Badge className={statusBadge(q.outcome || q.status)}>{q.outcome || q.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">{q.phone}</p>
                    <div className="flex gap-1 mt-1">
                      <Badge variant="outline" className={statusBadge(q.tps_status)}>TPS {q.tps_status}</Badge>
                      <Badge variant="outline" className={statusBadge(q.ctps_status)}>CTPS {q.ctps_status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
