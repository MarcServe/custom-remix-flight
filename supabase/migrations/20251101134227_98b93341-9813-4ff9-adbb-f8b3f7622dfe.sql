-- Create teams/workspaces table
CREATE TABLE public.teams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  owner_id UUID NOT NULL,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- Create team members table
CREATE TABLE public.team_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  permissions JSONB DEFAULT '{}'::jsonb,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(team_id, user_id)
);

-- Enable RLS
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX idx_team_members_team_id ON public.team_members(team_id);
CREATE INDEX idx_team_members_user_id ON public.team_members(user_id);
CREATE INDEX idx_team_members_role ON public.team_members(role);

-- RLS Policies for teams
CREATE POLICY "Team members can view their teams"
  ON public.teams
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_members.team_id = teams.id
      AND team_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Team owners can create teams"
  ON public.teams
  FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Team admins can update teams"
  ON public.teams
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_members.team_id = teams.id
      AND team_members.user_id = auth.uid()
      AND team_members.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Team owners can delete teams"
  ON public.teams
  FOR DELETE
  USING (auth.uid() = owner_id);

-- RLS Policies for team_members
CREATE POLICY "Team members can view other members"
  ON public.team_members
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = team_members.team_id
      AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Team admins can add members"
  ON public.team_members
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_members.team_id = team_id
      AND team_members.user_id = auth.uid()
      AND team_members.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Team admins can update members"
  ON public.team_members
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = team_members.team_id
      AND tm.user_id = auth.uid()
      AND tm.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Team admins can remove members"
  ON public.team_members
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = team_members.team_id
      AND tm.user_id = auth.uid()
      AND tm.role IN ('owner', 'admin')
    )
  );

-- Create shared inbox configurations
CREATE TABLE public.shared_inboxes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  email_address TEXT,
  auto_assign BOOLEAN DEFAULT false,
  assignment_strategy TEXT DEFAULT 'round_robin' CHECK (assignment_strategy IN ('round_robin', 'least_active', 'manual', 'skill_based')),
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.shared_inboxes ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX idx_shared_inboxes_team_id ON public.shared_inboxes(team_id);

-- RLS Policies
CREATE POLICY "Team members can view shared inboxes"
  ON public.shared_inboxes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_members.team_id = shared_inboxes.team_id
      AND team_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Team admins can manage shared inboxes"
  ON public.shared_inboxes
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_members.team_id = shared_inboxes.team_id
      AND team_members.user_id = auth.uid()
      AND team_members.role IN ('owner', 'admin')
    )
  );

-- Create assignment rules table
CREATE TABLE public.assignment_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  shared_inbox_id UUID REFERENCES public.shared_inboxes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  
  -- Conditions for assignment
  conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Assignment target
  assign_to_user_id UUID,
  assign_to_role TEXT,
  
  -- Settings
  notify_assignee BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.assignment_rules ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX idx_assignment_rules_team_id ON public.assignment_rules(team_id);
CREATE INDEX idx_assignment_rules_enabled ON public.assignment_rules(enabled);
CREATE INDEX idx_assignment_rules_priority ON public.assignment_rules(priority DESC);

-- RLS Policies
CREATE POLICY "Team members can view assignment rules"
  ON public.assignment_rules
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_members.team_id = assignment_rules.team_id
      AND team_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Team admins can manage assignment rules"
  ON public.assignment_rules
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_members.team_id = assignment_rules.team_id
      AND team_members.user_id = auth.uid()
      AND team_members.role IN ('owner', 'admin')
    )
  );

-- Create internal notes/comments table
CREATE TABLE public.internal_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  author_id UUID NOT NULL,
  
  -- What is being commented on
  entity_type TEXT NOT NULL CHECK (entity_type IN ('company_sequence', 'email_activity', 'deal', 'company', 'contact')),
  entity_id UUID NOT NULL,
  
  content TEXT NOT NULL,
  mentions JSONB DEFAULT '[]'::jsonb, -- Array of user IDs mentioned
  metadata JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.internal_notes ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX idx_internal_notes_team_id ON public.internal_notes(team_id);
CREATE INDEX idx_internal_notes_author_id ON public.internal_notes(author_id);
CREATE INDEX idx_internal_notes_entity ON public.internal_notes(entity_type, entity_id);
CREATE INDEX idx_internal_notes_created_at ON public.internal_notes(created_at DESC);

-- RLS Policies
CREATE POLICY "Team members can view internal notes"
  ON public.internal_notes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_members.team_id = internal_notes.team_id
      AND team_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Team members can create internal notes"
  ON public.internal_notes
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_members.team_id = internal_notes.team_id
      AND team_members.user_id = auth.uid()
    )
    AND auth.uid() = author_id
  );

CREATE POLICY "Note authors can update their notes"
  ON public.internal_notes
  FOR UPDATE
  USING (auth.uid() = author_id);

CREATE POLICY "Note authors or admins can delete notes"
  ON public.internal_notes
  FOR DELETE
  USING (
    auth.uid() = author_id
    OR EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_members.team_id = internal_notes.team_id
      AND team_members.user_id = auth.uid()
      AND team_members.role IN ('owner', 'admin')
    )
  );

-- Create assignments table (tracks who is assigned to what)
CREATE TABLE public.assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  assigned_to_user_id UUID NOT NULL,
  assigned_by_user_id UUID NOT NULL,
  
  -- What is being assigned
  entity_type TEXT NOT NULL CHECK (entity_type IN ('company_sequence', 'email_activity', 'deal', 'company', 'contact')),
  entity_id UUID NOT NULL,
  
  status TEXT DEFAULT 'assigned' CHECK (status IN ('assigned', 'in_progress', 'completed', 'cancelled')),
  due_date TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  UNIQUE(entity_type, entity_id, assigned_to_user_id)
);

-- Enable RLS
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX idx_assignments_team_id ON public.assignments(team_id);
CREATE INDEX idx_assignments_assigned_to ON public.assignments(assigned_to_user_id);
CREATE INDEX idx_assignments_entity ON public.assignments(entity_type, entity_id);
CREATE INDEX idx_assignments_status ON public.assignments(status);
CREATE INDEX idx_assignments_due_date ON public.assignments(due_date);

-- RLS Policies
CREATE POLICY "Team members can view assignments"
  ON public.assignments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_members.team_id = assignments.team_id
      AND team_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Team members can create assignments"
  ON public.assignments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_members.team_id = assignments.team_id
      AND team_members.user_id = auth.uid()
    )
    AND auth.uid() = assigned_by_user_id
  );

CREATE POLICY "Assigned users can update their assignments"
  ON public.assignments
  FOR UPDATE
  USING (
    auth.uid() = assigned_to_user_id
    OR auth.uid() = assigned_by_user_id
    OR EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_members.team_id = assignments.team_id
      AND team_members.user_id = auth.uid()
      AND team_members.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Team admins or assigners can delete assignments"
  ON public.assignments
  FOR DELETE
  USING (
    auth.uid() = assigned_by_user_id
    OR EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_members.team_id = assignments.team_id
      AND team_members.user_id = auth.uid()
      AND team_members.role IN ('owner', 'admin')
    )
  );

-- Create triggers for updated_at
CREATE TRIGGER update_teams_updated_at
  BEFORE UPDATE ON public.teams
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_shared_inboxes_updated_at
  BEFORE UPDATE ON public.shared_inboxes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_assignment_rules_updated_at
  BEFORE UPDATE ON public.assignment_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_internal_notes_updated_at
  BEFORE UPDATE ON public.internal_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_assignments_updated_at
  BEFORE UPDATE ON public.assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();