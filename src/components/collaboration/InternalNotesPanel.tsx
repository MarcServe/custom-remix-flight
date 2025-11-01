import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MessageSquare, Send, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface InternalNote {
  id: string;
  content: string;
  author_id: string;
  created_at: string;
  updated_at: string;
  profiles?: {
    full_name: string;
    email: string;
  };
}

interface InternalNotesPanelProps {
  entityType: 'company_sequence' | 'email_activity' | 'deal' | 'company' | 'contact';
  entityId: string;
  teamId: string;
}

export function InternalNotesPanel({ entityType, entityId, teamId }: InternalNotesPanelProps) {
  const [notes, setNotes] = useState<InternalNote[]>([]);
  const [newNote, setNewNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadNotes();
    
    // Set up realtime subscription
    const channel = supabase
      .channel(`notes-${entityType}-${entityId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'internal_notes',
          filter: `entity_type=eq.${entityType},entity_id=eq.${entityId}`,
        },
        () => {
          loadNotes();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [entityType, entityId]);

  const loadNotes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('internal_notes')
        .select(`
          *,
          profiles:author_id (
            full_name,
            email
          )
        `)
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotes(data as any || []);
    } catch (error: any) {
      console.error('Error loading notes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;

    try {
      setSubmitting(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('internal_notes')
        .insert({
          team_id: teamId,
          author_id: user.id,
          entity_type: entityType,
          entity_id: entityId,
          content: newNote,
        });

      if (error) throw error;

      setNewNote('');
      toast({ title: "Note added successfully" });
    } catch (error: any) {
      console.error('Error adding note:', error);
      toast({
        title: "Error",
        description: "Failed to add note",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm('Are you sure you want to delete this note?')) return;

    try {
      const { error } = await supabase
        .from('internal_notes')
        .delete()
        .eq('id', noteId);

      if (error) throw error;

      toast({ title: "Note deleted" });
    } catch (error: any) {
      console.error('Error deleting note:', error);
      toast({
        title: "Error",
        description: "Failed to delete note",
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Internal Notes
        </CardTitle>
        <CardDescription>
          Add private notes visible only to your team
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add new note */}
        <div className="space-y-2">
          <Textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Add a note..."
            rows={3}
            disabled={submitting}
          />
          <Button
            onClick={handleAddNote}
            disabled={!newNote.trim() || submitting}
            size="sm"
          >
            <Send className="h-4 w-4 mr-2" />
            Add Note
          </Button>
        </div>

        {/* Notes list */}
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">
            Loading notes...
          </div>
        ) : notes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No notes yet. Add the first one!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {notes.map((note) => (
              <div key={note.id} className="border rounded-lg p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>
                        {note.profiles?.full_name?.charAt(0) || note.profiles?.email?.charAt(0) || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium text-sm">
                        {note.profiles?.full_name || 'Unknown User'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteNote(note.id)}
                    className="h-8 w-8"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-sm whitespace-pre-wrap">{note.content}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}