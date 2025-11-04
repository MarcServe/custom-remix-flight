import { useState, useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { TrendingUp, BarChart3, Kanban } from "lucide-react";
import { KanbanBoard, KanbanItem } from "@/components/kanban/KanbanBoard";
import { toast } from "sonner";
import { companiesApi } from "@/lib/api/companies";

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
  const [view, setView] = useState<"chart" | "kanban">("chart");
  const queryClient = useQueryClient();

  const { data: pipelineData, isLoading } = useQuery({
    queryKey: ["pipeline-stats"],
    queryFn: async () => {
      const stages = ["NEW", "QUALIFIED", "CONTACTED", "MEETING", "PROPOSAL", "WON", "LOST"];
      const results = await Promise.all(
        stages.map(async (stage) => {
          const { count } = await supabase
            .from("deals")
            .select("*", { count: "exact", head: true })
            .eq("stage", stage);
          return { status: stage, count: count || 0 };
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
          table: "deals",
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

  const { data: deals } = useQuery({
    queryKey: ["deals-kanban"],
    queryFn: async () => {
      const { data } = await supabase
        .from('deals')
        .select('*, companies(name)')
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  const updateDealStage = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: string }) => {
      const { error } = await supabase
        .from('deals')
        .update({ stage })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deals-kanban"] });
      queryClient.invalidateQueries({ queryKey: ["pipeline-stats"] });
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      toast.success("Deal stage updated");
    },
    onError: () => {
      toast.error("Failed to update deal stage");
    },
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-96">Loading pipeline...</div>;
  }

  const totalDeals = pipelineData?.reduce((acc, curr) => acc + curr.count, 0) || 0;

  const kanbanColumns = [
    { id: "NEW", title: "New" },
    { id: "QUALIFIED", title: "Qualified" },
    { id: "CONTACTED", title: "Contacted" },
    { id: "MEETING", title: "Meeting" },
    { id: "PROPOSAL", title: "Proposal" },
    { id: "WON", title: "Won" },
    { id: "LOST", title: "Lost" },
  ];

  const kanbanItems: KanbanItem[] = (deals || []).map((deal: any) => ({
    id: deal.id,
    title: deal.title,
    status: deal.stage || "NEW",
    company: deal.companies?.name || "No company",
    amount: deal.amount,
  }));

  const handleStatusChange = (itemId: string, newStatus: string) => {
    updateDealStage.mutate({ id: itemId, stage: newStatus });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <TrendingUp className="h-8 w-8 text-primary" />
            Sales Pipeline
          </h1>
          <p className="text-muted-foreground">
            Real-time visualization of your deal pipeline
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={view === "chart" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("chart")}
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            Chart
          </Button>
          <Button
            variant={view === "kanban" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("kanban")}
          >
            <Kanban className="h-4 w-4 mr-2" />
            Kanban
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Deals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalDeals}</div>
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
              {totalDeals > 0
                ? Math.round(
                    ((pipelineData?.find((s) => s.status === "WON")?.count || 0) /
                      totalDeals) *
                      100
                  )
                : 0}
              %
            </div>
          </CardContent>
        </Card>
      </div>

      {view === "kanban" ? (
        <KanbanBoard
          items={kanbanItems}
          columns={kanbanColumns}
          onStatusChange={handleStatusChange}
          onItemClick={(item) => {
            toast.info(`Clicked: ${item.title}`);
          }}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Pipeline Distribution</CardTitle>
            <CardDescription>Deal count by stage</CardDescription>
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
      )}
    </div>
  );
}
