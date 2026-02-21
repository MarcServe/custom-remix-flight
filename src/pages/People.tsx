import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Mail, Phone, Briefcase, Linkedin, Upload, Users, Send, Plus, UserPlus, Loader2, CheckCircle2, Filter, X, Clock, Tag, ChevronDown, Search, Trash2, RefreshCw } from "lucide-react";
import { ImportLeadsDialog } from "@/components/ImportLeadsDialog";
import { PersonDetailsDialog } from "@/components/PersonDetailsDialog";
import BulkEmailDialog from "@/components/BulkEmailDialog";
import { AddContactDialog } from "@/components/AddContactDialog";
import { useToast } from "@/hooks/use-toast";
import { TagInput, TagBadges } from "@/components/ui/tag-input";
import { useCompanyTags } from "@/hooks/use-company-tags";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EmailHistoryView } from "@/components/email/EmailHistoryView";
import { getCompanySource, SOURCE_TAG_LIST } from "@/lib/company-sources";

export default function People() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
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
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string | null>(null);
  const [groupByCategory, setGroupByCategory] = useState(true);
  const [expandedEmailHistory, setExpandedEmailHistory] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [openedFromDraft, setOpenedFromDraft] = useState(false);
  useEffect(() => {
    setOpenedFromDraft(!!window.opener);
  }, []);

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

  const SELECTED_PEOPLE_IDS_KEY = 'leadgenie_selected_people_ids';
  const hasRestoredPeopleSelection = useRef(false);

  // Restore selected people IDs from localStorage when people first load
  useEffect(() => {
    if (!people?.length || hasRestoredPeopleSelection.current) return;
    hasRestoredPeopleSelection.current = true;
    try {
      const raw = localStorage.getItem(SELECTED_PEOPLE_IDS_KEY);
      if (!raw) return;
      const ids = JSON.parse(raw) as string[];
      if (Array.isArray(ids) && ids.length > 0) {
        const validIds = ids.filter(id => people.some(p => p.id === id));
        if (validIds.length > 0) {
          setSelectedPeopleIds(new Set(validIds));
        }
      }
    } catch {
      // ignore
    }
  }, [people]);

  // Persist selected people IDs to localStorage when selection changes
  useEffect(() => {
    try {
      localStorage.setItem(SELECTED_PEOPLE_IDS_KEY, JSON.stringify(Array.from(selectedPeopleIds)));
    } catch {
      // ignore
    }
  }, [selectedPeopleIds]);

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

  const deleteSelectedMutation = useMutation({
    mutationFn: async (personIds: string[]) => {
      const { error } = await supabase
        .from("people")
        .delete()
        .in("id", personIds);
      if (error) throw error;
      return personIds.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["people"] });
      setSelectedPeopleIds(new Set());
      setDeleteDialogOpen(false);
      toast({
        title: "Contacts deleted",
        description: `${count} contact${count === 1 ? "" : "s"} removed.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Get all unique tags from people and their companies (prioritize intelligent tags)
  // Extract from both tags column AND enrichment_data.suggestedTags
  const allPeopleTags = useMemo(() => {
    const tagsSet = new Set<string>();
    let peopleWithTags = 0;
    let peopleWithCompanyTags = 0;
    let peopleWithEnrichmentData = 0;
    let peopleWithSuggestedTags = 0;
    
    if (people && Array.isArray(people)) {
      people.forEach((person, index) => {
        // Add person's own tags
        const personTags = (person as any).tags;
        if (personTags && Array.isArray(personTags) && personTags.length > 0) {
          peopleWithTags++;
          personTags.forEach((tag: string) => {
            if (tag && typeof tag === 'string' && tag.trim()) {
              tagsSet.add(tag.trim());
            }
          });
        }
        
        // Add company tags from tags column
        if (person.companies?.tags && Array.isArray(person.companies.tags) && person.companies.tags.length > 0) {
          peopleWithCompanyTags++;
          person.companies.tags.forEach((tag: string) => {
            if (tag && typeof tag === 'string' && tag.trim()) {
              tagsSet.add(tag.trim());
            }
          });
        }
        
        // Extract tags from company enrichment_data.suggestedTags
        if (person.companies?.enrichment_data) {
          peopleWithEnrichmentData++;
          const enrichmentData = person.companies.enrichment_data as any;
          
          // Check multiple possible paths for suggestedTags
          let suggestedTags = enrichmentData?.suggestedTags || 
                             enrichmentData?.suggested_tags ||
                             enrichmentData?.suggestedTagsArray ||
                             null;
          
          // If it's a string, try to parse it
          if (typeof suggestedTags === 'string') {
            try {
              const parsed = JSON.parse(suggestedTags);
              suggestedTags = parsed;
            } catch (e) {
              // Not JSON, might be comma-separated
              if (suggestedTags.includes(',')) {
                suggestedTags = suggestedTags.split(',').map((t: string) => t.trim()).filter(Boolean);
              }
            }
          }
          
          if (Array.isArray(suggestedTags) && suggestedTags.length > 0) {
            peopleWithSuggestedTags++;
            suggestedTags.forEach((tag: string) => {
              if (tag && typeof tag === 'string' && tag.trim()) {
                tagsSet.add(tag.trim());
              }
            });
          }
          
          // Debug first few companies
          if (index < 5) {
            console.log(`[People Tags] Person ${index}:`, {
              name: `${person.first_name} ${person.last_name}`,
              company: person.companies?.name,
              personTags: personTags || [],
              companyTags: person.companies?.tags || [],
              hasEnrichmentData: !!enrichmentData,
              suggestedTags: suggestedTags,
              enrichmentDataKeys: enrichmentData ? Object.keys(enrichmentData) : []
            });
          }
        }
      });
      
      console.log('[People Tags] Summary:', {
        totalPeople: people.length,
        peopleWithTags,
        peopleWithCompanyTags,
        peopleWithEnrichmentData,
        peopleWithSuggestedTags,
        totalUniqueTags: tagsSet.size,
        sampleTags: Array.from(tagsSet).slice(0, 20)
      });
    }
    
    return tagsSet;
  }, [people]);

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

  // Filter people by selected tags, industries, campaigns, and search query
  const filteredPeople = useMemo(() => {
    if (!people || !Array.isArray(people)) return [];
    
    return people.filter(person => {
      // Search filter - search across name, email, company name, title, phone, and company tags (group/category)
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const fullName = `${person.first_name || ''} ${person.last_name || ''}`.toLowerCase();
        const email = (person.email || '').toLowerCase();
        const companyName = (person.companies?.name || '').toLowerCase();
        const title = (person.title || '').toLowerCase();
        const phone = (person.phone || '').toLowerCase();
        const companyTags = (person.companies?.tags && Array.isArray(person.companies.tags))
          ? person.companies.tags.map((t: string) => String(t).toLowerCase()).filter(Boolean)
          : [];
        let suggestedTags: string[] = [];
        if (person.companies?.enrichment_data) {
          const ed = person.companies.enrichment_data as any;
          const raw = ed?.suggestedTags || ed?.suggested_tags || [];
          suggestedTags = (Array.isArray(raw) ? raw : []).map((t: string) => String(t).toLowerCase()).filter(Boolean);
        }
        const allCompanyTags = [...companyTags, ...suggestedTags];
        const matchesGroupOrCategory = allCompanyTags.some((tag: string) => tag.includes(query) || query.includes(tag));
        
        const matchesSearch = 
          fullName.includes(query) ||
          email.includes(query) ||
          companyName.includes(query) ||
          title.includes(query) ||
          phone.includes(query) ||
          matchesGroupOrCategory;
        
        if (!matchesSearch) {
          return false;
        }
      }
      
      // Tag filter - case-insensitive matching with trimmed tags and partial matching
      if (selectedTagFilters.length > 0) {
        // Get tags from person.tags array
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
          let possibleTags = enrichmentData?.suggestedTags || 
                            enrichmentData?.suggested_tags ||
                            enrichmentData?.suggestedTagsArray ||
                            null;
          
          // If it's a string, try to parse it
          if (typeof possibleTags === 'string') {
            try {
              const parsed = JSON.parse(possibleTags);
              possibleTags = parsed;
            } catch (e) {
              // Not JSON, might be comma-separated
              if (possibleTags.includes(',')) {
                possibleTags = possibleTags.split(',').map((t: string) => t.trim()).filter(Boolean);
              }
            }
          }
          
          if (Array.isArray(possibleTags) && possibleTags.length > 0) {
            suggestedTags = possibleTags.map((tag: string) => 
              typeof tag === 'string' ? tag.trim().toLowerCase() : String(tag).toLowerCase()
            ).filter(Boolean);
          }
        }
        
        // Combine all tag sources
        const allPersonTags = [...personTags, ...companyTags, ...suggestedTags];
        const selectedTagsLower = selectedTagFilters.map(tag => tag.trim().toLowerCase()).filter(Boolean);
        
        // Use OR logic with partial matching: person matches if they have ANY of the selected tags
        const hasTag = selectedTagsLower.length > 0 && selectedTagsLower.some(selectedTag => {
          // Exact match
          if (allPersonTags.includes(selectedTag)) return true;
          
          // Partial match - check if any person tag contains the selected tag or vice versa
          return allPersonTags.some(personTag => 
            personTag.includes(selectedTag) || selectedTag.includes(personTag)
          );
        });
        
        if (!hasTag) {
          return false;
        }
        
        // Debug: log first match
        if (people.indexOf(person) === 0) {
          console.log('[People Filter] ✅ First person matched:', {
            name: `${person.first_name} ${person.last_name}`,
            company: person.companies?.name,
            selectedTags: selectedTagFilters,
            personTags: personTags,
            companyTags: companyTags,
            suggestedTags: suggestedTags,
            allPersonTags: allPersonTags
          });
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

    // Group / category filter - show only contacts whose company has this tag (source or custom category)
    if (selectedGroupFilter) {
      const companyTags = (person.companies?.tags || []).map((t: string) => String(t).trim()).filter(Boolean);
      if (!companyTags.includes(selectedGroupFilter)) return false;
    }

      return true;
    }).sort((a, b) => {
      // Sort by created_at descending (newest first) to show recently added people first
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dateB - dateA; // Descending order (newest first)
    });
  }, [people, selectedTagFilters, selectedIndustryFilters, selectedCampaignFilter, selectedGroupFilter, emailHistory, searchQuery]);

  // Category options: source groups + custom tags (for Category dropdown)
  const categoryOptions = useMemo(() => {
    const sourceSet = new Set<string>(SOURCE_TAG_LIST);
    const custom = Array.from(allPeopleTags).filter((t) => !sourceSet.has(t)).sort();
    return [...SOURCE_TAG_LIST, ...custom];
  }, [allPeopleTags]);
  const customCategoryOptions = useMemo(
    () => categoryOptions.filter((t) => !(SOURCE_TAG_LIST as readonly string[]).includes(t)),
    [categoryOptions]
  );

  // Group filtered people by category/source for display (when groupByCategory is true)
  const peopleGroupedByCategory = useMemo(() => {
    if (!groupByCategory || !filteredPeople?.length) return null;
    const groups: Record<string, typeof filteredPeople> = {};
    const order = [...SOURCE_TAG_LIST, "Other"];
    order.forEach((label) => { groups[label] = []; });
    for (const person of filteredPeople) {
      const source = getCompanySource(person.companies || {}) || "Other";
      if (!groups[source]) groups[source] = [];
      groups[source].push(person);
    }
    return order.filter((label) => (groups[label]?.length ?? 0) > 0).map((label) => ({ label, people: groups[label] }));
  }, [groupByCategory, filteredPeople]);

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

  const toggleCategoryGroupSelection = (personIds: string[], e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedPeopleIds(prev => {
      const newSet = new Set(prev);
      const allSelected = personIds.every(id => newSet.has(id));
      if (allSelected) {
        personIds.forEach(id => newSet.delete(id));
      } else {
        personIds.forEach(id => newSet.add(id));
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

  // NEW badge only for people added within the last 24 hours
  const isPersonNew = (person: { created_at?: string | null }) => {
    if (!person?.created_at) return false;
    const createdDate = new Date(person.created_at);
    const hoursSinceCreation = (Date.now() - createdDate.getTime()) / (1000 * 60 * 60);
    return hoursSinceCreation <= 24;
  };

  const renderPersonCard = (person: typeof filteredPeople[0]) => {
    const fullName = `${person.first_name || ""} ${person.last_name || ""}`.trim() || person.email || "Unknown";
    const isSelected = selectedPeopleIds.has(person.id);
    const isNew = isPersonNew(person);
    return (
      <Card
        key={person.id}
        className={`cursor-pointer transition-all hover:shadow-md ${isSelected ? "ring-2 ring-primary border-primary" : ""}`}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("button")) return;
          setSelectedPerson(person);
          setDetailsDialogOpen(true);
        }}
      >
        <CardHeader className="pb-2">
          <div className="flex items-start gap-3">
            <div onClick={(e) => { e.stopPropagation(); togglePersonSelection(person.id); }}>
              <Checkbox checked={isSelected} />
            </div>
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-primary/10 text-primary">
                {(person.first_name?.[0] || person.last_name?.[0] || person.email?.[0] || "?").toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium truncate">{fullName}</span>
                {isNew && (
                  <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-600 border-purple-500/20">
                    NEW
                  </Badge>
                )}
              </div>
              {person.email && (
                <p className="text-xs text-muted-foreground truncate">{person.email}</p>
              )}
              {person.companies?.name && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Briefcase className="h-3 w-3" />
                  {person.companies.name}
                </p>
              )}
              {person.created_at && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Added {format(new Date(person.created_at), "MMM d, yyyy 'at' h:mm a")}
                </p>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={(e) => { e.stopPropagation(); setSelectedPerson(person); setDetailsDialogOpen(true); }}
            >
              View Details
            </Button>
            {person.email && (
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => { e.stopPropagation(); /* could open send email */ }}
              >
                <Mail className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
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
                  {(selectedTagFilters.length > 0 || searchQuery.trim()) && " (filtered)"}
                  {selectedPeopleIds.size > 0 && ` • ${selectedPeopleIds.size} selected`}
                </p>
              </div>
            </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap w-full sm:w-auto">
              {openedFromDraft && selectedPeopleIds.size > 0 ? (
                <>
                  <Button
                    variant="default"
                    size="lg"
                    className="w-full sm:w-auto"
                    onClick={() => {
                      try {
                        window.opener?.postMessage?.(
                          { type: "LEADGENIE_ADD_RECIPIENTS_TO_DRAFT" },
                          window.location.origin
                        );
                        toast({ title: "Added to campaign", description: "Return to the campaign tab to see the updated recipient list." });
                      } catch {
                        toast({ title: "Could not reach campaign tab", variant: "destructive" });
                      }
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add to campaign
                  </Button>
                  <Button
                    variant="default"
                    size="lg"
                    className="w-full sm:w-auto"
                    onClick={() => {
                      try {
                        window.opener?.postMessage?.(
                          { type: "LEADGENIE_REPLACE_RECIPIENTS_TO_DRAFT" },
                          window.location.origin
                        );
                        toast({ title: "Campaign list replaced", description: "Return to the campaign tab to see the updated recipient list." });
                      } catch {
                        toast({ title: "Could not reach campaign tab", variant: "destructive" });
                      }
                    }}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Replace campaign list
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    className="w-full sm:w-auto"
                    onClick={() => setBulkEmailDialogOpen(true)}
                  >
                    <Send className="mr-2 h-4 w-4" />
                    {selectedPeopleIds.size > 0 ? `Send new campaign (${selectedPeopleIds.size})` : "Send new campaign"}
                  </Button>
                </>
              ) : (
                <>
                  <Button 
                    onClick={() => setBulkEmailDialogOpen(true)} 
                    size="lg"
                    variant={selectedPeopleIds.size > 0 ? "default" : "outline"}
                    className="w-full sm:w-auto"
                  >
                    <Send className="mr-2 h-4 w-4" />
                    {selectedPeopleIds.size > 0 ? `Bulk Send (${selectedPeopleIds.size})` : "Send Bulk Email"}
                  </Button>
                  {selectedPeopleIds.size > 0 && (
                    <Button
                      variant="outline"
                      size="lg"
                      className="w-full sm:w-auto"
                      onClick={async () => {
                        const selected = people?.filter(p => selectedPeopleIds.has(p.id) && p.email) || [];
                        if (selected.length === 0) {
                          toast({ title: "No emails", description: "None of the selected people have email addresses.", variant: "destructive" });
                          return;
                        }
                        const prepared = selected.map((p: any) => ({
                          id: p.id,
                          first_name: p.first_name ?? '',
                          last_name: p.last_name ?? '',
                          email: p.email,
                          company_id: p.company_id,
                          companies: p.companies ? { id: p.companies.id, name: p.companies.name, tags: p.companies.tags || [] } : undefined,
                        }));
                        localStorage.setItem('leadgenie_draft_recipients', JSON.stringify(prepared));
                        navigate("/campaigns?tab=drafts", { state: { addToDraft: true } });
                        toast({ title: "Continue with draft", description: `${prepared.length} recipient(s) will be added to a draft.` });
                      }}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add to draft
                    </Button>
                  )}
                </>
              )}
              {selectedPeopleIds.size > 0 && (
                <>
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
                  <Button
                    variant="outline"
                    size="lg"
                    className="w-full sm:w-auto text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setDeleteDialogOpen(true)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete ({selectedPeopleIds.size})
                  </Button>
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
              <div className="flex items-center gap-4 flex-wrap">
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
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="group-by-category"
                    checked={groupByCategory}
                    onCheckedChange={(checked) => setGroupByCategory(!!checked)}
                  />
                  <label htmlFor="group-by-category" className="text-sm font-medium cursor-pointer">
                    Group by category
                  </label>
                </div>
              </div>
            )}
            
            {/* Group / Category filter - source groups + custom categories for targeted campaigns */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Users className="h-4 w-4" />
                  Category
                  {selectedGroupFilter && (
                    <Badge variant="secondary" className="ml-1">{selectedGroupFilter}</Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 max-h-[320px] overflow-y-auto" align="start">
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Filter by category</h4>
                  <p className="text-xs text-muted-foreground">Source groups or custom categories (e.g. Real Estate Rentals). Use for targeted campaigns.</p>
                  <Button
                    variant={selectedGroupFilter === null ? "secondary" : "ghost"}
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => setSelectedGroupFilter(null)}
                  >
                    All categories
                  </Button>
                  <p className="text-xs text-muted-foreground pt-1 pb-0.5">Source</p>
                  {SOURCE_TAG_LIST.map((label) => (
                    <Button
                      key={label}
                      variant={selectedGroupFilter === label ? "secondary" : "ghost"}
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => setSelectedGroupFilter(label)}
                    >
                      {label}
                    </Button>
                  ))}
                  {customCategoryOptions.length > 0 && (
                    <>
                      <p className="text-xs text-muted-foreground pt-2 pb-0.5">Custom</p>
                      {customCategoryOptions.map((label) => (
                        <Button
                          key={label}
                          variant={selectedGroupFilter === label ? "secondary" : "ghost"}
                          size="sm"
                          className="w-full justify-start"
                          onClick={() => setSelectedGroupFilter(label)}
                        >
                          {label}
                        </Button>
                      ))}
                    </>
                  )}
                </div>
              </PopoverContent>
            </Popover>
            
            {/* Search Input */}
            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search by name, email, company, or group..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-full sm:w-64"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                  onClick={() => setSearchQuery("")}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
            
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
                    {allPeopleTags.size} intelligent tags from your contacts. Select multiple tags to filter.
                  </p>
                </div>
              </PopoverContent>
            </Popover>
          </div>
          
          {/* Active Filters */}
          {(selectedTagFilters.length > 0 || selectedGroupFilter) && (
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-sm text-muted-foreground">Filtering by:</span>
              {selectedGroupFilter && (
                <Badge
                  variant="secondary"
                  className="gap-1 cursor-pointer"
                  onClick={() => setSelectedGroupFilter(null)}
                >
                  Category: {selectedGroupFilter}
                  <X className="h-3 w-3 ml-1" />
                </Badge>
              )}
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
        groupByCategory && peopleGroupedByCategory && peopleGroupedByCategory.length > 0 ? (
          <div className="space-y-6">
            {peopleGroupedByCategory.map(({ label, people: sectionPeople }) => {
              const sectionIds = sectionPeople.filter((p) => p.id && p.email).map((p) => p.id as string);
              const allSelected = sectionIds.length > 0 && sectionIds.every((id) => selectedPeopleIds.has(id));
              return (
                <div key={label} className="space-y-3">
                  <div
                    className="flex items-center gap-2 cursor-pointer group rounded-md py-1.5 px-1 -mx-1 hover:bg-muted/50"
                    onClick={(e) => toggleCategoryGroupSelection(sectionIds, e)}
                  >
                    <Checkbox checked={allSelected} onCheckedChange={() => {}} />
                    <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2 flex-1">
                      {label}
                      <Badge variant="secondary" className="text-xs">{sectionPeople.length}</Badge>
                    </h3>
                    <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                      {allSelected ? "Deselect all" : "Select all"}
                    </span>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {sectionPeople.map((person) => renderPersonCard(person))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredPeople.map((person) => renderPersonCard(person))}
        </div>
        )
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

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete selected contacts?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove {selectedPeopleIds.size} contact{selectedPeopleIds.size === 1 ? "" : "s"} from People. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteSelectedMutation.mutate(Array.from(selectedPeopleIds))}
              disabled={deleteSelectedMutation.isPending}
            >
              {deleteSelectedMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
