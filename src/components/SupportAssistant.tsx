import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Bot, Loader2, Send, Sparkles, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string };

const STARTERS = [
  "What campaigns are running right now?",
  "Which follow-ups are going out this week?",
  "Is Autopilot working, and what did it find today?",
  "Anything that needs my attention?",
];

const storeKey = (uid: string) => `lb:support-chat:${uid}`;

// Minimal, safe markdown: paragraphs, bullet/numbered lists, **bold**, `code`, [links](/path).
// App links open in-app; other links open in a new tab. No HTML is ever injected.
function inline(text: string, onNavigate: () => void): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|`([^`]+)`/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] && m[2]) {
      const href = m[2];
      if (href.startsWith("/") && !href.startsWith("//")) {
        out.push(<Link key={i++} to={href} onClick={onNavigate} className="font-medium text-primary underline underline-offset-2">{m[1]}</Link>);
      } else if (/^https?:\/\//i.test(href)) {
        out.push(<a key={i++} href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline underline-offset-2">{m[1]}</a>);
      } else {
        out.push(m[1]);
      }
    } else if (m[3]) out.push(<strong key={i++}>{m[3]}</strong>);
    else if (m[4]) out.push(<code key={i++} className="rounded bg-muted px-1 text-[0.85em]">{m[4]}</code>);
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function Markdown({ text, onNavigate }: { text: string; onNavigate: () => void }) {
  const blocks = text.replace(/\r/g, "").split(/\n{2,}/);
  return (
    <div className="space-y-2">
      {blocks.map((block, bi) => {
        const lines = block.split("\n").filter((l) => l.trim());
        if (lines.length && lines.every((l) => /^\s*[-*•]\s+/.test(l))) {
          return <ul key={bi} className="list-disc space-y-1 pl-5">{lines.map((l, li) => <li key={li}>{inline(l.replace(/^\s*[-*•]\s+/, ""), onNavigate)}</li>)}</ul>;
        }
        if (lines.length && lines.every((l) => /^\s*\d+[.)]\s+/.test(l))) {
          return <ol key={bi} className="list-decimal space-y-1 pl-5">{lines.map((l, li) => <li key={li}>{inline(l.replace(/^\s*\d+[.)]\s+/, ""), onNavigate)}</li>)}</ol>;
        }
        if (lines.length >= 2 && lines.every((l) => l.trim().startsWith("|"))) {
          const rows = lines.filter((l) => !/^\s*\|?\s*:?-{2,}/.test(l)).map((l) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim()));
          return (
            <div key={bi} className="overflow-x-auto">
              <table className="w-full text-xs">
                <tbody>
                  {rows.map((r, ri) => (
                    <tr key={ri} className={ri === 0 ? "font-semibold border-b" : "border-b border-border/50"}>
                      {r.map((c, ci) => <td key={ci} className="py-1 pr-3 align-top">{inline(c, onNavigate)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        return (
          <p key={bi}>
            {lines.map((l, li) => (
              <Fragment key={li}>{li > 0 && <br />}{inline(l.replace(/^#+\s*/, ""), onNavigate)}</Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}

export function SupportAssistant() {
  const { user } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Keep the conversation on this device (per user).
  useEffect(() => {
    if (!user?.id) return;
    try {
      const saved = JSON.parse(localStorage.getItem(storeKey(user.id)) || "[]");
      if (Array.isArray(saved)) setMessages(saved.slice(-40));
    } catch { /* ignore */ }
  }, [user?.id]);
  useEffect(() => {
    if (!user?.id) return;
    try { localStorage.setItem(storeKey(user.id), JSON.stringify(messages.slice(-40))); } catch { /* ignore */ }
  }, [messages, user?.id]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, busy, open]);

  if (!user) return null;

  const ask = async (q: string) => {
    const question = q.trim();
    if (!question || busy) return;
    setError(null);
    const next: Msg[] = [...messages, { role: "user", content: question }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("support-assistant", {
        body: { messages: next.slice(-20), page: location.pathname + location.search },
      });
      let msg = data?.error as string | undefined;
      if (fnErr && !msg) {
        try { msg = (await (fnErr as any).context?.json())?.error; } catch { /* keep */ }
        msg = msg || "The assistant couldn't answer just now. Try again.";
      }
      if (msg) setError(msg);
      else setMessages([...next, { role: "assistant", content: String(data?.reply || "") }]);
    } catch {
      setError("The assistant couldn't answer just now. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "fixed z-40 bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-lg hover:opacity-90",
          open && "hidden",
        )}
        aria-label="Open the LeadBoosters assistant"
      >
        <Sparkles className="h-4 w-4" /> Ask
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
          <SheetHeader className="border-b px-4 py-3 text-left">
            <div className="flex items-center justify-between gap-2">
              <SheetTitle className="flex items-center gap-2 text-base"><Bot className="h-5 w-5 text-primary" /> LeadBoosters assistant</SheetTitle>
              <div className="flex items-center gap-1 pr-6">
                {messages.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => { setMessages([]); setError(null); }} title="Start a new conversation">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            <SheetDescription className="text-xs">Asks your live account data and points you to the right page. It can't send or change anything.</SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4 text-sm">
            {messages.length === 0 && (
              <div className="space-y-2">
                <p className="text-muted-foreground">Ask anything about your campaigns, follow-ups, Autopilot or settings. For example:</p>
                {STARTERS.map((s) => (
                  <button key={s} type="button" onClick={() => ask(s)} className="block w-full rounded-lg border px-3 py-2 text-left hover:bg-muted">
                    {s}
                  </button>
                ))}
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-[90%] rounded-2xl px-3 py-2", m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted")}>
                  {m.role === "user" ? <p className="whitespace-pre-wrap">{m.content}</p> : <Markdown text={m.content} onNavigate={() => setOpen(false)} />}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Checking your account…
              </div>
            )}
            {error && (
              <div className="flex items-start justify-between gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-destructive">
                <span>{error}</span>
                <button type="button" onClick={() => setError(null)} aria-label="Dismiss"><X className="h-4 w-4" /></button>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form
            className="flex items-end gap-2 border-t p-3"
            onSubmit={(e) => { e.preventDefault(); ask(input); }}
          >
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(input); } }}
              placeholder="Ask about your campaigns…"
              rows={2}
              className="min-h-[44px] resize-none"
              disabled={busy}
            />
            <Button type="submit" size="icon" disabled={busy || !input.trim()} aria-label="Send">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
