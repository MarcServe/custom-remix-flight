import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, FolderInput } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export interface GroupMember {
  email: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  person_id: string | null;
}

/**
 * Adds already-resolved recipients to an EXISTING email (or mixed) recipient group.
 * Members already in the group (same email) are skipped, so it is safe to re-run.
 */
export function AddToGroupDialog({
  open, onOpenChange, buildMembers, companyCount,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Resolves the recipients when the user confirms (may query the database). */
  buildMembers: () => Promise<GroupMember[]>;
  companyCount: number;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [groupId, setGroupId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (!open) setGroupId(""); }, [open]);

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ["recipient-groups-email-picker"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recipient_groups")
        .select("id, name, channel, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      // Phone-only groups hold numbers, not emails, so they are not offered here.
      return (data || []).filter((g: any) => g.channel !== "phone" && !String(g.name || "").trim().startsWith("📞"));
    },
  });

  const confirm = async () => {
    if (!groupId) return;
    setSaving(true);
    try {
      const members = await buildMembers();
      if (members.length === 0) {
        toast({ title: "No recipients", description: "None of the selected companies has an email address.", variant: "destructive" });
        return;
      }
      const { data: existing } = await supabase.from("recipient_group_members").select("email").eq("group_id", groupId);
      const have = new Set((existing || []).map((m: any) => String(m.email || "").toLowerCase().trim()));
      const toAdd = members.filter((m) => !have.has(m.email.toLowerCase().trim()));
      for (let i = 0; i < toAdd.length; i += 500) {
        const { error } = await supabase
          .from("recipient_group_members")
          .upsert(toAdd.slice(i, i + 500).map((m) => ({ ...m, group_id: groupId })), { onConflict: "group_id,email", ignoreDuplicates: true });
        if (error) throw error;
      }
      const name = groups.find((g: any) => g.id === groupId)?.name || "the group";
      queryClient.invalidateQueries({ queryKey: ["recipient-groups"] });
      queryClient.invalidateQueries({ queryKey: ["recipient-groups-page"] });
      queryClient.invalidateQueries({ queryKey: ["recipient-group-members", groupId] });
      toast({
        title: `Added to "${name}"`,
        description: `${toAdd.length} new member(s) added${members.length - toAdd.length > 0 ? `, ${members.length - toAdd.length} already in the group` : ""}.`,
      });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Could not add to group", description: e?.message ?? "Unknown error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add to an existing group</DialogTitle>
          <DialogDescription>
            {companyCount} compan{companyCount === 1 ? "y" : "ies"} with an email will be added. Anyone already in the group is skipped.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Recipient group</Label>
          <Select value={groupId} onValueChange={setGroupId} disabled={isLoading}>
            <SelectTrigger><SelectValue placeholder={isLoading ? "Loading groups…" : "Choose a group"} /></SelectTrigger>
            <SelectContent>
              {groups.map((g: any) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {!isLoading && groups.length === 0 && <p className="text-xs text-muted-foreground">No email groups yet. Use "Create group" instead.</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={confirm} disabled={!groupId || saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FolderInput className="h-4 w-4 mr-1" />}
            Add to group
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
