import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  CheckCircle2, 
  XCircle, 
  ArrowRight,
  Building2,
  Mail,
  Target,
  FileText
} from "lucide-react";

interface PrerequisiteItem {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  isComplete: boolean;
  link: string;
}

export function AutopilotPrerequisites() {
  const { user } = useAuth();

  // Check business profile
  const { data: businessProfile } = useQuery({
    queryKey: ['business-profile-check'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('business_profiles')
        .select('id, company_name, services_description')
        .eq('user_id', user?.id)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Check email provider
  const { data: emailProvider } = useQuery({
    queryKey: ['email-provider-check'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_connections')
        .select('id, status')
        .eq('user_id', user?.id)
        .eq('status', 'active')
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Check personas
  const { data: personas } = useQuery({
    queryKey: ['personas-check'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('discovery_personas')
        .select('id, is_active')
        .eq('user_id', user?.id);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Check sequences
  const { data: sequences } = useQuery({
    queryKey: ['sequences-check'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_sequences')
        .select('id')
        .eq('created_by', user?.id);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const prerequisites: PrerequisiteItem[] = [
    {
      id: 'business-profile',
      label: 'Business Profile',
      description: 'Company name and services description',
      icon: Building2,
      isComplete: !!(businessProfile?.company_name && businessProfile?.services_description),
      link: '/business-profile',
    },
    {
      id: 'email-provider',
      label: 'Email Provider',
      description: 'Connect your email for outreach',
      icon: Mail,
      isComplete: !!emailProvider?.id,
      link: '/integrations/email-providers',
    },
    {
      id: 'personas',
      label: 'Discovery Persona',
      description: 'At least one targeting persona',
      icon: Target,
      isComplete: (personas?.length || 0) > 0,
      link: '/lead-inbox',
    },
    {
      id: 'sequences',
      label: 'Email Sequence',
      description: 'At least one outreach sequence',
      icon: FileText,
      isComplete: (sequences?.length || 0) > 0,
      link: '/sequences',
    },
  ];

  const completedCount = prerequisites.filter(p => p.isComplete).length;
  const allComplete = completedCount === prerequisites.length;

  if (allComplete) {
    return null; // Don't show if everything is set up
  }

  return (
    <Card className="border-orange-200 bg-orange-50/50 dark:bg-orange-950/10 dark:border-orange-900/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <span className="text-orange-600">Setup Checklist</span>
          <span className="text-sm font-normal text-muted-foreground">
            ({completedCount}/{prerequisites.length} complete)
          </span>
        </CardTitle>
        <CardDescription>
          Complete these steps for full autopilot functionality
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {prerequisites.map((item) => (
            <Link
              key={item.id}
              to={item.link}
              className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                item.isComplete 
                  ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900/50' 
                  : 'bg-card hover:border-primary/50'
              }`}
            >
              <div className={`p-2 rounded-lg ${
                item.isComplete 
                  ? 'bg-green-100 dark:bg-green-900/30' 
                  : 'bg-muted'
              }`}>
                <item.icon className={`h-4 w-4 ${
                  item.isComplete ? 'text-green-600' : 'text-muted-foreground'
                }`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{item.label}</span>
                  {item.isComplete ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                  ) : (
                    <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">{item.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
