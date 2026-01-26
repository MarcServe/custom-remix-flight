import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Mail, Phone, Briefcase, Linkedin, Upload, Users, Send, Plus, UserPlus, Loader2, CheckCircle2, Filter, X, Clock, Tag, ChevronDown } from "lucide-react";
import { ImportLeadsDialog } from "@/components/ImportLeadsDialog";
import { PersonDetailsDialog } from "@/components/PersonDetailsDialog";
import BulkEmailDialog from "@/components/BulkEmailDialog";
import { AddContactDialog } from "@/components/AddContactDialog";
import { useToast } from "@/hooks/use-toast";
import { TagInput, TagBadges } from "@/components/ui/tag-input";
import { useCompanyTags } from "@/hooks/use-company-tags";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export default function People() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { allSuggestions } = useCompanyTags();
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [addContactDialogOpen, setAddContactDialogOpen] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<any>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [bulkEmailDialogOpen, setBulkEmailDialogOpen] = useState(false);
  const [selectedPeopleIds, setSelectedPeopleIds] = useState<Set<string>>(new Set());
  const [selectedTagFilters, setSelectedTagFilters] = useState<string[]>([]);
  const [selectedIndustryFilters, setSelectedIndustryFilters] = useState<string[]>([]);
  const [selectedCampaignFilter, setSelectedCampaignFilter] = useState<string | null>(null);
  const [expandedEmailHistory, setExpandedEmailHistory] = useState<Set<string>>(new Set());
  
  const { data: people, isLoading, refetch } = useQuery({
    queryKey: ["people"],
    queryFn: async () => {
      const { data } = await supabase
        .from("people")
        .select("*, companies(name, tags, industry, enrichment_data)")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  // Fetch email campaign history for all people
  const { data: emailHistory, error: emailHistoryError } = useQuery({
    queryKey: ["people-email-history"],
    queryFn: async () => {
      try {
        if (!people || people.length === 0) return {};
        
        const personIds = people.map(p => p?.id).filter(Boolean);
        if (personIds.length === 0) return {};

        // Try to fetch with tags first, fallback to without tags if it fails
        let data, error;
        
        try {
          const result = await supabase
            .from("email_campaign_recipients")
            .select(`
              id,
              person_id,
              email,
              status,
              sent_at,
              opened_at,
              campaign_id,
              personalized_subject,
              email_campaigns (
                id,
                name,
                tags,
                created_at
              )
            `)
            .in("person_id", personIds)
            .not("sent_at", "is", null)
            .order("sent_at", { ascending: false })
            .limit(1000);
          
          data = result.data;
          error = result.error;
        } catch (queryError: any) {
          // If the query fails (e.g., tags column doesn't exist), try without tags
          console.warn("Query with tags failed, trying without tags:", queryError);
          const result = await supabase
            .from("email_campaign_recipients")
            .select(`
              id,
              person_id,
              email,
              status,
              sent_at,
              opened_at,
              campaign_id,
              personalized_subject,
              email_campaigns (
                id,
                name,
                created_at
              )
            `)
            .in("person_id", personIds)
            .not("sent_at", "is", null)
            .order("sent_at", { ascending: false })
            .limit(1000);
          
          data = result.data;
          error = result.error;
        }

        if (error) {
          console.error("Error fetching email history:", error);
          return {};
        }

        // Group by person_id and filter out null campaigns
        const historyByPerson: Record<string, any[]> = {};
        (data || []).forEach((recipient: any) => {
          if (recipient?.person_id && recipient?.email_campaigns) {
            if (!historyByPerson[recipient.person_id]) {
              historyByPerson[recipient.person_id] = [];
            }
            historyByPerson[recipient.person_id].push(recipient);
          }
        });

        return historyByPerson;
      } catch (err) {
        console.error("Error in email history query:", err);
        return {};
      }
    },
    enabled: !!people && Array.isArray(people) && people.length > 0,
    retry: 1,
  });

  // Fetch people emails to check duplicates
  const { data: peopleEmails } = useQuery({
    queryKey: ["people-emails"],
    queryFn: async () => {
      const { data } = await supabase
        .from("people")
        .select("email");
      return new Set((data || []).map(p => p.email?.toLowerCase()).filter(Boolean));
    },
  });

  // Bulk ensure contacts are properly added (handles duplicates intelligently)
  // This is useful when importing or ensuring all people with emails are in contacts
  const bulkEnsureContactsMutation = useMutation({
    mutationFn: async (personIds: string[]) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const selectedPeople = people?.filter(p => personIds.includes(p.id)) || [];
      
      // Filter people that have emails
      const peopleWithEmails = selectedPeople.filter(p => p.email);

      if (peopleWithEmails.length === 0) {
        throw new Error("No people with emails selected");
      }

      // Get all existing people emails for duplicate checking
      const { data: existingPeople } = await supabase
        .from("people")
        .select("id, email, company_id, first_name, last_name");

      const existingEmails = new Set(
        (existingPeople || []).map(p => p.email?.toLowerCase()).filter(Boolean)
      );
      const existingPeopleByEmail = new Map(
        (existingPeople || []).map(p => [p.email?.toLowerCase(), p])
      );

      let updatedCount = 0;
      let skippedCount = 0;
      const skippedPeople: Array<{ name: string; reason: string }> = [];

      for (const person of peopleWithEmails) {
        if (!person.email) continue;

        const emailLower = person.email.toLowerCase();
        
        // Check if email already exists (but might be a different person)
        if (existingEmails.has(emailLower)) {
          const existingPerson = existingPeopleByEmail.get(emailLower);
          
          // If it's the same person (same ID), update company_id if needed
          if (existingPerson && existingPerson.id === person.id) {
            if (person.company_id && existingPerson.company_id !== person.company_id) {
              await supabase
                .from("people")
                .update({ company_id: person.company_id })
                .eq("id", person.id);
              updatedCount++;
            } else {
              skippedCount++;
            }
          } else if (existingPerson && existingPerson.id !== person.id) {
            // Different person with same email - skip to avoid duplicate
            skippedCount++;
            skippedPeople.push({
              name: `${person.first_name} ${person.last_name}`.trim() || person.email,
              reason: "Email already exists for another contact",
            });
          }
          continue;
        }

        // Person should already be in the table since we're querying from it
        // This mutation is mainly for ensuring proper linking and handling edge cases
        skippedCount++;
      }

      return {
        updated: updatedCount,
        skipped: skippedCount,
        total: peopleWithEmails.length,
        skippedPeople,
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["people"] });
      queryClient.invalidateQueries({ queryKey: ["people-emails"] });
      
      const parts: string[] = [];
      if (result.updated > 0) parts.push(`${result.updated} updated`);
      if (result.skipped > 0) parts.push(`${result.skipped} already in contacts`);

      toast({
        title: "Contacts Verified",
        description: `Processed ${result.total} contacts: ${parts.join(", ")}`,
        duration: 5000,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error processing contacts",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Get all unique tags from people and their companies (prioritize intelligent tags)
  // Extract from both tags column AND enrichment_data.suggestedTags
  const allPeopleTags = new Set<string>();
  if (people && Array.isArray(people)) {
    people.forEach(person => {
      // Add person's own tags (using type assertion since tags column exists but types may not be updated)
      const personTags = (person as any).tags;
      if (personTags && Array.isArray(personTags)) {
        personTags.forEach((tag: string) => {
          if (tag && typeof tag === 'string' && tag.trim()) {
            allPeopleTags.add(tag.trim());
          }
        });
      }
      // Add company tags from tags column (intelligent tags like "translation service", "healthcare", etc.)
      if (person.companies?.tags && Array.isArray(person.companies.tags)) {
        person.companies.tags.forEach((tag: string) => {
          if (tag && typeof tag === 'string' && tag.trim()) {
            allPeopleTags.add(tag.trim());
          }
        });
      }
      // Also extract tags from company enrichment_data.suggestedTags
      if (person.companies?.enrichment_data) {
        const enrichmentData = person.companies.enrichment_data as any;
        const suggestedTags = enrichmentData?.suggestedTags || 
                             enrichmentData?.suggested_tags ||
                             null;
        
        if (Array.isArray(suggestedTags)) {
          suggestedTags.forEach((tag: string) => {
            if (tag && typeof tag === 'string' && tag.trim()) {
              allPeopleTags.add(tag.trim());
            }
          });
        } else if (typeof suggestedTags === 'string') {
          // Try parsing if it's a JSON string
          try {
            const parsed = JSON.parse(suggestedTags);
            if (Array.isArray(parsed)) {
              parsed.forEach((tag: string) => {
                if (tag && typeof tag === 'string' && tag.trim()) {
                  allPeopleTags.add(tag.trim());
                }
              });
            }
          } catch (e) {
            // Not JSON, skip
          }
        }
      }
    });
  }

  // Get all unique industries from companies
  const allIndustries = new Set<string>();
  if (people && Array.isArray(people)) {
    people.forEach(person => {
      if (person.companies?.industry && typeof person.companies.industry === 'string') {
        allIndustries.add(person.companies.industry);
      }
    });
  }

  // Get all unique campaigns from email history
  const allCampaigns = new Set<{ id: string; name: string; tags: string[] | null; created_at: string }>();
  if (emailHistory && typeof emailHistory === 'object') {
    Object.values(emailHistory).forEach((personHistory: any) => {
      if (Array.isArray(personHistory)) {
        personHistory.forEach((email: any) => {
          if (email?.email_campaigns) {
            allCampaigns.add({
              id: email.email_campaigns.id,
              name: email.email_campaigns.name,
              tags: email.email_campaigns.tags,
              created_at: email.email_campaigns.created_at,
            });
          }
        });
      }
    });
  }

  // Filter people by selected tags, industries, and campaigns
  const filteredPeople = (people && Array.isArray(people)) ? people.filter(person => {
    // Tag filter - case-insensitive matching with trimmed tags and partial matching
    if (selectedTagFilters.length > 0) {
      // Get tags from person.tags array (using type assertion since tags column exists but types may not be updated)
      const personTags = ((person as any).tags && Array.isArray((person as any).tags)) 
        ? (person as any).tags.map((tag: string) => typeof tag === 'string' ? tag.trim().toLowerCase() : String(tag).toLowerCase()).filter(Boolean)
        : [];
      
      // Get tags from company.tags array
      const companyTags = (person.companies?.tags && Array.isArray(person.companies.tags))
        ? person.companies.tags.map((tag: string) => typeof tag === 'string' ? tag.trim().toLowerCase() : String(tag).toLowerCase()).filter(Boolean)
        : [];
      
      // Also get tags from company enrichment_data.suggestedTags
      let suggestedTags: string[] = [];
      if (person.companies?.enrichment_data) {
        const enrichmentData = person.companies.enrichment_data as any;
        const possibleTags = enrichmentData?.suggestedTags || 
                            enrichmentData?.suggested_tags ||
                            null;
        
        if (Array.isArray(possibleTags)) {
          suggestedTags = possibleTags.map((tag: string) => 
            typeof tag === 'string' ? tag.trim().toLowerCase() : String(tag).toLowerCase()
          ).filter(Boolean);
        } else if (typeof possibleTags === 'string') {
          try {
            const parsed = JSON.parse(possibleTags);
            if (Array.isArray(parsed)) {
              suggestedTags = parsed.map((tag: string) => 
                typeof tag === 'string' ? tag.trim().toLowerCase() : String(tag).toLowerCase()
              ).filter(Boolean);
            }
          } catch (e) {
            // Not JSON, skip
          }
        }
      }
      
      // Combine all tag sources
      const allPersonTags = [...personTags, ...companyTags, ...suggestedTags];
      const selectedTagsLower = selectedTagFilters.map(tag => tag.trim().toLowerCase()).filter(Boolean);
      
      // Use OR logic with partial matching: person matches if they have ANY of the selected tags
      // Also support partial matches (e.g., "EdTech" matches "EdTech platform")
      const hasTag = selectedTagsLower.length > 0 && selectedTagsLower.some(selectedTag => {
        // Exact match
        if (allPersonTags.includes(selectedTag)) return true;
        
        // Partial match - check if any person tag contains the selected tag or vice versa
        return allPersonTags.some(personTag => 
          personTag.includes(selectedTag) || selectedTag.includes(personTag)
        );
      });
      
      if (!hasTag) {
        // Debug logging for first few people that don't match
        if (people.indexOf(person) < 3) {
          console.log('[People Filter] Person did not match tags:', {
            name: `${person.first_name} ${person.last_name}`,
            selectedTags: selectedTagFilters,
            personTags: personTags,
            companyTags: companyTags,
            suggestedTags: suggestedTags,
            allPersonTags: allPersonTags
          });
        }
        return false;
      }
    }

    // Industry filter
    if (selectedIndustryFilters.length > 0) {
      const personIndustry = person.companies?.industry;
      if (!personIndustry || !selectedIndustryFilters.includes(personIndustry)) {
        return false;
      }
    }

    // Campaign filter - show only contacts who were in this campaign
    if (selectedCampaignFilter) {
      const personHistory = emailHistory?.[person.id] || [];
      const wasInCampaign = personHistory.some((email: any) => 
        email?.email_campaigns?.id === selectedCampaignFilter
      );
      if (!wasInCampaign) return false;
    }

    return true;
  }) : [];

  // Debug logging when filtering by tags but no results
  if (selectedTagFilters.length > 0 && filteredPeople.length === 0 && people && people.length > 0) {
    console.warn('[People Filter] ⚠️ No people matched the selected tags:', selectedTagFilters);
    
    // Find people that might have similar tags
    const potentialMatches = people.slice(0, 10).map(p => {
      const personTags = ((p as any).tags && Array.isArray((p as any).tags)) 
        ? (p as any).tags.map((t: string) => t.toLowerCase())
        : [];
      const companyTags = (p.companies?.tags && Array.isArray(p.companies.tags))
        ? p.companies.tags.map((t: string) => t.toLowerCase())
        : [];
      
      // Also check enrichment_data
      let suggestedTags: string[] = [];
      if (p.companies?.enrichment_data) {
        const ed = p.companies.enrichment_data as any;
        const st = ed?.suggestedTags || ed?.suggested_tags || [];
        if (Array.isArray(st)) {
          suggestedTags = st.map((t: string) => t.toLowerCase());
        }
      }
      
      const allTags = [...personTags, ...companyTags, ...suggestedTags];
      
      return {
        name: `${p.first_name} ${p.last_name}`,
        personTags: (p as any).tags || [],
        companyTags: p.companies?.tags || [],
        suggestedTags: suggestedTags,
        allTagsLower: allTags,
        hasSimilarTag: selectedTagFilters.some(st => 
          allTags.some(ct => ct.includes(st.toLowerCase()) || st.toLowerCase().includes(ct))
        )
      };
    }).filter(p => p.hasSimilarTag || p.allTagsLower.length > 0);
    
    console.warn('[People Filter] People with tags (potential matches):', potentialMatches);
  }

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

  const selectablePeople = filteredPeople?.filter(p => p.email) || [];

  const toggleSelectAll = () => {
    if (selectedPeopleIds.size === selectablePeople.length) {
      setSelectedPeopleIds(new Set());
    } else {
      setSelectedPeopleIds(new Set(selectablePeople.map(p => p.id)));
    }
  };

  const selectedPeople = filteredPeople.filter(p => selectedPeopleIds.has(p.id));

  const toggleEmailHistory = (personId: string) => {
    setExpandedEmailHistory(prev => {
      const newSet = new Set(prev);
      if (newSet.has(personId)) {
        newSet.delete(personId);
      } else {
        newSet.add(personId);
      }
      return newSet;
    });
  };

  // Debug logging
  console.log("People component rendering", { isLoading, peopleCount: people?.length, emailHistoryError });

  if (isLoading) {
    return <div className="flex items-center justify-center h-96">Loading...</div>;
  }

  // Log email history error if it exists (but don't block rendering)
  if (emailHistoryError) {
    console.error("Email history query error:", emailHistoryError);
  }

  // Safety check for people data
  if (!people) {
    return <div className="flex items-center justify-center h-96">No data available</div>;
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
                  {filteredPeople?.length || 0} of {people?.length || 0} contacts
                  {selectedTagFilters.length > 0 && ` (filtered by ${selectedTagFilters.length} tag${selectedTagFilters.length > 1 ? 's' : ''})`}
                  {selectedPeopleIds.size > 0 && ` • ${selectedPeopleIds.size} selected`}
                </p>
              </div>
            </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap w-full sm:w-auto">
              {selectedPeopleIds.size > 0 && (
                <>
                  <Button 
                    onClick={() => setBulkEmailDialogOpen(true)} 
                    size="lg"
                    variant="default"
                    className="w-full sm:w-auto"
                  >
                    <Send className="mr-2 h-4 w-4" />
                    Bulk Send ({selectedPeopleIds.size})
                  </Button>
                  {(() => {
                    const selectedPeopleWithEmails = people?.filter(p => 
                      selectedPeopleIds.has(p.id) && p.email
                    ) || [];
                    return selectedPeopleWithEmails.length > 0 && (
                      <Button 
                        onClick={() => bulkEnsureContactsMutation.mutate(Array.from(selectedPeopleIds))} 
                        size="lg"
                        variant="outline"
                        disabled={bulkEnsureContactsMutation.isPending}
                        className="w-full sm:w-auto"
                      >
                        {bulkEnsureContactsMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Verify Contacts ({selectedPeopleWithEmails.length})
                          </>
                        )}
                      </Button>
                    );
                  })()}
                </>
              )}
              <Button 
                onClick={() => setAddContactDialogOpen(true)} 
                size="lg" 
                variant="outline"
                className="w-full sm:w-auto"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Contact
              </Button>
              <Button 
                onClick={() => setImportDialogOpen(true)} 
                size="lg" 
                variant={selectedPeopleIds.size > 0 ? "outline" : "default"}
                className="w-full sm:w-auto"
              >
                <Upload className="mr-2 h-4 w-4" />
                Import Leads
              </Button>
            </div>
          </div>
          <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            {people && people.length > 0 && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="select-all"
                  checked={selectedPeopleIds.size === selectablePeople.length && selectablePeople.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
                <label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
                  Select all
                </label>
              </div>
            )}
            
            {/* Tag Filter */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Filter className="h-4 w-4" />
                  Filter by Tags
                  {selectedTagFilters.length > 0 && (
                    <Badge variant="secondary" className="ml-1">
                      {selectedTagFilters.length}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64" align="end">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-sm">Filter by Tags</h4>
                    {selectedTagFilters.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => setSelectedTagFilters([])}
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                  <TagInput
                    tags={selectedTagFilters}
                    onTagsChange={setSelectedTagFilters}
                    suggestions={Array.from(new Set([
                      ...Array.from(allPeopleTags), // Intelligent tags from people and companies first
                      ...(allSuggestions || [])      // Then presets and defaults
                    ])).sort()}
                    placeholder="Type to search tags (e.g., translation service, healthcare, post office)..."
                    maxTags={50}
                    showAddButton={false}
                  />
                  <p className="text-xs text-muted-foreground">
                    {Array.from(allPeopleTags).length} intelligent tags from your contacts. Select multiple tags to filter.
                  </p>
                </div>
              </PopoverContent>
            </Popover>
          </div>
          
          {/* Active Filters */}
          {selectedTagFilters.length > 0 && (
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-sm text-muted-foreground">Filtering by:</span>
              {selectedTagFilters.map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="gap-1 cursor-pointer"
                  onClick={() => setSelectedTagFilters(prev => prev.filter(t => t !== tag))}
                >
                  <Tag className="h-3 w-3" />
                  {tag}
                  <X className="h-3 w-3 ml-1" />
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      {filteredPeople && filteredPeople.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredPeople.map((person) => {
            if (!person || !person.id) return null;
            
            const personTags = ((person as any).tags && Array.isArray((person as any).tags)) ? (person as any).tags : [];
            const companyTags = (person.companies?.tags && Array.isArray(person.companies.tags)) ? person.companies.tags : [];
            const allPersonTags = [...personTags, ...companyTags];
            const personEmailHistory = (emailHistory && person.id) ? (emailHistory[person.id] || []) : [];
            const hasEmailHistory = personEmailHistory.length > 0;
            const isEmailHistoryExpanded = person.id ? expandedEmailHistory.has(person.id) : false;
            
            return (
            <Card 
              key={person.id || `person-${Math.random()}`} 
              className="transition-all hover:shadow-md border-2 relative"
            >
              <div 
                className="absolute top-4 left-4 z-10"
                onClick={(e) => e.stopPropagation()}
              >
                <Checkbox
                  checked={person.id ? selectedPeopleIds.has(person.id) : false}
                  onCheckedChange={() => {
                    if (person.id) {
                      togglePersonSelection(person.id);
                    }
                  }}
                  disabled={!person.email || !person.id}
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
                        {person.first_name?.[0] || ''}
                        {person.last_name?.[0] || ''}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-1">
                      <CardTitle className="text-lg flex items-center gap-2 flex-wrap">
                        {person.first_name || ''} {person.last_name || ''}
                        {person.email && (
                          <Badge variant="outline" className="text-xs">
                            Has Email
                          </Badge>
                        )}
                        {hasEmailHistory && (
                          <Badge variant="secondary" className="text-xs">
                            {personEmailHistory.length} Email{personEmailHistory.length > 1 ? 's' : ''}
                          </Badge>
                        )}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">{person.title}</p>
                      {allPersonTags.length > 0 && (
                        <div className="mt-1">
                          <TagBadges tags={allPersonTags} maxDisplay={3} />
                        </div>
                      )}
                      {person.created_at && (() => {
                        try {
                          const createdDate = new Date(person.created_at);
                          if (!isNaN(createdDate.getTime())) {
                            return (
                              <p className="text-xs text-muted-foreground mt-1">
                                Added: {format(createdDate, 'MMM d, yyyy')}
                              </p>
                            );
                          }
                        } catch (e) {
                          return null;
                        }
                        return null;
                      })()}
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
                  {person.email && (
                    <Button
                      variant={person.id && selectedPeopleIds.has(person.id) ? "default" : "outline"}
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (person.id) {
                          togglePersonSelection(person.id);
                        }
                      }}
                    >
                      {selectedPeopleIds.has(person.id) ? "Added to Contact List" : "Add to Contact List"}
                    </Button>
                  )}
                  
                  {/* Email History */}
                  {hasEmailHistory && (
                    <Collapsible open={isEmailHistoryExpanded} onOpenChange={() => toggleEmailHistory(person.id)}>
                      <CollapsibleTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-between text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (person.id) {
                              toggleEmailHistory(person.id);
                            }
                          }}
                        >
                          <span className="flex items-center gap-2">
                            <Mail className="h-3 w-3" />
                            Email History ({personEmailHistory.length})
                          </span>
                          <ChevronDown className={`h-3 w-3 transition-transform ${isEmailHistoryExpanded ? 'rotate-180' : ''}`} />
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-2 space-y-2">
                        <div className="space-y-2 text-xs">
                          {personEmailHistory.slice(0, 5).map((email: any) => {
                            if (!email) return null;
                            const campaign = email.email_campaigns || {};
                            const sentDate = email.sent_at ? new Date(email.sent_at) : null;
                            const isRecent = sentDate && !isNaN(sentDate.getTime()) && (Date.now() - sentDate.getTime()) < 7 * 24 * 60 * 60 * 1000; // Last 7 days
                            const isToday = sentDate && !isNaN(sentDate.getTime()) && sentDate.toDateString() === new Date().toDateString();
                            const isThisWeek = sentDate && !isNaN(sentDate.getTime()) && (Date.now() - sentDate.getTime()) < 7 * 24 * 60 * 60 * 1000;
                            
                            return (
                              <div
                                key={email.id}
                                className={`p-2 rounded border space-y-1 ${
                                  isToday ? 'bg-primary/5 border-primary/20' :
                                  isThisWeek ? 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-200/50' :
                                  'bg-muted/50'
                                }`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-medium truncate text-xs">{campaign?.name || 'Campaign'}</span>
                                  <Badge
                                    variant={
                                      email.status === 'sent' ? 'default' :
                                      email.status === 'opened' ? 'default' :
                                      email.status === 'failed' ? 'destructive' : 'secondary'
                                    }
                                    className="text-xs"
                                  >
                                    {email.status}
                                  </Badge>
                                </div>
                                {sentDate && (() => {
                                  try {
                                    return (
                                      <div className="flex items-center gap-1 text-muted-foreground text-xs">
                                        <Clock className="h-3 w-3" />
                                        <span>
                                          {isToday ? 'Today' : isThisWeek ? 'This week' : format(sentDate, 'MMM d, yyyy')} at {format(sentDate, 'h:mm a')}
                                        </span>
                                      </div>
                                    );
                                  } catch (e) {
                                    return null;
                                  }
                                })()}
                                {campaign?.tags && Array.isArray(campaign.tags) && campaign.tags.length > 0 && (
                                  <div className="flex items-center gap-1 flex-wrap">
                                    <Tag className="h-3 w-3 text-muted-foreground" />
                                    <TagBadges tags={campaign.tags} maxDisplay={3} />
                                  </div>
                                )}
                                {email.personalized_subject && (
                                  <div className="text-muted-foreground text-xs truncate" title={email.personalized_subject}>
                                    Subject: {email.personalized_subject}
                                  </div>
                                )}
                                {email.opened_at && (() => {
                                  try {
                                    const openedDate = new Date(email.opened_at);
                                    if (!isNaN(openedDate.getTime())) {
                                      return (
                                        <div className="text-muted-foreground text-xs">
                                          ✓ Opened: {format(openedDate, 'MMM d, yyyy h:mm a')}
                                        </div>
                                      );
                                    }
                                  } catch (e) {
                                    return null;
                                  }
                                  return null;
                                })()}
                              </div>
                            );
                          })}
                          {personEmailHistory.length > 5 && (
                            <p className="text-xs text-muted-foreground text-center">
                              +{personEmailHistory.length - 5} more email{personEmailHistory.length - 5 > 1 ? 's' : ''}
                            </p>
                          )}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  )}
                </CardContent>
              </div>
            </Card>
            );
          })}
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
