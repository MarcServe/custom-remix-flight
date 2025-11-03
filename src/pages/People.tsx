import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Mail, Phone, Briefcase, Linkedin, Upload, Users, Send, Plus } from "lucide-react";
import { ImportLeadsDialog } from "@/components/ImportLeadsDialog";
import { PersonDetailsDialog } from "@/components/PersonDetailsDialog";
import BulkEmailDialog from "@/components/BulkEmailDialog";
import { AddContactDialog } from "@/components/AddContactDialog";

export default function People() {
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [addContactDialogOpen, setAddContactDialogOpen] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<any>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [bulkEmailDialogOpen, setBulkEmailDialogOpen] = useState(false);
  const [selectedPeopleIds, setSelectedPeopleIds] = useState<Set<string>>(new Set());
  
  const { data: people, isLoading, refetch } = useQuery({
    queryKey: ["people"],
    queryFn: async () => {
      const { data } = await supabase
        .from("people")
        .select("*, companies(name)")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const togglePersonSelection = (personId: string) => {
    setSelectedPeopleIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(personId)) {
        newSet.delete(personId);
      } else {
        newSet.add(personId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedPeopleIds.size === people?.length) {
      setSelectedPeopleIds(new Set());
    } else {
      setSelectedPeopleIds(new Set(people?.map(p => p.id) || []));
    }
  };

  const selectedPeople = people?.filter(p => selectedPeopleIds.has(p.id)) || [];

  if (isLoading) {
    return <div className="flex items-center justify-center h-96">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-8 border">
        <div className="relative z-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center shadow-lg">
                <Users className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold tracking-tight">People</h1>
                <p className="text-muted-foreground mt-1">
                  {people?.length || 0} contacts in your directory
                  {selectedPeopleIds.size > 0 && ` • ${selectedPeopleIds.size} selected`}
                </p>
              </div>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              {selectedPeopleIds.size > 0 && (
                <Button 
                  onClick={() => setBulkEmailDialogOpen(true)} 
                  size="lg"
                  variant="default"
                  className="flex-1 sm:flex-none"
                >
                  <Send className="mr-2 h-4 w-4" />
                  Bulk Send ({selectedPeopleIds.size})
                </Button>
              )}
              <Button 
                onClick={() => setAddContactDialogOpen(true)} 
                size="lg" 
                variant="outline"
                className="flex-1 sm:flex-none"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Contact
              </Button>
              <Button 
                onClick={() => setImportDialogOpen(true)} 
                size="lg" 
                variant={selectedPeopleIds.size > 0 ? "outline" : "default"}
                className="flex-1 sm:flex-none"
              >
                <Upload className="mr-2 h-4 w-4" />
                Import Leads
              </Button>
            </div>
          </div>
          {people && people.length > 0 && (
            <div className="mt-4 flex items-center gap-2">
              <Checkbox
                id="select-all"
                checked={selectedPeopleIds.size === people.length}
                onCheckedChange={toggleSelectAll}
              />
              <label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
                Select all
              </label>
            </div>
          )}
        </div>
      </div>

      {people && people.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {people.map((person) => (
            <Card 
              key={person.id} 
              className="transition-all hover:shadow-md border-2 relative"
            >
              <div 
                className="absolute top-4 left-4 z-10"
                onClick={(e) => e.stopPropagation()}
              >
                <Checkbox
                  checked={selectedPeopleIds.has(person.id)}
                  onCheckedChange={() => togglePersonSelection(person.id)}
                />
              </div>
              <div 
                className="cursor-pointer"
                onClick={() => {
                  setSelectedPerson(person);
                  setDetailsDialogOpen(true);
                }}
              >
                <CardHeader>
                  <div className="flex items-start gap-4 pl-8">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="bg-gradient-primary text-white font-semibold">
                        {person.first_name?.[0]}
                        {person.last_name?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-1">
                      <CardTitle className="text-lg">
                        {person.first_name} {person.last_name}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">{person.title}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {person.companies?.name && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Briefcase className="h-4 w-4" />
                      {person.companies.name}
                    </div>
                  )}
                  {person.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <a
                        href={`mailto:${person.email}`}
                        className="text-primary hover:underline truncate"
                      >
                        {person.email}
                      </a>
                    </div>
                  )}
                  {person.phone && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="h-4 w-4" />
                      {person.phone}
                    </div>
                  )}
                  {person.linkedin_url && (
                    <a
                      href={person.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      <Linkedin className="h-4 w-4" />
                      LinkedIn Profile
                    </a>
                  )}
                </CardContent>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-2 border-dashed">
          <CardContent className="py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No contacts yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Import leads from your contact finder to get started
            </p>
            <Button onClick={() => setImportDialogOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Import Leads
            </Button>
          </CardContent>
        </Card>
      )}

      <AddContactDialog
        open={addContactDialogOpen}
        onOpenChange={setAddContactDialogOpen}
        onSuccess={refetch}
      />

      <ImportLeadsDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
      />

      {selectedPerson && (
        <PersonDetailsDialog
          person={selectedPerson}
          open={detailsDialogOpen}
          onOpenChange={setDetailsDialogOpen}
          onUpdate={refetch}
        />
      )}

      <BulkEmailDialog
        open={bulkEmailDialogOpen}
        onOpenChange={setBulkEmailDialogOpen}
        selectedPeople={selectedPeople}
      />
    </div>
  );
}
