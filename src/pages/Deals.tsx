import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DollarSign, Calendar, LayoutGrid, Kanban } from "lucide-react";
import { DealActivityIndicator } from "@/components/DealActivityIndicator";
import { DealDetailsDialog } from "@/components/DealDetailsDialog";
import { format } from "date-fns";
import { useDeals, useUpdateDealStage } from "@/hooks/use-deals";
import { KanbanBoard, KanbanItem } from "@/components/kanban/KanbanBoard";
import { toast } from "sonner";

export default function Deals() {
  const [view, setView] = useState<"grid" | "kanban">("grid");
  const [selectedDeal, setSelectedDeal] = useState<any>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const { data: deals, isLoading, refetch } = useDeals();
  const updateDealStage = useUpdateDealStage();

  if (isLoading) {
    return <div className="flex items-center justify-center h-96">Loading...</div>;
  }

  const stageColors: Record<string, string> = {
    NEW: "bg-blue-100 text-blue-800",
    QUALIFIED: "bg-yellow-100 text-yellow-800",
    CONTACTED: "bg-purple-100 text-purple-800",
    MEETING: "bg-orange-100 text-orange-800",
    PROPOSAL: "bg-indigo-100 text-indigo-800",
    WON: "bg-green-100 text-green-800",
    LOST: "bg-red-100 text-red-800",
  };

  const kanbanColumns = [
    { id: "NEW", title: "New" },
    { id: "QUALIFIED", title: "Qualified" },
    { id: "CONTACTED", title: "Contacted" },
    { id: "MEETING", title: "Meeting" },
    { id: "PROPOSAL", title: "Proposal" },
    { id: "WON", title: "Won" },
    { id: "LOST", title: "Lost" },
  ];

  const kanbanItems: KanbanItem[] = (deals || []).map((deal) => ({
    id: deal.id,
    title: deal.title,
    status: deal.stage || "NEW",
    company: deal.companies?.name,
    amount: deal.amount || undefined,
    closeDate: deal.close_date || undefined,
  }));

  const handleStatusChange = (itemId: string, newStatus: string) => {
    updateDealStage.mutate({ id: itemId, stage: newStatus });
  };

  const handleDealClick = (deal: any) => {
    setSelectedDeal(deal);
    setDetailsDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Deals</h1>
          <p className="text-muted-foreground">Track your sales pipeline</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={view === "grid" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("grid")}
          >
            <LayoutGrid className="h-4 w-4 mr-2" />
            Grid
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

      {view === "kanban" ? (
        <KanbanBoard
          items={kanbanItems}
          columns={kanbanColumns}
          onStatusChange={handleStatusChange}
          onItemClick={(item) => {
            const deal = deals?.find((d) => d.id === item.id);
            if (deal) handleDealClick(deal);
          }}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {deals?.map((deal) => (
            <Card 
              key={deal.id} 
              className="transition-all hover:shadow-md cursor-pointer"
              onClick={() => handleDealClick(deal)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{deal.title}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {deal.companies?.name || "No company"}
                    </p>
                  </div>
                  <Badge className={stageColors[deal.stage || "NEW"]}>
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
      )}

      {selectedDeal && (
        <DealDetailsDialog
          deal={selectedDeal}
          open={detailsDialogOpen}
          onOpenChange={setDetailsDialogOpen}
          onUpdate={refetch}
        />
      )}
    </div>
  );
}
