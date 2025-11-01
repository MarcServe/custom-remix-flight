import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Sparkles, Loader2, Building2, ExternalLink, Search, Database, Zap, Globe, Mail, ChevronLeft, ChevronRight, ChevronDown, FilterX } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { useLeadFinder } from "@/hooks/use-lead-finder";
import { useProviderStore } from "@/stores/provider-store";
import { useUIStore } from "@/stores/ui-store";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CompanyDetailsDialog } from "@/components/CompanyDetailsDialog";
import { companiesApi } from "@/lib/api/companies";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { industryTaxonomy, getIndustryCategories, getIndustrySubcategories, formatIndustryString } from "@/lib/data/industry-taxonomy";
import { QualityScoreBadge } from "@/components/lead-finder/QualityScoreBadge";
import { QualityStars } from "@/components/lead-finder/QualityStars";
import { DataCompletenessBar } from "@/components/lead-finder/DataCompletenessBar";
import { SourceBadges } from "@/components/lead-finder/SourceBadges";

export default function LeadFinder() {
  const [size, setSize] = useState("");
  const [geography, setGeography] = useState("");
  const [industryCategory, setIndustryCategory] = useState("");
  const [industrySubcategory, setIndustrySubcategory] = useState("");
  const [subcategorySearch, setSubcategorySearch] = useState("");
  const [dryRun, setDryRun] = useState(true);
  const [enrichWithPerplexity, setEnrichWithPerplexity] = useState(true);
  const [selectedCompany, setSelectedCompany] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCompanyIndices, setSelectedCompanyIndices] = useState<Set<number>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [currentCompanyIndex, setCurrentCompanyIndex] = useState<number>(0);
  
  // Filter states
  const [minQualityScore, setMinQualityScore] = useState<number>(0);
  const [mustHaveContacts, setMustHaveContacts] = useState(false);
  const [mustHaveLinkedIn, setMustHaveLinkedIn] = useState(false);
  const [mustHaveNews, setMustHaveNews] = useState(false);
  const [mustHaveFunding, setMustHaveFunding] = useState(false);
  
  // Sorting state
  const [sortBy, setSortBy] = useState<'quality' | 'completeness' | 'alphabetical' | 'employees'>('quality');
  
  const { defaultProvider, defaultModels } = useProviderStore();
  const [providerConfig, setProviderConfig] = useState<{
    provider: 'lovable' | 'openai' | 'perplexity';
    model: string | undefined;
  }>({
    provider: 'openai',
    model: 'gpt-4o-mini',
  });

  // Sync provider config with store changes
  useEffect(() => {
    setProviderConfig({
      provider: defaultProvider,
      model: defaultModels[defaultProvider] as string | undefined,
    });
  }, [defaultProvider, defaultModels]);

  const { leadFinderResults, setLeadFinderResults } = useUIStore();
  const leadFinderMutation = useLeadFinder();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleSearch = async (options?: { forceSave?: boolean }) => {
    // If forceSave is true, we want to save to DB (dryRun: false)
    // Otherwise, use the dryRun checkbox value
    const shouldDryRun = options?.forceSave ? false : dryRun;
    
    // Use the helper function to format industry string
    const industryString = industrySubcategory 
      ? formatIndustryString(industryCategory, industrySubcategory)
      : industryCategory;
    
    const { data } = await leadFinderMutation.mutateAsync({
      size,
      geography,
      industry: industryString,
      dryRun: shouldDryRun,
      provider: providerConfig.provider,
      model: providerConfig.model,
      enrichWithPerplexity,
    });

    if (data) {
      setLeadFinderResults(data.leads);
      setSelectedCompanyIndices(new Set()); // Reset selection on new search
    }
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
          // Create company
          const { data: createdCompany, error: companyError } = await companiesApi.createCompany({
            name: company.name,
            website: company.website,
            description: company.description,
            industry: company.industry,
            size: company.size,
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
              fundingInfo: company.fundingInfo,
            } : undefined,
          });

          if (companyError) {
            console.error('Error creating company:', companyError);
            errorCount++;
            continue;
          }

          // Create contacts if they exist
          if (company.contacts && company.contacts.length > 0 && createdCompany) {
            const { supabase } = await import("@/integrations/supabase/client");
            const contactsToInsert = company.contacts.map((contact: any) => ({
              company_id: createdCompany.id,
              name: contact.name,
              email: contact.email,
              email_verified: contact.emailVerified,
              linkedin_url: contact.linkedinUrl,
              title: contact.title,
              department: contact.department,
              phone: contact.phone,
              is_primary_contact: contact === company.primaryContact,
            }));

            const { error: contactsError } = await supabase
              .from('contacts')
              .insert(contactsToInsert);

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
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      queryClient.invalidateQueries({ queryKey: ['pipeline-stats'] });

      toast({
        title: 'Success',
        description: `Added ${successCount} ${successCount === 1 ? 'company' : 'companies'} to CRM${errorCount > 0 ? ` (${errorCount} failed)` : ''}`,
      });

      // Clear selection after saving
      setSelectedCompanyIndices(new Set());
    } catch (error) {
      console.error('Error saving companies:', error);
      toast({
        title: 'Error',
        description: 'Failed to save companies to CRM',
        variant: 'destructive',
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

  const availableSubcategories = industryCategory 
    ? getIndustrySubcategories(industryCategory)
    : [];

  const filteredSubcategories = availableSubcategories.filter(sub =>
    sub.toLowerCase().includes(subcategorySearch.toLowerCase())
  );

  const isFormValid = size && geography && industryCategory;
  const isLoading = leadFinderMutation.isPending;
  const results = leadFinderMutation.data?.data;

  // Filter and sort results
  const filteredAndSortedResults = results ? {
    ...results,
    leads: (() => {
      let filtered = results.leads.filter((company: any) => {
        // Quality score filter
        if (company.qualityScore !== undefined && company.qualityScore < minQualityScore) {
          return false;
        }
        
        // Must have contacts filter
        if (mustHaveContacts && (!company.contacts || company.contacts.length === 0)) {
          return false;
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
    setMustHaveContacts(false);
    setMustHaveLinkedIn(false);
    setMustHaveNews(false);
    setMustHaveFunding(false);
    setSortBy('quality');
  };

  const hasActiveFilters = minQualityScore > 0 || mustHaveContacts || mustHaveLinkedIn || mustHaveNews || mustHaveFunding || sortBy !== 'quality';

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Top Bar */}
      <div className="border-b bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50">
        <div className="flex items-center justify-between h-14 px-4 md:px-6">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="flex items-center justify-center w-7 h-7 md:w-8 md:h-8 rounded-lg bg-primary/10">
              <Search className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary" />
            </div>
            <div>
              <h1 className="text-base md:text-lg font-semibold tracking-tight">AI Lead Finder</h1>
              <p className="text-xs md:text-sm text-muted-foreground hidden sm:block">Intelligent company discovery</p>
            </div>
          </div>
          
          {results && (
            <div className="hidden md:flex items-center gap-4 text-xs">
              <div className="flex items-center gap-2">
                <Database className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-mono">{results.leads.length}</span>
                <span className="text-muted-foreground">companies</span>
              </div>
              <Separator orientation="vertical" className="h-4" />
              <div className="flex items-center gap-2">
                <Zap className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-mono">${(results.usage.estimatedCost + (results.enrichmentUsage?.estimatedCost || 0)).toFixed(4)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
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
                    <Select value={size} onValueChange={setSize}>
                      <SelectTrigger id="size" className="h-9 text-xs">
                        <SelectValue placeholder="Select size" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1-10">1-10 employees</SelectItem>
                        <SelectItem value="11-50">11-50 employees</SelectItem>
                        <SelectItem value="51-200">51-200 employees</SelectItem>
                        <SelectItem value="201-500">201-500 employees</SelectItem>
                        <SelectItem value="500+">500+ employees</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="geography" className="text-xs font-medium">Geography</Label>
                    <Input
                      id="geography"
                      placeholder="e.g., United Kingdom"
                      value={geography}
                      onChange={(e) => setGeography(e.target.value)}
                      className="h-9 text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="industry-category" className="text-xs font-medium">Industry Category</Label>
                    <Select 
                      value={industryCategory} 
                      onValueChange={(value) => {
                        setIndustryCategory(value);
                        setIndustrySubcategory("");
                        setSubcategorySearch("");
                      }}
                    >
                      <SelectTrigger id="industry-category" className="h-9 text-xs">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[300px]">
                        {getIndustryCategories().map(category => (
                          <SelectItem key={category} value={category}>{category}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {industryCategory && (
                    <div className="space-y-1.5">
                      <Label htmlFor="industry-subcategory" className="text-xs font-medium">Subcategory (Optional)</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            className="w-full h-9 justify-between text-xs font-normal"
                          >
                            {industrySubcategory || "Select subcategory"}
                            <ChevronDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                          <div className="p-2">
                            <Input
                              placeholder="Search..."
                              value={subcategorySearch}
                              onChange={(e) => setSubcategorySearch(e.target.value)}
                              className="h-8 text-xs mb-2"
                            />
                            <ScrollArea className="h-[200px]">
                              <div className="space-y-1">
                                <Button
                                  variant="ghost"
                                  className="w-full h-8 justify-start text-xs font-normal"
                                  onClick={() => {
                                    setIndustrySubcategory("");
                                    setSubcategorySearch("");
                                  }}
                                >
                                  None
                                </Button>
                                {filteredSubcategories.length > 0 ? (
                                  filteredSubcategories.map((subcategory) => (
                                    <Button
                                      key={subcategory}
                                      variant="ghost"
                                      className="w-full h-8 justify-start text-xs font-normal"
                                      onClick={() => {
                                        setIndustrySubcategory(subcategory);
                                        setSubcategorySearch("");
                                      }}
                                    >
                                      {subcategory}
                                    </Button>
                                  ))
                                ) : (
                                  <div className="p-2 text-xs text-muted-foreground text-center">
                                    No results found
                                  </div>
                                )}
                              </div>
                            </ScrollArea>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  )}
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
                  <Select 
                    value={providerConfig.provider} 
                    onValueChange={(value: any) => setProviderConfig({
                      provider: value,
                      model: value === 'lovable' ? 'google/gemini-2.5-flash' : 
                             value === 'perplexity' ? 'sonar' : 
                             'gpt-4o-mini'
                    })}
                  >
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
                  <Select 
                    value={providerConfig.model} 
                    onValueChange={(model) => setProviderConfig({ ...providerConfig, model })}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {providerConfig.provider === 'lovable' && (
                        <>
                          <SelectItem value="google/gemini-2.5-flash">Gemini 2.5 Flash</SelectItem>
                          <SelectItem value="google/gemini-2.5-pro">Gemini 2.5 Pro</SelectItem>
                          <SelectItem value="google/gemini-2.5-flash-lite">Gemini Flash Lite</SelectItem>
                        </>
                      )}
                      {providerConfig.provider === 'openai' && (
                        <>
                          <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                          <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                        </>
                      )}
                      {providerConfig.provider === 'perplexity' && (
                        <>
                          <SelectItem value="sonar">Sonar</SelectItem>
                          <SelectItem value="sonar-pro">Sonar Pro</SelectItem>
                        </>
                      )}
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
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="dryRun"
                      checked={dryRun}
                      onCheckedChange={(checked) => setDryRun(checked as boolean)}
                    />
                    <Label htmlFor="dryRun" className="text-xs font-normal cursor-pointer">
                      Preview only (no CRM insert)
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="enrichWithPerplexity"
                      checked={enrichWithPerplexity}
                      onCheckedChange={(checked) => setEnrichWithPerplexity(checked as boolean)}
                    />
                    <Label htmlFor="enrichWithPerplexity" className="text-xs font-normal cursor-pointer flex items-center gap-1">
                      <Sparkles className="h-3 w-3 text-primary" />
                      Enrich with Perplexity
                    </Label>
                  </div>
                </div>
              </div>

              {/* Filters & Sorting */}
              {results && (
                <>
                  <Separator />
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Filters & Sorting
                      </h2>
                      {hasActiveFilters && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={clearFilters}
                          className="h-6 text-xs px-2"
                        >
                          <FilterX className="h-3 w-3 mr-1" />
                          Clear
                        </Button>
                      )}
                    </div>

                    {/* Quality Score Slider */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-medium">Min Quality Score</Label>
                        <span className="text-xs font-mono text-muted-foreground">{minQualityScore}</span>
                      </div>
                      <Slider
                        value={[minQualityScore]}
                        onValueChange={(value) => setMinQualityScore(value[0])}
                        min={0}
                        max={100}
                        step={5}
                        className="py-2"
                      />
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

                    {/* Filter Checkboxes */}
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="mustHaveContacts"
                          checked={mustHaveContacts}
                          onCheckedChange={(checked) => setMustHaveContacts(checked as boolean)}
                        />
                        <Label htmlFor="mustHaveContacts" className="text-xs font-normal cursor-pointer">
                          Must have contacts
                        </Label>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="mustHaveLinkedIn"
                          checked={mustHaveLinkedIn}
                          onCheckedChange={(checked) => setMustHaveLinkedIn(checked as boolean)}
                        />
                        <Label htmlFor="mustHaveLinkedIn" className="text-xs font-normal cursor-pointer">
                          Must have LinkedIn URL
                        </Label>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="mustHaveNews"
                          checked={mustHaveNews}
                          onCheckedChange={(checked) => setMustHaveNews(checked as boolean)}
                        />
                        <Label htmlFor="mustHaveNews" className="text-xs font-normal cursor-pointer">
                          Must have recent news
                        </Label>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="mustHaveFunding"
                          checked={mustHaveFunding}
                          onCheckedChange={(checked) => setMustHaveFunding(checked as boolean)}
                        />
                        <Label htmlFor="mustHaveFunding" className="text-xs font-normal cursor-pointer">
                          Must have funding info
                        </Label>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Action Button */}
          <div className="p-4 md:p-6 border-t bg-card/50">
            <Button
              onClick={() => handleSearch()}
              disabled={!isFormValid || isLoading}
              className="w-full h-9 md:h-10"
              size="default"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  <span className="text-xs font-medium">Searching...</span>
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  <span className="text-xs font-medium">Find Companies</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Right Panel - Results */}
        <div className="flex-1 overflow-y-auto">
          {!filteredAndSortedResults ? (
            <div className="h-full flex items-center justify-center p-4">
              <div className="text-center space-y-3 max-w-md px-4">
                <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/5 flex items-center justify-center">
                  <Search className="h-8 w-8 text-primary/40" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-foreground mb-1">No search results yet</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Configure your search parameters and click "Find Companies" to discover leads
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 md:p-6 space-y-4">
              {/* Results Header */}
              <div className="flex flex-col gap-3 pb-3 border-b">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold">
                    {filteredAndSortedResults.leads.length} {filteredAndSortedResults.leads.length === 1 ? 'Company' : 'Companies'}
                  </h2>
                  {hasActiveFilters && results && filteredAndSortedResults.leads.length < results.leads.length && (
                    <Badge variant="outline" className="text-xs bg-orange-500/10 text-orange-600 border-orange-500/20">
                      {results.leads.length - filteredAndSortedResults.leads.length} filtered out
                    </Badge>
                  )}
                  {results.stats && results.stats.filtered > 0 && (
                    <Badge variant="outline" className="text-xs">
                      {results.stats.filtered} low quality (backend)
                    </Badge>
                  )}
                  {results.stats && results.stats.averageScore && (
                    <Badge variant="secondary" className="text-xs">
                      Avg Score: {results.stats.averageScore}/100
                    </Badge>
                  )}
                  {results.wasEnriched && (
                    <Badge variant="default" className="h-5 text-xs bg-gradient-primary">
                      <Sparkles className="h-3 w-3 mr-1" />
                      Enriched
                    </Badge>
                  )}
                </div>
                
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {filteredAndSortedResults.dryRun && filteredAndSortedResults.leads.length > 0 && (
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="select-all"
                        checked={selectedCompanyIndices.size === filteredAndSortedResults.leads.length && filteredAndSortedResults.leads.length > 0}
                        onCheckedChange={toggleSelectAll}
                      />
                      <Label htmlFor="select-all" className="text-xs font-medium cursor-pointer">
                        Select All
                      </Label>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2 ml-auto">
                    {filteredAndSortedResults.dryRun && filteredAndSortedResults.leads.length > 0 && (
                      <Button
                        size="sm"
                        onClick={handleSaveSelectedCompanies}
                        disabled={isLoading || isSaving || selectedCompanyIndices.size === 0}
                        className="h-8 text-xs"
                      >
                        {isSaving ? (
                          <>
                            <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Database className="h-3 w-3 mr-1.5" />
                            Add {selectedCompanyIndices.size > 0 ? `${selectedCompanyIndices.size} ` : ''}to CRM
                          </>
                        )}
                      </Button>
                    )}
                    <div className="text-xs text-muted-foreground whitespace-nowrap">
                      {filteredAndSortedResults.dryRun ? "Preview" : `${filteredAndSortedResults.inserted} added`}
                    </div>
                  </div>
                </div>
              </div>

              {/* Results List */}
              <div className="space-y-3 md:space-y-4">
                {filteredAndSortedResults.leads.map((company: any, idx: number) => (
                  <div 
                    key={idx} 
                    className="group relative rounded-lg border bg-card hover:shadow-md hover:border-primary/50 transition-all p-3 md:p-4 cursor-pointer"
                    onClick={() => {
                      setCurrentCompanyIndex(idx);
                      setSelectedCompany(company);
                      setDialogOpen(true);
                    }}
                  >
                    <div className="flex flex-col h-full gap-3">
                      {/* Header with checkbox and icon */}
                      <div className="flex gap-3 md:gap-4">
                        {/* Selection Checkbox */}
                        {filteredAndSortedResults.dryRun && (
                          <div className="flex items-start pt-1">
                            <Checkbox
                              checked={selectedCompanyIndices.has(idx)}
                              onCheckedChange={() => toggleCompanySelection(idx)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        )}
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
                                {company.qualityScore !== undefined && (
                                  <QualityScoreBadge score={company.qualityScore} />
                                )}
                              </div>
                              {company.qualityScore !== undefined && (
                                <QualityStars score={company.qualityScore} />
                              )}
                              {company.website && (
                                <a
                                  href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-primary hover:underline inline-flex items-center gap-1 font-mono"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Globe className="h-3 w-3" />
                                  {company.website}
                                  <ExternalLink className="h-2.5 w-2.5" />
                                </a>
                              )}
                            </div>
                            {company.wasEnriched && (
                              <Badge variant="secondary" className="shrink-0 h-5 text-xs">
                                <Sparkles className="h-2.5 w-2.5 mr-1" />
                                Enriched
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Company Info */}
                      <div className="flex-1 space-y-2">
                        {/* Description */}
                        {company.description && (
                          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                            {company.description}
                          </p>
                        )}

                        {/* Data Completeness Bar */}
                        {company.dataCompleteness !== undefined && (
                          <DataCompletenessBar percentage={company.dataCompleteness} />
                        )}

                        {/* Enriched Data */}
                        {(company.products || company.recentNews || company.fundingInfo) && (
                          <div className="space-y-1 pt-1">
                            {company.products && (
                              <div className="text-xs">
                                <span className="font-medium text-foreground">Products:</span>{" "}
                                <span className="text-muted-foreground line-clamp-1">{company.products}</span>
                              </div>
                            )}
                            {company.recentNews && (
                              <div className="text-xs">
                                <span className="font-medium text-foreground">News:</span>{" "}
                                <span className="text-muted-foreground line-clamp-1">{company.recentNews}</span>
                              </div>
                            )}
                            {company.fundingInfo && (
                              <div className="text-xs">
                                <span className="font-medium text-foreground">Funding:</span>{" "}
                                <span className="text-muted-foreground line-clamp-1">{company.fundingInfo}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Source Badges */}
                        <SourceBadges
                          wasEnriched={company.wasEnriched}
                          hasVerifiedContacts={company.contacts?.some((c: any) => c.emailVerified)}
                          hasPatternContacts={company.contacts?.some((c: any) => !c.emailVerified)}
                        />

                        {/* Meta Badges */}
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {company.primaryContact && (
                            <Badge variant="outline" className="h-5 text-xs bg-cyan-500/10 text-cyan-600 border-cyan-500/20">
                              <Mail className="h-3 w-3 mr-1" />
                              Contact Available
                            </Badge>
                          )}
                          {company.industry && (
                            <Badge variant="outline" className="h-5 text-xs font-mono">
                              {company.industry}
                            </Badge>
                          )}
                          {company.size && (
                            <Badge variant="secondary" className="h-5 text-xs font-mono">
                              {company.size}
                            </Badge>
                          )}
                          {company.employeeCount && (
                            <Badge variant="secondary" className="h-5 text-xs font-mono">
                              {company.employeeCount} emp
                            </Badge>
                          )}
                          {company.geography && (
                            <Badge variant="outline" className="h-5 text-xs font-mono">
                              📍 {company.geography}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Usage Stats Footer */}
              {filteredAndSortedResults.usage && (
                <div className="mt-6 pt-4 border-t">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground font-medium">Provider</div>
                      <div className="text-xs font-mono capitalize">{filteredAndSortedResults.provider}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground font-medium">Tokens</div>
                      <div className="text-xs font-mono">
                        {(filteredAndSortedResults.usage.totalTokens + (filteredAndSortedResults.enrichmentUsage?.totalTokens || 0)).toLocaleString()}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground font-medium">Cost</div>
                      <div className="text-xs font-mono font-semibold">
                        ${(filteredAndSortedResults.usage.estimatedCost + (filteredAndSortedResults.enrichmentUsage?.estimatedCost || 0)).toFixed(4)}
                      </div>
                    </div>
                    {filteredAndSortedResults.traceUrl && (
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground font-medium">Trace</div>
                        <a
                          href={filteredAndSortedResults.traceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline inline-flex items-center gap-1 font-mono"
                        >
                          View
                          <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <CompanyDetailsDialog 
        company={selectedCompany}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        isSearching={isLoading}
        allCompanies={filteredAndSortedResults?.leads || []}
        currentIndex={currentCompanyIndex}
        onNavigate={handleNavigateCompany}
      />
    </div>
  );
}
