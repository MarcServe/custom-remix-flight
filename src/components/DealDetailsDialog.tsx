import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  DollarSign, Calendar, Building2, Pencil, 
  Trash2, TrendingUp 
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Deal {
  id: string;
  title: string;
  stage?: string;
  amount?: number;
  close_date?: string;
  company_id?: string;
  created_at?: string;
  companies?: {
    name: string;
  };
}

interface DealDetailsDialogProps {
  deal: Deal;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate?: () => void;
}

const DEAL_STAGES = ["NEW", "QUALIFIED", "CONTACTED", "MEETING", "PROPOSAL", "WON", "LOST"];

export function DealDetailsDialog({
  deal,
  open,
  onOpenChange,
  onUpdate,
}: DealDetailsDialogProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState(deal);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("deals")
        .update({
          title: formData.title,
          stage: formData.stage,
          amount: formData.amount,
          close_date: formData.close_date,
        })
        .eq("id", deal.id);

      if (error) throw error;

      toast.success("Deal updated successfully");
      setIsEditing(false);
      onUpdate?.();
    } catch (error) {
      console.error("Error updating deal:", error);
      toast.error("Failed to update deal");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this deal?")) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("deals")
        .delete()
        .eq("id", deal.id);

      if (error) throw error;

      toast.success("Deal deleted successfully");
      onOpenChange(false);
      onUpdate?.();
    } catch (error) {
      console.error("Error deleting deal:", error);
      toast.error("Failed to delete deal");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-2xl">{deal.title}</DialogTitle>
                {deal.companies?.name && (
                  <DialogDescription className="text-base">
                    {deal.companies.name}
                  </DialogDescription>
                )}
              </div>
            </div>
            {!isEditing && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                >
                  <Pencil className="h-4 w-4 mr-1" />
                  Edit
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDelete}
                  disabled={loading}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </DialogHeader>

        <Tabs defaultValue="details" className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4">
            {isEditing ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Deal Title</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="stage">Stage</Label>
                  <Select
                    value={formData.stage || "NEW"}
                    onValueChange={(value) =>
                      setFormData({ ...formData, stage: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DEAL_STAGES.map((stage) => (
                        <SelectItem key={stage} value={stage}>
                          {stage}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="amount">Amount ($)</Label>
                  <Input
                    id="amount"
                    type="number"
                    value={formData.amount || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, amount: parseFloat(e.target.value) })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="close_date">Expected Close Date</Label>
                  <Input
                    id="close_date"
                    type="date"
                    value={formData.close_date?.split("T")[0] || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, close_date: e.target.value })
                    }
                  />
                </div>

                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsEditing(false);
                      setFormData(deal);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={loading}>
                    {loading ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm text-muted-foreground">Stage</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Badge>{deal.stage}</Badge>
                    </CardContent>
                  </Card>

                  {deal.amount && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm text-muted-foreground">Value</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-2 text-2xl font-bold text-primary">
                          <DollarSign className="h-5 w-5" />
                          {deal.amount.toLocaleString()}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {deal.companies?.name && (
                  <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{deal.companies.name}</p>
                      <p className="text-xs text-muted-foreground">Company</p>
                    </div>
                  </div>
                )}

                {deal.close_date && (
                  <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">
                        {format(new Date(deal.close_date), "MMMM dd, yyyy")}
                      </p>
                      <p className="text-xs text-muted-foreground">Expected Close Date</p>
                    </div>
                  </div>
                )}

                {deal.created_at && (
                  <div className="pt-4 border-t text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-3 w-3" />
                      Created {format(new Date(deal.created_at), "MMM dd, yyyy")}
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="activity">
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground text-center">
                  Activity history and notes coming soon
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
