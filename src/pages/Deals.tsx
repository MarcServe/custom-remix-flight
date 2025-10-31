import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Calendar } from "lucide-react";
import { DealActivityIndicator } from "@/components/DealActivityIndicator";
import { format } from "date-fns";

export default function Deals() {
  const { data: deals, isLoading } = useQuery({
    queryKey: ["deals"],
    queryFn: async () => {
      const { data } = await supabase
        .from("deals")
        .select("*, companies(name)")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-96">Loading...</div>;
  }

  const stageColors: Record<string, string> = {
    Discovery: "bg-blue-100 text-blue-800",
    Qualified: "bg-yellow-100 text-yellow-800",
    Proposal: "bg-purple-100 text-purple-800",
    Negotiation: "bg-orange-100 text-orange-800",
    Closed: "bg-green-100 text-green-800",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Deals</h1>
        <p className="text-muted-foreground">Track your sales pipeline</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {deals?.map((deal) => (
          <Card key={deal.id} className="transition-all hover:shadow-md">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-lg">{deal.title}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {deal.companies?.name || "No company"}
                  </p>
                </div>
                <Badge className={stageColors[deal.stage || "Discovery"]}>
                  {deal.stage}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {deal.amount && (
                <div className="flex items-center gap-2 text-lg font-semibold text-primary">
                  <DollarSign className="h-5 w-5" />
                  ${deal.amount.toLocaleString()}
                </div>
              )}
              {deal.close_date && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  Close: {format(new Date(deal.close_date), "MMM dd, yyyy")}
                </div>
              )}
              <DealActivityIndicator dealId={deal.id} />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
