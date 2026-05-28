import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Trash2, Users, FolderOpen, Plus, Upload, Building2, UserCircle } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { parseRecipientRowsFromCSVText } from "@/lib/recipient-group-csv";
import { getCompanyResolvableEmail } from "@/lib/company-email";
import { createRecipientGroupWithMembers } from "@/lib/recipient-group-mutations";

type RecipientGroup = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  member_count?: number;
};

type PeopleRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  companies: { name: string | null } | null;
};

type CompanyRow = {
  id: string;
  name: string | null;
  general_email: string | null;
  contacts: { email: string | null; name: string | null }[] | null;
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

  const [createOpen, setCreateOpen] = useState(false);
  const [createTab, setCreateTab] = useState<"csv" | "people" | "companies">("csv");
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [csvPreviewCount, setCsvPreviewCount] = useState(0);
  const [csvRows, setCsvRows] = useState<ReturnType<typeof parseRecipientRowsFromCSVText>>([]);
  const [peopleSearch, setPeopleSearch] = useState("");
  const [companySearch, setCompanySearch] = useState("");
  const [selectedPeopleIds, setSelectedPeopleIds] = useState<Set<string>>(new Set());
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);

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

  const { data: peoplePickList = [], isLoading: loadingPeoplePick } = useQuery({
    queryKey: ["recipient-groups-pick-people", user?.id],
    enabled: createOpen && createTab === "people",
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [];
      // Paginate to bypass Supabase's 1000-row default limit
      const all: PeopleRow[] = [];
      const PAGE = 1000;
      let page = 0;
      while (true) {
        const { data, error } = await supabase
          .from("people")
          .select("id, first_name, last_name, email, companies(name)")
          .eq("user_id", u.user.id)
          .not("email", "is", null)
          .order("created_at", { ascending: false })
          .range(page * PAGE, (page + 1) * PAGE - 1);
        if (error) throw error;
        if (data?.length) all.push(...(data as PeopleRow[]));
        if (!data || data.length < PAGE) break;
        page++;
      }
      return all;
    },
  });

  const { data: companiesPickList = [], isLoading: loadingCompaniesPick } = useQuery({
    queryKey: ["recipient-groups-pick-companies", user?.id],
    enabled: createOpen && createTab === "companies",
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [];
      // Paginate to bypass Supabase's 1000-row default limit
      const all: CompanyRow[] = [];
      const PAGE = 1000;
      let page = 0;
      while (true) {
        const { data, error } = await supabase
          .from("companies")
          .select("id, name, general_email, contacts(email, name)")
          .eq("user_id", u.user.id)
          .order("created_at", { ascending: false })
          .range(page * PAGE, (page + 1) * PAGE - 1);
        if (error) throw error;
        if (data?.length) all.push(...(data as CompanyRow[]));
        if (!data || data.length < PAGE) break;
        page++;
      }
      return all;
    },
  });

  const filteredPeople = useMemo(() => {
    const q = peopleSearch.trim().toLowerCase();
    if (!q) return peoplePickList;
    return peoplePickList.filter((p) => {
      const em = (p.email || "").toLowerCase();
      const fn = (p.first_name || "").toLowerCase();
      const ln = (p.last_name || "").toLowerCase();
      const cn = (p.companies?.name || "").toLowerCase();
      return em.includes(q) || fn.includes(q) || ln.includes(q) || cn.includes(q);
    });
  }, [peoplePickList, peopleSearch]);

  const companiesWithEmail = useMemo(() => {
    return companiesPickList.filter((c) => getCompanyResolvableEmail(c) != null);
  }, [companiesPickList]);

  const filteredCompanies = useMemo(() => {
    const q = companySearch.trim().toLowerCase();
    const base = companiesWithEmail;
    if (!q) return base;
    return base.filter((c) => (c.name || "").toLowerCase().includes(q));
  }, [companiesWithEmail, companySearch]);

  const openRename = (g: RecipientGroup) => {
    setRenameId(g.id);
    setRenameName(g.name);
    setRenameDescription(g.description || "");
  };

  const resetCreateForm = () => {
    setCreateName("");
    setCreateDescription("");
    setCsvPreviewCount(0);
    setCsvRows([]);
    setPeopleSearch("");
    setCompanySearch("");
    setSelectedPeopleIds(new Set());
    setSelectedCompanyIds(new Set());
    setCreateTab("csv");
  };

  const openCreate = () => {
    resetCreateForm();
    setCreateOpen(true);
  };

  const handleCsvFile = async (file: File | null) => {
    if (!file) return;
    const text = await file.text();
    const rows = parseRecipientRowsFromCSVText(text);
    setCsvRows(rows);
    setCsvPreviewCount(rows.length);
    if (rows.length === 0) {
      toast({
        title: "No emails found",
        description: "Use a header row with an Email column, or put one email per row in the first column.",
        variant: "destructive",
      });
    }
  };

  const handleCreateGroup = async () => {
    if (!createName.trim()) {
      toast({ title: "Enter a group name", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Not authenticated");

      let members: Array<{
        email: string;
        first_name: string | null;
        last_name: string | null;
        company: string | null;
        person_id: string | null;
      }> = [];

      if (createTab === "csv") {
        if (csvRows.length === 0) {
          toast({ title: "Add a CSV file", description: "Upload a file with at least one email.", variant: "destructive" });
          setCreating(false);
          return;
        }
        const seen = new Set<string>();
        members = csvRows
          .filter((r) => {
            const k = r.email.toLowerCase();
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
          })
          .map((r) => ({
            email: r.email.toLowerCase(),
            first_name: r.first_name,
            last_name: r.last_name,
            company: r.company,
            person_id: null,
          }));
      } else if (createTab === "people") {
        const picked = peoplePickList.filter((p) => selectedPeopleIds.has(p.id) && p.email);
        const seen = new Set<string>();
        members = picked
          .filter((p) => {
            const k = p.email.trim().toLowerCase();
            if (!k || seen.has(k)) return false;
            seen.add(k);
            return true;
          })
          .map((p) => ({
            email: p.email.trim().toLowerCase(),
            first_name: p.first_name || null,
            last_name: p.last_name || null,
            company: p.companies?.name || null,
            person_id: p.id,
          }));
        if (members.length === 0) {
          toast({ title: "Select people", description: "Choose at least one contact with an email.", variant: "destructive" });
          setCreating(false);
          return;
        }
      } else {
        if (selectedCompanyIds.size === 0) {
          toast({ title: "Select companies", description: "Choose at least one company with an email.", variant: "destructive" });
          setCreating(false);
          return;
        }
        const companyIds = [...selectedCompanyIds];
        const seen = new Set<string>();
        members = [];
        const selectedCompanyRows = companiesPickList.filter((c) => selectedCompanyIds.has(c.id));
        const { data: existingPeople } = await supabase
          .from("people")
          .select("id, first_name, last_name, email, company_id, companies(name)")
          .in("company_id", companyIds)
          .not("email", "is", null);
        if (existingPeople) {
          for (const p of existingPeople as any[]) {
            if (p.email && !seen.has(p.email.toLowerCase().trim())) {
              seen.add(p.email.toLowerCase().trim());
              members.push({
                email: p.email.trim().toLowerCase(),
                first_name: p.first_name || null,
                last_name: p.last_name || null,
                company: p.companies?.name || null,
                person_id: p.id,
              });
            }
          }
        }
        for (const company of selectedCompanyRows) {
          const resolved = getCompanyResolvableEmail(company);
          if (resolved && !seen.has(resolved.email)) {
            seen.add(resolved.email);
            members.push({
              email: resolved.email,
              first_name: resolved.first_name,
              last_name: resolved.last_name,
              company: resolved.company,
              person_id: null,
            });
          }
        }
        if (members.length === 0) {
          toast({
            title: "No recipients",
            description: "Selected companies have no resolved email. Add contacts or general email on Companies.",
            variant: "destructive",
          });
          setCreating(false);
          return;
        }
      }

      await createRecipientGroupWithMembers(supabase, {
        userId: auth.user.id,
        name: createName.trim(),
        description: createDescription.trim() || null,
        members,
      });

      queryClient.invalidateQueries({ queryKey: ["recipient-groups-page"] });
      queryClient.invalidateQueries({ queryKey: ["recipient-groups"] });
      setCreateOpen(false);
      resetCreateForm();
      toast({
        title: "Group created",
        description: `"${createName.trim()}" has ${members.length} member(s). Use it in Newsletters (Import from group) or Campaigns.`,
      });
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? "Failed to create group", variant: "destructive" });
    } finally {
      setCreating(false);
    }
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
      toast({ title: "Group updated" });
      setRenameId(null);
      queryClient.invalidateQueries({ queryKey: ["recipient-groups-page"] });
      queryClient.invalidateQueries({ queryKey: ["recipient-groups"] });
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? "Failed to update group", variant: "destructive" });
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
      toast({ title: "Group deleted" });
      setDeleteId(null);
      queryClient.invalidateQueries({ queryKey: ["recipient-groups-page"] });
      queryClient.invalidateQueries({ queryKey: ["recipient-groups"] });
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? "Failed to delete group", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6" />
            Recipient Groups
          </h1>
          <p className="text-muted-foreground mt-1">
            Saved lists for{" "}
            <Link to="/campaigns" className="text-primary hover:underline">
              Campaigns
            </Link>{" "}
            and{" "}
            <Link to="/newsletters" className="text-primary hover:underline">
              Newsletters
            </Link>
            . Create a group from a CSV file, People, or Companies.
          </p>
        </div>
        <Button onClick={openCreate} className="shrink-0">
          <Plus className="h-4 w-4 mr-2" />
          New group
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            Your groups
          </CardTitle>
          <CardDescription>Rename, delete, or create a new list below.</CardDescription>
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
              <p className="text-sm mt-1 max-w-md mx-auto">
                Create a group by uploading a CSV (email column), or select People / Companies from your CRM.
              </p>
              <Button variant="default" className="mt-4" onClick={openCreate}>
                <Plus className="h-4 w-4 mr-2" />
                New group
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

      {/* Create group */}
      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) resetCreateForm();
        }}
      >
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New recipient group</DialogTitle>
            <DialogDescription>
              Members are stored for reuse. Duplicates are removed by email.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-2">
              <Label htmlFor="cg-name">Name *</Label>
              <Input
                id="cg-name"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="e.g. April webinar leads"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cg-desc">Description (optional)</Label>
              <Input
                id="cg-desc"
                value={createDescription}
                onChange={(e) => setCreateDescription(e.target.value)}
              />
            </div>
            <Tabs value={createTab} onValueChange={(v) => setCreateTab(v as typeof createTab)} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="csv" className="gap-1 text-xs sm:text-sm">
                  <Upload className="h-3.5 w-3.5" />
                  CSV
                </TabsTrigger>
                <TabsTrigger value="people" className="gap-1 text-xs sm:text-sm">
                  <UserCircle className="h-3.5 w-3.5" />
                  People
                </TabsTrigger>
                <TabsTrigger value="companies" className="gap-1 text-xs sm:text-sm">
                  <Building2 className="h-3.5 w-3.5" />
                  Companies
                </TabsTrigger>
              </TabsList>
              <TabsContent value="csv" className="space-y-3 mt-3">
                <p className="text-xs text-muted-foreground">
                  Comma-separated CSV with a header row. Include an <strong>email</strong> column (or put emails in the first
                  column). Optional: first name, last name, company.
                </p>
                <Input
                  type="file"
                  accept=".csv,.txt,text/csv,text/plain"
                  onChange={(e) => handleCsvFile(e.target.files?.[0] ?? null)}
                />
                {csvPreviewCount > 0 && (
                  <p className="text-sm text-muted-foreground">
                    <strong>{csvPreviewCount}</strong> unique email(s) ready to import.
                  </p>
                )}
              </TabsContent>
              <TabsContent value="people" className="space-y-3 mt-3">
                <Input
                  placeholder="Search by name, email, company…"
                  value={peopleSearch}
                  onChange={(e) => setPeopleSearch(e.target.value)}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>
                    {filteredPeople.length} shown · {selectedPeopleIds.size} selected
                    {selectedPeopleIds.size > 0 && filteredPeople.length !== peoplePickList.length && (
                      <> · {peoplePickList.length} total</>
                    )}
                  </span>
                  <div className="flex gap-3">
                    {selectedPeopleIds.size > 0 && (
                      <button
                        type="button"
                        className="text-muted-foreground hover:underline"
                        onClick={() => setSelectedPeopleIds(new Set())}
                      >
                        Deselect all
                      </button>
                    )}
                    <button
                      type="button"
                      className="text-primary hover:underline font-medium"
                      onClick={() => setSelectedPeopleIds(new Set(peoplePickList.map((p) => p.id)))}
                    >
                      Select all ({peoplePickList.length})
                    </button>
                  </div>
                </div>
                <div className="max-h-52 overflow-y-auto rounded-md border p-2 space-y-1">
                  {loadingPeoplePick ? (
                    <div className="flex justify-center py-6">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : filteredPeople.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-4 text-center">No contacts with email.</p>
                  ) : (
                    filteredPeople.map((p) => (
                      <label
                        key={p.id}
                        className="flex items-center gap-2 cursor-pointer py-1.5 px-2 rounded hover:bg-muted/50"
                      >
                        <Checkbox
                          checked={selectedPeopleIds.has(p.id)}
                          onCheckedChange={(checked) => {
                            setSelectedPeopleIds((prev) => {
                              const next = new Set(prev);
                              if (checked) next.add(p.id);
                              else next.delete(p.id);
                              return next;
                            });
                          }}
                        />
                        <span className="text-sm truncate flex-1">
                          {[p.first_name, p.last_name].filter(Boolean).join(" ") || p.email}
                        </span>
                        <span className="text-xs text-muted-foreground truncate max-w-[120px]">{p.email}</span>
                      </label>
                    ))
                  )}
                </div>
              </TabsContent>
              <TabsContent value="companies" className="space-y-3 mt-3">
                <p className="text-xs text-muted-foreground">
                  Includes people at selected companies plus company contact / general email when no person exists.
                </p>
                <Input
                  placeholder="Filter by company name…"
                  value={companySearch}
                  onChange={(e) => setCompanySearch(e.target.value)}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>
                    {filteredCompanies.length} shown · {selectedCompanyIds.size} selected
                    {selectedCompanyIds.size > 0 && filteredCompanies.length !== companiesWithEmail.length && (
                      <> · {companiesWithEmail.length} total</>
                    )}
                  </span>
                  <div className="flex gap-3">
                    {selectedCompanyIds.size > 0 && (
                      <button
                        type="button"
                        className="text-muted-foreground hover:underline"
                        onClick={() => setSelectedCompanyIds(new Set())}
                      >
                        Deselect all
                      </button>
                    )}
                    <button
                      type="button"
                      className="text-primary hover:underline font-medium"
                      onClick={() => setSelectedCompanyIds(new Set(companiesWithEmail.map((c) => c.id)))}
                    >
                      Select all ({companiesWithEmail.length})
                    </button>
                  </div>
                </div>
                <div className="max-h-52 overflow-y-auto rounded-md border p-2 space-y-1">
                  {loadingCompaniesPick ? (
                    <div className="flex justify-center py-6">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : filteredCompanies.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-4 text-center">
                      No companies with a resolvable email. Add contacts or general email on the Companies page.
                    </p>
                  ) : (
                    filteredCompanies.map((c) => (
                      <label
                        key={c.id}
                        className="flex items-center gap-2 cursor-pointer py-1.5 px-2 rounded hover:bg-muted/50"
                      >
                        <Checkbox
                          checked={selectedCompanyIds.has(c.id)}
                          onCheckedChange={(checked) => {
                            setSelectedCompanyIds((prev) => {
                              const next = new Set(prev);
                              if (checked) next.add(c.id);
                              else next.delete(c.id);
                              return next;
                            });
                          }}
                        />
                        <span className="text-sm truncate">{c.name || "—"}</span>
                      </label>
                    ))
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateGroup} disabled={creating || !createName.trim()}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Create group
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
