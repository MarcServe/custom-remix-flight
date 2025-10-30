import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { TrendingUp } from "lucide-react";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

const statusColors: Record<string, string> = {
  NEW: "hsl(var(--primary))",
  QUALIFIED: "hsl(var(--chart-1))",
  CONTACTED: "hsl(var(--chart-2))",
  MEETING: "hsl(var(--chart-3))",
  PROPOSAL: "hsl(var(--chart-4))",
  WON: "hsl(var(--chart-5))",
  LOST: "hsl(var(--muted))",
};

export default function Pipeline() {
  const queryClient = useQueryClient();

  const { data: pipelineData, isLoading } = useQuery({
    queryKey: ["pipeline-stats"],
    queryFn: async () => {
      const statuses = ["NEW", "QUALIFIED", "CONTACTED", "MEETING", "PROPOSAL", "WON", "LOST"];
      const results = await Promise.all(
        statuses.map(async (status) => {
          const { count } = await supabase
            .from("companies")
            .select("*", { count: "exact", head: true })
            .eq("status", status);
          return { status, count: count || 0 };
        })
      );
      return results;
    },
  });

  // Subscribe to real-time updates
  useEffect(() => {
    const channel = supabase
      .channel("pipeline-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "companies",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["pipeline-stats"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  if (isLoading) {
    return <div className="flex items-center justify-center h-96">Loading pipeline...</div>;
  }

  const totalCompanies = pipelineData?.reduce((acc, curr) => acc + curr.count, 0) || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <TrendingUp className="h-8 w-8 text-primary" />
          Sales Pipeline
        </h1>
        <p className="text-muted-foreground">
          Real-time visualization of your company pipeline
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Companies</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCompanies}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Pipeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {pipelineData
                ?.filter((s) => !["NEW", "WON", "LOST"].includes(s.status))
                .reduce((acc, curr) => acc + curr.count, 0) || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Won</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {pipelineData?.find((s) => s.status === "WON")?.count || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalCompanies > 0
                ? Math.round(
                    ((pipelineData?.find((s) => s.status === "WON")?.count || 0) /
                      totalCompanies) *
                      100
                  )
                : 0}
              %
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pipeline Distribution</CardTitle>
          <CardDescription>Company count by status</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={pipelineData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="status"
                className="text-xs"
                tick={{ fill: "hsl(var(--muted-foreground))" }}
              />
              <YAxis
                className="text-xs"
                tick={{ fill: "hsl(var(--muted-foreground))" }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
              />
              <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                {pipelineData?.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={statusColors[entry.status]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
