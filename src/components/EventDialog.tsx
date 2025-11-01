import { useState, useEffect } from 'react';
import { Calendar, Phone, Mail, Users, CheckSquare, Bell } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreateEvent, useUpdateEvent } from '@/hooks/use-events';

interface EventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCompanyId?: string;
  defaultDealId?: string;
  eventId?: string;
  event?: {
    type: 'note' | 'call' | 'email' | 'meeting' | 'task' | 'reminder';
    content: { title?: string; description?: string };
    due_at?: string;
    company_id?: string;
    deal_id?: string;
  };
}

const eventTypes = [
  { value: 'note', label: 'Note', icon: Calendar },
  { value: 'call', label: 'Call', icon: Phone },
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'meeting', label: 'Meeting', icon: Users },
  { value: 'task', label: 'Task', icon: CheckSquare },
  { value: 'reminder', label: 'Reminder', icon: Bell },
] as const;

export function EventDialog({ open, onOpenChange, defaultCompanyId, defaultDealId, eventId, event }: EventDialogProps) {
  const isEditMode = !!eventId && !!event;
  
  const [type, setType] = useState<'note' | 'call' | 'email' | 'meeting' | 'task' | 'reminder'>('note');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [companyId, setCompanyId] = useState<string>('');
  const [dealId, setDealId] = useState<string>('');
  
  const createMutation = useCreateEvent();
  const updateMutation = useUpdateEvent();

  // Fetch companies for dropdown
  const { data: companies, isLoading: companiesLoading, error: companiesError } = useQuery({
    queryKey: ['companies-for-events'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('companies')
          .select('id, name')
          .order('name');
        
        if (error) {
          console.error('Error fetching companies:', error);
          throw error;
        }
        
        return data || [];
      } catch (error) {
        console.error('Failed to fetch companies:', error);
        return [];
      }
    },
  });

  // Fetch deals for dropdown
  const { data: deals, isLoading: dealsLoading, error: dealsError } = useQuery({
    queryKey: ['deals-for-events'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('deals')
          .select('id, title, companies(name)')
          .order('title');
        
        if (error) {
          console.error('Error fetching deals:', error);
          throw error;
        }
        
        return data || [];
      } catch (error) {
        console.error('Failed to fetch deals:', error);
        return [];
      }
    },
  });

  // Set defaults or edit data when dialog opens
  useEffect(() => {
    if (open) {
      if (isEditMode && event) {
        // Populate with existing event data
        setType(event.type);
        setTitle(event.content.title || '');
        setDescription(event.content.description || '');
        setDueDate(event.due_at ? new Date(event.due_at).toISOString().slice(0, 16) : '');
        setCompanyId(event.company_id || '');
        setDealId(event.deal_id || '');
      } else {
        // Reset form for new event
        setType('note');
        setTitle('');
        setDescription('');
        setDueDate('');
        setCompanyId(defaultCompanyId || '');
        setDealId(defaultDealId || '');
      }
    }
  }, [open, isEditMode, event, defaultCompanyId, defaultDealId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      console.warn('Event title is required');
      return;
    }

    try {
      if (isEditMode && eventId) {
        console.log('Updating event:', eventId);
        await updateMutation.mutateAsync({
          id: eventId,
          updates: {
            type,
            content: {
              title,
              description,
            },
            due_at: dueDate || undefined,
            company_id: companyId || undefined,
            deal_id: dealId || undefined,
          }
        });
      } else {
        console.log('Creating event:', { type, title, description, dueDate, companyId, dealId });
        await createMutation.mutateAsync({
          type,
          content: {
            title,
            description,
          },
          due_at: dueDate || undefined,
          company_id: companyId || undefined,
          deal_id: dealId || undefined,
        });
      }

      console.log(isEditMode ? 'Event updated successfully' : 'Event created successfully');
      onOpenChange(false);
    } catch (error) {
      console.error(`Failed to ${isEditMode ? 'update' : 'create'} event:`, error);
      // Keep dialog open so user can retry
    }
  };

  const isLoading = companiesLoading || dealsLoading;
  const hasErrors = companiesError || dealsError;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit Event' : 'Create New Event'}</DialogTitle>
          <DialogDescription>
            {isEditMode ? 'Update the event details' : 'Add a new activity to track your interactions'}
          </DialogDescription>
        </DialogHeader>

        {hasErrors && (
          <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
            Error loading data. You can still create an event without linking to companies or deals.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="event-type">Event Type</Label>
            <Select value={type} onValueChange={(value: any) => setType(value)}>
              <SelectTrigger id="event-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {eventTypes.map((eventType) => {
                  const Icon = eventType.icon;
                  return (
                    <SelectItem key={eventType.value} value={eventType.value}>
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        {eventType.label}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="event-title">Title</Label>
            <Input
              id="event-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Follow-up call with CEO"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="event-description">Description</Label>
            <Textarea
              id="event-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add details about this activity..."
              className="min-h-[100px]"
            />
          </div>

          {(type === 'task' || type === 'reminder' || type === 'meeting') && (
            <div className="space-y-2">
              <Label htmlFor="event-due">Due Date & Time</Label>
              <Input
                id="event-due"
                type="datetime-local"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="event-company">Link to Company (Optional)</Label>
              <Select value={companyId || undefined} onValueChange={setCompanyId} disabled={companiesLoading}>
                <SelectTrigger id="event-company">
                  <SelectValue placeholder={companiesLoading ? "Loading..." : "Select company"} />
                </SelectTrigger>
                <SelectContent>
                  {companies?.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="event-deal">Link to Deal (Optional)</Label>
              <Select value={dealId || undefined} onValueChange={setDealId} disabled={dealsLoading}>
                <SelectTrigger id="event-deal">
                  <SelectValue placeholder={dealsLoading ? "Loading..." : "Select deal"} />
                </SelectTrigger>
                <SelectContent>
                  {deals?.map((deal) => (
                    <SelectItem key={deal.id} value={deal.id}>
                      {deal.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={createMutation.isPending || updateMutation.isPending || isLoading || !title.trim()}
            >
              {isEditMode 
                ? (updateMutation.isPending ? 'Updating...' : 'Update Event')
                : (createMutation.isPending ? 'Creating...' : 'Create Event')
              }
            </Button>
          </div>

          {(createMutation.isError || updateMutation.isError) && (
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
              Failed to {isEditMode ? 'update' : 'create'} event. Please try again.
            </div>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
