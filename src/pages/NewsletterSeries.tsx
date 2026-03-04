import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  Plus,
  CalendarClock,
  ArrowLeft,
  Newspaper,
  Send,
  Pause,
  Play,
  CheckCircle2,
  ChevronDown,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";

type Series = {
  id: string;
  user_id: string;
  name: string;
  duration_days: number;
  send_time: string;
  timezone: string;
  scheduled_send_options: Record<string, unknown> | null;
  start_date: string;
  status: string;
  ai_topic_template: string | null;
  ai_tone: string | null;
  ai_target_audience: string | null;
  sender_profile_id: string | null;
  header_image_urls: string[] | null;
  created_at: string;
  updated_at: string;
};

type Edition = {
  id: string;
  series_id: string;
  edition_date: string;
  newsletter_id: string;
  created_at: string;
  newsletters?: { id: string; title: string; subject: string; status: string; total_sent?: number } | null;
};

type Subscriber = {
  id: string;
  email: string;
  industry?: string | null;
};

export default function NewsletterSeries() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [durationDays, setDurationDays] = useState<7 | 30>(7);
  const [sendTime, setSendTime] = useState("09:00");
  const [timezone, setTimezone] = useState("Europe/London");
  const [startDate, setStartDate] = useState("");
  const [aiTopicTemplate, setAiTopicTemplate] = useState(
    "Daily tip for our subscribers. Day {day} of {total}. Share something valuable and actionable."
  );
  const [aiTone, setAiTone] = useState("professional");
  const [aiTargetAudience, setAiTargetAudience] = useState("subscribers and leads");
  const [sendTargets, setSendTargets] = useState<string[]>([]);
  const [headerImageUrlsText, setHeaderImageUrlsText] = useState("");
  const [pausingId, setPausingId] = useState<string | null>(null);

  const { data: seriesList = [], isLoading, isError: seriesQueryError, refetch: refetchSeries } = useQuery({
    queryKey: ["newsletter-series", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("newsletter_series")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Series[];
    },
    enabled: !!user?.id,
  });

  const { data: editionsBySeries = {} } = useQuery({
    queryKey: ["newsletter-series-editions", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("newsletter_series_editions")
        .select("id, series_id, edition_date, newsletter_id, newsletters(id, title, subject, status, total_sent)");
      if (error) throw error;
      const map: Record<string, Edition[]> = {};
      (data || []).forEach((e: Edition) => {
        if (!map[e.series_id]) map[e.series_id] = [];
        map[e.series_id].push(e);
      });
      return map;
    },
    enabled: !!user?.id,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["newsletter-categories-series"],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("newsletter_categories")
        .select("id, name")
        .eq("user_id", user.id)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id && showCreate,
  });

  const { data: recipientGroups = [] } = useQuery({
    queryKey: ["recipient-groups-series"],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("recipient_groups")
        .select("id, name")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id && showCreate,
  });

  const { data: subscribers = [] } = useQuery({
    queryKey: ["newsletter-subscribers-series"],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("newsletter_subscribers")
        .select("id, email, industry")
        .eq("user_id", user.id)
        .eq("status", "active");
      if (error) throw error;
      return (data || []) as Subscriber[];
    },
    enabled: !!user?.id && showCreate,
  });

  const industryCounts = subscribers.reduce<Record<string, number>>((acc, s) => {
    const ind = (s.industry || "").trim();
    if (ind) acc[ind] = (acc[ind] || 0) + 1;
    return acc;
  }, {});
  const industryList = Object.keys(industryCounts).sort();

  const buildScheduledSendOptions = () => {
    if (sendTargets.length === 0 || sendTargets.includes("all")) return null;
    const categoryFilters: string[] = [];
    const recipientGroupIds: string[] = [];
    const industryFilter: string[] = [];
    for (const t of sendTargets) {
      if (t.startsWith("cat:")) categoryFilters.push(t.slice(5));
      else if (t.startsWith("group:")) recipientGroupIds.push(t.slice(6));
      else if (t.startsWith("industry:")) industryFilter.push(decodeURIComponent(t.slice(9)));
    }
    const opts: Record<string, unknown> = {};
    if (categoryFilters.length) opts.categoryFilters = categoryFilters;
    if (recipientGroupIds.length) opts.recipientGroupIds = recipientGroupIds;
    if (industryFilter.length) opts.industryFilter = industryFilter;
    return Object.keys(opts).length ? opts : null;
  };

  const handleCreate = async () => {
    if (!user || !name.trim() || !startDate.trim()) {
      toast({ title: "Required", description: "Name and start date are required.", variant: "destructive" });
      return;
    }
    const start = new Date(startDate);
    if (isNaN(start.getTime()) || start < new Date()) {
      toast({ title: "Invalid date", description: "Start date must be today or in the future.", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      const headerImageUrls = headerImageUrlsText
        .split(/[\n,]+/)
        .map(u => u.trim())
        .filter(Boolean);
      const { error } = await supabase.from("newsletter_series").insert({
        user_id: user.id,
        name: name.trim(),
        duration_days: durationDays,
        send_time: sendTime.trim() || "09:00",
        timezone: timezone.trim() || "Europe/London",
        scheduled_send_options: buildScheduledSendOptions(),
        start_date: startDate,
        status: "active",
        ai_topic_template: aiTopicTemplate.trim() || null,
        ai_tone: aiTone || "professional",
        ai_target_audience: aiTargetAudience.trim() || "",
        header_image_urls: headerImageUrls.length ? headerImageUrls : null,
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["newsletter-series"] });
      setShowCreate(false);
      setName("");
      setStartDate("");
      toast({ title: "Series created", description: `"${name}" will send daily at ${sendTime} ${timezone} for ${durationDays} days.` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handlePauseResume = async (series: Series) => {
    if (!user) return;
    setPausingId(series.id);
    try {
      const newStatus = series.status === "active" ? "paused" : "active";
      const { error } = await supabase
        .from("newsletter_series")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", series.id)
        .eq("user_id", user.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["newsletter-series"] });
      toast({ title: newStatus === "paused" ? "Paused" : "Resumed", description: `Series "${series.name}" ${newStatus}.` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setPausingId(null);
    }
  };

  const defaultStartDate = () => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  };

  if (!user) {
    return (
      <div className="max-w-full min-h-[40vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-full">
      <div className="container mx-auto p-6 max-w-5xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/newsletters">
              <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Newspaper className="h-7 w-7" /> Newsletter Series
              </h1>
              <p className="text-muted-foreground">
                Run a daily newsletter for 7 or 30 days. AI generates content and sends at 9:00 AM London time.
              </p>
            </div>
          </div>
          <Button onClick={() => { setShowCreate(true); if (!startDate) setStartDate(defaultStartDate()); }}>
            <Plus className="h-4 w-4 mr-1.5" /> New Series
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Active & completed series</CardTitle>
            <CardDescription>Each series sends one AI-generated newsletter per day at the configured time.</CardDescription>
          </CardHeader>
          <CardContent>
            {seriesQueryError ? (
              <div className="text-center py-12 space-y-3">
                <p className="font-medium text-destructive">Could not load series</p>
                <p className="text-sm text-muted-foreground">The newsletter series list could not be loaded. Make sure database migrations are applied.</p>
                <Button variant="outline" onClick={() => refetchSeries()}>Retry</Button>
              </div>
            ) : isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : seriesList.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <CalendarClock className="h-12 w-12 mx-auto text-muted-foreground/50" />
                <p className="font-medium">No series yet</p>
                <p className="text-sm text-muted-foreground">Create a 7- or 30-day series to send daily newsletters at 9:00 AM London time.</p>
                <Button onClick={() => { setShowCreate(true); setStartDate(defaultStartDate()); }}><Plus className="h-4 w-4 mr-1.5" />Create Series</Button>
              </div>
            ) : (
              <div className="divide-y">
                {seriesList.map((s) => {
                  const editions = editionsBySeries[s.id] || [];
                  return (
                    <div key={s.id} className="flex items-center justify-between py-4 first:pt-0">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{s.name}</span>
                          <Badge variant={s.status === "active" ? "default" : s.status === "completed" ? "secondary" : "outline"}>
                            {s.status}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {s.duration_days} days · {s.send_time} {s.timezone}
                          </span>
                        </div>
                        <div className="text-sm text-muted-foreground mt-0.5">
                          Started {new Date(s.start_date).toLocaleDateString()} · {editions.length} sent
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {s.status === "active" && (
                          <Button variant="outline" size="sm" onClick={() => handlePauseResume(s)} disabled={pausingId === s.id}>
                            {pausingId === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pause className="h-3.5 w-3.5" />} Pause
                          </Button>
                        )}
                        {s.status === "paused" && (
                          <Button variant="outline" size="sm" onClick={() => handlePauseResume(s)} disabled={pausingId === s.id}>
                            {pausingId === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />} Resume
                          </Button>
                        )}
                        {editions.length > 0 && (
                          <Link to="/newsletters">
                            <Button variant="ghost" size="sm"><Send className="h-3.5 w-3.5 mr-1" />View editions</Button>
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-h-[90vh] overflow-y-auto max-w-lg">
          <DialogHeader>
            <DialogTitle>Create newsletter series</DialogTitle>
            <DialogDescription>
              AI will generate and send one newsletter every day at the set time (e.g. 9:00 AM London) for 7 or 30 days.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Series name</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Weekly tips" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Duration</Label>
                <Select value={String(durationDays)} onValueChange={v => setDurationDays(Number(v) as 7 | 30)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">7 days</SelectItem>
                    <SelectItem value="30">30 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Start date</Label>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} min={defaultStartDate()} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Send time</Label>
                <Input type="time" value={sendTime} onChange={e => setSendTime(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Timezone</Label>
                <Select value={timezone} onValueChange={setTimezone}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Europe/London">Europe/London (9:00 AM)</SelectItem>
                    <SelectItem value="UTC">UTC</SelectItem>
                    <SelectItem value="America/New_York">America/New_York</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Send to</Label>
              <p className="text-xs text-muted-foreground">Leave default for all active subscribers.</p>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between font-normal">
                    <span>{sendTargets.length === 0 || sendTargets.includes("all") ? "All active subscribers" : `${sendTargets.length} selected`}</span>
                    <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] max-h-[280px] overflow-y-auto p-2" align="start">
                  <label className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer hover:bg-muted">
                    <Checkbox
                      checked={sendTargets.length === 0 || sendTargets.includes("all")}
                      onCheckedChange={c => { if (c) setSendTargets(["all"]); else setSendTargets([]); }}
                    />
                    All active subscribers
                  </label>
                  {categories.length > 0 && (
                    <>
                      <div className="text-xs font-medium text-muted-foreground px-2 pt-2">Categories</div>
                      {categories.map((c: { id: string; name: string }) => {
                        const v = `cat:${c.id}`;
                        return (
                          <label key={c.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer hover:bg-muted">
                            <Checkbox
                              checked={sendTargets.includes(v)}
                              onCheckedChange={c => { if (c) setSendTargets(prev => prev.filter(t => t !== "all").concat(v)); else setSendTargets(prev => prev.filter(t => t !== v)); }}
                            />
                            {c.name}
                          </label>
                        );
                      })}
                    </>
                  )}
                  {recipientGroups.length > 0 && (
                    <>
                      <div className="text-xs font-medium text-muted-foreground px-2 pt-2">Recipient groups</div>
                      {recipientGroups.map((g: { id: string; name: string }) => {
                        const v = `group:${g.id}`;
                        return (
                          <label key={g.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer hover:bg-muted">
                            <Checkbox
                              checked={sendTargets.includes(v)}
                              onCheckedChange={c => { if (c) setSendTargets(prev => prev.filter(t => t !== "all").concat(v)); else setSendTargets(prev => prev.filter(t => t !== v)); }}
                            />
                            {g.name}
                          </label>
                        );
                      })}
                    </>
                  )}
                  {industryList.length > 0 && (
                    <>
                      <div className="text-xs font-medium text-muted-foreground px-2 pt-2">Industry</div>
                      {industryList.map(ind => {
                        const v = `industry:${encodeURIComponent(ind)}`;
                        return (
                          <label key={ind} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer hover:bg-muted">
                            <Checkbox
                              checked={sendTargets.includes(v)}
                              onCheckedChange={c => { if (c) setSendTargets(prev => prev.filter(t => t !== "all").concat(v)); else setSendTargets(prev => prev.filter(t => t !== v)); }}
                            />
                            {ind} ({industryCounts[ind]})
                          </label>
                        );
                      })}
                    </>
                  )}
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1.5">
              <Label>Header images for daily emails (optional)</Label>
              <p className="text-xs text-muted-foreground">One URL per line. Day 1 uses the first image, Day 2 the second, etc.; cycles so each email can have a different header.</p>
              <Textarea
                value={headerImageUrlsText}
                onChange={e => setHeaderImageUrlsText(e.target.value)}
                rows={2}
                placeholder={"https://example.com/header1.png\nhttps://example.com/header2.png"}
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label>AI topic template</Label>
              <p className="text-xs text-muted-foreground">Use {"{day}"} and {"{total}"} for day number and total days.</p>
              <Textarea
                value={aiTopicTemplate}
                onChange={e => setAiTopicTemplate(e.target.value)}
                rows={3}
                placeholder="Daily tip for our subscribers. Day {day} of {total}."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Tone</Label>
                <Select value={aiTone} onValueChange={setAiTone}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="friendly">Friendly</SelectItem>
                    <SelectItem value="casual">Casual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Target audience (for AI)</Label>
                <Input value={aiTargetAudience} onChange={e => setAiTargetAudience(e.target.value)} placeholder="subscribers" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating || !name.trim() || !startDate}>
              {creating ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Creating...</> : <><CheckCircle2 className="h-4 w-4 mr-1.5" />Create series</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
