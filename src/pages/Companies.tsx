import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, MapPin, Users2 } from "lucide-react";

export default function Companies() {
  const { data: companies, isLoading } = useQuery({
    queryKey: ["companies"],
    queryFn: async () => {
      const { data } = await supabase
        .from("companies")
        .select("*")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-96">Loading...</div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Companies</h1>
          <p className="text-muted-foreground mt-2">Manage and view all your companies</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {companies?.map((company) => (
          <Card key={company.id} className="transition-all hover:shadow-lg border-0 bg-gradient-to-br from-card to-card/50 group">
            <CardHeader className="pb-4">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                  <Building2 className="h-7 w-7 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-xl font-bold truncate">{company.name}</CardTitle>
                    <Badge variant="secondary" className="flex-shrink-0 text-xs">{company.status}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{company.industry}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {company.headquarters && (
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center flex-shrink-0">
                      <MapPin className="h-4 w-4" />
                    </div>
                    <span>{company.headquarters}</span>
                  </div>
                )}
                {company.employee_count && (
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center flex-shrink-0">
                      <Users2 className="h-4 w-4" />
                    </div>
                    <span>{company.employee_count} employees</span>
                  </div>
                )}
              </div>
              
              {company.description && (
                <p className="text-sm text-muted-foreground line-clamp-2 pt-2 border-t">
                  {company.description}
                </p>
              )}
              
              {company.website && (
                <a
                  href={company.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-sm font-medium text-primary hover:underline mt-2"
                >
                  Visit website →
                </a>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
