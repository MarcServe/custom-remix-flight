import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { 
  Search, 
  Loader2, 
  CheckCircle, 
  AlertCircle,
  Building2,
  Globe,
  FileText,
  Sparkles,
  MapPin
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface CompanyListSearchProps {
  onLeadsFound?: (leads: any[]) => void;
}

export function CompanyListSearch({ onLeadsFound }: CompanyListSearchProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [companyList, setCompanyList] = useState('');
  const [location, setLocation] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [foundLeads, setFoundLeads] = useState<any[]>([]);
  const [searchMode, setSearchMode] = useState<'names' | 'websites'>('names');
  const [useApify, setUseApify] = useState(true);
  const [enrichAll, setEnrichAll] = useState(true);

  const parseCompanyList = (text: string): string[] => {
    return text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .slice(0, 100); // Limit to 100 companies
  };

  const extractWebsites = (text: string): string[] => {
    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9-]+\.[a-zA-Z]{2,}[^\s]*)/g;
    const matches = text.match(urlRegex) || [];
    return matches
      .map(url => {
        // Normalize URLs
        if (!url.startsWith('http')) {
          url = 'https://' + url;
        }
        return url.trim();
      })
      .filter((url, index, self) => self.indexOf(url) === index) // Remove duplicates
      .slice(0, 100); // Limit to 100 websites
  };

  const searchCompanyWithApify = async (query: string, locationQuery?: string): Promise<any[]> => {
    try {
      // Build search string - use location if provided, otherwise just query
      const searchString = locationQuery ? `${query} in ${locationQuery}` : query;
      
      const { data, error } = await supabase.functions.invoke('apify-google-scraper', {
        body: {
          query: query,
          location: locationQuery || 'United States', // Default location if not provided
          maxResults: 10, // Get multiple results per company
          scrapeEmails: true,
        },
      });

      if (error) {
        console.error(`Apify error for ${query}:`, error);
        return [];
      }

      if (data?.results && data.results.length > 0) {
        return data.results.map((result: any) => ({
          name: result.name || query,
          website: result.website || null,
          phone: result.phone || null,
          email: result.email || null,
          address: result.address || null,
          city: result.city || null,
          category: result.category || null,
          rating: result.rating || null,
          reviews: result.reviews || null,
          source: 'apify',
          searchQuery: query,
        }));
      }

      return [];
    } catch (error) {
      console.error(`Error searching Apify for ${query}:`, error);
      return [];
    }
  };

  const searchCompanyWithAI = async (companyName: string, website?: string): Promise<any[]> => {
    try {
      // Use lead-finder for AI-powered search
      const { data, error } = await supabase.functions.invoke('lead-finder', {
        body: {
          customSearchText: website ? `${companyName} ${website}` : companyName,
          size: '',
          geography: location || '',
          industry: '',
          dryRun: false,
          provider: 'openai',
          model: 'gpt-4o-mini',
          enrichWithPerplexity: true,
          useSerpApi: false,
          useApify: false,
          autonomousMode: false,
        },
      });

      if (error) {
        console.error(`AI search error for ${companyName}:`, error);
        return [];
      }

      // The lead-finder returns streaming data, but we can extract initial results
      // For now, return empty and let Apify handle it
      return [];
    } catch (error) {
      console.error(`Error with AI search for ${companyName}:`, error);
      return [];
    }
  };

  const enrichLeadsBatch = async (leads: any[]): Promise<any[]> => {
    if (!enrichAll || leads.length === 0) {
      return leads.map(lead => ({ ...lead, wasEnriched: false }));
    }

    try {
      setStatusMessage(`Enriching ${leads.length} leads with AI...`);
      
      const { data, error } = await supabase.functions.invoke('enrich-leads', {
        body: {
          leads: leads.map(lead => ({
            name: lead.name,
            website: lead.website,
            industry: lead.category,
            geography: lead.city || lead.address || location,
          })),
          provider: 'perplexity',
        },
      });

      if (error) {
        console.error('Enrichment error:', error);
        return leads.map(lead => ({ ...lead, wasEnriched: false }));
      }

      // Handle streaming response
      if (data instanceof ReadableStream) {
        const reader = data.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let enrichedLeads: any[] = [];

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
                if (event.type === 'complete' && event.enrichedLeads) {
                  // Merge enriched data with original leads
                  return leads.map(lead => {
                    const enriched = event.enrichedLeads.find((e: any) => 
                      e.name === lead.name || (e.website && e.website === lead.website)
                    );
                    return enriched ? { ...lead, ...enriched, wasEnriched: true } : { ...lead, wasEnriched: false };
                  });
                }
              } catch (e) {
                console.error('Error parsing SSE event:', e);
              }
            }
          }
        }
      }

      return leads.map(lead => ({ ...lead, wasEnriched: false }));
    } catch (error) {
      console.error('Enrichment error:', error);
      return leads.map(lead => ({ ...lead, wasEnriched: false }));
    }
  };

  const handleSearch = async () => {
    if (!companyList.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter company names or websites',
        variant: 'destructive',
      });
      return;
    }

    setIsSearching(true);
    setProgress(0);
    setStatusMessage('Preparing search...');
    setFoundLeads([]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: 'Error',
          description: 'Please log in',
          variant: 'destructive',
        });
        return;
      }

      const items = searchMode === 'names' 
        ? parseCompanyList(companyList)
        : extractWebsites(companyList);

      if (items.length === 0) {
        toast({
          title: 'Error',
          description: `No valid ${searchMode === 'names' ? 'company names' : 'websites'} found`,
          variant: 'destructive',
        });
        setIsSearching(false);
        return;
      }

      setProgress(5);
      setStatusMessage(`Found ${items.length} ${searchMode === 'names' ? 'companies' : 'websites'}. Searching...`);

      // Collect all leads from multiple sources
      const allLeads: any[] = [];
      const leadMap = new Map<string, any>(); // Deduplicate by name+website

      const batchSize = 5; // Smaller batches for better progress tracking
      const totalSteps = items.length * (useApify ? 2 : 1) + (enrichAll ? 1 : 0);
      let currentStep = 0;

      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const batchProgress = 5 + ((i / items.length) * (useApify ? 70 : 85));
        setProgress(batchProgress);
        setStatusMessage(`Searching batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(items.length / batchSize)}...`);

        const batchPromises = batch.map(async (item, index) => {
          try {
            let searchQuery = item;
            let websiteUrl: string | undefined = undefined;

            if (searchMode === 'websites') {
              websiteUrl = item;
              // Extract domain name from URL for search
              try {
                const url = new URL(item);
                searchQuery = url.hostname.replace('www.', '');
              } catch {
                searchQuery = item.replace(/^https?:\/\//, '').replace(/^www\./, '');
              }
            }

            // Search with Apify (gives more results)
            if (useApify) {
              const apifyResults = await searchCompanyWithApify(searchQuery, location || undefined);
              
              for (const result of apifyResults) {
                const key = `${result.name.toLowerCase()}_${result.website || ''}`;
                if (!leadMap.has(key)) {
                  leadMap.set(key, result);
                  allLeads.push(result);
                }
              }
            }

            // If no results from Apify, try AI search as fallback
            if (allLeads.length === 0 || !useApify) {
              const aiResults = await searchCompanyWithAI(searchQuery, websiteUrl);
              for (const result of aiResults) {
                const key = `${result.name.toLowerCase()}_${result.website || ''}`;
                if (!leadMap.has(key)) {
                  leadMap.set(key, result);
                  allLeads.push(result);
                }
              }
            }

            currentStep++;
            setProgress(5 + (currentStep / totalSteps) * (enrichAll ? 85 : 95));
          } catch (error) {
            console.error(`Error processing ${item}:`, error);
          }
        });

        await Promise.all(batchPromises);

        // Small delay between batches
        if (i + batchSize < items.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      setProgress(90);
      setStatusMessage(`Found ${allLeads.length} companies. ${enrichAll ? 'Enriching...' : 'Finalizing...'}`);

      // Enrich all leads if enabled
      let finalLeads = allLeads;
      if (enrichAll && allLeads.length > 0) {
        finalLeads = await enrichLeadsBatch(allLeads);
      } else {
        finalLeads = allLeads.map(lead => ({ ...lead, wasEnriched: false }));
      }

      setFoundLeads(finalLeads);
      
      if (onLeadsFound && finalLeads.length > 0) {
        onLeadsFound(finalLeads);
      }

      setProgress(100);
      setStatusMessage('Search complete');
      
      if (finalLeads.length === 0) {
        toast({
          title: 'No Results',
          description: 'No companies found. Try adjusting your search terms or location.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Search Complete',
          description: `Found ${finalLeads.length} companies${enrichAll ? ` (${finalLeads.filter(l => l.wasEnriched).length} enriched)` : ''}`,
        });
      }

    } catch (error) {
      console.error('Search error:', error);
      toast({
        title: 'Error',
        description: 'Failed to search companies',
        variant: 'destructive',
      });
      setStatusMessage('Search failed');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        <div className="space-y-4">
          <div>
            <h2 className="text-sm font-semibold mb-3">Search by Company List</h2>
            <p className="text-xs text-muted-foreground mb-4">
              Paste a list of company names or website URLs to search on Google Maps (via Apify) and enrich with AI.
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex gap-2">
              <Button
                variant={searchMode === 'names' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSearchMode('names')}
                className="flex-1"
              >
                <FileText className="h-3.5 w-3.5 mr-2" />
                Company Names
              </Button>
              <Button
                variant={searchMode === 'websites' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSearchMode('websites')}
                className="flex-1"
              >
                <Globe className="h-3.5 w-3.5 mr-2" />
                Website URLs
              </Button>
            </div>

            {/* Location input for better search results */}
            <div className="space-y-2">
              <Label htmlFor="location" className="text-xs font-medium">
                Location (Optional - helps improve search accuracy)
              </Label>
              <Input
                id="location"
                placeholder="e.g., New York, NY or United States"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="h-9 text-xs"
                disabled={isSearching}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="company-list" className="text-xs font-medium">
                {searchMode === 'names' ? 'Company Names (one per line)' : 'Website URLs (one per line)'}
              </Label>
              <Textarea
                id="company-list"
                placeholder={searchMode === 'names' 
                  ? 'Acme Corp\nTech Solutions Inc\nGlobal Industries Ltd\n...'
                  : 'https://example.com\nwww.company.com\nhttps://business.io\n...'
                }
                value={companyList}
                onChange={(e) => setCompanyList(e.target.value)}
                className="min-h-[200px] text-xs font-mono"
                disabled={isSearching}
              />
              <p className="text-xs text-muted-foreground">
                {searchMode === 'names' 
                  ? 'Enter up to 100 company names, one per line'
                  : 'Enter up to 100 website URLs, one per line'
                }
              </p>
            </div>

            {/* Search options */}
            <div className="space-y-3 p-3 border rounded-lg bg-muted/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-blue-500" />
                  <Label htmlFor="use-apify" className="text-xs font-medium cursor-pointer">
                    Use Apify (More Results)
                  </Label>
                </div>
                <Switch
                  id="use-apify"
                  checked={useApify}
                  onCheckedChange={setUseApify}
                  disabled={isSearching}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-500" />
                  <Label htmlFor="enrich-all" className="text-xs font-medium cursor-pointer">
                    Enrich All Results
                  </Label>
                </div>
                <Switch
                  id="enrich-all"
                  checked={enrichAll}
                  onCheckedChange={setEnrichAll}
                  disabled={isSearching}
                />
              </div>
            </div>

            <Button
              onClick={handleSearch}
              disabled={isSearching || !companyList.trim()}
              className="w-full"
            >
              {isSearching ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  Search & Enrich
                </>
              )}
            </Button>
          </div>

          {isSearching && (
            <Card className="p-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{statusMessage}</span>
                  <span className="font-medium">{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            </Card>
          )}

          {foundLeads.length > 0 && !isSearching && (
            <Card className="p-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Search Results</h3>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{foundLeads.length} found</Badge>
                    {enrichAll && (
                      <Badge variant="outline" className="text-xs">
                        {foundLeads.filter(l => l.wasEnriched).length} enriched
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {foundLeads.map((lead, index) => (
                    <div key={index} className="flex items-start gap-3 p-2 rounded-lg border bg-card">
                      <Building2 className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="font-medium text-sm">{lead.name}</div>
                        {lead.website && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <Globe className="h-3 w-3" />
                            {lead.website}
                          </div>
                        )}
                        {lead.description && (
                          <div className="text-xs text-muted-foreground line-clamp-2">
                            {lead.description}
                          </div>
                        )}
                        {lead.suggestedTags && lead.suggestedTags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {lead.suggestedTags.slice(0, 3).map((tag: string, i: number) => (
                              <Badge key={i} variant="outline" className="text-[10px]">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      {lead.wasEnriched && (
                        <Sparkles className="h-4 w-4 text-primary flex-shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
