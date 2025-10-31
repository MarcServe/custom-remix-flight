import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Building2, Globe, ExternalLink, Users, MapPin, Sparkles, Package, Newspaper, DollarSign, Mail, Search, Wand2, ChevronLeft, ChevronRight, Trash2, Calendar as CalendarIcon, Plus } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { PersonalizeSequenceDialog } from "@/components/sequences/PersonalizeSequenceDialog";
import { SendEmailDialog } from "@/components/SendEmailDialog";
import { EventCard } from "@/components/EventCard";
import { EventDialog } from "@/components/EventDialog";
import { useDeleteCompany } from "@/hooks/use-companies";
import { useCompanyEvents, useDeleteEvent } from "@/hooks/use-events";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface Contact {
  id?: string;
  name: string;
  email?: string;
  emailVerified?: boolean;
  linkedinUrl?: string;
  title?: string;
  department?: string;
  phone?: string;
  companyName: string;
}

interface Company {
  id: string;
  name: string;
  website?: string;
  description?: string;
  industry?: string;
  size?: string;
  geography?: string;
  linkedinUrl?: string;
  wasEnriched?: boolean;
  products?: string;
  recentNews?: string;
  fundingInfo?: string;
  employeeCount?: number;
  companyPhone?: string;
  generalEmail?: string;
  socialProfiles?: {
    linkedin?: string;
    twitter?: string;
    facebook?: string;
    instagram?: string;
    youtube?: string;
  };
  keyExecutives?: Array<{
    name: string;
    title: string;
  }>;
  contacts?: Contact[];
  primaryContact?: Contact;
}

interface CompanyDetailsDialogProps {
  company: Company | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSearching?: boolean;
  allCompanies?: Company[];
  currentIndex?: number;
  onNavigate?: (direction: 'prev' | 'next') => void;
}

