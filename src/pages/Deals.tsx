import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DollarSign, Calendar, LayoutGrid, Kanban, Plus, Tag as TagIcon } from "lucide-react";
import { DealActivityIndicator } from "@/components/DealActivityIndicator";
import { DealDetailsDialog } from "@/components/DealDetailsDialog";
import { CreateDealDialog } from "@/components/CreateDealDialog";
import { format } from "date-fns";
import { useDeals, useUpdateDealStage } from "@/hooks/use-deals";
import { KanbanBoard, KanbanItem } from "@/components/kanban/KanbanBoard";
import { toast } from "sonner";
import { useMarkMultipleDealsAsViewed, useMarkDealAsViewed } from "@/hooks/use-deal-views";

export default function Deals() {
  const [view, setView] = useState<"grid" | "kanban">("grid");
  const [selectedDeal, setSelectedDeal] = useState<any>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const { data: deals, isLoading, refetch } = useDeals();
  const updateDealStage = useUpdateDealStage();
  const markMultipleDealsAsViewed = useMarkMultipleDealsAsViewed();
  const markDealAsViewed = useMarkDealAsViewed();

  // Mark all visible active deals as viewed when page loads
  useEffect(() => {
    if (deals && deals.length > 0) {
      const activeDealIds = deals
        .filter((d: any) => ['QUALIFIED', 'CONTACTED', 'MEETING', 'PROPOSAL'].includes(d.stage))
        .map((d: any) => d.id);
      
      if (activeDealIds.length > 0) {
        markMultipleDealsAsViewed.mutate(activeDealIds);
      }
    }
  }, [deals]);

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

  const kanbanItems: KanbanItem[] = (deals || []).map((deal: any) => ({
    id: deal.id,
    title: deal.title,
    status: deal.stage || "NEW",
    company: deal.companies?.name,
    amount: deal.amount || undefined,
    closeDate: deal.close_date || undefined,
    tags: deal.tags || [],
    priority: deal.priority || 'medium',
  }));

  const handleStatusChange = (itemId: string, newStatus: string) => {
    updateDealStage.mutate({ id: itemId, stage: newStatus });
  };

  const handleDealClick = (deal: any) => {
    markDealAsViewed.mutate(deal.id);
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
            onClick={() => setCreateDialogOpen(true)}
            size="sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Deal
          </Button>
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
          {deals && deals.length > 0 ? (
            deals.map((deal: any) => (
              <Card
                key={deal.id} 
                className="transition-all hover:shadow-md cursor-pointer"
                onClick={() => handleDealClick(deal)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1 flex-1">
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
                  {deal.tags && deal.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {deal.tags.slice(0, 3).map((tag: string, idx: number) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          <TagIcon className="h-3 w-3 mr-1" />
                          {tag}
                        </Badge>
                      ))}
                      {deal.tags.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{deal.tags.length - 3}
                        </Badge>
                      )}
                    </div>
                  )}
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
            ))
          ) : (
            <Card className="col-span-full border-2 border-dashed">
              <CardContent className="py-12 text-center">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                  <DollarSign className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No deals yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Create your first deal to start tracking your sales pipeline
                </p>
                <Button onClick={() => setCreateDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Deal
                </Button>
              </CardContent>
            </Card>
          )}
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

      <CreateDealDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </div>
  );
}
