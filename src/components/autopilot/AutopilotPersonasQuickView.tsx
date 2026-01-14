import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { 
  Target, 
  Plus, 
  Building2, 
  Globe2,
  Users,
  TrendingUp
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface AutopilotPersonasQuickViewProps {
  onManage: () => void;
}

export function AutopilotPersonasQuickView({ onManage }: AutopilotPersonasQuickViewProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: personas, isLoading } = useQuery({
    queryKey: ['discovery-personas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('discovery_personas')
        .select('*')
        .eq('user_id', user?.id)
        .order('priority', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

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

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground">Loading personas...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Active Personas
            </CardTitle>
            <CardDescription>
              {personas?.filter(p => p.is_active).length || 0} of {personas?.length || 0} personas active
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={onManage}>
            Manage All
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {personas && personas.length > 0 ? (
          <div className="space-y-3">
            {personas.slice(0, 5).map((persona) => {
              const conversionRate = persona.total_leads_found && persona.total_approved
                ? Math.round((persona.total_approved / persona.total_leads_found) * 100)
                : 0;

              return (
                <div
                  key={persona.id}
                  className={`p-4 rounded-lg border transition-colors ${
                    persona.is_active 
                      ? 'bg-card border-primary/20' 
                      : 'bg-muted/50 border-muted'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={persona.is_active}
                        onCheckedChange={(checked) => 
                          toggleActiveMutation.mutate({ id: persona.id, is_active: checked })
                        }
                      />
                      <div>
                        <h4 className="font-medium">{persona.name}</h4>
                        {persona.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {persona.description}
                          </p>
                        )}
                      </div>
                    </div>
                    {persona.is_active && conversionRate > 0 && (
                      <Badge variant="outline" className="text-green-600 border-green-200">
                        <TrendingUp className="h-3 w-3 mr-1" />
                        {conversionRate}%
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    {persona.target_industries?.length > 0 && (
                      <div className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        <span>{persona.target_industries.length} industries</span>
                      </div>
                    )}
                    {persona.target_geographies?.length > 0 && (
                      <div className="flex items-center gap-1">
                        <Globe2 className="h-3 w-3" />
                        <span>{persona.target_geographies.length} regions</span>
                      </div>
                    )}
                    {persona.target_company_sizes?.length > 0 && (
                      <div className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        <span>{persona.target_company_sizes.join(', ')}</span>
                      </div>
                    )}
                  </div>

                  {persona.total_leads_found > 0 && (
                    <div className="mt-3 pt-3 border-t flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        {persona.total_leads_found} found · {persona.total_approved || 0} approved
                      </span>
                      <div className="w-20">
                        <Progress value={conversionRate} className="h-1" />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {personas.length > 5 && (
              <Button variant="ghost" size="sm" className="w-full" onClick={onManage}>
                View all {personas.length} personas
              </Button>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <Target className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <h3 className="font-medium mb-1">No personas configured</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create targeting personas to discover different types of leads
            </p>
            <Button onClick={onManage}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Persona
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