export function CompanyDetailsDialog({ 
  company, 
  open, 
  onOpenChange, 
  isSearching = false,
  allCompanies,
  currentIndex,
  onNavigate,
}: CompanyDetailsDialogProps) {
  const [isEnriching, setIsEnriching] = useState(false);
  const [personalizeDialogOpen, setPersonalizeDialogOpen] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [emailRecipient, setEmailRecipient] = useState<{
    email: string;
    name: string;
    contactId?: string;
  } | null>(null);
  const { toast } = useToast();
  const deleteMutation = useDeleteCompany();
  const { data: eventsData } = useCompanyEvents(company?.id || '');
  const deleteEventMutation = useDeleteEvent();

  // Keyboard navigation
  useEffect(() => {
    if (!open || !onNavigate) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && currentIndex !== undefined && currentIndex > 0) {
        onNavigate('prev');
      } else if (e.key === 'ArrowRight' && allCompanies && currentIndex !== undefined && currentIndex < allCompanies.length - 1) {
        onNavigate('next');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onNavigate, currentIndex, allCompanies]);
  
  if (!company) return null;

  const hasContacts = company.contacts && company.contacts.length > 0;
  const hasBeenSaved = !!company.id;
  const showFindProspectsButton = !hasContacts && !isSearching && hasBeenSaved && company.linkedinUrl;
  
  const showNavigation = allCompanies && currentIndex !== undefined && onNavigate;
  const canGoPrev = showNavigation && currentIndex > 0;
  const canGoNext = showNavigation && allCompanies && currentIndex < allCompanies.length - 1;

  const handleSendEmailToContact = (contact: Contact) => {
    if (!contact.email) {
      toast({
        title: "No Email",
        description: "This contact doesn't have an email address",
        variant: "destructive",
      });
      return;
    }
    
    setEmailRecipient({
      email: contact.email,
      name: contact.name,
      contactId: contact.id,
    });
    setEmailDialogOpen(true);
  };

  const handleFindProspects = async () => {
    if (!company.linkedinUrl) {
      toast({
        title: "LinkedIn URL required",
        description: "This company needs a LinkedIn URL to find prospects.",
        variant: "destructive",
      });
      return;
    }

    setIsEnriching(true);
    toast({
      title: "Finding prospects",
      description: `Searching for contacts at ${company.name}...`,
    });

    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data, error } = await supabase.functions.invoke('find-linkedin-prospects', {
        body: {
          companyId: company.id,
          linkedinUrl: company.linkedinUrl,
          companyName: company.name,
        }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: `Found ${data.inserted} prospects with contact details`,
      });

      // Close and reopen dialog to refresh data
      onOpenChange(false);
      setTimeout(() => onOpenChange(true), 100);
    } catch (error) {
      console.error("Find prospects error:", error);
      toast({
        title: "Error finding prospects",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsEnriching(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 bg-gradient-to-br from-primary/5 via-primary/3 to-transparent">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-xl bg-gradient-primary flex items-center justify-center shadow-lg shrink-0">
              <Building2 className="h-8 w-8 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-2">
                <DialogTitle className="text-2xl font-bold">{company.name}</DialogTitle>
                
                {showNavigation && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onNavigate!('prev')}
                      disabled={!canGoPrev}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm text-muted-foreground min-w-[60px] text-center">
                      {currentIndex! + 1} of {allCompanies!.length}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onNavigate!('next')}
                      disabled={!canGoNext}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
              
              {company.website && (
                <a
                  href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline inline-flex items-center gap-1.5 font-medium"
                >
                  <Globe className="h-4 w-4" />
                  {company.website}
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
              <div className="flex flex-wrap gap-2 mt-3">
                {company.wasEnriched && (
                  <Badge className="bg-gradient-primary">
                    <Sparkles className="h-3 w-3 mr-1" />
                    Enriched
                  </Badge>
                )}
                {company.industry && (
                  <Badge variant="secondary">{company.industry}</Badge>
                )}
                {company.size && (
                  <Badge variant="outline">{company.size}</Badge>
                )}
              </div>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="overview" className="flex-1">
          <TabsList className="mx-6 mt-2">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="activity">Activity Timeline</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-0">
            <ScrollArea className="px-6 pb-6 max-h-[calc(90vh-260px)]">
              <div className="space-y-6 pt-4">
            {/* Overview Section */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Overview
              </h3>
              {company.description && (
                <p className="text-sm text-foreground leading-relaxed">
                  {company.description}
                </p>
              )}
              <div className="grid grid-cols-2 gap-3">
                {company.geography && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Location:</span>
                    <span className="text-muted-foreground">{company.geography}</span>
                  </div>
                )}
                {company.employeeCount && (
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Employees:</span>
                    <span className="text-muted-foreground">{company.employeeCount}</span>
                  </div>
                )}
                {company.companyPhone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Phone:</span>
                    <a href={`tel:${company.companyPhone}`} className="text-primary hover:underline">
                      {company.companyPhone}
                    </a>
                  </div>
                )}
                {company.generalEmail && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Email:</span>
                    <a href={`mailto:${company.generalEmail}`} className="text-primary hover:underline">
                      {company.generalEmail}
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Enriched Data Sections */}
            {company.wasEnriched && (
              <>
                <Separator />
                
                {company.products && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                        <Package className="h-4 w-4 text-blue-500" />
                      </div>
                      <h3 className="text-sm font-semibold">Products & Services</h3>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed pl-10">
                      {company.products}
                    </p>
                  </div>
                )}

                {company.recentNews && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                        <Newspaper className="h-4 w-4 text-purple-500" />
                      </div>
                      <h3 className="text-sm font-semibold">Recent News</h3>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed pl-10">
                      {company.recentNews}
                    </p>
                  </div>
                )}

                {company.fundingInfo && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                        <DollarSign className="h-4 w-4 text-green-500" />
                      </div>
                      <h3 className="text-sm font-semibold">Funding Information</h3>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed pl-10">
                      {company.fundingInfo}
                    </p>
                  </div>
                )}

                {company.keyExecutives && company.keyExecutives.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                        <Users className="h-4 w-4 text-amber-500" />
                      </div>
                      <h3 className="text-sm font-semibold">Key Executives</h3>
                    </div>
                    <div className="space-y-2 pl-10">
                      {company.keyExecutives.map((exec, idx) => (
                        <div key={idx} className="text-sm">
                          <span className="font-medium text-foreground">{exec.name}</span>
                          {" - "}
                          <span className="text-muted-foreground">{exec.title}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {company.socialProfiles && Object.keys(company.socialProfiles).length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-pink-500/10 flex items-center justify-center">
                        <Globe className="h-4 w-4 text-pink-500" />
                      </div>
                      <h3 className="text-sm font-semibold">Social Profiles</h3>
                    </div>
                    <div className="flex flex-wrap gap-2 pl-10">
                      {company.socialProfiles.linkedin && (
                        <Button variant="outline" size="sm" asChild>
                          <a href={company.socialProfiles.linkedin} target="_blank" rel="noopener noreferrer">
                            LinkedIn
                          </a>
                        </Button>
                      )}
                      {company.socialProfiles.twitter && (
                        <Button variant="outline" size="sm" asChild>
                          <a href={company.socialProfiles.twitter} target="_blank" rel="noopener noreferrer">
                            Twitter
                          </a>
                        </Button>
                      )}
                      {company.socialProfiles.facebook && (
                        <Button variant="outline" size="sm" asChild>
                          <a href={company.socialProfiles.facebook} target="_blank" rel="noopener noreferrer">
                            Facebook
                          </a>
                        </Button>
                      )}
                      {company.socialProfiles.instagram && (
                        <Button variant="outline" size="sm" asChild>
                          <a href={company.socialProfiles.instagram} target="_blank" rel="noopener noreferrer">
                            Instagram
                          </a>
                        </Button>
                      )}
                      {company.socialProfiles.youtube && (
                        <Button variant="outline" size="sm" asChild>
                          <a href={company.socialProfiles.youtube} target="_blank" rel="noopener noreferrer">
                            YouTube
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Team Contacts Section */}
            {company.contacts && company.contacts.length > 0 && (
              <>
                <Separator />
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                      <Users className="h-4 w-4 text-cyan-500" />
                    </div>
                    <h3 className="text-sm font-semibold">Team Contacts</h3>
                  </div>
                  
                  <div className="space-y-3 pl-10">
                    {company.contacts.map((contact, idx) => (
                      <div key={idx} className="p-3 rounded-lg border bg-card/50 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{contact.name}</span>
                            {contact.emailVerified && (
                              <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/20">
                                Verified
                              </Badge>
                            )}
                            {contact === company.primaryContact && (
                              <Badge className="text-xs bg-primary/10 text-primary border-primary/20">
                                Primary
                              </Badge>
                            )}
                          </div>
                          {contact.email && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSendEmailToContact(contact);
                              }}
                            >
                              <Mail className="h-4 w-4 mr-1" />
                              Email
                            </Button>
                          )}
                        </div>
                        
                        {contact.title && (
                          <p className="text-xs text-muted-foreground">{contact.title}</p>
                        )}
                        
                        {contact.email && (
                          <a 
                            href={`mailto:${contact.email}`}
                            className="text-xs text-primary hover:underline font-mono inline-flex items-center gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Mail className="h-3 w-3" />
                            {contact.email}
                          </a>
                        )}
                        
                        {contact.linkedinUrl && (
                          <a 
                            href={contact.linkedinUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink className="h-3 w-3" />
                            LinkedIn Profile
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Actions Section */}
            <Separator />
            <div className="flex gap-2">
              {!hasBeenSaved && !hasContacts && (
                <div className="text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded-lg">
                  💡 Save this company to CRM first to find prospects
                </div>
              )}
              {showFindProspectsButton && (
                <Button 
                  variant="default" 
                  size="sm" 
                  onClick={handleFindProspects}
                  disabled={isEnriching}
                >
                  <Search className="h-3.5 w-3.5 mr-2" />
                  {isEnriching ? "Finding..." : "Find Prospects"}
                </Button>
              )}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setPersonalizeDialogOpen(true)}
                disabled={!company.id}
                title={!company.id ? "Save company to CRM first to generate sequences" : undefined}
              >
                <Wand2 className="h-3.5 w-3.5 mr-2" />
                Personalize Sequence
              </Button>
              {company.linkedinUrl && (
                <Button variant="outline" size="sm" asChild>
                  <a
                    href={company.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View LinkedIn
                  </a>
                </Button>
              )}
              {company.id && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setDeleteDialogOpen(true)}
                  className="ml-auto text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-2" />
                  Delete
                </Button>
              )}
            </div>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="activity" className="mt-0">
            <ScrollArea className="px-6 pb-6 max-h-[calc(90vh-260px)]">
              <div className="space-y-4 pt-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    Recent Activity
                  </h3>
                  <Button size="sm" onClick={() => setEventDialogOpen(true)}>
                    <Plus className="h-3.5 w-3.5 mr-1.5" />
                    Add Event
                  </Button>
                </div>

                {eventsData?.data && eventsData.data.length > 0 ? (
                  <div className="space-y-3">
                    {(eventsData.data as Array<{
                      id: string;
                      type: 'note' | 'call' | 'email' | 'meeting' | 'task' | 'reminder';
                      content: { title?: string; description?: string };
                      created_at: string;
                      due_at?: string;
                    }>).map((event) => (
                      <EventCard
                        key={event.id}
                        event={event}
                        onDelete={async (id) => {
                          if (confirm('Delete this event?')) {
                            await deleteEventMutation.mutateAsync(id);
                          }
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <CalendarIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">No activity yet</p>
                    <p className="text-xs mt-1">Start tracking interactions with this company</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>

      <EventDialog open={eventDialogOpen} onOpenChange={setEventDialogOpen} />

      <PersonalizeSequenceDialog
        open={personalizeDialogOpen}
        onOpenChange={setPersonalizeDialogOpen}
        companyId={company.id}
        companyName={company.name}
      />

      {emailRecipient && (
        <SendEmailDialog
          open={emailDialogOpen}
          onOpenChange={setEmailDialogOpen}
          recipientEmail={emailRecipient.email}
          recipientName={emailRecipient.name}
          companyId={company.id}
          contactId={emailRecipient.contactId}
        />
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Company</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{company.name}</strong>? This will also delete all associated contacts, deals, and events. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                try {
                  await deleteMutation.mutateAsync(company.id);
                  onOpenChange(false);
                } catch (error) {
                  console.error('Delete error:', error);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
