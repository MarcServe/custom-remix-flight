import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, Copy, Check, Wand2, MessageSquareText, Plug, Mail, Newspaper, ArrowRight, Loader2 } from "lucide-react";

type Kind = "campaign" | "newsletter";

// Build a self-contained prompt the user can paste into ANY AI chat (Claude, ChatGPT, Gemini).
function buildChatPrompt(kind: Kind, brief: string, audience: string) {
  if (kind === "newsletter") {
    return `You are helping me write an email NEWSLETTER for my subscribers.

Topic / brief: ${brief || "(describe what this edition is about)"}

Write it in a warm, useful, non-salesy tone. Then reply in EXACTLY this format and nothing else:

SUBJECT: <a compelling subject line>
BODY:
<the newsletter body — a few short sections, plain text with line breaks>`;
  }
  return `You are helping me write a cold-outreach email CAMPAIGN that will be sent to many recipients.

What it's about: ${brief || "(describe the offer / reason for reaching out)"}
Who it's for: ${audience || "(describe the audience)"}

Rules:
- Keep it ~90–140 words, warm and human, one clear call to action.
- Personalise using the EXACT merge tokens {{firstName}} and {{company}} (do not use real names).
- No signature or sign-off name (it's added automatically).

Reply in EXACTLY this format and nothing else:

SUBJECT: <subject line, may use {{firstName}} or {{company}}>
BODY:
<the email body, using {{firstName}} and {{company}} where natural>`;
}

function parseChatReply(text: string): { subject: string; body: string } {
  const subjMatch = text.match(/SUBJECT:\s*(.+)/i);
  const subject = subjMatch ? subjMatch[1].trim() : "";
  const bodyIdx = text.search(/BODY:\s*/i);
  let body = "";
  if (bodyIdx !== -1) {
    body = text.slice(bodyIdx).replace(/^BODY:\s*/i, "").trim();
  } else if (!subject) {
    body = text.trim(); // no markers — treat whole paste as the body
  }
  return { subject, body };
}

const API_ENDPOINT = "https://kgndpwzqohepotahnfeo.supabase.co/functions/v1/api-campaigns";

