import { Card } from "@/components/ui/card";
import { 
  Inbox, 
  CheckCircle2, 
  XCircle, 
  Zap,
  TrendingUp
} from "lucide-react";
import { cn } from "@/lib/utils";

interface StatsHeaderProps {
  counts: {
    pending: number;
    approved: number;
    rejected: number;
    auto_approved: number;
    all: number;
  };
}

export function StatsHeader({ counts }: StatsHeaderProps) {
  const stats = [
    {
      label: "Pending Review",
      value: counts.pending,
      icon: Inbox,
      color: "text-amber-600",
      bgColor: "bg-amber-500/10",
    },
    {
      label: "Approved",
      value: counts.approved,
      icon: CheckCircle2,
      color: "text-green-600",
      bgColor: "bg-green-500/10",
    },
    {
      label: "Auto-Approved",
      value: counts.auto_approved,
      icon: Zap,
      color: "text-purple-600",
      bgColor: "bg-purple-500/10",
    },
    {
      label: "Rejected",
      value: counts.rejected,
      icon: XCircle,
      color: "text-red-600",
      bgColor: "bg-red-500/10",
    },
  ];

  const approvalRate = counts.all > 0 
    ? Math.round(((counts.approved + counts.auto_approved) / counts.all) * 100) 
    : 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {stats.map((stat) => (
        <Card key={stat.label} className="p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-lg", stat.bgColor)}>
              <stat.icon className={cn("h-5 w-5", stat.color)} />
            </div>
            <div>
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          </div>
        </Card>
      ))}
      
      {/* Approval Rate Card */}
      <Card className="p-4 hover:shadow-md transition-shadow bg-gradient-to-br from-primary/5 to-primary/10">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/20">
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold">{approvalRate}%</p>
            <p className="text-xs text-muted-foreground">Approval Rate</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
