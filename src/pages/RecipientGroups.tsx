import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Trash2, Users, FolderOpen } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";

type RecipientGroup = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  member_count?: number;
};

export default function RecipientGroups() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameName, setRenameName] = useState("");
  const [renameDescription, setRenameDescription] = useState("");
  const [savingRename, setSavingRename] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ["recipient-groups-page"],
    queryFn: async () => {
      const {
        data: { user: u },
      } = await supabase.auth.getUser();
      if (!u) return [];
      const { data: groupsData, error: groupsError } = await supabase
        .from("recipient_groups")
        .select("id, name, description, created_at")
        .eq("user_id", u.id)
        .order("created_at", { ascending: false });
      if (groupsError) throw groupsError;
      if (!groupsData?.length) return [];
      const ids = groupsData.map((g) => g.id);
      const { data: countsData } = await supabase
        .from("recipient_group_members")
        .select("group_id")
        .in("group_id", ids);
      const countByGroup: Record<string, number> = {};
      ids.forEach((id) => (countByGroup[id] = 0));
      (countsData || []).forEach((r: { group_id: string }) => {
        countByGroup[r.group_id] = (countByGroup[r.group_id] || 0) + 1;
      });
      return (groupsData || []).map((g) => ({
        ...g,
        member_count: countByGroup[g.id] ?? 0,
      })) as RecipientGroup[];
    },
  });

  const openRename = (g: RecipientGroup) => {
    setRenameId(g.id);
    setRenameName(g.name);
    setRenameDescription(g.description || "");
  };

  const saveRename = async () => {
    if (!renameId || !renameName.trim()) return;
    setSavingRename(true);
    try {
      const { error } = await supabase
        .from("recipient_groups")
        .update({
          name: renameName.trim(),
          description: renameDescription.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", renameId);
      if (error) throw error;
      toast.success("Group updated");
      setRenameId(null);
      queryClient.invalidateQueries({ queryKey: ["recipient-groups-page"] });
      queryClient.invalidateQueries({ queryKey: ["recipient-groups"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to update group");
    } finally {
      setSavingRename(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from("recipient_groups").delete().eq("id", deleteId);
      if (error) throw error;
      toast.success("Group deleted");
      setDeleteId(null);
      queryClient.invalidateQueries({ queryKey: ["recipient-groups-page"] });
      queryClient.invalidateQueries({ queryKey: ["recipient-groups"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to delete group");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Users className="h-6 w-6" />
          Recipient Groups
        </h1>
        <p className="text-muted-foreground mt-1">
          View and manage saved recipient lists. Use them in{" "}
          <Link to="/campaigns" className="text-primary hover:underline">
            Campaigns
          </Link>{" "}
          (Add from group) or{" "}
          <Link to="/newsletters" className="text-primary hover:underline">
            Newsletters
          </Link>{" "}
          (Import from group).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            Your groups
          </CardTitle>
          <CardDescription>
            Rename or delete groups. Saving new groups is done from Campaigns → Campaign Recipients → Save as group.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : groups.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FolderOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No recipient groups yet</p>
              <p className="text-sm mt-1">
                Save recipients from a campaign: open a campaign → Campaign Recipients → Save as group.
              </p>
              <Button asChild variant="outline" className="mt-4">
                <Link to="/campaigns">Go to Campaigns</Link>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Members</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.map((g) => (
                  <TableRow key={g.id}>
                    <TableCell className="font-medium">{g.name}</TableCell>
                    <TableCell className="text-muted-foreground max-w-[200px] truncate">
                      {g.description || "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{g.member_count ?? 0}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDistanceToNow(new Date(g.created_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openRename(g)}
                          aria-label="Rename"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleteId(g.id)}
                          aria-label="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Rename dialog */}
      <Dialog open={!!renameId} onOpenChange={(open) => !open && setRenameId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit group</DialogTitle>
            <DialogDescription>Change the group name and optional description.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="rename-name">Name</Label>
              <Input
                id="rename-name"
                value={renameName}
                onChange={(e) => setRenameName(e.target.value)}
                placeholder="Group name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rename-desc">Description (optional)</Label>
              <Input
                id="rename-desc"
                value={renameDescription}
                onChange={(e) => setRenameDescription(e.target.value)}
                placeholder="Short description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameId(null)}>
              Cancel
            </Button>
            <Button onClick={saveRename} disabled={savingRename || !renameName.trim()}>
              {savingRename ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete group</DialogTitle>
            <DialogDescription>
              This will permanently delete this group and all its members. You can’t undo this.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
