import { useState } from 'react';
import { Plus, Calendar, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EventCard } from '@/components/EventCard';
import { EventDialog } from '@/components/EventDialog';
import { useEvents, useDeleteEvent } from '@/hooks/use-events';
import { format, isToday, isYesterday, startOfDay } from 'date-fns';

export default function Events() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  
  const { data: eventsData, isLoading } = useEvents(
    typeFilter !== 'all' ? { type: typeFilter } : undefined
  );
  const deleteMutation = useDeleteEvent();

  const events = (eventsData?.data || []) as Array<{
    id: string;
    type: 'note' | 'call' | 'email' | 'meeting' | 'task' | 'reminder';
    content: { title?: string; description?: string };
    created_at: string;
    due_at?: string;
    companies?: { name: string };
    deals?: { title: string };
  }>;

  // Group events by date
  const groupedEvents = events.reduce((acc, event) => {
    const date = startOfDay(new Date(event.created_at)).toISOString();
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(event);
    return acc;
  }, {} as Record<string, typeof events>);

  const getDateLabel = (dateString: string) => {
    const date = new Date(dateString);
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'MMMM d, yyyy');
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this event?')) {
      await deleteMutation.mutateAsync(id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-8 border">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Calendar className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-3xl font-bold">Events & Activities</h1>
          </div>
          <p className="text-muted-foreground">
            Track all your interactions, tasks, and activities in one place
          </p>
        </div>
      </div>

      {/* Filters and Actions */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="note">📝 Notes</SelectItem>
                  <SelectItem value="call">📞 Calls</SelectItem>
                  <SelectItem value="email">📧 Emails</SelectItem>
                  <SelectItem value="meeting">👥 Meetings</SelectItem>
                  <SelectItem value="task">✅ Tasks</SelectItem>
                  <SelectItem value="reminder">📅 Reminders</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Event
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Timeline */}
      {isLoading ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Loading events...
          </CardContent>
        </Card>
      ) : events.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No events yet</h3>
            <p className="text-muted-foreground mb-4">
              Start tracking your activities by creating your first event
            </p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Event
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedEvents).map(([date, dateEvents]) => (
            <div key={date}>
              <div className="flex items-center gap-3 mb-4">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                </div>
                <h2 className="text-lg font-semibold">{getDateLabel(date)}</h2>
              </div>
              
              <div className="space-y-3 pl-11">
                {dateEvents.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <EventDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
