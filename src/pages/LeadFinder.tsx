import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, Loader2, Building2, ExternalLink, Search, Database, Zap, Globe, Mail, Phone, ChevronLeft, ChevronRight, ChevronDown, FilterX, Download, RefreshCw, UserPlus, MoreVertical, Eye, Copy, StopCircle, X, AlertCircle, Clock, Linkedin, Facebook, Twitter, Instagram, Youtube, MapPin, FileSpreadsheet } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { GoogleMapsScraper } from "@/components/lead-finder/GoogleMapsScraper";
import { ImportCSVPanel } from "@/components/lead-finder/ImportCSVPanel";
import { CompanyListSearch } from "@/components/lead-finder/CompanyListSearch";
import { exportCompaniesToCSV } from "@/lib/utils/export";
import { ContactsList } from "@/components/lead-finder/ContactsList";
import { LeadCardSkeleton } from "@/components/lead-finder/LeadCardSkeleton";
import { useLeadFinderStream } from "@/hooks/use-lead-finder-stream";
import { useProviderStore } from "@/stores/provider-store";
import { useUIStore } from "@/stores/ui-store";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { CompanyDetailsDialog } from "@/components/CompanyDetailsDialog";
import { companiesApi } from "@/lib/api/companies";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useCompanyTags } from "@/hooks/use-company-tags";
import { industryTaxonomy, getIndustryCategories, getIndustrySubcategories, formatIndustryString } from "@/lib/data/industry-taxonomy";
import { QualityScoreBadge } from "@/components/lead-finder/QualityScoreBadge";
import { QualityStars } from "@/components/lead-finder/QualityStars";
import { DataCompletenessBar } from "@/components/lead-finder/DataCompletenessBar";
import { SourceBadges, SourcesSummary } from "@/components/lead-finder/SourceBadges";
const SIZE_OPTIONS = [
  { value: "1-10", label: "1-10 employees" },
  { value: "11-50", label: "11-50 employees" },
  { value: "51-200", label: "51-200 employees" },
  { value: "201-500", label: "201-500 employees" },
  { value: "500+", label: "500+ employees" },
];

/** Only show as main "website" if it's a real org site, not LinkedIn/Crunchbase. */
function isRealCompanyWebsite(url: string | null | undefined): boolean {
  if (!url || !url.trim()) return false;
  try {
    const host = new URL(url.startsWith("http") ? url : `https://${url}`).hostname.toLowerCase();
    return !host.includes("linkedin.com") && !host.includes("crunchbase.com");
  } catch {
    return false;
  }
}

