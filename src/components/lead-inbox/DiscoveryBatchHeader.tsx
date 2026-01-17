import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, Package, Clock } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface DiscoveryBatchHeaderProps {
  batchDate: string;
  leadCount: number;
  avgQualityScore: number;
  sourceBreakdown: Record<string, number>;
  statusBreakdown: Record<string, number>;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
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

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <div className="mb-3">
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className={cn(
              "w-full justify-start gap-3 h-auto py-3 px-4 rounded-lg transition-all",
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
                {statusBreakdown.pending > 0 && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-amber-500/10 text-amber-600 border-amber-200">
                    {statusBreakdown.pending} pending
                  </Badge>
                )}
                {(statusBreakdown.approved || 0) + (statusBreakdown.auto_approved || 0) > 0 && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-green-500/10 text-green-600 border-green-200">
                    {(statusBreakdown.approved || 0) + (statusBreakdown.auto_approved || 0)} approved
                  </Badge>
                )}
              </div>

              {/* Source breakdown (hidden on small screens) */}
              <span className="hidden lg:block text-xs text-muted-foreground max-w-[200px] truncate">
                {sourceDisplay}
              </span>
            </div>
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="pl-4 pt-2 space-y-2">
            {children}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
