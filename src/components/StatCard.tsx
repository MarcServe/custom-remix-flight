import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: string;
    isPositive: boolean;
  };
}

export const StatCard = ({ title, value, icon: Icon, trend }: StatCardProps) => {
  return (
    <Card className="transition-all hover:shadow-lg border-0 bg-gradient-to-br from-card to-card/50">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground mb-2">{title}</p>
            <h3 className="text-3xl font-bold tracking-tight">{value}</h3>
            {trend && (
              <div className="flex items-center gap-1 mt-3">
                <span
                  className={cn(
                    "text-xs font-semibold px-2 py-1 rounded-full",
                    trend.isPositive 
                      ? "text-green-700 bg-green-50 dark:text-green-400 dark:bg-green-950/30" 
                      : "text-red-700 bg-red-50 dark:text-red-400 dark:bg-red-950/30"
                  )}
                >
                  {trend.isPositive ? "↑" : "↓"} {trend.value}
                </span>
              </div>
            )}
          </div>
          <div className="rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 p-4 shadow-sm">
            <Icon className="h-7 w-7 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
