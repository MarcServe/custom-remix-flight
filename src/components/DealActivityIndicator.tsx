import { Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useDealEvents } from '@/hooks/use-events';
import { format } from 'date-fns';

interface DealActivityIndicatorProps {
  dealId: string;
}

export function DealActivityIndicator({ dealId }: DealActivityIndicatorProps) {
  const { data: eventsData } = useDealEvents(dealId);
  const events = eventsData?.data || [];
  const latestEvent = events[0];

  if (!latestEvent) return null;

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <Clock className="h-3 w-3" />
      <span>Last activity: {format(new Date(latestEvent.created_at), 'MMM d')}</span>
      <Badge variant="outline" className="text-xs">
        {latestEvent.type}
      </Badge>
    </div>
  );
}
