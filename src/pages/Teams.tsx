import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { apiClient } from "@/lib/api/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Users, Settings, UserPlus, Trash2, Crown, Shield, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Team {
  id: string;
  name: string;
  description: string;
  owner_id: string;
  settings: any;
  created_at: string;
}

interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  role: string;
  permissions: any;
  joined_at: string;
  profiles?: {
    full_name: string;
    email: string;
  };
}

interface TeamInvitation {
  id: string;
  team_id: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
  expires_at: string;
  profiles?: {
    full_name: string;
  };
}

export default function Teams() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamInvitations, setTeamInvitations] = useState<TeamInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });

  const [inviteData, setInviteData] = useState({
    email: '',
    role: 'member' as const,
  });

  useEffect(() => {
    loadTeams();
  }, []);

  useEffect(() => {
    if (selectedTeam) {
      loadTeamMembers(selectedTeam.id);
      loadTeamInvitations(selectedTeam.id);
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

  const loadTeamMembers = async (teamId: string) => {
    try {
      const { data, error } = await supabase
        .from('team_members')
        .select(`
          *,
          profiles:user_id (
            full_name,
            email
          )
        `)
        .eq('team_id', teamId)
        .order('joined_at', { ascending: false });

      if (error) throw error;
      setTeamMembers(data as any || []);
    } catch (error: any) {
      console.error('Error loading team members:', error);
      toast({
        title: "Error",
        description: "Failed to load team members",
        variant: "destructive",
      });
    }
  };

  const loadTeamInvitations = async (teamId: string) => {
    try {
      const { data, error } = await supabase
        .from('team_invitations')
        .select(`
          *,
          profiles:invited_by_user_id (
            full_name
          )
        `)
        .eq('team_id', teamId)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTeamInvitations(data as any || []);
    } catch (error: any) {
      console.error('Error loading invitations:', error);
    }
  };

  const handleCreateTeam = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Create team
      const { data: team, error: teamError } = await supabase
        .from('teams')
        .insert({
          name: formData.name,
          description: formData.description,
          owner_id: user.id,
        })
        .select()
        .single();

      if (teamError) throw teamError;

      // Add creator as owner
      const { error: memberError } = await supabase
        .from('team_members')
        .insert({
          team_id: team.id,
          user_id: user.id,
          role: 'owner',
        });

      if (memberError) throw memberError;

      toast({ title: "Team created successfully" });
      setIsCreateDialogOpen(false);
      resetForm();
      await loadTeams();
    } catch (error: any) {
      console.error('Error creating team:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create team",
        variant: "destructive",
      });
    }
  };

  const handleInviteMember = async () => {
    if (!selectedTeam) return;

    try {
      // Check if user exists
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', inviteData.email.toLowerCase())
        .single();

      if (profile) {
        // User exists, add them directly to the team
        const { error } = await supabase
          .from('team_members')
          .insert({
            team_id: selectedTeam.id,
            user_id: profile.id,
            role: inviteData.role,
          });

        if (error) throw error;

        toast({ title: "Team member added successfully" });
      } else {
        // User doesn't exist, send invitation email
        const { error } = await apiClient.callFunction('send-team-invitation', {
          teamId: selectedTeam.id,
          email: inviteData.email.toLowerCase(),
          role: inviteData.role,
          teamName: selectedTeam.name,
        });

        if (error) throw error;

        toast({ 
          title: "Invitation sent",
          description: `An invitation email has been sent to ${inviteData.email}`,
        });
      }

      setIsInviteDialogOpen(false);
      resetInviteForm();
      await loadTeamMembers(selectedTeam.id);
      await loadTeamInvitations(selectedTeam.id);
    } catch (error: any) {
      console.error('Error inviting member:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to add team member",
        variant: "destructive",
      });
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this team member?')) return;

    try {
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;

      toast({ title: "Team member removed" });
      if (selectedTeam) {
        await loadTeamMembers(selectedTeam.id);
      }
    } catch (error: any) {
      console.error('Error removing member:', error);
      toast({
        title: "Error",
        description: "Failed to remove team member",
        variant: "destructive",
      });
    }
  };

  const updateMemberRole = async (memberId: string, newRole: string) => {
    try {
      const { error } = await supabase
        .from('team_members')
        .update({ role: newRole })
        .eq('id', memberId);

      if (error) throw error;

      toast({ title: "Role updated successfully" });
      if (selectedTeam) {
        await loadTeamMembers(selectedTeam.id);
      }
    } catch (error: any) {
      console.error('Error updating role:', error);
      toast({
        title: "Error",
        description: "Failed to update role",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({ name: '', description: '' });
  };

  const resetInviteForm = () => {
    setInviteData({ email: '', role: 'member' });
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner': return <Crown className="h-4 w-4 text-yellow-500" />;
      case 'admin': return <Shield className="h-4 w-4 text-blue-500" />;
      default: return <Users className="h-4 w-4 text-green-500" />;
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner': return 'bg-yellow-500';
      case 'admin': return 'bg-blue-500';
      default: return 'bg-green-500';
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

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Teams</h1>
          <p className="text-muted-foreground mt-1">
            Manage your teams and collaborate with your colleagues
          </p>
        </div>
        <Button onClick={() => { resetForm(); setIsCreateDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Create Team
        </Button>
      </div>

      {loadError && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {loadError}. Please try refreshing the page or contact support if the issue persists.
          </AlertDescription>
        </Alert>
      )}

      {teams.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-16 w-16 text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-xl font-semibold mb-2">No Teams Yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create your first team to start collaborating
            </p>
            <Button onClick={() => { resetForm(); setIsCreateDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Create Team
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Teams List */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Your Teams</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {teams.map((team) => (
                <button
                  key={team.id}
                  onClick={() => setSelectedTeam(team)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedTeam?.id === team.id
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'hover:bg-accent'
                  }`}
                >
                  <div className="font-medium">{team.name}</div>
                  <div className="text-sm opacity-80">{team.description || 'No description'}</div>
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Team Details */}
          {selectedTeam && (
            <Card className="lg:col-span-3">
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle>{selectedTeam.name}</CardTitle>
                    <CardDescription>{selectedTeam.description}</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => { resetInviteForm(); setIsInviteDialogOpen(true); }}
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      Add Member
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="members">
                  <TabsList>
                    <TabsTrigger value="members">Members ({teamMembers.length})</TabsTrigger>
                    <TabsTrigger value="settings">Settings</TabsTrigger>
                  </TabsList>

                  <TabsContent value="members" className="space-y-4 mt-4">
                    {/* Pending Invitations */}
                    {teamInvitations.length > 0 && (
                      <div className="space-y-2">
                        <h3 className="text-sm font-semibold text-muted-foreground">
                          Pending Invitations ({teamInvitations.length})
                        </h3>
                        <div className="space-y-2">
                          {teamInvitations.map((invitation) => (
                            <div
                              key={invitation.id}
                              className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-3 border border-dashed rounded-lg bg-muted/30"
                            >
                              <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                  <UserPlus className="h-4 w-4 text-primary" />
                                </div>
                                <div>
                                  <div className="font-medium text-sm">
                                    {invitation.email}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    Invited {new Date(invitation.created_at).toLocaleDateString()} • 
                                    Expires {new Date(invitation.expires_at).toLocaleDateString()}
                                  </div>
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline" className="capitalize">
                                  {getRoleIcon(invitation.role)}
                                  <span className="ml-1">{invitation.role}</span>
                                </Badge>
                                <Badge variant="secondary" className="text-xs">
                                  Pending
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Team Members */}
                    <div>
                      <h3 className="text-sm font-semibold text-muted-foreground mb-2">
                        Active Members ({teamMembers.length})
                      </h3>
                    {teamMembers.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No team members yet
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {teamMembers.map((member) => (
                          <div
                            key={member.id}
                            className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4 border rounded-lg"
                          >
                            <div className="flex items-center gap-3">
                              <Avatar>
                                <AvatarFallback>
                                  {member.profiles?.full_name?.charAt(0) || member.profiles?.email?.charAt(0) || '?'}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-medium">
                                  {member.profiles?.full_name || 'Unknown User'}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {member.profiles?.email}
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">
                                  Joined {new Date(member.joined_at).toLocaleDateString()}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Select
                                value={member.role}
                                onValueChange={(value) => updateMemberRole(member.id, value)}
                                disabled={member.role === 'owner'}
                              >
                              <SelectTrigger className="w-full sm:w-32">
                                  <div className="flex items-center gap-2">
                                    {getRoleIcon(member.role)}
                                    <SelectValue />
                                  </div>
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="member">Member</SelectItem>
                                  <SelectItem value="admin">Admin</SelectItem>
                                  <SelectItem value="viewer">Viewer</SelectItem>
                                </SelectContent>
                              </Select>
                              {member.role !== 'owner' && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleRemoveMember(member.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    </div>
                  </TabsContent>

                  <TabsContent value="settings" className="space-y-4 mt-4">
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-lg font-semibold mb-2">Team Settings</h3>
                        <p className="text-sm text-muted-foreground">
                          Configure team-wide settings and preferences
                        </p>
                      </div>
                      {/* Add more settings here as needed */}
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Create Team Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Team</DialogTitle>
            <DialogDescription>
              Create a team to collaborate with your colleagues
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Team Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Sales Team"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe your team's purpose"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsCreateDialogOpen(false); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleCreateTeam} disabled={!formData.name}>
              Create Team
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite Member Dialog */}
      <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Team Member</DialogTitle>
            <DialogDescription>
              Invite someone to join your team
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={inviteData.email}
                onChange={(e) => setInviteData({ ...inviteData, email: e.target.value })}
                placeholder="colleague@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select
                value={inviteData.role}
                onValueChange={(value: any) => setInviteData({ ...inviteData, role: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Members can view and edit, Admins can manage settings and invite members
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsInviteDialogOpen(false); resetInviteForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleInviteMember} disabled={!inviteData.email}>
              Add Member
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}