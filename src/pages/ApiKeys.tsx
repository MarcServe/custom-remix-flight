import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SUPABASE_URL } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Plus, Copy, Trash2, KeyRound, Check } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type ApiKey = {
  id: string;
  name: string;
  key_prefix: string;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

const API_URL = `${SUPABASE_URL}/functions/v1/api-campaigns`;

export default function ApiKeys() {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const { data: keys = [], isLoading } = useQuery({
    queryKey: ["api-keys"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("manage-api-keys", { body: { action: "list" } });
      if (error) throw error;
      return (data?.keys || []) as ApiKey[];
    },
  });

  const createKey = async () => {
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-api-keys", {
        body: { action: "create", name: newKeyName.trim() || "API key" },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setRevealedKey(data.key);
      setNewKeyName("");
      setCreateOpen(false);
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
    } catch (e: any) {
      toast.error(e?.message || "Failed to create key");
    } finally {
      setCreating(false);
    }
  };

  const revokeKey = async (id: string) => {
    if (!window.confirm("Revoke this key? Any automation using it will stop working immediately.")) return;
    try {
      const { error } = await supabase.functions.invoke("manage-api-keys", { body: { action: "revoke", id } });
      if (error) throw error;
      toast.success("Key revoked");
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
    } catch (e: any) {
      toast.error(e?.message || "Failed to revoke");
    }
  };

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  };

  const activeKeys = keys.filter((k) => !k.revoked_at);

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><KeyRound className="h-6 w-6" /> API Keys</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create keys so external tools (Claude, Codex, your own scripts) can load & schedule campaigns via the API.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-1.5" /> New API key</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your keys</CardTitle>
          <CardDescription>Keys are shown in full only once, at creation.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : activeKeys.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No active API keys yet. Create one to get started.</p>
          ) : (
            <div className="space-y-2">
              {activeKeys.map((k) => (
                <div key={k.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{k.name}</div>
                    <div className="text-xs text-muted-foreground font-mono">{k.key_prefix}…</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      Created {formatDistanceToNow(new Date(k.created_at), { addSuffix: true })}
                      {k.last_used_at ? ` · Last used ${formatDistanceToNow(new Date(k.last_used_at), { addSuffix: true })}` : " · Never used"}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive shrink-0" onClick={() => revokeKey(k.id)} aria-label="Revoke">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Using the API</CardTitle>
          <CardDescription>Create + schedule campaigns. Sending happens automatically at the scheduled time.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded bg-muted px-2 py-1.5 text-xs font-mono overflow-x-auto">{API_URL}</code>
            <Button variant="outline" size="sm" onClick={() => copy(API_URL, "url")}>
              {copied === "url" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <pre className="rounded-lg bg-muted p-3 text-[11px] overflow-x-auto"><code>{`curl -X POST ${API_URL} \\
  -H "x-api-key: YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "action": "create",
    "name": "Daily outreach",
    "subject": "Hi {{firstName}}",
    "body_text": "Hi {{firstName}}, ...",
    "recipients": [{"email":"jane@acme.com","first_name":"Jane"}],
    "schedule_at": "2026-07-16T09:00"   // London time; sends automatically
  }'`}</code></pre>
          <p className="text-xs text-muted-foreground">
            Actions: <strong>create</strong> (create + schedule), <strong>list</strong>, <strong>status</strong> (with <code>campaign_id</code>).
            Omit <code>schedule_at</code> to create a draft. For Claude, add the LeadBoosters MCP server (see <code>mcp-server/README.md</code>) with this key.
          </p>
        </CardContent>
      </Card>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New API key</DialogTitle>
            <DialogDescription>Give it a name so you can recognise it later.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="key-name">Name</Label>
            <Input id="key-name" placeholder="e.g. Claude automation" value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={createKey} disabled={creating}>
              {creating ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Plus className="h-4 w-4 mr-1.5" />} Create key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reveal-once dialog */}
      <Dialog open={!!revealedKey} onOpenChange={(o) => !o && setRevealedKey(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copy your API key now</DialogTitle>
            <DialogDescription>This is the only time the full key is shown. Store it somewhere safe.</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded bg-muted px-2 py-2 text-xs font-mono break-all">{revealedKey}</code>
            <Button variant="outline" size="sm" onClick={() => revealedKey && copy(revealedKey, "key")}>
              {copied === "key" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setRevealedKey(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
