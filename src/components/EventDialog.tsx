import { useState } from 'react';
import { Calendar, Phone, Mail, Users, CheckSquare, Bell } from 'lucide-react';
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
import { useCreateEvent } from '@/hooks/use-events';

interface EventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const eventTypes = [
  { value: 'note', label: 'Note', icon: Calendar },
  { value: 'call', label: 'Call', icon: Phone },
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'meeting', label: 'Meeting', icon: Users },
  { value: 'task', label: 'Task', icon: CheckSquare },
  { value: 'reminder', label: 'Reminder', icon: Bell },
] as const;

export function EventDialog({ open, onOpenChange }: EventDialogProps) {
  const [type, setType] = useState<'note' | 'call' | 'email' | 'meeting' | 'task' | 'reminder'>('note');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  
  const createMutation = useCreateEvent();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    await createMutation.mutateAsync({
      type,
      content: {
        title,
        description,
      },
      due_at: dueDate || undefined,
    });

    // Reset form
    setType('note');
    setTitle('');
    setDescription('');
    setDueDate('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Event</DialogTitle>
          <DialogDescription>
            Add a new activity to track your interactions
          </DialogDescription>
        </DialogHeader>

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

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create Event'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
