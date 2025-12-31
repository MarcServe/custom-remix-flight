import { Button } from "@/components/ui/button";
import { 
  Inbox, 
  Search, 
  CheckCircle2, 
  XCircle, 
  Zap, 
  Sparkles,
  Settings
} from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  type: 'pending' | 'approved' | 'rejected' | 'auto_approved' | 'all';
  onGoToSettings?: () => void;
}

const emptyStateConfig = {
  pending: {
    icon: Inbox,
    title: "No pending leads",
    description: "New leads discovered by AI will appear here for your review.",
    gradient: "from-amber-500/20 to-orange-500/20",
    iconColor: "text-amber-600",
    showSettings: true,
  },
  approved: {
    icon: CheckCircle2,
    title: "No approved leads yet",
    description: "Leads you approve will be added to your CRM and appear here.",
    gradient: "from-green-500/20 to-emerald-500/20",
    iconColor: "text-green-600",
    showSettings: false,
  },
  rejected: {
    icon: XCircle,
    title: "No rejected leads",
    description: "Leads you reject will appear here. You can always reconsider later.",
    gradient: "from-red-500/20 to-rose-500/20",
    iconColor: "text-red-600",
    showSettings: false,
  },
  auto_approved: {
    icon: Zap,
    title: "No auto-approved leads",
    description: "High-quality leads that meet your threshold will be auto-approved.",
    gradient: "from-purple-500/20 to-violet-500/20",
    iconColor: "text-purple-600",
    showSettings: true,
  },
  all: {
    icon: Search,
    title: "No leads discovered yet",
    description: "Enable autonomous discovery to start finding leads automatically.",
    gradient: "from-primary/20 to-primary/5",
    iconColor: "text-primary",
    showSettings: true,
  },
};

export function EmptyState({ type, onGoToSettings }: EmptyStateProps) {
  const config = emptyStateConfig[type];
  const Icon = config.icon;

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      {/* Animated Icon */}
      <div className={cn(
        "relative flex items-center justify-center w-24 h-24 rounded-2xl mb-6",
        "bg-gradient-to-br",
        config.gradient
      )}>
        <Icon className={cn("h-12 w-12", config.iconColor)} />
        <Sparkles className="absolute -top-2 -right-2 h-6 w-6 text-primary animate-pulse" />
      </div>

      {/* Text */}
      <h3 className="text-xl font-semibold mb-2">{config.title}</h3>
      <p className="text-muted-foreground text-center max-w-md mb-6">
        {config.description}
      </p>

      {/* Action Button */}
      {config.showSettings && onGoToSettings && (
        <Button onClick={onGoToSettings} variant="outline" className="gap-2">
          <Settings className="h-4 w-4" />
          Configure Discovery
        </Button>
      )}
    </div>
  );
}
