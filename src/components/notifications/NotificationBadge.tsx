import { Badge } from '@/components/ui/badge';

interface NotificationBadgeProps {
  count: number;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary';
  pulse?: boolean;
}

export function NotificationBadge({ 
  count, 
  variant = 'destructive',
  pulse = true 
}: NotificationBadgeProps) {
  if (count === 0) return null;

  return (
    <Badge 
      variant={variant}
      className={`min-w-[20px] h-5 flex items-center justify-center px-1.5 ${
        pulse ? 'animate-pulse' : ''
      }`}
    >
      {count > 99 ? '99+' : count}
    </Badge>
  );
}
