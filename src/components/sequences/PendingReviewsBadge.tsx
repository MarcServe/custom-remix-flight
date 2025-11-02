import { Badge } from "@/components/ui/badge";
import { Bell } from "lucide-react";
import { usePendingReviewsCount } from "@/hooks/use-pending-reviews";

export function PendingReviewsBadge() {
  const { data: count } = usePendingReviewsCount();

  if (!count || count === 0) return null;

  return (
    <Badge variant="destructive" className="flex items-center gap-1 animate-pulse">
      <Bell className="h-3 w-3" />
      {count} {count === 1 ? 'review' : 'reviews'} pending
    </Badge>
  );
}
