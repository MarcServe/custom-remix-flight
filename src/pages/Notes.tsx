import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Plus, Pencil, Trash2, Loader2, Copy, Send } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface CrmNote {
  id: string;
  user_id: string;
  title: string;
  content: string;
  source?: string;
  source_metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export default function Notes() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ["crm-notes"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await (supabase as any)
        .from("crm_notes")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data || []) as CrmNote[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const payload = { title: title.trim() || "Untitled note", content: content.trim() || "", updated_at: new Date().toISOString() };
      if (editingId) {
        const { error } = await (supabase as any).from("crm_notes").update(payload).eq("id", editingId).eq("user_id", user.id);
        if (error) throw error;
        return { id: editingId };
      } else {
        const { data, error } = await (supabase as any)
          .from("crm_notes")
          .insert({ user_id: user.id, ...payload })
          .select("id")
          .single();
        if (error) throw error;
        return { id: data?.id };
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-notes"] });
      setDialogOpen(false);
      setEditingId(null);
      setTitle("");
      setContent("");
      toast({ title: editingId ? "Note updated" : "Note saved" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { error } = await (supabase as any).from("crm_notes").delete().eq("id", id).eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-notes"] });
      toast({ title: "Note deleted" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const openCreate = () => {
    setEditingId(null);
    setTitle("");
    setContent("");
    setDialogOpen(true);
  };

  const openEdit = (note: CrmNote) => {
    setEditingId(note.id);
    setTitle(note.title);
    setContent(note.content);
    setDialogOpen(true);
  };

  const copyContent = (note: CrmNote) => {
    navigator.clipboard.writeText(note.content);
    toast({ title: "Copied", description: "Note content copied to clipboard" });
  };

  const useInCampaign = (note: CrmNote) => {
    navigator.clipboard.writeText(note.content);
    toast({ title: "Copied", description: "Note copied. Opening Campaigns — paste into your campaign or recipient list." });
    navigate("/campaigns");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-7 w-7" />
            Notes
          </h1>
          <p className="text-muted-foreground mt-1">
            Save analysis results, campaign ideas, and snippets. Use them when creating campaigns or bulk emails.
          </p>
        </div>
        <Button onClick={openCreate} className="shrink-0">
          <Plus className="h-4 w-4 mr-2" />
          New note
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : notes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-2">No notes yet</p>
            <p className="text-sm text-muted-foreground max-w-sm mb-4">
              Save analysis results (e.g. from Campaign Fit Analyzer), campaign ideas, or company lists here. You can paste them into campaigns later.
            </p>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Create your first note
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="h-[calc(100vh-12rem)]">
          <div className="grid gap-4 pb-4">
            {notes.map((note) => (
              <Card key={note.id} className="overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base font-medium truncate pr-2">{note.title}</CardTitle>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copyContent(note)} title="Copy content">
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => useInCampaign(note)} title="Copy and open Campaigns">
                        <Send className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(note)} title="Edit">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => deleteMutation.mutate(note.id)}
                        disabled={deleteMutation.isPending}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <CardDescription className="text-xs">
                    {note.source && <span className="mr-2">Source: {note.source}</span>}
                    Updated {format(new Date(note.updated_at), "PPp")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-sans max-h-24 overflow-hidden rounded bg-muted/50 p-3">
                    {note.content || "—"}
                  </pre>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit note" : "New note"}</DialogTitle>
            <DialogDescription>Title and content. You can paste analysis results or company lists here.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="note-title">Title</Label>
              <Input
                id="note-title"
                placeholder="e.g. Campaign Fit - High fit list"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="note-content">Content</Label>
              <Textarea
                id="note-content"
                placeholder="Paste analysis results, company names, or campaign notes..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="min-h-[200px] resize-y"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editingId ? "Update" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
