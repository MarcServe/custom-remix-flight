import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, Package, Clock, Users } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { BatchActionsDropdown } from "./BatchActionsDropdown";

interface DiscoveryBatchHeaderProps {
  batchDate: string;
  leadCount: number;
  avgQualityScore: number;
  sourceBreakdown: Record<string, number>;
  statusBreakdown: Record<string, number>;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  // New props for batch actions
  batchLeadIds?: string[];
  approvedLeadIds?: string[];
  pendingLeadIds?: string[];
  sequences?: Array<{ id: string; name: string }>;
  onApproveAll?: (leadIds: string[]) => void;
  onRejectAll?: (leadIds: string[]) => void;
  onDeleteAll?: (leadIds: string[]) => void;
  onEnrollInSequence?: (leadIds: string[], sequenceId: string) => void;
  onCreateCampaign?: (leadIds: string[]) => void;
  isActionsLoading?: boolean;
  // Persona display
  personaName?: string;
  personaId?: string;
}

export function DiscoveryBatchHeader({
  batchDate,
  leadCount,
  avgQualityScore,
  sourceBreakdown,
  statusBreakdown,
  isExpanded,
  onToggle,
  children,
  batchLeadIds = [],
  approvedLeadIds = [],
  pendingLeadIds = [],
  sequences = [],
  onApproveAll,
  onRejectAll,
  onDeleteAll,
  onEnrollInSequence,
  onCreateCampaign,
  isActionsLoading,
  personaName,
}: DiscoveryBatchHeaderProps) {
  const batchDateTime = new Date(batchDate);
  const isToday = new Date().toDateString() === batchDateTime.toDateString();
  const formattedDate = format(batchDateTime, "MMM d, yyyy, h:mm a");
  const relativeTime = formatDistanceToNow(batchDateTime, { addSuffix: true });

  // Get source display
  const sourceEntries = Object.entries(sourceBreakdown).filter(([_, count]) => count > 0);
  const sourceDisplay = sourceEntries
    .map(([source, count]) => {
      const icon = source === 'apify' ? '📍' : source === 'serpapi' ? '🔍' : source === 'exa' ? '🌐' : '✨';
      return `${icon} ${source}: ${count}`;
    })
    .join(', ') || 'Various sources';

  const hasActions = onApproveAll && onRejectAll && onDeleteAll;
  const pendingCount = statusBreakdown.pending || 0;
  const approvedCount = (statusBreakdown.approved || 0) + (statusBreakdown.auto_approved || 0);

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <div className="mb-3">
        <div className="flex items-center gap-2">
          <CollapsibleTrigger asChild>
            <div
              className={cn(
                "flex-1 flex items-center gap-3 h-auto py-3 px-4 rounded-lg transition-all cursor-pointer",
                "hover:bg-accent/50 border border-transparent",
                isExpanded && "bg-accent/30 border-border/50"
              )}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
              
              <div className="flex items-center gap-2 shrink-0">
                <div className="p-1.5 rounded-md bg-primary/10">
                  <Package className="h-4 w-4 text-primary" />
                </div>
              </div>

              <div className="flex flex-col items-start gap-0.5 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">
                    {isToday ? 'Today' : format(batchDateTime, "EEEE, MMM d")}
                  </span>
                  {isToday && (
                    <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-200 text-[10px] px-1.5 py-0 h-4">
                      NEW
                    </Badge>
                  )}
                  {personaName && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-purple-500/10 text-purple-600 border-purple-200">
                      <Users className="h-2.5 w-2.5 mr-0.5" />
                      {personaName}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>{formattedDate}</span>
                  <span className="text-muted-foreground/60">·</span>
                  <span>{relativeTime}</span>
                </div>
              </div>

              <div className="flex items-center gap-3 ml-auto shrink-0">
                {/* Lead count */}
                <Badge variant="secondary" className="text-xs">
                  {leadCount} lead{leadCount !== 1 ? 's' : ''}
                </Badge>

                {/* Average quality score */}
                <Badge 
                  variant="outline" 
                  className={cn(
                    "text-xs",
                    avgQualityScore >= 70 ? "bg-green-500/10 text-green-600 border-green-200" :
                    avgQualityScore >= 50 ? "bg-amber-500/10 text-amber-600 border-amber-200" :
                    "bg-red-500/10 text-red-600 border-red-200"
                  )}
                >
                  Avg: {avgQualityScore}
                </Badge>

                {/* Status breakdown */}
                <div className="hidden md:flex items-center gap-1">
                  {pendingCount > 0 && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-amber-500/10 text-amber-600 border-amber-200">
                      {pendingCount} pending
                    </Badge>
                  )}
                  {approvedCount > 0 && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-green-500/10 text-green-600 border-green-200">
                      {approvedCount} approved
                    </Badge>
                  )}
                </div>

                {/* Source breakdown (hidden on small screens) */}
                <span className="hidden lg:block text-xs text-muted-foreground max-w-[200px] truncate">
                  {sourceDisplay}
                </span>
              </div>
            </div>
          </CollapsibleTrigger>

          {/* Batch Actions Dropdown */}
          {hasActions && (
            <BatchActionsDropdown
              pendingCount={pendingCount}
              approvedCount={approvedCount}
              totalCount={leadCount}
              batchLeadIds={batchLeadIds}
              approvedLeadIds={approvedLeadIds}
              pendingLeadIds={pendingLeadIds}
              sequences={sequences}
              onApproveAll={onApproveAll}
              onRejectAll={onRejectAll}
              onDeleteAll={onDeleteAll}
              onEnrollInSequence={onEnrollInSequence || (() => {})}
              onCreateCampaign={onCreateCampaign || (() => {})}
              isLoading={isActionsLoading}
            />
          )}
        </div>

        <CollapsibleContent>
          <div className="pl-4 pt-2 space-y-2">
            {children}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