export default function LeadFinder() {
  const [sizes, setSizes] = useState<string[]>([]);
  const [geography, setGeography] = useState("");
  const [industryCategories, setIndustryCategories] = useState<string[]>([]);
  const [industrySubcategories, setIndustrySubcategories] = useState<string[]>([]);
  const [subcategorySearch, setSubcategorySearch] = useState("");
  const [customSearchText, setCustomSearchText] = useState("");
  const [dryRun, setDryRun] = useState(true);
  const [enrichWithPerplexity, setEnrichWithPerplexity] = useState(true);
  const [useSerpApi, setUseSerpApi] = useState(false);
  const [useApify, setUseApify] = useState(false);
  /** Target number of leads to fetch per search (25–100). More = more API calls / results. */
  const [maxResults, setMaxResults] = useState<number>(50);
  const [selectedCompany, setSelectedCompany] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCompanyIndices, setSelectedCompanyIndices] = useState<Set<number>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [currentCompanyIndex, setCurrentCompanyIndex] = useState<number>(0);

  // Batch operation states
  const [isEnriching, setIsEnriching] = useState(false);
  const [isFindingContacts, setIsFindingContacts] = useState(false);

  // Filter states
  const [minQualityScore, setMinQualityScore] = useState<number>(0);
  const [mustHaveEmail, setMustHaveEmail] = useState(false);
  const [mustHaveLinkedIn, setMustHaveLinkedIn] = useState(false);
  const [mustHaveNews, setMustHaveNews] = useState(false);
  const [mustHaveFunding, setMustHaveFunding] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<'all' | 'exa' | 'serpapi' | 'google_maps' | 'apify'>('all');

  // Sorting state
  const [sortBy, setSortBy] = useState<'quality' | 'completeness' | 'alphabetical' | 'employees'>('quality');
  // Optional category when saving to CRM (e.g. "Real Estate Rentals") so leads are grouped for campaigns
  const [saveCategoryTag, setSaveCategoryTag] = useState<string>("");
  const [addToCrmDialogOpen, setAddToCrmDialogOpen] = useState(false);
  const { allSuggestions: categoryTagSuggestions } = useCompanyTags();
  const {
    defaultProvider,
    defaultModels
  } = useProviderStore();
  const [providerConfig, setProviderConfig] = useState<{
    provider: 'lovable' | 'openai' | 'perplexity';
    model: string | undefined;
  }>({
    provider: 'openai',
    model: 'gpt-4o-mini'
  });

  // Sync provider config with store changes
  useEffect(() => {
    setProviderConfig({
      provider: defaultProvider,
      model: defaultModels[defaultProvider] as string | undefined
    });
  }, [defaultProvider, defaultModels]);

  // When multiple industry categories are selected, subcategories don't apply
  useEffect(() => {
    if (industryCategories.length !== 1) {
      setIndustrySubcategories([]);
      setSubcategorySearch("");
    }
  }, [industryCategories.length]);
  const {
    leadFinderResults,
    setLeadFinderResults
  } = useUIStore();
  const streamingSearch = useLeadFinderStream();
  const queryClient = useQueryClient();
  const {
    toast
  } = useToast();

  // Handle page visibility changes - refresh when user returns
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Check for active search updates when page becomes visible
        const activeSearch = streamingSearch.hasActiveSearch;
        if (activeSearch) {
          console.log('Page visible - active search detected');
          // The hook already loads active search on mount, so just log
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [streamingSearch.hasActiveSearch]);
  const handleSearch = async (options?: {
    forceSave?: boolean;
  }) => {
    const shouldDryRun = options?.forceSave ? false : dryRun;
    const industryString = industryCategories.length === 1 && industrySubcategories.length > 0
      ? industrySubcategories.map(sub => formatIndustryString(industryCategories[0], sub)).join(', ')
      : industryCategories.join(', ');
    await streamingSearch.findLeads({
      size: sizes.join(', '),
      geography,
      industry: industryString,
      customSearchText,
      dryRun: shouldDryRun,
      provider: providerConfig.provider,
      model: providerConfig.model,
      enrichWithPerplexity,
      useSerpApi,
      useApify,
      maxResults,
    });
  };
  const handleCancelSearch = () => {
    streamingSearch.cancelSearch();
  };
  const handleNavigateCompany = (direction: 'prev' | 'next') => {
    if (!filteredAndSortedResults?.leads) return;
    let newIndex = currentCompanyIndex;
    if (direction === 'prev' && currentCompanyIndex > 0) {
      newIndex = currentCompanyIndex - 1;
    } else if (direction === 'next' && currentCompanyIndex < filteredAndSortedResults.leads.length - 1) {
      newIndex = currentCompanyIndex + 1;
    }
    setCurrentCompanyIndex(newIndex);
    setSelectedCompany(filteredAndSortedResults.leads[newIndex]);
  };
  const handleSaveSelectedCompanies = async () => {
    if (!filteredAndSortedResults?.leads || selectedCompanyIndices.size === 0) return;
    setIsSaving(true);
    try {
      const selectedCompanies = Array.from(selectedCompanyIndices).map(idx => filteredAndSortedResults.leads[idx]);
      let successCount = 0;
      let errorCount = 0;
      for (const company of selectedCompanies) {
        try {
          // Check if company already exists by website or name
          let existingCompany = null;

          // If website is a real org site (not LinkedIn/Crunchbase), check by website
          if (isRealCompanyWebsite(company.website)) {
            const normalized = company.website!.startsWith('http') ? company.website! : `https://${company.website}`;
            const { data } = await supabase.from('companies').select('id').eq('website', normalized).maybeSingle();
            existingCompany = data;
          }

          // If no website or no match found, check by name
          if (!existingCompany) {
            const {
              data
            } = await supabase.from('companies').select('id').ilike('name', company.name).maybeSingle();
            existingCompany = data;
          }
          if (existingCompany) {
            // Company already exists, skip
            console.log('Company already exists:', company.name);
            continue;
          }

          // Create company — only use real org website, not LinkedIn/Crunchbase
          const websiteValue = isRealCompanyWebsite(company.website) ? (company.website!.startsWith('http') ? company.website! : `https://${company.website}`) : `no-website-${crypto.randomUUID()}`;

          // Get current user
          const {
            data: {
              user
            }
          } = await supabase.auth.getUser();
          if (!user) {
            throw new Error('User not authenticated');
          }
          const {
            data: createdCompany,
            error: companyError
          } = await companiesApi.createCompany({
            name: company.name,
            website: websiteValue,
            description: company.description,
            industry: company.industry,
            size: company.size,
            user_id: user.id,
            geography: company.geography,
            linkedin_url: company.linkedinUrl,
            company_phone: company.companyPhone,
            general_email: company.generalEmail,
            social_profiles: company.socialProfiles,
            key_executives: company.keyExecutives,
            employee_count: company.employeeCount,
            enriched_at: company.wasEnriched ? new Date().toISOString() : undefined,
            enrichment_data: company.wasEnriched ? {
              products: company.products,
              recentNews: company.recentNews,
              fundingInfo: company.fundingInfo
            } : undefined,
            tags: ['Lead Finder', saveCategoryTag?.trim()].filter(Boolean)
          });
          if (companyError) {
            console.error('Error creating company:', companyError);
            errorCount++;
            continue;
          }

          // Create contacts if they exist
          if (company.contacts && company.contacts.length > 0 && createdCompany) {
            const {
              supabase
            } = await import("@/integrations/supabase/client");
            const contactsToInsert = company.contacts.map((contact: any) => ({
              company_id: createdCompany.id,
              name: contact.name,
              email: contact.email,
              email_verified: contact.emailVerified,
              linkedin_url: contact.linkedinUrl,
              title: contact.title,
              department: contact.department,
              phone: contact.phone,
              is_primary_contact: contact === company.primaryContact
            }));
            const {
              error: contactsError
            } = await supabase.from('contacts').insert(contactsToInsert);
            if (contactsError) {
              console.error('Error creating contacts:', contactsError);
            }
          }
          successCount++;
        } catch (error) {
          console.error('Error saving company:', error);
          errorCount++;
        }
      }

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({
        queryKey: ['companies']
      });
      queryClient.invalidateQueries({
        queryKey: ['pipeline-stats']
      });
      toast({
        title: 'Success',
        description: `Added ${successCount} ${successCount === 1 ? 'company' : 'companies'} to CRM${errorCount > 0 ? ` (${errorCount} failed)` : ''}`
      });

      // Clear selection after saving
      setSelectedCompanyIndices(new Set());
    } catch (error) {
      console.error('Error saving companies:', error);
      toast({
        title: 'Error',
        description: 'Failed to save companies to CRM',
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  };
  const toggleCompanySelection = (index: number) => {
    setSelectedCompanyIndices(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };
  const toggleSelectAll = () => {
    if (!filteredAndSortedResults?.leads) return;
    if (selectedCompanyIndices.size === filteredAndSortedResults.leads.length) {
      setSelectedCompanyIndices(new Set());
    } else {
      setSelectedCompanyIndices(new Set(filteredAndSortedResults.leads.map((_, idx) => idx)));
    }
  };
  const primaryIndustryCategory = industryCategories.length === 1 ? industryCategories[0] : null;
  const availableSubcategories = primaryIndustryCategory ? getIndustrySubcategories(primaryIndustryCategory) : [];
  const filteredSubcategories = availableSubcategories.filter(sub => sub.toLowerCase().includes(subcategorySearch.toLowerCase()));
  const isFormValid = (sizes.length > 0 && geography && industryCategories.length > 0) || customSearchText.trim().length > 0;
  const isLoading = streamingSearch.isLoading;

  // Create results object compatible with existing code
  const results = streamingSearch.leads.length > 0 ? {
    leads: streamingSearch.leads,
    inserted: 0,
    dryRun,
    provider: providerConfig.provider,
    model: providerConfig.model || '',
    usage: streamingSearch.usage || {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      estimatedCost: 0
    },
    wasEnriched: enrichWithPerplexity,
    traceUrl: streamingSearch.traceUrl || '',
    stats: streamingSearch.stats
  } : null;

  // Debug logging for stored results
  console.log('Lead Finder State:', {
    hasLeads: streamingSearch.leads.length,
    hasStoredResults: streamingSearch.hasStoredResults,
    resultsObject: results ? 'exists' : 'null',
    isLoading
  });

  // Filter and sort results
  const filteredAndSortedResults = results ? {
    ...results,
    leads: (() => {
      let filtered = results.leads.filter((company: any) => {
        // Quality score filter
        if (company.qualityScore !== undefined && company.qualityScore < minQualityScore) {
          return false;
        }

        // Must have email filter - check generalEmail OR contacts with email
        if (mustHaveEmail) {
          const hasGeneralEmail = company.generalEmail && company.generalEmail.trim();
          const hasContactEmail = company.contacts && company.contacts.some((c: any) => c.email && c.email.trim());
          if (!hasGeneralEmail && !hasContactEmail) {
            return false;
          }
        }

        // Must have LinkedIn filter
        if (mustHaveLinkedIn && !company.linkedinUrl) {
          return false;
        }

        // Must have news filter
        if (mustHaveNews && !company.recentNews) {
          return false;
        }

        // Must have funding filter
        if (mustHaveFunding && !company.fundingInfo) {
          return false;
        }

        // Source filter
        if (sourceFilter !== 'all') {
          const companySource = company.source || 'exa';
          if (companySource !== sourceFilter) {
            return false;
          }
        }

        return true;
      });

      // Sort
      const sorted = [...filtered].sort((a: any, b: any) => {
        switch (sortBy) {
          case 'quality':
            return (b.qualityScore || 0) - (a.qualityScore || 0);
          case 'completeness':
            return (b.dataCompleteness || 0) - (a.dataCompleteness || 0);
          case 'alphabetical':
            return (a.name || '').localeCompare(b.name || '');
          case 'employees':
            return (b.employeeCount || 0) - (a.employeeCount || 0);
          default:
            return 0;
        }
      });
      return sorted;
    })()
  } : null;
  const clearFilters = () => {
    setMinQualityScore(0);
    setMustHaveEmail(false);
    setMustHaveLinkedIn(false);
    setMustHaveNews(false);
    setMustHaveFunding(false);
    setSortBy('quality');
    setSourceFilter('all');
  };
  const hasActiveFilters = minQualityScore > 0 || mustHaveEmail || mustHaveLinkedIn || mustHaveNews || mustHaveFunding || sortBy !== 'quality' || sourceFilter !== 'all';

  // Copy email to clipboard
  const handleCopyEmail = (email: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(email);
    toast({
      title: 'Copied',
      description: 'Email copied to clipboard'
    });
  };

  // Batch action handlers
  const handleExportSelected = () => {
    if (!filteredAndSortedResults?.leads || selectedCompanyIndices.size === 0) return;
    const selectedCompanies = Array.from(selectedCompanyIndices).map(idx => filteredAndSortedResults.leads[idx]);
    exportCompaniesToCSV(selectedCompanies, 'selected_leads');
    toast({
      title: 'Success',
      description: `Exported ${selectedCompanies.length} ${selectedCompanies.length === 1 ? 'company' : 'companies'} to CSV`
    });
  };
  const handleExportAll = () => {
    if (!filteredAndSortedResults?.leads) return;
    exportCompaniesToCSV(filteredAndSortedResults.leads, 'all_leads');
    toast({
      title: 'Success',
      description: `Exported ${filteredAndSortedResults.leads.length} ${filteredAndSortedResults.leads.length === 1 ? 'company' : 'companies'} to CSV`
    });
  };
  const handleEnrichSelected = async () => {
    if (!filteredAndSortedResults?.leads || selectedCompanyIndices.size === 0) return;
    setIsEnriching(true);
    try {
      const selectedCompanies = Array.from(selectedCompanyIndices).map(idx => filteredAndSortedResults.leads[idx]);
      const {
        supabase
      } = await import("@/integrations/supabase/client");
      
      toast({
        title: 'Enriching Companies',
        description: `Enriching ${selectedCompanies.length} companies with AI...`,
      });

      // Prepare leads for enrichment
      const leadsToEnrich = selectedCompanies.map(company => ({
        name: company.name,
        website: company.website,
        industry: company.industry,
        geography: company.geography,
      }));

      // Call the enrich-leads function
      const { data, error } = await supabase.functions.invoke('enrich-leads', {
        body: {
          leads: leadsToEnrich,
          provider: 'perplexity',
        },
      });

      if (error) throw error;

      // Handle streaming response
      if (data instanceof ReadableStream) {
        const reader = data.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let enrichedLeads: any[] = [];
        let successCount = 0;
        let failedCount = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const event = JSON.parse(line.slice(6));
                if (event.type === 'enriched') {
                  successCount++;
                } else if (event.type === 'failed') {
                  failedCount++;
                } else if (event.type === 'complete' && event.enrichedLeads) {
                  enrichedLeads = event.enrichedLeads;
                }
              } catch (e) {
                console.error('Error parsing SSE event:', e);
              }
            }
          }
        }

        // Update the leads with enriched data
        if (enrichedLeads.length > 0) {
          const updatedLeads = filteredAndSortedResults.leads.map((lead: any, idx: number) => {
            if (selectedCompanyIndices.has(idx)) {
              const enriched = enrichedLeads.find((e: any) => 
                e.name === lead.name || e.website === lead.website
              );
              if (enriched) {
                return {
                  ...lead,
                  ...enriched,
                  wasEnriched: true,
                  enrichmentTier: 'deep',
                };
              }
            }
            return lead;
          });

          // Update the results
          setLeadFinderResults({
            ...filteredAndSortedResults,
            leads: updatedLeads,
            wasEnriched: true,
          });

          toast({
            title: 'Enrichment Complete',
            description: `Enriched ${successCount} ${successCount === 1 ? 'company' : 'companies'}${failedCount > 0 ? ` (${failedCount} failed)` : ''}`,
          });
        }
      } else {
        // Non-streaming response
        toast({
          title: 'Enrichment Complete',
          description: `Enriched ${selectedCompanies.length} companies`,
        });
      }
    } catch (error) {
      console.error('Error in batch enrichment:', error);
      toast({
        title: 'Error',
        description: 'Failed to enrich selected companies',
        variant: 'destructive'
      });
    } finally {
      setIsEnriching(false);
    }
  };
  const handleFindMoreContacts = async () => {
    if (!filteredAndSortedResults?.leads || selectedCompanyIndices.size === 0) return;
    setIsFindingContacts(true);
    try {
      const selectedCompanies = Array.from(selectedCompanyIndices).map(idx => {
        const company = filteredAndSortedResults.leads[idx];
        return {
          name: company.name,
          website: company.website
        };
      });
      const {
        supabase
      } = await import("@/integrations/supabase/client");
      const {
        data,
        error
      } = await supabase.functions.invoke('find-additional-contacts', {
        body: {
          companies: selectedCompanies
        }
      });
      if (error) throw error;
      const totalFound = data?.totalContactsFound || 0;
      const companiesWithContacts = data?.companiesWithContacts || 0;
      toast({
        title: 'Contact Discovery Complete',
        description: `Found ${totalFound} additional contacts across ${companiesWithContacts} ${companiesWithContacts === 1 ? 'company' : 'companies'}`
      });

      // Optionally trigger a re-search to refresh data
      if (totalFound > 0) {
        await handleSearch();
      }
    } catch (error) {
      console.error('Error finding contacts:', error);
      toast({
        title: 'Error',
        description: 'Failed to find additional contacts',
        variant: 'destructive'
      });
    } finally {
      setIsFindingContacts(false);
    }
  };
  return <div className="h-screen flex flex-col bg-background">
      {/* Active Search Recovery Banner */}
      {streamingSearch.hasActiveSearch && !streamingSearch.isLoading && streamingSearch.currentStatus !== 'Complete' && <Alert className="sticky top-0 z-20 rounded-none border-x-0 border-t-0 bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-900">
          <RefreshCw className="h-4 w-4 text-orange-600 dark:text-orange-400" />
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between flex-wrap gap-2">
            <div className="flex-1 min-w-0">
              <div className="text-sm text-orange-900 dark:text-orange-100 font-medium mb-1">
                🔄 Search in Progress ({streamingSearch.progress}% complete)
              </div>
              <div className="text-xs text-orange-700 dark:text-orange-300">
                {streamingSearch.leads.length} leads found so far • {streamingSearch.currentStatus}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="h-7 text-xs text-orange-700 dark:text-orange-300 hover:text-orange-900 dark:hover:text-orange-100 hover:bg-orange-100 dark:hover:bg-orange-900/50" onClick={() => {
            streamingSearch.resumeActiveSearch();
            window.scrollTo({
              top: document.body.scrollHeight,
              behavior: 'smooth'
            });
            toast({
              title: 'Viewing Partial Results',
              description: `Currently showing ${streamingSearch.leads.length} leads found so far`
            });
          }}>
                <Eye className="h-3 w-3 mr-1" />
                View Progress
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs text-orange-700 dark:text-orange-300 hover:text-orange-900 dark:hover:text-orange-100 hover:bg-orange-100 dark:hover:bg-orange-900/50" onClick={() => {
            streamingSearch.clearActiveSearch();
            toast({
              title: 'Search Cancelled',
              description: 'Active search has been cancelled'
            });
          }}>
                <X className="h-3 w-3 mr-1" />
                Cancel
              </Button>
            </div>
          </AlertDescription>
        </Alert>}

      {/* Stored Results Banner */}
      {streamingSearch.hasStoredResults && streamingSearch.leads.length > 0 && !streamingSearch.hasActiveSearch && <Alert className="sticky top-0 z-10 rounded-none border-x-0 border-t-0 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900">
          <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm text-blue-900 dark:text-blue-100 font-medium">
              💾 You have {streamingSearch.leads.length} saved lead{streamingSearch.leads.length !== 1 ? 's' : ''} from your previous search
            </span>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 text-xs text-blue-700 dark:text-blue-300 hover:text-blue-900 dark:hover:text-blue-100 hover:bg-blue-100 dark:hover:bg-blue-900/50">
                  <X className="h-3 w-3 mr-1" />
                  Clear
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear saved results?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete {streamingSearch.leads.length} saved lead{streamingSearch.leads.length !== 1 ? 's' : ''} from your browser storage. 
                    This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => streamingSearch.clearStoredResults()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Clear Results
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </AlertDescription>
        </Alert>}
      
      {/* Background Search Indicator (Floating) */}
      {streamingSearch.hasActiveSearch && streamingSearch.isLoading && <div className="fixed bottom-4 right-4 z-50 bg-card border shadow-lg rounded-lg p-3 max-w-xs animate-in slide-in-from-bottom-4">
          <div className="flex items-start gap-3">
            <Loader2 className="h-4 w-4 animate-spin text-primary flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium mb-1">
                {streamingSearch.websiteScrapingProgress ? 'Scraping Websites' : 'Finding Leads in Background'}
              </div>
              <div className="text-xs text-muted-foreground truncate">{streamingSearch.currentStatus}</div>
              {streamingSearch.websiteScrapingProgress && streamingSearch.websiteScrapingProgress.total > 0 && (
                <div className="text-[10px] text-muted-foreground mt-1">
                  <Globe className="h-3 w-3 inline mr-1" />
                  {streamingSearch.websiteScrapingProgress.completed}/{streamingSearch.websiteScrapingProgress.total} websites
                </div>
              )}
              <Progress value={streamingSearch.progress} className="h-1 mt-2" />
            </div>
          </div>
        </div>}
      
      {/* Top Bar */}
      <div className="border-b bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between h-14 px-4 md:px-6">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="flex items-center justify-center w-7 h-7 md:w-8 md:h-8 rounded-lg bg-primary/10">
              <Search className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary" />
            </div>
            <div>
              <h1 className="text-base md:text-lg font-semibold tracking-tight">Lead Command Center</h1>
              <p className="text-xs md:text-sm text-muted-foreground hidden sm:block">AI Search • Google Maps • CSV Import</p>
            </div>
          </div>
          
          {results && <div className="hidden md:flex items-center gap-4 text-xs">
              <div className="flex items-center gap-2">
                <Database className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-mono">{results.leads.length}</span>
                <span className="text-muted-foreground">companies</span>
              </div>
              <Separator orientation="vertical" className="h-4" />
              <div className="flex items-center gap-2">
                <Zap className="h-3.5 w-3.5 text-muted-foreground" />
                
              </div>
            </div>}
        </div>
      </div>

      {/* Main Content with Tabs */}
      <Tabs defaultValue="ai-search" className="flex-1 flex flex-col overflow-hidden">
        <div className="border-b px-4 md:px-6 bg-background/50">
          <TabsList className="h-10">
            <TabsTrigger value="ai-search" className="gap-2 text-xs">
              <Sparkles className="h-3.5 w-3.5" />
              AI Search
            </TabsTrigger>
            <TabsTrigger value="google-maps" className="gap-2 text-xs">
              <MapPin className="h-3.5 w-3.5" />
              Google Maps
            </TabsTrigger>
            <TabsTrigger value="import-csv" className="gap-2 text-xs">
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Import CSV
            </TabsTrigger>
            <TabsTrigger value="company-list" className="gap-2 text-xs">
              <Database className="h-3.5 w-3.5" />
              Company List
            </TabsTrigger>
          </TabsList>
        </div>

        {/* AI Search Tab */}
        <TabsContent value="ai-search" className="flex-1 flex flex-col md:flex-row overflow-hidden mt-0 data-[state=inactive]:hidden">
        {/* Left Panel - Search Config */}
        <div className="w-full md:w-80 border-b md:border-b-0 md:border-r bg-card/30 backdrop-blur supports-[backdrop-filter]:bg-card/30 flex flex-col overflow-y-auto max-h-[50vh] md:max-h-none">
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 md:space-y-6">
            {/* Search Parameters */}
            <div className="space-y-3 md:space-y-4">
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Search Parameters
                </h2>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="size" className="text-xs font-medium">Company Size</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" role="combobox" id="size" className="w-full min-h-9 h-auto justify-between text-xs font-normal py-2">
                          <span className="text-left flex-1 truncate">
                            {sizes.length === 0
                              ? "Select size(s)"
                              : sizes.length === 1
                                ? SIZE_OPTIONS.find(o => o.value === sizes[0])?.label ?? sizes[0]
                                : `${sizes.length} selected`}
                          </span>
                          <ChevronDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                        <ScrollArea className="h-[220px]">
                          <div className="p-2 space-y-1">
                            {sizes.length > 0 && (
                              <Button variant="ghost" size="sm" className="w-full h-7 text-xs text-muted-foreground mb-1" onClick={() => setSizes([])}>
                                Clear all ({sizes.length})
                              </Button>
                            )}
                            {SIZE_OPTIONS.map(opt => (
                              <div
                                key={opt.value}
                                className="flex items-center space-x-2 px-2 py-1.5 hover:bg-accent rounded-md cursor-pointer"
                                onClick={() => setSizes(prev => prev.includes(opt.value) ? prev.filter(s => s !== opt.value) : [...prev, opt.value])}
                              >
                                <Checkbox checked={sizes.includes(opt.value)} />
                                <span className="text-xs">{opt.label}</span>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="geography" className="text-xs font-medium">Geography</Label>
                    <Input id="geography" placeholder="e.g., United Kingdom" value={geography} onChange={e => setGeography(e.target.value)} className="h-9 text-xs" />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="industry-category" className="text-xs font-medium">Industry Category</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" role="combobox" id="industry-category" className="w-full min-h-9 h-auto justify-between text-xs font-normal py-2">
                          <span className="text-left flex-1 truncate">
                            {industryCategories.length === 0
                              ? "Select category(ies)"
                              : industryCategories.length === 1
                                ? industryCategories[0]
                                : `${industryCategories.length} selected`}
                          </span>
                          <ChevronDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[var(--radix-popover-trigger-width)] max-h-[300px] p-0" align="start">
                        <ScrollArea className="h-[260px]">
                          <div className="p-2 space-y-1">
                            {industryCategories.length > 0 && (
                              <Button variant="ghost" size="sm" className="w-full h-7 text-xs text-muted-foreground mb-1" onClick={() => { setIndustryCategories([]); setIndustrySubcategories([]); setSubcategorySearch(""); }}>
                                Clear all ({industryCategories.length})
                              </Button>
                            )}
                            {getIndustryCategories().map(category => (
                              <div
                                key={category}
                                className="flex items-center space-x-2 px-2 py-1.5 hover:bg-accent rounded-md cursor-pointer"
                                onClick={() => {
                                  setIndustryCategories(prev =>
                                    prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]
                                  );
                                  if (industryCategories.length === 1 && industryCategories[0] === category) {
                                    setIndustrySubcategories([]);
                                    setSubcategorySearch("");
                                  }
                                }}
                              >
                                <Checkbox checked={industryCategories.includes(category)} />
                                <span className="text-xs">{category}</span>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </PopoverContent>
                    </Popover>
                  </div>

                  {primaryIndustryCategory && <div className="space-y-1.5">
                      <Label htmlFor="industry-subcategory" className="text-xs font-medium">Subcategories (Optional)</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" role="combobox" className="w-full min-h-9 h-auto justify-between text-xs font-normal py-2">
                            <span className="text-left flex-1 truncate">
                              {industrySubcategories.length === 0 
                                ? "Select subcategories" 
                                : industrySubcategories.length === 1 
                                  ? industrySubcategories[0]
                                  : `${industrySubcategories.length} selected`}
                            </span>
                            <ChevronDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                          <div className="p-2">
                            <Input placeholder="Search..." value={subcategorySearch} onChange={e => setSubcategorySearch(e.target.value)} className="h-8 text-xs mb-2" />
                            {industrySubcategories.length > 0 && (
                              <Button variant="ghost" size="sm" className="w-full h-7 text-xs text-muted-foreground mb-2" onClick={() => setIndustrySubcategories([])}>
                                Clear all ({industrySubcategories.length})
                              </Button>
                            )}
                            <ScrollArea className="h-[200px]">
                              <div className="space-y-1">
                                {filteredSubcategories.length > 0 ? filteredSubcategories.map(subcategory => (
                                  <div key={subcategory} className="flex items-center space-x-2 px-2 py-1.5 hover:bg-accent rounded-md cursor-pointer" onClick={() => {
                                    setIndustrySubcategories(prev =>
                                      prev.includes(subcategory)
                                        ? prev.filter(s => s !== subcategory)
                                        : [...prev, subcategory]
                                    );
                                  }}>
                                    <Checkbox checked={industrySubcategories.includes(subcategory)} />
                                    <span className="text-xs">{subcategory}</span>
                                  </div>
                                )) : <div className="p-2 text-xs text-muted-foreground text-center">
                                    No results found
                                  </div>}
                              </div>
                            </ScrollArea>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>}

                  <div className="space-y-1.5">
                    <Label htmlFor="custom-search" className="text-xs font-medium">Custom Search (Optional)</Label>
                    <Textarea id="custom-search" placeholder="e.g., Find me hospitals in Cardiff with 1-10 employees, specialised in taking care of old and disabled" value={customSearchText} onChange={e => setCustomSearchText(e.target.value)} className="text-xs min-h-[80px] resize-none" />
                    <p className="text-[10px] text-muted-foreground">
                      Describe your search in natural language to refine results
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* AI Provider */}
              <div className="space-y-3">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  AI Configuration
                </h2>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Provider</Label>
                  <Select value={providerConfig.provider} onValueChange={(value: any) => setProviderConfig({
                  provider: value,
                  model: value === 'lovable' ? 'google/gemini-2.5-flash' : value === 'perplexity' ? 'sonar' : 'gpt-4o-mini'
                })}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lovable">Lovable AI</SelectItem>
                      <SelectItem value="openai">OpenAI</SelectItem>
                      <SelectItem value="perplexity">Perplexity</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Model</Label>
                  <Select value={providerConfig.model} onValueChange={model => setProviderConfig({
                  ...providerConfig,
                  model
                })}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {providerConfig.provider === 'lovable' && <>
                          <SelectItem value="google/gemini-2.5-flash">Gemini 2.5 Flash</SelectItem>
                          <SelectItem value="google/gemini-2.5-pro">Gemini 2.5 Pro</SelectItem>
                          <SelectItem value="google/gemini-2.5-flash-lite">Gemini Flash Lite</SelectItem>
                        </>}
                      {providerConfig.provider === 'openai' && <>
                          <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                          <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                        </>}
                      {providerConfig.provider === 'perplexity' && <>
                          <SelectItem value="sonar">Sonar</SelectItem>
                          <SelectItem value="sonar-pro">Sonar Pro</SelectItem>
                        </>}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              {/* Options */}
              <div className="space-y-3">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Options
                </h2>
                <div className="space-y-2">
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-normal">Target leads per search</Label>
                    <Select value={String(maxResults)} onValueChange={v => setMaxResults(Number(v))}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="25">25</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="75">75</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="dryRun" checked={dryRun} onCheckedChange={checked => setDryRun(checked as boolean)} />
                    <Label htmlFor="dryRun" className="text-xs font-normal cursor-pointer">
                      Preview only (no CRM insert)
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox id="enrichWithPerplexity" checked={enrichWithPerplexity} onCheckedChange={checked => setEnrichWithPerplexity(checked as boolean)} />
                    <Label htmlFor="enrichWithPerplexity" className="text-xs font-normal cursor-pointer flex items-center gap-1">
                      <Sparkles className="h-3 w-3 text-primary" />
                      Enrich with Perplexity
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox id="useSerpApi" checked={useSerpApi} onCheckedChange={checked => setUseSerpApi(checked as boolean)} />
                    <Label htmlFor="useSerpApi" className="text-xs font-normal cursor-pointer flex items-center gap-1">
                      <Globe className="h-3 w-3 text-blue-500" />
                      Include Google Search (SerpAPI)
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox id="useApify" checked={useApify} onCheckedChange={checked => setUseApify(checked as boolean)} />
                    <Label htmlFor="useApify" className="text-xs font-normal cursor-pointer flex items-center gap-1">
                      <Search className="h-3 w-3 text-teal-500" />
                      Include Apify (extra sources)
                    </Label>
                  </div>
                </div>
              </div>

              {/* Filters & Sorting */}
              {results && <>
                  <Separator />
                  
                  <div className="space-y-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Filters & Sorting
                      </h2>
                      {hasActiveFilters && <Button variant="ghost" size="sm" onClick={clearFilters} className="h-6 text-xs px-2">
                          <FilterX className="h-3 w-3 mr-1" />
                          Clear
                        </Button>}
                    </div>

                    {/* Quality Score Slider */}
                    <div className="space-y-2">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <Label className="text-xs font-medium">Min Quality Score</Label>
                        <span className="text-xs font-mono text-muted-foreground">{minQualityScore}</span>
                      </div>
                      <Slider value={[minQualityScore]} onValueChange={value => setMinQualityScore(value[0])} min={0} max={100} step={5} className="py-2" />
                    </div>

                    {/* Sort Dropdown */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Sort By</Label>
                      <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="z-50 bg-popover">
                          <SelectItem value="quality">Quality Score (High to Low)</SelectItem>
                          <SelectItem value="completeness">Data Completeness (High to Low)</SelectItem>
                          <SelectItem value="alphabetical">Alphabetical (A-Z)</SelectItem>
                          <SelectItem value="employees">Employee Count (High to Low)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2 pt-1">
                      <div className="flex items-center space-x-2">
                        <Checkbox id="mustHaveEmail" checked={mustHaveEmail} onCheckedChange={checked => setMustHaveEmail(checked as boolean)} />
                        <Label htmlFor="mustHaveEmail" className="text-xs font-normal cursor-pointer">
                          Must have email
                        </Label>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Checkbox id="mustHaveLinkedIn" checked={mustHaveLinkedIn} onCheckedChange={checked => setMustHaveLinkedIn(checked as boolean)} />
                        <Label htmlFor="mustHaveLinkedIn" className="text-xs font-normal cursor-pointer">
                          Must have LinkedIn URL
                        </Label>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Checkbox id="mustHaveNews" checked={mustHaveNews} onCheckedChange={checked => setMustHaveNews(checked as boolean)} />
                        <Label htmlFor="mustHaveNews" className="text-xs font-normal cursor-pointer">
                          Must have recent news
                        </Label>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Checkbox id="mustHaveFunding" checked={mustHaveFunding} onCheckedChange={checked => setMustHaveFunding(checked as boolean)} />
                        <Label htmlFor="mustHaveFunding" className="text-xs font-normal cursor-pointer">
                          Must have funding info
                        </Label>
                      </div>
                    </div>
                  </div>
                </>}
            </div>
          </div>

          {/* Action Button */}
          <div className="p-4 md:p-6 border-t bg-card/50">
            <Button onClick={() => handleSearch()} disabled={!isFormValid || isLoading} className="w-full h-9 md:h-10" size="default">
              {isLoading ? <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  <span className="text-xs font-medium">Searching...</span>
                </> : <>
                  <Search className="mr-2 h-4 w-4" />
                  <span className="text-xs font-medium">Find Companies</span>
                </>}
            </Button>
            
            {/* Stop Search Button */}
            {isLoading && <Button onClick={handleCancelSearch} variant="outline" className="w-full h-9 md:h-10 mt-2" size="default">
                <StopCircle className="mr-2 h-4 w-4" />
                <span className="text-xs font-medium">Stop Search</span>
              </Button>}
          </div>
        </div>

        {/* Right Panel - Results */}
        <div className="flex-1 overflow-y-auto">
          {/* Progress Indicator */}
          {isLoading && <div className="p-4 md:p-6 space-y-3 border-b bg-secondary/20">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-sm font-medium">{streamingSearch.currentStatus}</span>
                </div>
                <span className="text-xs text-muted-foreground">{streamingSearch.leads.length} found</span>
              </div>
              <Progress value={streamingSearch.progress} className="h-2" />
            </div>}

          {isLoading && streamingSearch.leads.length === 0 ? <div className="p-4 md:p-6 space-y-3 md:space-y-4">
              {Array.from({
            length: 5
          }).map((_, i) => <LeadCardSkeleton key={i} />)}
            </div> : !results && !isLoading && streamingSearch.leads.length === 0 ? <div className="h-full flex items-center justify-center p-4">
              <div className="text-center space-y-4 max-w-md px-4">
                <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/5 flex items-center justify-center">
                  <Search className="h-8 w-8 text-primary/40" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-foreground mb-1">No search results yet</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Configure your search parameters and click "Find Companies" to discover leads
                  </p>
                </div>
                
                {/* Restore Stored Results */}
                {streamingSearch.hasStoredResults && streamingSearch.leads.length === 0 && <div className="pt-4 border-t">
                    <Alert className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900">
                      <Database className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      <AlertDescription className="text-xs">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between gap-3">
                          <div>
                            <p className="font-semibold mb-1 text-blue-900 dark:text-blue-100">Previous Results Available</p>
                            <p className="text-blue-700 dark:text-blue-300">You have saved results from a previous search.</p>
                          </div>
                          <Button size="sm" onClick={() => {
                      const restored = streamingSearch.restoreStoredResults();
                      if (!restored) {
                        toast({
                          title: 'No Results',
                          description: 'No previous results found',
                          variant: 'destructive'
                        });
                      }
                    }} className="h-7 text-xs whitespace-nowrap">
                            <RefreshCw className="h-3 w-3 mr-1" />
                            Load Results
                          </Button>
                        </div>
                      </AlertDescription>
                    </Alert>
                  </div>}
                
                {/* Resume Active Search */}
                {streamingSearch.hasActiveSearch && !isLoading && <div className="pt-4 border-t">
                    <Alert className="bg-primary/5 border-primary/20">
                      <AlertCircle className="h-4 w-4 text-primary" />
                      <AlertDescription className="text-xs text-foreground">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <p className="font-semibold mb-1">Active Search in Progress</p>
                            <p className="text-muted-foreground mb-2">
                              {streamingSearch.currentStatus || 'Background search is running...'}
                            </p>
                            {streamingSearch.progress > 0 && <div className="space-y-1">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-xs">
                                  <span>Progress</span>
                                  <span className="font-mono">{streamingSearch.progress}%</span>
                                </div>
                                <Progress value={streamingSearch.progress} className="h-1.5" />
                              </div>}
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => {
                        if (streamingSearch.leads.length > 0) {
                          toast({
                            title: 'Viewing Current Results',
                            description: `${streamingSearch.leads.length} leads found so far`
                          });
                          window.scrollTo({
                            top: 0,
                            behavior: 'smooth'
                          });
                        }
                      }} className="h-7 text-xs">
                              <Eye className="h-3 w-3 mr-1" />
                              View ({streamingSearch.leads.length})
                            </Button>
                          </div>
                        </div>
                      </AlertDescription>
                    </Alert>
                  </div>}
              </div>
            </div> : <div className="p-4 md:p-6 space-y-4">
              {/* Results Header */}
              <div className="flex flex-col gap-3 pb-3 border-b">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold">
                    {filteredAndSortedResults.leads.length} {filteredAndSortedResults.leads.length === 1 ? 'Company' : 'Companies'}
                  </h2>
                  {hasActiveFilters && results && filteredAndSortedResults.leads.length < results.leads.length && <Badge variant="outline" className="text-xs bg-orange-500/10 text-orange-600 border-orange-500/20">
                      {results.leads.length - filteredAndSortedResults.leads.length} filtered out
                    </Badge>}
                  {results.stats && results.stats.filtered > 0 && <Badge variant="outline" className="text-xs">
                      {results.stats.filtered} low quality (backend)
                    </Badge>}
                  {results.stats && results.stats.averageScore && <Badge variant="secondary" className="text-xs">
                      Avg Score: {results.stats.averageScore}/100
                    </Badge>}
                  {results.wasEnriched && <Badge variant="default" className="h-5 text-xs bg-gradient-primary">
                      <Sparkles className="h-3 w-3 mr-1" />
                      Enriched
                    </Badge>}
                </div>
                
                {/* Sources Summary */}
                <SourcesSummary leads={filteredAndSortedResults.leads} />
                
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {filteredAndSortedResults.dryRun && filteredAndSortedResults.leads.length > 0 && <div className="flex items-center gap-2">
                      <Checkbox id="select-all" checked={selectedCompanyIndices.size === filteredAndSortedResults.leads.length && filteredAndSortedResults.leads.length > 0} onCheckedChange={toggleSelectAll} />
                      <Label htmlFor="select-all" className="text-xs font-medium cursor-pointer">
                        Select All
                      </Label>
                    </div>}
                  
                  <div className="flex items-center gap-2 ml-auto">
                    {/* Batch Actions Dropdown */}
                    {filteredAndSortedResults.leads.length > 0 && <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="h-8 text-xs" disabled={isEnriching || isFindingContacts}>
                            <MoreVertical className="h-3 w-3 mr-1.5" />
                            Batch Actions
                            {(isEnriching || isFindingContacts) && <Loader2 className="h-3 w-3 ml-1.5 animate-spin" />}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 z-50 bg-popover">
                          <DropdownMenuItem onClick={handleExportSelected} disabled={selectedCompanyIndices.size === 0} className="cursor-pointer">
                            <Download className="h-3.5 w-3.5 mr-2" />
                            Export Selected to CSV
                            {selectedCompanyIndices.size > 0 && <span className="ml-auto text-xs text-muted-foreground">
                                ({selectedCompanyIndices.size})
                              </span>}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={handleExportAll} className="cursor-pointer">
                            <Download className="h-3.5 w-3.5 mr-2" />
                            Export All to CSV
                            <span className="ml-auto text-xs text-muted-foreground">
                              ({filteredAndSortedResults.leads.length})
                            </span>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={handleEnrichSelected} disabled={selectedCompanyIndices.size === 0 || isEnriching} className="cursor-pointer">
                            <RefreshCw className="h-3.5 w-3.5 mr-2" />
                            Enrich Selected
                            {selectedCompanyIndices.size > 0 && <span className="ml-auto text-xs text-muted-foreground">
                                ({selectedCompanyIndices.size})
                              </span>}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={handleFindMoreContacts} disabled={selectedCompanyIndices.size === 0 || isFindingContacts} className="cursor-pointer">
                            <UserPlus className="h-3.5 w-3.5 mr-2" />
                            Find More Contacts
                            {selectedCompanyIndices.size > 0 && <span className="ml-auto text-xs text-muted-foreground">
                                ({selectedCompanyIndices.size})
                              </span>}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>}

                    {filteredAndSortedResults.dryRun && filteredAndSortedResults.leads.length > 0 && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" title="Add these leads to a category for easier campaign targeting">
                              <span className="text-muted-foreground">Category:</span>
                              {saveCategoryTag ? <Badge variant="secondary" className="font-normal">{saveCategoryTag}</Badge> : <span className="text-muted-foreground">Optional</span>}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-72" align="end">
                            <div className="space-y-2">
                              <Label className="text-xs">Add to category (optional)</Label>
                              <p className="text-xs text-muted-foreground">e.g. Real Estate Rentals. New leads will get this tag so you can filter campaigns later.</p>
                              <Input
                                placeholder="e.g. Real Estate Rentals"
                                value={saveCategoryTag}
                                onChange={(e) => setSaveCategoryTag(e.target.value)}
                                list="lead-finder-category-list"
                                className="h-8 text-sm"
                              />
                              <datalist id="lead-finder-category-list">
                                {(categoryTagSuggestions || []).slice(0, 30).map((tag) => (
                                  <option key={tag} value={tag} />
                                ))}
                              </datalist>
                              {saveCategoryTag && (
                                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSaveCategoryTag("")}>Clear category</Button>
                              )}
                            </div>
                          </PopoverContent>
                        </Popover>
                        <Button size="sm" onClick={handleSaveSelectedCompanies} disabled={isLoading || isSaving || selectedCompanyIndices.size === 0} className="h-8 text-xs">
                          {isSaving ? <>
                            <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                            Saving...
                          </> : <>
                            <Database className="h-3 w-3 mr-1.5" />
                            Add {selectedCompanyIndices.size > 0 ? `${selectedCompanyIndices.size} ` : ''}to CRM
                          </>}
                        </Button>
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground whitespace-nowrap">
                      {filteredAndSortedResults.dryRun ? "Preview" : `${filteredAndSortedResults.inserted} added`}
                    </div>
                  </div>
                </div>
              </div>

              {/* Results List */}
              <div className="space-y-3 md:space-y-4">
                {filteredAndSortedResults.leads.map((company: any, idx: number) => <div key={idx} className="group relative rounded-lg border bg-card hover:shadow-md hover:border-primary/50 transition-all p-3 md:p-4 cursor-pointer animate-in fade-in slide-in-from-bottom-2" style={{
              animationDelay: `${idx * 50}ms`
            }} onClick={() => {
              setCurrentCompanyIndex(idx);
              setSelectedCompany(company);
              setDialogOpen(true);
            }}>
{/* Hover Quick Actions — moved into flex layout; no longer absolute to avoid overlapping email/phone row */}

                    <div className="flex flex-col h-full gap-3">
                      {/* Header with checkbox and icon */}
                      <div className="flex gap-3 md:gap-4">
                        {/* Selection Checkbox */}
                        {filteredAndSortedResults.dryRun && <div className="flex items-start pt-1">
                            <Checkbox checked={selectedCompanyIndices.has(idx)} onCheckedChange={() => toggleCompanySelection(idx)} onClick={e => e.stopPropagation()} />
                          </div>}
                        {/* Company Icon */}
                        <div className="shrink-0">
                          <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-gradient-primary flex items-center justify-center shadow-sm">
                            <Building2 className="h-4 w-4 md:h-5 md:w-5 text-white" />
                          </div>
                        </div>

                        {/* Company Header Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="flex items-center gap-2">
                                <h3 className="text-sm font-semibold text-foreground truncate">
                                  {company.name}
                                </h3>
                                {company.qualityScore !== undefined && <QualityScoreBadge score={company.qualityScore} />}
                              </div>
                              {company.qualityScore !== undefined && <QualityStars score={company.qualityScore} />}
                              {/* Website, Email, Phone row — only show real org website, not LinkedIn/Crunchbase */}
                              <div className="flex flex-wrap items-center gap-3">
                                {isRealCompanyWebsite(company.website) && <a href={company.website!.startsWith('http') ? company.website! : `https://${company.website}`} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1 font-mono" onClick={e => e.stopPropagation()}>
                                    <Globe className="h-3 w-3" />
                                    {company.website!.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}
                                    <ExternalLink className="h-2.5 w-2.5" />
                                  </a>}
                                {company.generalEmail && <a href={`mailto:${company.generalEmail}`} className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                    <Mail className="h-3 w-3" />
                                    {company.generalEmail}
                                  </a>}
                                {company.companyPhone && <a href={`tel:${company.companyPhone}`} className="text-xs text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                    <Phone className="h-3 w-3" />
                                    {company.companyPhone}
                                  </a>}
                              </div>
                              {/* Social Media Links */}
                              {company.socialProfiles && Object.keys(company.socialProfiles).some(k => company.socialProfiles[k]) && (
                                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                  {company.socialProfiles.linkedin && <a href={company.socialProfiles.linkedin} target="_blank" rel="noopener noreferrer" className="p-1 rounded hover:bg-muted transition-colors" onClick={e => e.stopPropagation()} title="LinkedIn">
                                      <Linkedin className="h-3.5 w-3.5 text-[#0A66C2]" />
                                    </a>}
                                  {company.socialProfiles.twitter && <a href={company.socialProfiles.twitter} target="_blank" rel="noopener noreferrer" className="p-1 rounded hover:bg-muted transition-colors" onClick={e => e.stopPropagation()} title="Twitter/X">
                                      <Twitter className="h-3.5 w-3.5 text-foreground" />
                                    </a>}
                                  {company.socialProfiles.facebook && <a href={company.socialProfiles.facebook} target="_blank" rel="noopener noreferrer" className="p-1 rounded hover:bg-muted transition-colors" onClick={e => e.stopPropagation()} title="Facebook">
                                      <Facebook className="h-3.5 w-3.5 text-[#1877F2]" />
                                    </a>}
                                  {company.socialProfiles.instagram && <a href={company.socialProfiles.instagram} target="_blank" rel="noopener noreferrer" className="p-1 rounded hover:bg-muted transition-colors" onClick={e => e.stopPropagation()} title="Instagram">
                                      <Instagram className="h-3.5 w-3.5 text-[#E4405F]" />
                                    </a>}
                                  {company.socialProfiles.youtube && <a href={company.socialProfiles.youtube} target="_blank" rel="noopener noreferrer" className="p-1 rounded hover:bg-muted transition-colors" onClick={e => e.stopPropagation()} title="YouTube">
                                      <Youtube className="h-3.5 w-3.5 text-[#FF0000]" />
                                    </a>}
                                  {company.socialProfiles.tiktok && <a href={company.socialProfiles.tiktok} target="_blank" rel="noopener noreferrer" className="p-1 rounded hover:bg-muted transition-colors text-xs" onClick={e => e.stopPropagation()} title="TikTok">
                                      <span className="font-bold">TT</span>
                                    </a>}
                                </div>
                              )}
                            </div>
                            {/* Right column — action buttons (hover) stacked above status badges */}
                            <div className="shrink-0 flex flex-col items-end gap-1.5">
                              {/* Action buttons — visible on card hover, no absolute overlap */}
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button variant="secondary" size="sm" className="h-7 px-2 text-xs shadow-sm" onClick={e => {
                                  e.stopPropagation();
                                  setCurrentCompanyIndex(idx);
                                  setSelectedCompany(company);
                                  setDialogOpen(true);
                                }}>
                                  <Eye className="h-3 w-3 mr-1" />
                                  View
                                </Button>
                                {company.primaryContact?.email && (
                                  <Button variant="secondary" size="sm" className="h-7 px-2 text-xs shadow-sm" onClick={e => handleCopyEmail(company.primaryContact.email, e)}>
                                    <Copy className="h-3 w-3 mr-1" />
                                    Email
                                  </Button>
                                )}
                                {filteredAndSortedResults.dryRun && (
                                  <Button variant="secondary" size="sm" className="h-7 px-2 text-xs shadow-sm" onClick={e => {
                                    e.stopPropagation();
                                    toggleCompanySelection(idx);
                                  }}>
                                    <Database className="h-3 w-3 mr-1" />
                                    Add
                                  </Button>
                                )}
                              </div>
                              {/* Status badges — always visible */}
                              <div className="flex flex-wrap justify-end gap-1">
                                {company.wasEnriched && (
                                  <Badge variant="outline" className="h-5 text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                                    ✓ Enriched
                                  </Badge>
                                )}
                                {company.contactCount > 0 && (
                                  <Badge variant="outline" className="h-5 text-xs bg-cyan-500/10 text-cyan-600 border-cyan-500/20">
                                    {company.contactCount} contact{company.contactCount > 1 ? 's' : ''}
                                  </Badge>
                                )}
                                {company.generalEmail && (
                                  <Badge variant="outline" className="h-5 text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                                    <Mail className="h-3 w-3 mr-1" />
                                    Email
                                  </Badge>
                                )}
                                {company.companyPhone && (
                                  <Badge variant="outline" className="h-5 text-xs bg-blue-500/10 text-blue-600 border-blue-500/20">
                                    <Phone className="h-3 w-3 mr-1" />
                                    Phone
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Company Info */}
                      <div className="flex-1 space-y-2">
                        {/* Description */}
                        {company.description && <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                            {company.description}
                          </p>}

                        {/* Data Completeness Bar */}
                        {company.dataCompleteness !== undefined && <DataCompletenessBar percentage={company.dataCompleteness} />}

                        {/* Enriched Data */}
                        {(company.products || company.recentNews || company.fundingInfo) && <div className="space-y-1 pt-1">
                            {company.products && <div className="text-xs">
                                <span className="font-medium text-foreground">Products:</span>{" "}
                                <span className="text-muted-foreground line-clamp-1">{typeof company.products === 'object' ? JSON.stringify(company.products) : String(company.products)}</span>
                              </div>}
                            {company.recentNews && <div className="text-xs">
                                <span className="font-medium text-foreground">News:</span>{" "}
                                <span className="text-muted-foreground line-clamp-1">{typeof company.recentNews === 'object' ? JSON.stringify(company.recentNews) : String(company.recentNews)}</span>
                              </div>}
                            {company.fundingInfo && <div className="text-xs">
                                <span className="font-medium text-foreground">Funding:</span>{" "}
                                <span className="text-muted-foreground line-clamp-1">
                                  {typeof company.fundingInfo === 'object'
                                    ? [
                                        company.fundingInfo.totalFunding && `Total: ${company.fundingInfo.totalFunding}`,
                                        company.fundingInfo.valuation && `Val: ${company.fundingInfo.valuation}`,
                                        company.fundingInfo.recentRounds && `Rounds: ${company.fundingInfo.recentRounds}`,
                                        company.fundingInfo.investors && `Investors: ${Array.isArray(company.fundingInfo.investors) ? company.fundingInfo.investors.join(', ') : company.fundingInfo.investors}`,
                                      ].filter(Boolean).join(' · ') || JSON.stringify(company.fundingInfo)
                                    : String(company.fundingInfo)}
                                </span>
                              </div>}
                          </div>}

                        {/* Source Badges */}
                        <SourceBadges source={company.source} wasEnriched={company.wasEnriched} hasVerifiedContacts={company.contacts?.some((c: any) => c.emailVerified)} hasPatternContacts={company.contacts?.some((c: any) => !c.emailVerified)} />

                        {/* Expandable Contacts List */}
                        {company.contacts && company.contacts.length > 0 && <ContactsList contacts={company.contacts.map((c: any) => ({
                    ...c,
                    isPrimary: c === company.primaryContact
                  }))} />}

                        {/* Meta Badges */}
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {company.industry && <Badge variant="outline" className="h-5 text-xs font-mono">
                              {company.industry}
                            </Badge>}
                          {company.size && <Badge variant="secondary" className="h-5 text-xs font-mono">
                              {company.size}
                            </Badge>}
                          {company.employeeCount && <Badge variant="secondary" className="h-5 text-xs font-mono">
                              {company.employeeCount} emp
                            </Badge>}
                          {company.geography && <Badge variant="outline" className="h-5 text-xs font-mono">
                              📍 {company.geography}
                            </Badge>}
                        </div>
                      </div>
                    </div>
                  </div>)}
              </div>
            </div>}
        </div>
        </TabsContent>

        {/* Google Maps Scraper Tab */}
        <TabsContent value="google-maps" className="flex-1 overflow-auto mt-0 p-6">
          <div className="max-w-2xl mx-auto">
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-2">Google Maps Scraper</h2>
              <p className="text-sm text-muted-foreground">
                Scrape local businesses from Google Maps with phone numbers, emails, and addresses
              </p>
            </div>
            <GoogleMapsScraper />
          </div>
        </TabsContent>

        {/* Import CSV Tab */}
        <TabsContent value="import-csv" className="flex-1 overflow-auto mt-0 p-6">
          <div className="max-w-2xl mx-auto">
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-2">Import from CSV</h2>
              <p className="text-sm text-muted-foreground">
                Upload CSV files from various sources including Apify exports and LinkedIn
              </p>
            </div>
            <ImportCSVPanel />
          </div>
        </TabsContent>

        {/* Company List Search Tab */}
        <TabsContent value="company-list" className="flex-1 overflow-auto mt-0 p-6">
          <div className="max-w-2xl mx-auto">
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-2">Search by Company List</h2>
              <p className="text-sm text-muted-foreground">
                Paste a list of company names or website URLs to search on Google Maps and enrich with AI
              </p>
            </div>
            <CompanyListSearch 
              onLeadsFound={(leads) => {
                // Add leads to the results
                if (leads && leads.length > 0) {
                  const formattedLeads = leads.map(lead => ({
                    ...lead,
                    qualityScore: lead.wasEnriched ? 75 : (lead.website ? 60 : 40),
                    dataCompleteness: lead.wasEnriched ? 85 : (lead.website && lead.phone ? 50 : 30),
                    source: lead.source || 'apify',
                    enrichmentTier: lead.wasEnriched ? 'deep' : undefined,
                    enrichmentStatus: lead.wasEnriched ? 'completed' : 'pending',
                    contacts: lead.email ? [{
                      name: lead.name,
                      email: lead.email,
                      emailVerified: false,
                    }] : [],
                    generalEmail: lead.email || null,
                    companyPhone: lead.phone || null,
                    linkedinUrl: lead.linkedin || null,
                    socialProfiles: lead.socialProfiles || {},
                    keyExecutives: lead.keyExecutives || [],
                    products: lead.products || null,
                    recentNews: lead.recentNews || null,
                    fundingInfo: lead.fundingInfo || null,
                    technologies: lead.technologies || null,
                    suggestedTags: lead.suggestedTags || [],
                  }));
                  
                  // Merge with existing leads or replace
                  const existingLeads = streamingSearch.leads || [];
                  const mergedLeads = [...existingLeads, ...formattedLeads];
                  
                  // Update the UI store with new leads
                  setLeadFinderResults({
                    leads: mergedLeads,
                    inserted: 0,
                    dryRun: false,
                    provider: 'apify',
                    model: 'enrich-leads',
                    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCost: 0 },
                    wasEnriched: formattedLeads.some(l => l.wasEnriched),
                    traceUrl: '',
                    stats: { 
                      total: mergedLeads.length, 
                      enriched: mergedLeads.filter(l => l.wasEnriched).length 
                    },
                  });
                  
                  toast({
                    title: 'Leads Found',
                    description: `Found ${formattedLeads.length} companies. ${formattedLeads.filter(l => l.wasEnriched).length} enriched with AI.`,
                  });
                }
              }}
            />
          </div>
        </TabsContent>
      </Tabs>

      <CompanyDetailsDialog company={selectedCompany} open={dialogOpen} onOpenChange={setDialogOpen} isSearching={isLoading} allCompanies={filteredAndSortedResults?.leads || []} currentIndex={currentCompanyIndex} onNavigate={handleNavigateCompany} />
    </div>;
}