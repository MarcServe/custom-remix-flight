import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Plus, 
  Target, 
  Trash2, 
  Edit2, 
  Loader2,
  Building2,
  Globe2,
  Users,
  Tag,
  XCircle,
  Mail,
  Megaphone,
  Briefcase
} from "lucide-react";

interface Persona {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  priority: number;
  target_industries: string[] | null;
  target_geographies: string[] | null;
  target_company_sizes: string[] | null;
  target_keywords: string[] | null;
  exclude_industries: string[] | null;
  exclude_keywords: string[] | null;
  auto_enroll_sequence_id: string | null;
  custom_search_query: string | null;
  total_leads_found: number;
  total_approved: number;
  total_rejected: number;
  conversion_rate: number;
  // Email marketing fields
  product_focus: string | null;
  value_proposition: string | null;
  email_tone: string | null;
  talking_points: string[] | null;
  call_to_action: string | null;
  email_signature_override: string | null;
}

const EMAIL_TONES = [
  { value: 'professional', label: 'Professional' },
  { value: 'casual', label: 'Casual & Friendly' },
  { value: 'technical', label: 'Technical' },
  { value: 'persuasive', label: 'Persuasive' },
];

const COMPANY_SIZES = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1001-5000', '5000+'];

export function PersonaManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPersona, setEditingPersona] = useState<Persona | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    target_industries: '',
    target_geographies: '',
    target_company_sizes: [] as string[],
    target_keywords: '',
    exclude_industries: '',
    exclude_keywords: '',
    auto_enroll_sequence_id: '',
    custom_search_query: '',
    // Email marketing fields
    product_focus: '',
    value_proposition: '',
    email_tone: 'professional',
    talking_points: '',
    call_to_action: '',
    email_signature_override: '',
  });

  // Fetch personas
  const { data: personas, isLoading } = useQuery({
    queryKey: ['discovery-personas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('discovery_personas')
        .select('*')
        .eq('user_id', user?.id)
        .order('priority', { ascending: false });
      
      if (error) throw error;
      return data as Persona[];
    },
    enabled: !!user?.id,
  });

  // Fetch sequences for dropdown
  const { data: sequences } = useQuery({
    queryKey: ['email-sequences'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_sequences')
        .select('id, name')
        .eq('created_by', user?.id)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Create/Update persona
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData & { id?: string }) => {
      const payload = {
        user_id: user?.id,
        name: data.name,
        description: data.description || null,
        target_industries: data.target_industries ? data.target_industries.split(',').map(s => s.trim()).filter(Boolean) : null,
        target_geographies: data.target_geographies ? data.target_geographies.split(',').map(s => s.trim()).filter(Boolean) : null,
        target_company_sizes: data.target_company_sizes.length > 0 ? data.target_company_sizes : null,
        target_keywords: data.target_keywords ? data.target_keywords.split(',').map(s => s.trim()).filter(Boolean) : null,
        exclude_industries: data.exclude_industries ? data.exclude_industries.split(',').map(s => s.trim()).filter(Boolean) : null,
        exclude_keywords: data.exclude_keywords ? data.exclude_keywords.split(',').map(s => s.trim()).filter(Boolean) : null,
        auto_enroll_sequence_id: data.auto_enroll_sequence_id || null,
        custom_search_query: data.custom_search_query || null,
        // Email marketing fields
        product_focus: data.product_focus || null,
        value_proposition: data.value_proposition || null,
        email_tone: data.email_tone || null,
        talking_points: data.talking_points ? data.talking_points.split(',').map(s => s.trim()).filter(Boolean) : null,
        call_to_action: data.call_to_action || null,
        email_signature_override: data.email_signature_override || null,
      };

      if (data.id) {
        const { error } = await supabase
          .from('discovery_personas')
          .update(payload)
          .eq('id', data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('discovery_personas')
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discovery-personas'] });
      setDialogOpen(false);
      resetForm();
      toast({ title: editingPersona ? 'Persona updated' : 'Persona created' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Toggle active
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('discovery_personas')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discovery-personas'] });
    },
  });

  // Delete persona
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('discovery_personas')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discovery-personas'] });
      toast({ title: 'Persona deleted' });
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      target_industries: '',
      target_geographies: '',
      target_company_sizes: [],
      target_keywords: '',
      exclude_industries: '',
      exclude_keywords: '',
      auto_enroll_sequence_id: '',
      custom_search_query: '',
      product_focus: '',
      value_proposition: '',
      email_tone: 'professional',
      talking_points: '',
      call_to_action: '',
      email_signature_override: '',
    });
    setEditingPersona(null);
  };

  const handleEdit = (persona: Persona) => {
    setEditingPersona(persona);
    setFormData({
      name: persona.name,
      description: persona.description || '',
      target_industries: persona.target_industries?.join(', ') || '',
      target_geographies: persona.target_geographies?.join(', ') || '',
      target_company_sizes: persona.target_company_sizes || [],
      target_keywords: persona.target_keywords?.join(', ') || '',
      exclude_industries: persona.exclude_industries?.join(', ') || '',
      exclude_keywords: persona.exclude_keywords?.join(', ') || '',
      auto_enroll_sequence_id: persona.auto_enroll_sequence_id || '',
      custom_search_query: persona.custom_search_query || '',
      product_focus: persona.product_focus || '',
      value_proposition: persona.value_proposition || '',
      email_tone: persona.email_tone || 'professional',
      talking_points: persona.talking_points?.join(', ') || '',
      call_to_action: persona.call_to_action || '',
      email_signature_override: persona.email_signature_override || '',
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!formData.name.trim()) {
      toast({ title: 'Name is required', variant: 'destructive' });
      return;
    }
    saveMutation.mutate({ ...formData, id: editingPersona?.id });
  };

  const toggleCompanySize = (size: string) => {
    setFormData(prev => ({
      ...prev,
      target_company_sizes: prev.target_company_sizes.includes(size)
        ? prev.target_company_sizes.filter(s => s !== size)
        : [...prev.target_company_sizes, size]
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium flex items-center gap-2">
            <Target className="h-5 w-5" />
            Discovery Personas
          </h3>
          <p className="text-sm text-muted-foreground">
            Create different targeting profiles to discover diverse lead types
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              New Persona
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>{editingPersona ? 'Edit Persona' : 'Create New Persona'}</DialogTitle>
              <DialogDescription>
                Define targeting criteria for this persona. The AI will use these to find relevant leads.
              </DialogDescription>
            </DialogHeader>
            
            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="space-y-6 py-4">
                {/* Basic Info */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Persona Name *</Label>
                    <Input
                      id="name"
                      placeholder="e.g., Enterprise SaaS, SMB Retail"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      placeholder="Describe the ideal target for this persona"
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      rows={2}
                    />
                  </div>
                </div>

                {/* Targeting */}
                <div className="space-y-4">
                  <h4 className="font-medium flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Targeting Criteria
                  </h4>
                  
                  <div className="space-y-2">
                    <Label htmlFor="target_industries">Target Industries (comma-separated)</Label>
                    <Input
                      id="target_industries"
                      placeholder="e.g., Technology, Healthcare, Finance"
                      value={formData.target_industries}
                      onChange={(e) => setFormData(prev => ({ ...prev, target_industries: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="target_geographies">
                      <Globe2 className="h-4 w-4 inline mr-1" />
                      Target Geographies (comma-separated)
                    </Label>
                    <Input
                      id="target_geographies"
                      placeholder="e.g., United States, United Kingdom, Germany"
                      value={formData.target_geographies}
                      onChange={(e) => setFormData(prev => ({ ...prev, target_geographies: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>
                      <Users className="h-4 w-4 inline mr-1" />
                      Company Size
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {COMPANY_SIZES.map(size => (
                        <Badge
                          key={size}
                          variant={formData.target_company_sizes.includes(size) ? "default" : "outline"}
                          className="cursor-pointer"
                          onClick={() => toggleCompanySize(size)}
                        >
                          {size}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="target_keywords">
                      <Tag className="h-4 w-4 inline mr-1" />
                      Target Keywords (comma-separated)
                    </Label>
                    <Input
                      id="target_keywords"
                      placeholder="e.g., AI, automation, cloud"
                      value={formData.target_keywords}
                      onChange={(e) => setFormData(prev => ({ ...prev, target_keywords: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Exclusions */}
                <div className="space-y-4">
                  <h4 className="font-medium flex items-center gap-2 text-red-600">
                    <XCircle className="h-4 w-4" />
                    Exclusions
                  </h4>
                  
                  <div className="space-y-2">
                    <Label htmlFor="exclude_industries">Exclude Industries (comma-separated)</Label>
                    <Input
                      id="exclude_industries"
                      placeholder="e.g., Government, Non-profit"
                      value={formData.exclude_industries}
                      onChange={(e) => setFormData(prev => ({ ...prev, exclude_industries: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="exclude_keywords">Exclude Keywords (comma-separated)</Label>
                    <Input
                      id="exclude_keywords"
                      placeholder="e.g., free, student, hobby"
                      value={formData.exclude_keywords}
                      onChange={(e) => setFormData(prev => ({ ...prev, exclude_keywords: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Outreach */}
                <div className="space-y-4">
                  <h4 className="font-medium">Auto-Outreach</h4>
                  
                  <div className="space-y-2">
                    <Label>Auto-enroll in Sequence</Label>
                    <Select
                      value={formData.auto_enroll_sequence_id || "none"}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, auto_enroll_sequence_id: value === "none" ? "" : value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="None (manual approval)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {sequences?.map((seq) => (
                          <SelectItem key={seq.id} value={seq.id}>{seq.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="custom_search_query">Custom Search Query</Label>
                    <Textarea
                      id="custom_search_query"
                      placeholder="Override default search with a custom query..."
                      value={formData.custom_search_query}
                      onChange={(e) => setFormData(prev => ({ ...prev, custom_search_query: e.target.value }))}
                      rows={2}
                    />
                  </div>
                </div>

                {/* Email Marketing */}
                <div className="space-y-4 border-t pt-4">
                  <h4 className="font-medium flex items-center gap-2 text-primary">
                    <Megaphone className="h-4 w-4" />
                    Email Marketing
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Define product/service messaging for this persona. This will be used when generating AI emails.
                  </p>
                  
                  <div className="space-y-2">
                    <Label htmlFor="product_focus">
                      <Briefcase className="h-4 w-4 inline mr-1" />
                      Product/Service Focus
                    </Label>
                    <Input
                      id="product_focus"
                      placeholder="e.g., Lead Genie AI Assistant, Enterprise CRM Suite"
                      value={formData.product_focus}
                      onChange={(e) => setFormData(prev => ({ ...prev, product_focus: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="value_proposition">Value Proposition</Label>
                    <Textarea
                      id="value_proposition"
                      placeholder="Key benefits in 1-2 sentences (e.g., Increase sales productivity by 10x with AI-powered lead qualification)"
                      value={formData.value_proposition}
                      onChange={(e) => setFormData(prev => ({ ...prev, value_proposition: e.target.value }))}
                      rows={2}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>
                      <Mail className="h-4 w-4 inline mr-1" />
                      Email Tone
                    </Label>
                    <Select
                      value={formData.email_tone}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, email_tone: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select tone" />
                      </SelectTrigger>
                      <SelectContent>
                        {EMAIL_TONES.map(tone => (
                          <SelectItem key={tone.value} value={tone.value}>{tone.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="talking_points">Key Talking Points (comma-separated)</Label>
                    <Textarea
                      id="talking_points"
                      placeholder="e.g., AI-powered automation, CRM integration, team collaboration, real-time analytics"
                      value={formData.talking_points}
                      onChange={(e) => setFormData(prev => ({ ...prev, talking_points: e.target.value }))}
                      rows={2}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="call_to_action">Call to Action</Label>
                    <Input
                      id="call_to_action"
                      placeholder="e.g., Book a 15-minute demo, Start your free trial, Schedule a consultation"
                      value={formData.call_to_action}
                      onChange={(e) => setFormData(prev => ({ ...prev, call_to_action: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email_signature_override">Signature Override (Optional)</Label>
                    <Textarea
                      id="email_signature_override"
                      placeholder="Leave empty to use your default signature, or enter a custom signature for this persona"
                      value={formData.email_signature_override}
                      onChange={(e) => setFormData(prev => ({ ...prev, email_signature_override: e.target.value }))}
                      rows={3}
                    />
                  </div>
                </div>
              </div>
            </ScrollArea>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                {editingPersona ? 'Update' : 'Create'} Persona
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Personas List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !personas || personas.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <Target className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="font-medium">No personas yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Create your first persona to start targeted lead discovery
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {personas.map((persona) => (
            <Card key={persona.id} className={!persona.is_active ? 'opacity-60' : ''}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${persona.is_active ? 'bg-green-500' : 'bg-muted'}`} />
                      {persona.name}
                    </CardTitle>
                    {persona.description && (
                      <CardDescription className="mt-1">{persona.description}</CardDescription>
                    )}
                  </div>
                  <Switch
                    checked={persona.is_active}
                    onCheckedChange={(checked) => toggleActiveMutation.mutate({ id: persona.id, is_active: checked })}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Targeting badges */}
                <div className="flex flex-wrap gap-1">
                  {persona.target_industries?.slice(0, 3).map(ind => (
                    <Badge key={ind} variant="secondary" className="text-xs">{ind}</Badge>
                  ))}
                  {persona.target_geographies?.slice(0, 2).map(geo => (
                    <Badge key={geo} variant="outline" className="text-xs">{geo}</Badge>
                  ))}
                  {(persona.target_industries?.length || 0) + (persona.target_geographies?.length || 0) > 5 && (
                    <Badge variant="outline" className="text-xs">+more</Badge>
                  )}
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>{persona.total_leads_found || 0} found</span>
                  <span>{persona.total_approved || 0} approved</span>
                  {persona.conversion_rate > 0 && (
                    <Badge variant="outline" className="text-green-600 text-xs">
                      {Number(persona.conversion_rate).toFixed(0)}% conversion
                    </Badge>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2">
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(persona)}>
                    <Edit2 className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-destructive hover:text-destructive"
                    onClick={() => deleteMutation.mutate(persona.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
