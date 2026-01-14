import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Inbox, UserCheck, Settings, Mail, AlertCircle, ArrowRight } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Link } from "react-router-dom";

interface SharedInbox {
  id: string;
  team_id: string;
  name: string;
  description: string;
  email_address: string;
  auto_assign: boolean;
  assignment_strategy: string;
  settings: any;
  created_at: string;
}

interface Assignment {
  id: string;
  assigned_to_user_id: string;
  entity_type: string;
  entity_id: string;
  status: string;
  due_date?: string;
  profiles?: {
    full_name: string;
    email: string;
  };
}

export default function SharedInbox() {
  const [teams, setTeams] = useState<any[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<any>(null);
  const [inboxes, setInboxes] = useState<SharedInbox[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isConfigureDialogOpen, setIsConfigureDialogOpen] = useState(false);
  const [selectedInbox, setSelectedInbox] = useState<SharedInbox | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    email_address: string;
    auto_assign: boolean;
    assignment_strategy: string;
  }>({
    name: '',
    description: '',
    email_address: '',
    auto_assign: false,
    assignment_strategy: 'round_robin',
  });

  useEffect(() => {
    loadTeams();
  }, []);

  useEffect(() => {
    if (selectedTeam) {
      loadInboxes(selectedTeam.id);
      loadAssignments(selectedTeam.id);
    }
  }, [selectedTeam]);

  const loadTeams = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTeams(data || []);
      
      if (data && data.length > 0 && !selectedTeam) {
        setSelectedTeam(data[0]);
      }
    } catch (error: any) {
      console.error('Error loading teams:', error);
      setLoadError(error.message || "Failed to load teams");
    } finally {
      setLoading(false);
    }
  };

  const loadInboxes = async (teamId: string) => {
    try {
      const { data, error } = await supabase
        .from('shared_inboxes')
        .select('*')
        .eq('team_id', teamId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInboxes(data || []);
    } catch (error: any) {
      console.error('Error loading inboxes:', error);
    }
  };

  const loadAssignments = async (teamId: string) => {
    try {
      const { data, error } = await supabase
        .from('assignments')
        .select(`
          *,
          profiles:assigned_to_user_id (
            full_name,
            email
          )
        `)
        .eq('team_id', teamId)
        .eq('status', 'assigned')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setAssignments(data as any || []);
    } catch (error: any) {
      console.error('Error loading assignments:', error);
    }
  };

  const handleCreateInbox = async () => {
    if (!selectedTeam) return;

    try {
      const { error } = await supabase
        .from('shared_inboxes')
        .insert({
          team_id: selectedTeam.id,
          name: formData.name,
          description: formData.description,
          email_address: formData.email_address,
          auto_assign: formData.auto_assign,
          assignment_strategy: formData.assignment_strategy,
        });

      if (error) throw error;

      toast({ title: "Shared inbox created successfully" });
      setIsDialogOpen(false);
      resetForm();
      await loadInboxes(selectedTeam.id);
    } catch (error: any) {
      console.error('Error creating inbox:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create inbox",
        variant: "destructive",
      });
    }
  };

  const handleUpdateInbox = async () => {
    if (!selectedInbox) return;

    try {
      const { error } = await supabase
        .from('shared_inboxes')
        .update({
          name: formData.name,
          description: formData.description,
          email_address: formData.email_address,
          auto_assign: formData.auto_assign,
          assignment_strategy: formData.assignment_strategy,
        })
        .eq('id', selectedInbox.id);

      if (error) throw error;

      toast({ title: "Inbox updated successfully" });
      setIsConfigureDialogOpen(false);
      setSelectedInbox(null);
      resetForm();
      if (selectedTeam) {
        await loadInboxes(selectedTeam.id);
      }
    } catch (error: any) {
      console.error('Error updating inbox:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update inbox",
        variant: "destructive",
      });
    }
  };

  const handleConfigureInbox = (inbox: SharedInbox) => {
    setSelectedInbox(inbox);
    setFormData({
      name: inbox.name,
      description: inbox.description || '',
      email_address: inbox.email_address || '',
      auto_assign: inbox.auto_assign,
      assignment_strategy: inbox.assignment_strategy,
    });
    setIsConfigureDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      email_address: '',
      auto_assign: false,
      assignment_strategy: 'round_robin',
    });
  };

  const getStrategyLabel = (strategy: string) => {
    switch (strategy) {
      case 'round_robin': return 'Round Robin';
      case 'least_active': return 'Least Active';
      case 'skill_based': return 'Skill Based';
      default: return 'Manual';
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  if (teams.length === 0) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Shared Inbox</h1>
          <p className="text-muted-foreground mt-1">
            Collaborate on emails with your team
          </p>
        </div>

        {loadError && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {loadError}. Please try refreshing the page or contact support if the issue persists.
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="rounded-full bg-muted p-4 mb-4">
              <Inbox className="h-12 w-12 text-muted-foreground" />
            </div>
            <h3 className="text-2xl font-semibold mb-2">No Teams Yet</h3>
            <p className="text-muted-foreground text-center mb-6 max-w-md">
              Shared inboxes require a team. Create your first team to start collaborating on emails with your colleagues.
            </p>
            <Link to="/teams">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Team
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6 overflow-y-auto max-h-[calc(100vh-4rem)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Shared Inbox</h1>
          <p className="text-muted-foreground mt-1">
            Collaborate on emails with your team
          </p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 w-full sm:w-auto">
          {loadError && (
            <Alert className="mb-0">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {loadError}
              </AlertDescription>
            </Alert>
          )}
          <Select
            value={selectedTeam?.id}
            onValueChange={(value) => {
              const team = teams.find(t => t.id === value);
              setSelectedTeam(team);
            }}
          >
          <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Select team" />
            </SelectTrigger>
            <SelectContent>
              {teams.map((team) => (
                <SelectItem key={team.id} value={team.id}>
                  {team.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button className="w-full sm:w-auto" onClick={() => { resetForm(); setIsDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            New Inbox
          </Button>
        </div>
      </div>

      <Tabs defaultValue="inboxes" className="space-y-4">
        <TabsList>
          <TabsTrigger value="inboxes">Inboxes ({inboxes.length})</TabsTrigger>
          <TabsTrigger value="assignments">My Assignments ({assignments.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="inboxes" className="space-y-4">
          {inboxes.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Inbox className="h-16 w-16 text-muted-foreground mb-4 opacity-50" />
                <h3 className="text-xl font-semibold mb-2">No Shared Inboxes</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Create your first shared inbox to start collaborating
                </p>
                <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Inbox
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {inboxes.map((inbox) => (
                <Card key={inbox.id}>
                  <CardHeader>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-blue-500 text-white">
                          <Inbox className="h-5 w-5" />
                        </div>
                        <div>
                          <CardTitle>{inbox.name}</CardTitle>
                          <CardDescription>{inbox.description}</CardDescription>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => handleConfigureInbox(inbox)}>
                        <Settings className="h-4 w-4 mr-2" />
                        Configure
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                      {inbox.email_address && (
                        <div>
                          <p className="text-muted-foreground">Email Address</p>
                          <p className="font-medium">{inbox.email_address}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-muted-foreground">Auto-Assign</p>
                        <Badge variant={inbox.auto_assign ? 'default' : 'secondary'}>
                          {inbox.auto_assign ? 'Enabled' : 'Disabled'}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Strategy</p>
                        <p className="font-medium">{getStrategyLabel(inbox.assignment_strategy)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Created</p>
                        <p className="font-medium">
                          {new Date(inbox.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="assignments" className="space-y-4">
          {assignments.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <UserCheck className="h-16 w-16 text-muted-foreground mb-4 opacity-50" />
                <h3 className="text-xl font-semibold mb-2">No Assignments</h3>
                <p className="text-muted-foreground text-center">
                  You don't have any pending assignments
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {assignments.map((assignment) => (
                <Card key={assignment.id}>
                  <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4">
                    <div className="flex items-center gap-3">
                      <Mail className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <div className="font-medium">
                          {assignment.entity_type.replace('_', ' ')}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Assigned to {assignment.profiles?.full_name}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge>{assignment.status}</Badge>
                      <Button variant="outline" size="sm">
                        View
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Inbox Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Shared Inbox</DialogTitle>
            <DialogDescription>
              Set up a new shared inbox for your team
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Inbox Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Sales Inbox"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe this inbox's purpose"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address (optional)</Label>
              <Input
                id="email"
                type="email"
                value={formData.email_address}
                onChange={(e) => setFormData({ ...formData, email_address: e.target.value })}
                placeholder="inbox@yourdomain.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="strategy">Assignment Strategy</Label>
              <Select
                value={formData.assignment_strategy}
                onValueChange={(value: any) => setFormData({ ...formData, assignment_strategy: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="round_robin">Round Robin</SelectItem>
                  <SelectItem value="least_active">Least Active</SelectItem>
                  <SelectItem value="skill_based">Skill Based</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-0.5">
                <Label>Auto-Assign</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically assign new items to team members
                </p>
              </div>
              <Switch
                checked={formData.auto_assign}
                onCheckedChange={(checked) => setFormData({ ...formData, auto_assign: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsDialogOpen(false); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleCreateInbox} disabled={!formData.name}>
              Create Inbox
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Configure Inbox Dialog */}
      <Dialog open={isConfigureDialogOpen} onOpenChange={(open) => {
        setIsConfigureDialogOpen(open);
        if (!open) {
          setSelectedInbox(null);
          resetForm();
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Configure Shared Inbox</DialogTitle>
            <DialogDescription>
              Update settings for {selectedInbox?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Inbox Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Sales Inbox"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe this inbox's purpose"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address (optional)</Label>
              <Input
                id="email"
                type="email"
                value={formData.email_address}
                onChange={(e) => setFormData({ ...formData, email_address: e.target.value })}
                placeholder="inbox@yourdomain.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="strategy">Assignment Strategy</Label>
              <Select
                value={formData.assignment_strategy}
                onValueChange={(value: any) => setFormData({ ...formData, assignment_strategy: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="round_robin">Round Robin</SelectItem>
                  <SelectItem value="least_active">Least Active</SelectItem>
                  <SelectItem value="skill_based">Skill Based</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-0.5">
                <Label>Auto-Assign</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically assign new items to team members
                </p>
              </div>
              <Switch
                checked={formData.auto_assign}
                onCheckedChange={(checked) => setFormData({ ...formData, auto_assign: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { 
              setIsConfigureDialogOpen(false); 
              setSelectedInbox(null);
              resetForm(); 
            }}>
              Cancel
            </Button>
            <Button onClick={handleUpdateInbox} disabled={!formData.name}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}