export default function AiCreate() {
  const navigate = useNavigate();
  const [kind, setKind] = useState<Kind>("campaign");
  const [brief, setBrief] = useState("");
  const [audience, setAudience] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [pasteVal, setPasteVal] = useState("");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [creatingKey, setCreatingKey] = useState(false);

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied((c) => (c === id ? null : c)), 1500);
  };

  const generate = async () => {
    if (!brief.trim()) { toast.error("Tell the AI what this is about first."); return; }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-email-with-ai", {
        body: kind === "newsletter"
          ? { context: "newsletter", prompt: brief }
          : { context: "campaign", prompt: brief, audience },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      if (kind === "newsletter") {
        setBody(data.generatedEmail || "");
        if (!subject) setSubject("");
      } else {
        setSubject(data.subject || "");
        setBody(data.body || "");
      }
      toast.success("Draft written — review and edit below, then save.");
    } catch (e: any) {
      toast.error(e?.message || "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const applyPaste = () => {
    const { subject: s, body: b } = parseChatReply(pasteVal);
    if (!b) { toast.error("Couldn't find a BODY in that paste. Include the SUBJECT: / BODY: lines."); return; }
    if (s) setSubject(s);
    setBody(b);
    toast.success("Imported — review and edit below, then save.");
  };

  const saveDraft = async () => {
    if (!subject.trim() && kind === "campaign") { toast.error("Add a subject line."); return; }
    if (!body.trim()) { toast.error("The body is empty."); return; }
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Not signed in.");
      const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short" });

      if (kind === "newsletter") {
        const html = /<[a-z][\s\S]*>/i.test(body) ? body : `<p>${body.replace(/\n{2,}/g, "</p><p>").replace(/\n/g, "<br/>")}</p>`;
        const { error } = await supabase.from("newsletters").insert({
          user_id: userId,
          title: subject.trim() || `AI newsletter · ${today}`,
          subject: subject.trim() || `AI newsletter · ${today}`,
          body_html: html,
          status: "draft",
        });
        if (error) throw error;
        toast.success("Newsletter draft saved.");
        navigate("/newsletters");
      } else {
        const html = `<p>${body.replace(/\n{2,}/g, "</p><p>").replace(/\n/g, "<br/>")}</p>`;
        const { error } = await supabase.from("email_campaigns").insert({
          user_id: userId,
          name: `AI campaign · ${today}`,
          subject_template: subject.trim(),
          body_html_template: html,
          body_text_template: body,
          status: "draft",
          total_recipients: 0,
        });
        if (error) throw error;
        toast.success("Campaign draft saved. Add recipients in the composer.");
        navigate("/campaigns");
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to save draft");
    } finally {
      setSaving(false);
    }
  };

  const createKey = async () => {
    setCreatingKey(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-api-keys", {
        body: { action: "create", name: "AI Assistant" },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setRevealedKey(data.key);
    } catch (e: any) {
      toast.error(e?.message || "Failed to create key");
    } finally {
      setCreatingKey(false);
    }
  };

  const keyShown = revealedKey || "lb_live_YOUR_KEY";
  const mcpCommand = `claude mcp add leadboosters --env LEADBOOSTERS_API_KEY=${keyShown} -- npx -y leadboosters-mcp`;
  const dailyPrompt = `Every morning, draft a fresh outreach email campaign and a newsletter in LeadBoosters as DRAFTS (never send). Use the leadboosters tools create_campaign and create_newsletter, leave schedule_at empty, and reply with the draft IDs so I can review and send from the app.`;

  const TypeToggle = (
    <div className="inline-flex rounded-lg border p-1 bg-muted/40">
      <button
        onClick={() => setKind("campaign")}
        className={`px-3 py-1.5 text-sm rounded-md flex items-center gap-1.5 ${kind === "campaign" ? "bg-background shadow-sm font-medium" : "text-muted-foreground"}`}
      >
        <Mail className="h-4 w-4" /> Campaign
      </button>
      <button
        onClick={() => setKind("newsletter")}
        className={`px-3 py-1.5 text-sm rounded-md flex items-center gap-1.5 ${kind === "newsletter" ? "bg-background shadow-sm font-medium" : "text-muted-foreground"}`}
      >
        <Newspaper className="h-4 w-4" /> Newsletter
      </button>
    </div>
  );

  const ResultEditor = (
    <div className="space-y-3 mt-5">
      {kind === "campaign" && (
        <div className="space-y-1.5">
          <Label>Subject</Label>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject line" />
        </div>
      )}
      {kind === "newsletter" && (
        <div className="space-y-1.5">
          <Label>Subject / title</Label>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Newsletter subject" />
        </div>
      )}
      <div className="space-y-1.5">
        <Label>Body {kind === "campaign" && <span className="text-xs text-muted-foreground">— uses {"{{firstName}}"} / {"{{company}}"}</span>}</Label>
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={12} placeholder="Email body will appear here…" className="font-mono text-sm" />
      </div>
      <div className="flex items-center gap-2">
        <Button onClick={saveDraft} disabled={saving || !body.trim()}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
          Save as draft
        </Button>
        {body.trim() && (
          <span className="text-xs text-muted-foreground">Saves to {kind === "campaign" ? "Campaigns" : "Newsletters"} → you add recipients & send there.</span>
        )}
      </div>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow">
          <Sparkles className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Create with AI</h1>
          <p className="text-sm text-muted-foreground">Draft a campaign or newsletter in seconds — three easy ways.</p>
        </div>
      </div>

      <Tabs defaultValue="generate" className="mt-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="generate" className="gap-1.5"><Wand2 className="h-4 w-4" /> Generate for me</TabsTrigger>
          <TabsTrigger value="chat" className="gap-1.5"><MessageSquareText className="h-4 w-4" /> Use my AI chat</TabsTrigger>
          <TabsTrigger value="connect" className="gap-1.5"><Plug className="h-4 w-4" /> Automate daily</TabsTrigger>
        </TabsList>

        {/* 1 — In-app generation */}
        <TabsContent value="generate">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Let LeadBoosters write it</CardTitle>
              <CardDescription>No accounts, no keys — just describe it and we draft it for you.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {TypeToggle}
              <div className="space-y-1.5">
                <Label>What's it about?</Label>
                <Textarea value={brief} onChange={(e) => setBrief(e.target.value)} rows={3}
                  placeholder={kind === "campaign" ? "e.g. Offer our free grant-finding tool to UK business networks as a partnership." : "e.g. This week's tips on finding UK small-business grants."} />
              </div>
              {kind === "campaign" && (
                <div className="space-y-1.5">
                  <Label>Who's it for? <span className="text-xs text-muted-foreground">(optional)</span></Label>
                  <Input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="e.g. UK accelerators, chambers of commerce, enterprise agencies" />
                </div>
              )}
              <Button onClick={generate} disabled={generating}>
                {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                Generate {kind}
              </Button>
              {body && ResultEditor}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 2 — Bring your own AI chat */}
        <TabsContent value="chat">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Use ChatGPT, Claude or any AI chat</CardTitle>
              <CardDescription>Copy the prompt into your favourite chat, paste its reply back here, and we turn it into a draft.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {TypeToggle}
              <div className="space-y-1.5">
                <Label>What's it about?</Label>
                <Textarea value={brief} onChange={(e) => setBrief(e.target.value)} rows={2} placeholder="Describe the campaign or newsletter…" />
              </div>
              {kind === "campaign" && (
                <div className="space-y-1.5">
                  <Label>Who's it for? <span className="text-xs text-muted-foreground">(optional)</span></Label>
                  <Input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="Audience" />
                </div>
              )}
              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-muted-foreground">Step 1 — copy this prompt into your AI chat</span>
                  <Button size="sm" variant="outline" onClick={() => copy(buildChatPrompt(kind, brief, audience), "prompt")}>
                    {copied === "prompt" ? <Check className="h-4 w-4 mr-1.5 text-emerald-600" /> : <Copy className="h-4 w-4 mr-1.5" />}
                    Copy prompt
                  </Button>
                </div>
                <pre className="text-xs whitespace-pre-wrap text-muted-foreground max-h-40 overflow-auto">{buildChatPrompt(kind, brief, audience)}</pre>
              </div>
              <div className="space-y-1.5">
                <Label>Step 2 — paste the AI's reply here</Label>
                <Textarea value={pasteVal} onChange={(e) => setPasteVal(e.target.value)} rows={6} placeholder={"SUBJECT: …\nBODY:\n…"} />
                <Button variant="secondary" onClick={applyPaste} disabled={!pasteVal.trim()}>
                  <ArrowRight className="h-4 w-4 mr-2" /> Turn into a draft
                </Button>
              </div>
              {body && ResultEditor}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 3 — Automate daily via Claude/Codex */}
        <TabsContent value="connect">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Run it automatically every day</CardTitle>
              <CardDescription>For power users: connect LeadBoosters to Claude Code / Codex so it drafts for you on a schedule.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label>1. Your API key</Label>
                {revealedKey ? (
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-muted rounded px-2 py-2 break-all">{revealedKey}</code>
                    <Button size="sm" variant="outline" onClick={() => copy(revealedKey, "key")}>
                      {copied === "key" ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                ) : (
                  <Button size="sm" onClick={createKey} disabled={creatingKey}>
                    {creatingKey ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null} Generate a key
                  </Button>
                )}
                <p className="text-xs text-muted-foreground">Shown once — copy it now. Manage keys anytime on the <button className="underline" onClick={() => navigate("/api-keys")}>API Keys</button> page.</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>2. Connect it to Claude Code <span className="text-xs text-muted-foreground">(advanced — needs Node.js)</span></Label>
                  <Button size="sm" variant="outline" onClick={() => copy(mcpCommand, "mcp")}>
                    {copied === "mcp" ? <Check className="h-4 w-4 mr-1.5 text-emerald-600" /> : <Copy className="h-4 w-4 mr-1.5" />} Copy
                  </Button>
                </div>
                <pre className="text-xs whitespace-pre-wrap bg-muted rounded px-2 py-2 break-all">{mcpCommand}</pre>
                <p className="text-xs text-muted-foreground">Prefer a chat? Use the <strong>Use my AI chat</strong> tab instead — no install needed.</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>3. Your daily instruction</Label>
                  <Button size="sm" variant="outline" onClick={() => copy(dailyPrompt, "daily")}>
                    {copied === "daily" ? <Check className="h-4 w-4 mr-1.5 text-emerald-600" /> : <Copy className="h-4 w-4 mr-1.5" />} Copy
                  </Button>
                </div>
                <pre className="text-xs whitespace-pre-wrap bg-muted rounded px-2 py-2">{dailyPrompt}</pre>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
