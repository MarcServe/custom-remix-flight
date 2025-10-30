import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { StatCard } from "@/components/StatCard";
import { Building2, Users, DollarSign, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Welcome to your sales overview</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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

      <Card>
        <CardHeader>
          <CardTitle>Recent Companies</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentCompanies?.map((company, i) => (
              <div
                key={i}
                className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0"
              >
                <div>
                  <p className="font-medium">{company.name}</p>
                  <p className="text-sm text-muted-foreground">{company.industry}</p>
                </div>
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  {company.status}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
