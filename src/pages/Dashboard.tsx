import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { StatCard } from "@/components/StatCard";
import { QuickActions } from "@/components/QuickActions";
import { Building2, Users, DollarSign, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function Dashboard() {
  const { data: companies } = useQuery({
    queryKey: ["companies-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("companies")
        .select("*", { count: "exact", head: true });
      return count || 0;
    },
  });

  const { data: deals } = useQuery({
    queryKey: ["deals-stats"],
    queryFn: async () => {
      const { data } = await supabase
        .from("deals")
        .select("amount, stage");
      const total = data?.reduce((sum, deal) => sum + (deal.amount || 0), 0) || 0;
      return { count: data?.length || 0, total };
    },
  });

  const { data: people } = useQuery({
    queryKey: ["people-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("people")
        .select("*", { count: "exact", head: true });
      return count || 0;
    },
  });

  const { data: recentCompanies } = useQuery({
    queryKey: ["recent-companies"],
    queryFn: async () => {
      const { data } = await supabase
        .from("companies")
        .select("name, industry, status, created_at")
        .order("created_at", { ascending: false })
        .limit(5);
      return data || [];
    },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-2">Welcome to your sales overview</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Companies"
          value={companies || 0}
          icon={Building2}
          trend={{ value: "+12.5%", isPositive: true }}
        />
        <StatCard
          title="Active Deals"
          value={deals?.count || 0}
          icon={DollarSign}
          trend={{ value: "+8.2%", isPositive: true }}
        />
        <StatCard
          title="Total Contacts"
          value={people || 0}
          icon={Users}
          trend={{ value: "+4.1%", isPositive: true }}
        />
        <StatCard
          title="Revenue"
          value={`$${((deals?.total || 0) / 1000).toFixed(0)}k`}
          icon={TrendingUp}
          trend={{ value: "+15.3%", isPositive: true }}
        />
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
        <QuickActions />
      </div>

      <Card className="border-0 shadow-md">
        <CardHeader className="border-b bg-muted/30">
          <CardTitle className="text-xl">Recent Companies</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-4">
            {recentCompanies?.map((company, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-4 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                    <Building2 className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{company.name}</p>
                    <p className="text-sm text-muted-foreground">{company.industry}</p>
                  </div>
                </div>
                <Badge variant="secondary" className="text-xs font-medium px-3 py-1">
                  {company.status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
