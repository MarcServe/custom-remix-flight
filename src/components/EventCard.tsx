import { Calendar, Phone, Mail, Users, CheckSquare, Bell, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

interface EventCardProps {
  event: {
    id: string;
    type: 'note' | 'call' | 'email' | 'meeting' | 'task' | 'reminder';
    content: {
      title?: string;
      description?: string;
    };
    created_at: string;
    due_at?: string;
    companies?: { name: string };
    deals?: { title: string };
  };
  onDelete?: (id: string) => void;
}

const eventIcons = {
  note: Calendar,
  call: Phone,
  email: Mail,
  meeting: Users,
  task: CheckSquare,
  reminder: Bell,
};

const eventColors = {
  note: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  call: 'bg-green-500/10 text-green-700 dark:text-green-400',
  email: 'bg-purple-500/10 text-purple-700 dark:text-purple-400',
  meeting: 'bg-orange-500/10 text-orange-700 dark:text-orange-400',
  task: 'bg-pink-500/10 text-pink-700 dark:text-pink-400',
  reminder: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
};

export function EventCard({ event, onDelete }: EventCardProps) {
  const Icon = eventIcons[event.type];

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg ${eventColors[event.type]}`}>
            <Icon className="h-4 w-4" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <h4 className="font-medium text-sm">
                  {event.content.title || `${event.type.charAt(0).toUpperCase() + event.type.slice(1)}`}
                </h4>
                {event.content.description && (
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                    {event.content.description}
                  </p>
                )}
              </div>
              
              {onDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => onDelete(event.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <Badge variant="secondary" className="text-xs">
                {format(new Date(event.created_at), 'MMM d, h:mm a')}
              </Badge>
              
              {event.companies && (
                <Badge variant="outline" className="text-xs">
                  {event.companies.name}
                </Badge>
              )}
              
              {event.deals && (
                <Badge variant="outline" className="text-xs">
                  {event.deals.title}
                </Badge>
              )}
              
              {event.due_at && (
                <Badge variant="outline" className="text-xs">
                  Due: {format(new Date(event.due_at), 'MMM d')}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
