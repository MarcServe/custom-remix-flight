import { useState, useEffect } from 'react';
import { Plus, Calendar, Filter } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import { useMarkMultipleEventsAsViewed } from '@/hooks/use-event-views';
import { format, isToday, isYesterday, startOfDay } from 'date-fns';

export default function Events() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<{
    id: string;
    type: 'note' | 'call' | 'email' | 'meeting' | 'task' | 'reminder';
    content: { title?: string; description?: string };
    due_at?: string;
    company_id?: string;
    deal_id?: string;
  } | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [companyFilter, setCompanyFilter] = useState<string>('all');
  const [dealFilter, setDealFilter] = useState<string>('all');
  
  // Build filters object
  const filters = {
    ...(typeFilter !== 'all' && { type: typeFilter }),
    ...(companyFilter !== 'all' && { company_id: companyFilter }),
    ...(dealFilter !== 'all' && { deal_id: dealFilter }),
  };
  
  const { data: eventsData, isLoading } = useEvents(
    Object.keys(filters).length > 0 ? filters : undefined
  );
  const deleteMutation = useDeleteEvent();
  const markMultipleAsViewedMutation = useMarkMultipleEventsAsViewed();

  // Mark all visible events as viewed when they load
  useEffect(() => {
    if (eventsData?.data && eventsData.data.length > 0) {
      const eventIds = eventsData.data.map((e: any) => e.id);
      markMultipleAsViewedMutation.mutate(eventIds);
    }
  }, [eventsData?.data]);

  // Fetch companies for filter
  const { data: companies } = useQuery({
    queryKey: ['companies-filter'],
    queryFn: async () => {
      const { data } = await supabase
        .from('companies')
        .select('id, name')
        .order('name');
      return data || [];
    },
  });

  // Fetch deals for filter
  const { data: deals } = useQuery({
    queryKey: ['deals-filter'],
    queryFn: async () => {
      const { data } = await supabase
        .from('deals')
        .select('id, title')
        .order('title');
      return data || [];
    },
  });

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
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Filters</span>
              </div>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                New Event
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Types" />
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

              <Select value={companyFilter} onValueChange={setCompanyFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Companies" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Companies</SelectItem>
                  {companies?.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={dealFilter} onValueChange={setDealFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Deals" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Deals</SelectItem>
                  {deals?.map((deal) => (
                    <SelectItem key={deal.id} value={deal.id}>
                      {deal.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
                    onClick={() => {
                      setSelectedEvent({
                        id: event.id,
                        type: event.type,
                        content: event.content,
                        due_at: event.due_at,
                        company_id: event.companies ? undefined : undefined,
                        deal_id: event.deals ? undefined : undefined,
                      });
                      setDialogOpen(true);
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Event Dialog with error boundary */}
      {dialogOpen && (
        <EventDialog 
          open={dialogOpen} 
          onOpenChange={(open) => {
            console.log('Event dialog state change:', open);
            setDialogOpen(open);
            if (!open) {
              setSelectedEvent(null);
            }
          }}
          eventId={selectedEvent?.id}
          event={selectedEvent || undefined}
        />
      )}
    </div>
  );
}
