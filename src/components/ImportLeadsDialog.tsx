import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, Building2, CheckCircle2 } from "lucide-react";

interface ImportLeadsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Contact {
  id: string;
  name: string;
  email?: string;
  email_verified?: boolean;
  title?: string;
  phone?: string;
  linkedin_url?: string;
  company_id?: string;
  companies?: {
    name: string;
  };
}

export function ImportLeadsDialog({ open, onOpenChange }: ImportLeadsDialogProps) {
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: contacts, isLoading } = useQuery({
    queryKey: ["contacts-for-import"],
    queryFn: async () => {
      // Get contacts that are NOT already in people table
      const { data: contactsData } = await supabase
        .from("contacts")
        .select("id, name, email, email_verified, title, phone, linkedin_url, company_id, companies(name)")
        .order("created_at", { ascending: false });

      const { data: peopleEmails } = await supabase
        .from("people")
        .select("email");

      const existingEmails = new Set(peopleEmails?.map(p => p.email?.toLowerCase()) || []);
      
      // Filter out contacts that are already in people
      return (contactsData as Contact[] || []).filter(
        contact => !contact.email || !existingEmails.has(contact.email.toLowerCase())
      );
    },
    enabled: open,
  });

  const importMutation = useMutation({
    mutationFn: async (contactIds: string[]) => {
      // Get current user ID
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      const contactsToImport = contacts?.filter(c => contactIds.includes(c.id)) || [];
      
      const peopleData = contactsToImport.map(contact => {
        // Parse name into first and last name
        const nameParts = contact.name.trim().split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        return {
          first_name: firstName,
          last_name: lastName,
          email: contact.email,
          phone: contact.phone,
          title: contact.title,
          linkedin_url: contact.linkedin_url,
          company_id: contact.company_id,
          user_id: user.id,
        };
      });

      const { error } = await supabase
        .from("people")
        .insert(peopleData);

      if (error) throw error;
      
      return peopleData.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["people"] });
      queryClient.invalidateQueries({ queryKey: ["contacts-for-import"] });
      toast({
        title: "Success",
        description: `Imported ${count} contact${count > 1 ? 's' : ''} to People`,
      });
      setSelectedContacts(new Set());
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const toggleContact = (contactId: string) => {
    const newSelected = new Set(selectedContacts);
    if (newSelected.has(contactId)) {
      newSelected.delete(contactId);
    } else {
      newSelected.add(contactId);
    }
    setSelectedContacts(newSelected);
  };

  const toggleAll = () => {
    if (selectedContacts.size === contacts?.length) {
      setSelectedContacts(new Set());
    } else {
      setSelectedContacts(new Set(contacts?.map(c => c.id) || []));
    }
  };

  const handleImport = () => {
    importMutation.mutate(Array.from(selectedContacts));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Mail className="h-4 w-4 text-primary" />
            </div>
            Import Leads to People
          </DialogTitle>
          <DialogDescription>
            Select contacts from your lead finder results to add to your People directory
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : contacts && contacts.length > 0 ? (
          <>
            <div className="flex items-center justify-between py-2 border-b shrink-0">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedContacts.size === contacts.length}
                  onCheckedChange={toggleAll}
                />
                <span className="text-sm font-medium">
                  Select All ({selectedContacts.size} of {contacts.length})
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-2" style={{ maxHeight: '400px' }}>
              <div className="space-y-2">
                {contacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors cursor-pointer"
                    onClick={() => toggleContact(contact.id)}
                  >
                    <Checkbox
                      checked={selectedContacts.has(contact.id)}
                      onCheckedChange={() => toggleContact(contact.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{contact.name}</span>
                        {contact.email_verified && (
                          <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/20">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Verified
                          </Badge>
                        )}
                      </div>
                      {contact.title && (
                        <p className="text-xs text-muted-foreground">{contact.title}</p>
                      )}
                      {contact.companies?.name && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Building2 className="h-3 w-3" />
                          {contact.companies.name}
                        </div>
                      )}
                      {contact.email && (
                        <div className="flex items-center gap-1.5 text-xs">
                          <Mail className="h-3 w-3 text-muted-foreground" />
                          <span className="text-primary font-mono">{contact.email}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
              <Mail className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              No new contacts to import. All your contacts are already in the People directory.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={selectedContacts.size === 0 || importMutation.isPending}
          >
            {importMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importing...
              </>
            ) : (
              <>Import {selectedContacts.size} Contact{selectedContacts.size !== 1 ? 's' : ''}</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
