import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, Send, Loader2, TrendingUp, DollarSign, Clock, Mail, ChevronRight } from "lucide-react";
import { useFindDealOpportunities, useSendOpportunityEmail, useCreateDealFromOpportunity } from "@/hooks/use-deal-opportunities";
import { toast } from "sonner";

interface AIWorkerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AIWorkerDialog({ open, onOpenChange }: AIWorkerDialogProps) {
  const [selectedOpportunities, setSelectedOpportunities] = useState<Set<string>>(new Set());
  const findOpportunities = useFindDealOpportunities();
  const sendEmail = useSendOpportunityEmail();
  const createDeal = useCreateDealFromOpportunity();

  const handleFindOpportunities = () => {
    findOpportunities.mutate({ maxOpportunities: 10 });
  };

  const toggleOpportunity = (companyId: string) => {
    const newSelected = new Set(selectedOpportunities);
    if (newSelected.has(companyId)) {
      newSelected.delete(companyId);
    } else {
      newSelected.add(companyId);
    }
    setSelectedOpportunities(newSelected);
  };

  const handleSendEmail = async (opportunity: any, sendImmediately: boolean) => {
    try {
      await sendEmail.mutateAsync({
        opportunity,
        sendImmediately,
      });

      // Create deal automatically
      await createDeal.mutateAsync(opportunity);

      toast.success(sendImmediately ? "Email sent and deal created!" : "Deal created! Review the email in your drafts.");
    } catch (error) {
      // Error handling is done in the mutation
    }
  };

  const handleBulkSend = async (sendImmediately: boolean) => {
    const opportunities = findOpportunities.data?.opportunities.filter((opp: any) =>
      selectedOpportunities.has(opp.companyId)
    ) || [];

    if (opportunities.length === 0) {
      toast.error("Please select at least one opportunity");
      return;
    }

    let successCount = 0;
    for (const opp of opportunities) {
      try {
        await handleSendEmail(opp, sendImmediately);
        successCount++;
      } catch (error) {
        console.error("Failed to process opportunity:", error);
      }
    }

    toast.success(`Processed ${successCount} of ${opportunities.length} opportunities`);
    setSelectedOpportunities(new Set());
  };

  const getValueColor = (value: string) => {
    switch (value) {
      case "high": return "bg-green-100 text-green-800";
      case "medium": return "bg-yellow-100 text-yellow-800";
      case "low": return "bg-blue-100 text-blue-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case "high": return "bg-red-100 text-red-800";
      case "medium": return "bg-orange-100 text-orange-800";
      case "low": return "bg-blue-100 text-blue-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Deal Opportunities
          </DialogTitle>
          <DialogDescription>
            AI analyzes your companies and identifies potential sales opportunities based on your business profile
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!findOpportunities.data && !findOpportunities.isPending && (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Find Sales Opportunities</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Let AI analyze your companies and identify the best opportunities to pursue
              </p>
              <Button onClick={handleFindOpportunities} disabled={findOpportunities.isPending}>
                {findOpportunities.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Find Opportunities
                  </>
                )}
              </Button>
            </div>
          )}

          {findOpportunities.isPending && (
            <div className="text-center py-12">
              <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary mb-4" />
              <p className="text-sm text-muted-foreground">
                AI is analyzing your companies and business profile...
              </p>
            </div>
          )}

          {findOpportunities.data && (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Found {findOpportunities.data.opportunities.length} opportunities from {findOpportunities.data.analyzedCompanies} companies
                  </p>
                </div>
                <div className="flex gap-2">
                  {selectedOpportunities.size > 0 && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleBulkSend(false)}
                        disabled={sendEmail.isPending || createDeal.isPending}
                      >
                        <Mail className="h-4 w-4 mr-2" />
                        Save {selectedOpportunities.size} as Drafts
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleBulkSend(true)}
                        disabled={sendEmail.isPending || createDeal.isPending}
                      >
                        <Send className="h-4 w-4 mr-2" />
                        Send {selectedOpportunities.size} Now
                      </Button>
                    </>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleFindOpportunities}
                    disabled={findOpportunities.isPending}
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              </div>

              <ScrollArea className="h-[500px]">
                <div className="space-y-3 pr-4">
                  {findOpportunities.data.opportunities.map((opportunity: any, index: number) => (
                    <Card
                      key={index}
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        selectedOpportunities.has(opportunity.companyId) ? 'ring-2 ring-primary' : ''
                      }`}
                      onClick={() => toggleOpportunity(opportunity.companyId)}
                    >
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="space-y-1 flex-1">
                            <CardTitle className="text-lg">{opportunity.title}</CardTitle>
                            <CardDescription>{opportunity.companyName}</CardDescription>
                          </div>
                          <div className="flex gap-2">
                            <Badge className={getValueColor(opportunity.estimatedValue)}>
                              <DollarSign className="h-3 w-3 mr-1" />
                              {opportunity.estimatedValue}
                            </Badge>
                            <Badge className={getUrgencyColor(opportunity.urgency)}>
                              <Clock className="h-3 w-3 mr-1" />
                              {opportunity.urgency}
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <p className="text-sm text-muted-foreground">{opportunity.description}</p>

                        <div>
                          <p className="text-sm font-medium mb-2">Key Talking Points:</p>
                          <ul className="space-y-1">
                            {opportunity.talkingPoints?.map((point: string, i: number) => (
                              <li key={i} className="text-sm flex items-start gap-2">
                                <ChevronRight className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                                <span>{point}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="border-t pt-4 space-y-2">
                          <p className="text-sm font-medium">Suggested Email:</p>
                          <div className="bg-muted/50 p-3 rounded-lg space-y-2">
                            <p className="text-sm font-medium">Subject: {opportunity.emailSubject}</p>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{opportunity.emailBody}</p>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSendEmail(opportunity, false);
                            }}
                            disabled={sendEmail.isPending || createDeal.isPending}
                          >
                            <Mail className="h-4 w-4 mr-2" />
                            Save as Draft
                          </Button>
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSendEmail(opportunity, true);
                            }}
                            disabled={sendEmail.isPending || createDeal.isPending}
                          >
                            <Send className="h-4 w-4 mr-2" />
                            Send Now
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}