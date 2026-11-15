import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Bot, Copy, Check, KeyRound, Loader2, Sparkles, ShieldCheck, Link2 } from 'lucide-react';
import { Link } from 'react-router-dom';

const MCP_BASE = 'https://kgndpwzqohepotahnfeo.supabase.co/functions/v1/mcp?key=';
const PLACEHOLDER = 'lb_live_YOUR_KEY';

interface ApiKey { id: string; name: string; key_prefix: string; created_at: string; last_used_at: string | null; revoked_at: string | null }

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); } catch {
      const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch { /* ignore */ }
      document.body.removeChild(ta);
    }
    setDone(true); setTimeout(() => setDone(false), 1500);
  };
  return (
    <Button type="button" variant="outline" size="sm" onClick={copy} className="gap-1 shrink-0">
      {done ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {done ? 'Copied' : label}
    </Button>
  );
}

function Snippet({ code }: { code: string }) {
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-md border bg-muted/40 p-3 pr-24 text-xs leading-relaxed"><code>{code}</code></pre>
      <div className="absolute right-2 top-2"><CopyButton text={code} /></div>
    </div>
  );
}

export default function ConnectAI() {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [key, setKey] = useState<string>('');
  const [manualKey, setManualKey] = useState('');

  const { data: keys = [] } = useQuery({
    queryKey: ['api-keys'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('manage-api-keys', { body: { action: 'list' } });
      if (error) throw error;
      return (data?.keys || []) as ApiKey[];
    },
  });
  const activeKeys = keys.filter((k) => !k.revoked_at);

  const createKey = async () => {
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-api-keys', { body: { action: 'create', name: 'AI assistant connection' } });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setKey(data.key);
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      toast.success('Connection key created. It is shown once, so copy your URL now.');
    } catch (e: any) {
      toast.error(e?.message || 'Could not create a key');
    } finally {
      setCreating(false);
    }
  };

  const effectiveKey = (key || manualKey.trim() || PLACEHOLDER);
  const url = useMemo(() => MCP_BASE + effectiveKey, [effectiveKey]);
  const hasRealKey = effectiveKey !== PLACEHOLDER && /^lb_live_[A-Za-z0-9]{10,}$/.test(effectiveKey);

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Bot className="h-6 w-6 text-primary" />
          <h1 className="text-xl sm:text-2xl font-bold">AI Assistants</h1>
        </div>
        <p className="text-muted-foreground max-w-2xl">
          Connect Claude, ChatGPT, Claude Code or Cursor to LeadBoosters. Then just say what you want: find and save contacts,
          build groups, write and send on-brand email and SMS campaigns, run newsletters and follow-ups, and check results. No copying and pasting.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><Link2 className="h-5 w-5" /> 1. Your connection URL</CardTitle>
          <CardDescription>
            One hosted address works for every assistant. It includes a key that identifies your account, so treat it like a password.
            {activeKeys.length > 0 && <> You have {activeKeys.length} active key{activeKeys.length === 1 ? '' : 's'}; keys are only shown when created, so create a new one for each device or paste one you saved.</>}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <Button onClick={createKey} disabled={creating} className="gap-2">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />} Create connection key
            </Button>
            <div className="flex-1 flex gap-2">
              <Input id="connect-ai-key" value={manualKey} onChange={(e) => { setManualKey(e.target.value); if (key) setKey(''); }} placeholder="…or paste an existing lb_live_ key" className="font-mono text-sm" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <code className={`flex-1 min-w-0 truncate rounded-md border px-3 py-2 text-xs ${hasRealKey ? 'bg-primary/5 border-primary/40' : 'bg-muted/40 text-muted-foreground'}`}>{url}</code>
            <CopyButton text={url} label="Copy URL" />
          </div>
          {!hasRealKey && <p className="text-xs text-muted-foreground">Create or paste a key and the URL and every snippet below fill in automatically.</p>}
          <p className="text-xs text-muted-foreground flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" /> Revoke a key any time under <Link to="/api-keys" className="underline">API Keys</Link>; that disconnects every assistant using it.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">2. Add it to your assistant</CardTitle>
          <CardDescription>Pick your app. Each takes about a minute.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="claude">
            <TabsList className="flex flex-wrap h-auto gap-1">
              <TabsTrigger value="claude">Claude.ai</TabsTrigger>
              <TabsTrigger value="desktop">Claude Desktop</TabsTrigger>
              <TabsTrigger value="code">Claude Code</TabsTrigger>
              <TabsTrigger value="chatgpt">ChatGPT</TabsTrigger>
              <TabsTrigger value="cursor">Cursor &amp; others</TabsTrigger>
            </TabsList>

            <TabsContent value="claude" className="space-y-3 text-sm">
              <p className="text-muted-foreground">Custom connectors are on Claude Pro, Max, Team and Enterprise. One setup covers the web, desktop and phone apps.</p>
              <ol className="list-decimal pl-5 space-y-1.5">
                <li>Open <strong>Settings → Connectors</strong> (Team/Enterprise: an admin does this under Organization settings).</li>
                <li>Click <strong>Add custom connector</strong>.</li>
                <li>Name it <strong>LeadBoosters</strong>; paste the URL above into <strong>Remote MCP server URL</strong>. Leave OAuth fields empty.</li>
                <li>Click <strong>Add</strong>, then <strong>Connect</strong>.</li>
                <li>In a chat, open the tools menu (<strong>+</strong> or sliders icon) and switch LeadBoosters on.</li>
              </ol>
            </TabsContent>

            <TabsContent value="desktop" className="space-y-3 text-sm">
              <p className="text-muted-foreground">Works on every plan, including free. Node.js 18+ must be installed.</p>
              <ol className="list-decimal pl-5 space-y-1.5">
                <li>Open <strong>Settings → Developer → Edit Config</strong> (opens <code>claude_desktop_config.json</code>).</li>
                <li>Add this, save, and restart Claude Desktop:</li>
              </ol>
              <Snippet code={`{
  "mcpServers": {
    "leadboosters": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "${url}"]
    }
  }
}`} />
            </TabsContent>

            <TabsContent value="code" className="space-y-3 text-sm">
              <p className="text-muted-foreground">Run in a terminal. Add <code>--scope user</code> to use it in every project.</p>
              <Snippet code={`claude mcp add --transport http leadboosters "${url}"`} />
            </TabsContent>

            <TabsContent value="chatgpt" className="space-y-3 text-sm">
              <p className="text-muted-foreground">Needs Developer mode (Plus, Pro, Business, Enterprise, Edu).</p>
              <ol className="list-decimal pl-5 space-y-1.5">
                <li><strong>Settings → Connectors → Advanced settings</strong>: turn on <strong>Developer mode</strong>.</li>
                <li>In <strong>Connectors</strong>, click <strong>Create</strong>.</li>
                <li>Name: <strong>LeadBoosters</strong>. MCP Server URL: the URL above. Authentication: <strong>No authentication</strong> (the key is in the URL). Tick the acknowledgement, click <strong>Create</strong>.</li>
                <li>In a new chat: <strong>+ → More → Developer mode</strong>, enable LeadBoosters.</li>
              </ol>
              <p className="text-muted-foreground">Deep research mode is supported too: LeadBoosters provides the <code>search</code> and <code>fetch</code> tools it needs.</p>
            </TabsContent>

            <TabsContent value="cursor" className="space-y-3 text-sm">
              <p className="text-muted-foreground">Cursor: <strong>Settings → MCP → Add new global MCP server</strong>. Windsurf, VS Code (Copilot agent mode) and OpenAI Codex accept the same URL in their MCP settings.</p>
              <Snippet code={`{
  "mcpServers": {
    "leadboosters": { "url": "${url}" }
  }
}`} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><Sparkles className="h-5 w-5" /> 3. Try saying</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 sm:grid-cols-2 text-sm">
            {[
              'Put every contact tagged hotel in Manchester into a group called Manchester hotels.',
              'Write an on-brand HTML email introducing our new service, save it as a draft for that group, and send me a test.',
              'Send that campaign now.',
              'Text everyone in Route Local Bristol: Hi {name}, Mike here… and save it as a draft.',
              'Who replied to the Bristol campaign? Answer the ones asking for a call.',
              'Are follow-ups working? What’s new since yesterday?',
            ].map((s) => (
              <li key={s} className="rounded-md border bg-muted/30 px-3 py-2">“{s}”</li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            Anything that sends real messages is flagged to the assistant, so it confirms with you first unless you already told it to send.
            The assistant is the interface; LeadBoosters is the memory and the engine: your contacts, history, senders, automation and reporting stay in one place
            {' '}<Badge variant="secondary" className="align-middle">44 tools</Badge>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
