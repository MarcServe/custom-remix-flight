import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Target, Briefcase } from "lucide-react";

export interface MarketingPersona {
  id: string;
  name: string;
  description: string | null;
  product_focus: string | null;
  value_proposition: string | null;
  email_tone: string | null;
  talking_points: string[] | null;
  call_to_action: string | null;
  email_signature_override: string | null;
}

interface PersonaSelectorProps {
  value: string | null;
  onChange: (persona: MarketingPersona | null, context: string) => void;
  disabled?: boolean;
}

export function PersonaSelector({ value, onChange, disabled }: PersonaSelectorProps) {
  const { user } = useAuth();

  const { data: personas, isLoading } = useQuery({
    queryKey: ['marketing-personas', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('discovery_personas')
        .select('id, name, description, product_focus, value_proposition, email_tone, talking_points, call_to_action, email_signature_override')
        .eq('user_id', user?.id)
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return data as MarketingPersona[];
    },
    enabled: !!user?.id,
  });

  // Filter personas that have marketing content
  const marketingPersonas = personas?.filter(p => 
    p.product_focus || p.value_proposition || p.talking_points?.length
  ) || [];

  const buildContextFromPersona = (persona: MarketingPersona): string => {
    const parts: string[] = [];

    if (persona.product_focus) {
      parts.push(`Product/Service: ${persona.product_focus}`);
    }
    if (persona.value_proposition) {
      parts.push(`Value Proposition: ${persona.value_proposition}`);
    }
    if (persona.talking_points?.length) {
      parts.push(`Key Points: ${persona.talking_points.join(', ')}`);
    }
    if (persona.call_to_action) {
      parts.push(`Call to Action: ${persona.call_to_action}`);
    }
    if (persona.email_tone) {
      parts.push(`Tone: ${persona.email_tone}`);
    }

    return parts.join('\n');
  };

  const handleChange = (personaId: string) => {
    if (personaId === 'none') {
      onChange(null, '');
      return;
    }

    const persona = marketingPersonas.find(p => p.id === personaId);
    if (persona) {
      const context = buildContextFromPersona(persona);
      onChange(persona, context);
    }
  };

  const selectedPersona = marketingPersonas.find(p => p.id === value);

  if (isLoading) {
    return null;
  }

  // Don't show if no marketing personas exist
  if (marketingPersonas.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        <Target className="h-4 w-4 text-primary" />
        Marketing Persona
      </Label>
      <Select
        value={value || 'none'}
        onValueChange={handleChange}
        disabled={disabled}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select a persona..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">
            <span className="text-muted-foreground">No persona (manual context)</span>
          </SelectItem>
          {marketingPersonas.map((persona) => (
            <SelectItem key={persona.id} value={persona.id}>
              <div className="flex items-center gap-2">
                <span className="font-medium">{persona.name}</span>
                {persona.product_focus && (
                  <Badge variant="outline" className="text-xs">
                    {persona.product_focus.slice(0, 20)}...
                  </Badge>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      {selectedPersona && (
        <div className="rounded-md bg-primary/5 border border-primary/20 p-3 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <Briefcase className="h-4 w-4" />
            {selectedPersona.name}
          </div>
          {selectedPersona.product_focus && (
            <p className="text-sm"><strong>Product:</strong> {selectedPersona.product_focus}</p>
          )}
          {selectedPersona.value_proposition && (
            <p className="text-sm text-muted-foreground">{selectedPersona.value_proposition}</p>
          )}
          {selectedPersona.call_to_action && (
            <p className="text-xs text-muted-foreground">
              <strong>CTA:</strong> {selectedPersona.call_to_action}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
