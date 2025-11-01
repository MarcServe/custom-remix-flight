import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface DataCompletenessBarProps {
  percentage: number;
  className?: string;
}

export function DataCompletenessBar({ percentage, className }: DataCompletenessBarProps) {
  const getColor = (pct: number): string => {
    if (pct >= 80) return "bg-emerald-500";
    if (pct >= 60) return "bg-yellow-500";
    if (pct >= 40) return "bg-orange-500";
    return "bg-red-500";
  };

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Data Completeness</span>
        <span className="text-xs font-mono font-semibold text-foreground">{Math.round(percentage)}%</span>
      </div>
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className={cn("h-full transition-all duration-300", getColor(percentage))}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
