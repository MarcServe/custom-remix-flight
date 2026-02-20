import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Search, 
  MapPin, 
  Building2, 
  Loader2, 
  CheckCircle, 
  Mail,
  Phone,
  Globe,
  Inbox,
  Database,
  AlertCircle,
  ArrowRightCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { COMPANY_SOURCE_TAGS } from '@/lib/company-sources';

interface ScrapedLead {
  name: string;
  website?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  rating?: number;
  reviews?: number;
  category?: string;
}

type ScraperStep = 'config' | 'scraping' | 'review';

interface GoogleMapsScraperProps {
  onLeadsScraped?: (leads: ScrapedLead[]) => void;
}

export function GoogleMapsScraper({ onLeadsScraped }: GoogleMapsScraperProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<ScraperStep>('config');
  
  // Config state
  const [searchQuery, setSearchQuery] = useState('');
  const [location, setLocation] = useState('');
  const [maxResults, setMaxResults] = useState([100]);
  const [scrapeEmails, setScrapeEmails] = useState(true);
  
  // Scraping state
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [scrapedLeads, setScrapedLeads] = useState<ScrapedLead[]>([]);
  const [selectedLeads, setSelectedLeads] = useState<Set<number>>(new Set());
  
  // Import state
  const [isImporting, setIsImporting] = useState(false);
  const [isSendingToInbox, setIsSendingToInbox] = useState(false);
  const [isSendingToEnrichment, setIsSendingToEnrichment] = useState(false);
  const [lastScrapeError, setLastScrapeError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleStartScraping = async (isRetry = false) => {
    if (!searchQuery.trim()) {
      toast.error('Please enter a search query');
      return;
    }
    if (!location.trim()) {
      toast.error('Please enter a location');
      return;
    }

    setLastScrapeError(null);
    setStep('scraping');
    setProgress(10);
    setStatusMessage(isRetry ? 'Retrying...' : 'Initializing Apify scraper...');
    setScrapedLeads([]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Please log in');
        setStep('config');
        return;
      }

      setProgress(30);
      setStatusMessage('Scraping Google Maps...');

      const response = await supabase.functions.invoke('apify-google-scraper', {
        body: {
          query: searchQuery,
          location: location,
          maxResults: maxResults[0],
          scrapeEmails: scrapeEmails,
        },
      });

      // Surface server error message (e.g. APIFY_API_TOKEN not configured)
      if (response.data?.error && typeof response.data.error === 'string') {
        throw new Error(response.data.error);
      }
      if (response.error) throw response.error;

      const leads = response.data?.leads || [];
      setScrapedLeads(leads);
      setSelectedLeads(new Set(leads.map((_: any, i: number) => i)));
      setProgress(100);
      setStatusMessage(`Found ${leads.length} businesses`);
      setStep('review');
      
      if (onLeadsScraped) {
        onLeadsScraped(leads);
      }
      
      toast.success(`Scraped ${leads.length} businesses from Google Maps`);
    } catch (error: any) {
      console.error('Scraping error:', error);
      const msg = error?.message || 'Failed to scrape data';
      const isEdgeFunctionUnreachable = msg.includes('Failed to send a request to the Edge Function') || msg.includes('fetch failed');
      if (isEdgeFunctionUnreachable && !isRetry) {
        setStatusMessage('Connection issue. Retrying once...');
        await new Promise((r) => setTimeout(r, 2000));
        return handleStartScraping(true);
      }
      const hint = isEdgeFunctionUnreachable
        ? ' Check that the apify-google-scraper Edge Function is deployed and try again.'
        : msg.includes('APIFY_API_TOKEN')
        ? ' Add APIFY_API_TOKEN in Supabase Dashboard → Project Settings → Edge Functions → Secrets.'
        : '';
      setLastScrapeError(msg + hint);
      toast.error(msg + hint);
      setStep('config');
    }
  };

  const toggleLead = (index: number) => {
    setSelectedLeads(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedLeads(new Set(scrapedLeads.map((_, i) => i)));
  };

  const deselectAll = () => {
    setSelectedLeads(new Set());
  };

  const handleAddToCRM = async () => {
    if (selectedLeads.size === 0) {
      toast.error('Please select at least one lead to import');
      return;
    }

    setIsImporting(true);
    let imported = 0;

    const leadsToImport = scrapedLeads.filter((_, i) => selectedLeads.has(i));

    for (const lead of leadsToImport) {
      try {
        // Check for existing company
        const { data: existing } = await supabase
          .from('companies')
          .select('id')
          .eq('user_id', user?.id)
          .ilike('name', lead.name)
          .maybeSingle();

        if (!existing) {
          const { error } = await supabase
            .from('companies')
            .insert({
              user_id: user?.id,
              name: lead.name,
              website: lead.website,
              company_phone: lead.phone,
              general_email: lead.email,
              headquarters: lead.address,
              geography: lead.city,
              industry: lead.category,
              tags: [COMPANY_SOURCE_TAGS.GOOGLE_MAPS],
              enrichment_data: {
                google_rating: lead.rating,
                google_reviews: lead.reviews,
                source: 'apify_google_maps',
              },
            });

          if (!error) imported++;
        }
      } catch (err) {
        console.error('Import error:', err);
      }
    }

    queryClient.invalidateQueries({ queryKey: ['companies'] });
    setIsImporting(false);
    toast.success(`Added ${imported} companies to CRM`);
    
    // Reset to config
    setStep('config');
    setSearchQuery('');
    setLocation('');
    setScrapedLeads([]);
    setSelectedLeads(new Set());
  };

  const handleSendToInbox = async () => {
    if (selectedLeads.size === 0) {
      toast.error('Please select at least one lead');
      return;
    }

    setIsSendingToInbox(true);
    let sent = 0;
    const insertedIds: string[] = [];

    const leadsToSend = scrapedLeads.filter((_, i) => selectedLeads.has(i));

    for (const lead of leadsToSend) {
      try {
        const { data, error } = await supabase
          .from('autonomous_leads')
          .insert({
            user_id: user?.id,
            company_name: lead.name,
            company_website: lead.website,
            industry: lead.category,
            geography: lead.city,
            status: 'pending',
            quality_score: calculateQualityScore(lead),
            source: 'apify',
            company_data: {
              companyPhone: lead.phone,
              generalEmail: lead.email,
              address: lead.address,
              googleRating: lead.rating,
              googleReviewCount: lead.reviews,
            },
          })
          .select('id')
          .single();

        if (!error && data) {
          sent++;
          insertedIds.push(data.id);
        }
      } catch (err) {
        console.error('Send to inbox error:', err);
      }
    }

    // Enrich the leads with Perplexity after insertion
    if (insertedIds.length > 0) {
      toast.success(`Sent ${sent} leads to inbox. Starting enrichment...`);
      
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const response = await fetch(
          `https://kgndpwzqohepotahnfeo.supabase.co/functions/v1/enrich-autonomous-leads`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session?.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ leadIds: insertedIds, mode: 'deep' }),
          }
        );

        if (response.ok && response.body) {
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let enrichedCount = 0;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const text = decoder.decode(value);
            const lines = text.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const event = JSON.parse(line.slice(6));
                  if (event.type === 'enriched') {
                    enrichedCount++;
                  } else if (event.type === 'complete') {
                    toast.success(`Enriched ${event.success} of ${event.total} leads with AI research`);
                  }
                } catch (e) {
                  // Ignore parse errors
                }
              }
            }
          }
        }
      } catch (enrichError) {
        console.error('Enrichment error:', enrichError);
        toast.info('Leads saved. Enrichment will happen in background.');
      }
    } else {
      toast.success(`Sent ${sent} leads to inbox for review`);
    }

    queryClient.invalidateQueries({ queryKey: ['autonomous-leads'] });
    setIsSendingToInbox(false);
    
    // Reset
    setStep('config');
    setSearchQuery('');
    setLocation('');
    setScrapedLeads([]);
    setSelectedLeads(new Set());
  };

  const handleSendToEnrichment = async () => {
    if (selectedLeads.size === 0 || !user) {
      toast.error('Please select at least one lead');
      return;
    }
    setIsSendingToEnrichment(true);
    const leadsToSend = scrapedLeads.filter((_, i) => selectedLeads.has(i));
    try {
      const inserts = leadsToSend.map(lead => ({
        user_id: user.id,
        name: lead.name,
        website: lead.website || null,
        industry: lead.category || null,
        geography: lead.city || lead.address || null,
        email: lead.email || null,
        phone: lead.phone || null,
        source: 'google_maps',
        source_metadata: { from: 'google_maps_scraper' },
        enrichment_status: 'pending',
        email_extraction_status: (lead.website && !lead.email) ? 'pending' : 'not_needed',
      }));
      const { error } = await (supabase as any).from('enrichment_queue').insert(inserts).select('id');
      if (error) throw error;
      toast.success(`${inserts.length} lead(s) sent to Enrichment page. Run enrichment there.`);
      navigate('/enrichment');
    } catch (e) {
      toast.error((e as Error)?.message ?? 'Failed to send to Enrichment');
    } finally {
      setIsSendingToEnrichment(false);
    }
  };

  const calculateQualityScore = (lead: ScrapedLead): number => {
    let score = 30;
    if (lead.email) score += 25;
    if (lead.phone) score += 15;
    if (lead.website) score += 15;
    if (lead.rating && lead.rating >= 4) score += 10;
    if (lead.reviews && lead.reviews >= 10) score += 5;
    return Math.min(score, 100);
  };

  const resetScraper = () => {
    setLastScrapeError(null);
    setStep('config');
    setSearchQuery('');
    setLocation('');
    setScrapedLeads([]);
    setSelectedLeads(new Set());
    setProgress(0);
    setStatusMessage('');
  };

  return (
    <div className="space-y-4">
      {step === 'config' && (
        <div className="space-y-4">
          {lastScrapeError && (
            <Alert variant="destructive" className="mb-2">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Scraping failed</AlertTitle>
              <AlertDescription>{lastScrapeError}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="search-query">Search Query</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="search-query"
                placeholder="e.g., Restaurants, Marketing Agencies, Law Firms..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="location"
                placeholder="e.g., New York, NY or 10001"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Maximum Results</Label>
              <Badge variant="secondary">{maxResults[0]} leads</Badge>
            </div>
            <Slider
              value={maxResults}
              onValueChange={setMaxResults}
              min={10}
              max={300}
              step={10}
              className="w-full"
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="space-y-0.5">
              <Label htmlFor="scrape-emails">Extract Emails from Websites</Label>
              <p className="text-xs text-muted-foreground">
                Crawl business websites to find contact emails
              </p>
            </div>
            <Switch
              id="scrape-emails"
              checked={scrapeEmails}
              onCheckedChange={setScrapeEmails}
            />
          </div>

          <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
            <h4 className="font-medium text-sm mb-2">What you'll get:</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li className="flex items-center gap-2">
                <Building2 className="h-3 w-3" /> Business names & categories
              </li>
              <li className="flex items-center gap-2">
                <Phone className="h-3 w-3" /> Phone numbers
              </li>
              <li className="flex items-center gap-2">
                <Globe className="h-3 w-3" /> Websites
              </li>
              <li className="flex items-center gap-2">
                <Mail className="h-3 w-3" /> Emails (if available)
              </li>
              <li className="flex items-center gap-2">
                <MapPin className="h-3 w-3" /> Addresses & locations
              </li>
            </ul>
          </div>

          <Button 
            onClick={handleStartScraping} 
            disabled={!searchQuery || !location}
            className="w-full"
          >
            <Search className="h-4 w-4 mr-2" />
            Start Scraping
          </Button>
        </div>
      )}

      {step === 'scraping' && (
        <div className="py-12 text-center space-y-6">
          <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary" />
          <div className="space-y-2">
            <h3 className="text-lg font-medium">Scraping Google Maps</h3>
            <p className="text-sm text-muted-foreground">{statusMessage}</p>
          </div>
          <Progress value={progress} className="w-full max-w-xs mx-auto" />
          <p className="text-xs text-muted-foreground">
            This may take 1-3 minutes depending on the number of results
          </p>
        </div>
      )}

      {step === 'review' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">Review Scraped Leads</h3>
              <p className="text-sm text-muted-foreground">
                {selectedLeads.size} of {scrapedLeads.length} selected
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={selectAll}>
                Select All
              </Button>
              <Button variant="outline" size="sm" onClick={deselectAll}>
                Deselect All
              </Button>
            </div>
          </div>

          <ScrollArea className="h-[350px] pr-4">
            <div className="space-y-2">
              {scrapedLeads.map((lead, index) => (
                <Card
                  key={index}
                  className={`p-3 cursor-pointer transition-colors ${
                    selectedLeads.has(index) ? 'border-primary bg-primary/5' : ''
                  }`}
                  onClick={() => toggleLead(index)}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                      selectedLeads.has(index) ? 'bg-primary border-primary' : 'border-muted-foreground/30'
                    }`}>
                      {selectedLeads.has(index) && (
                        <CheckCircle className="h-3 w-3 text-primary-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium truncate">{lead.name}</h4>
                        {lead.rating && (
                          <Badge variant="secondary" className="text-xs">
                            ⭐ {lead.rating}
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1">
                        {lead.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" /> {lead.phone}
                          </span>
                        )}
                        {lead.email && (
                          <span className="flex items-center gap-1 text-green-600">
                            <Mail className="h-3 w-3" /> {lead.email}
                          </span>
                        )}
                        {lead.website && (
                          <span className="flex items-center gap-1">
                            <Globe className="h-3 w-3" /> {new URL(lead.website.startsWith('http') ? lead.website : `https://${lead.website}`).hostname}
                          </span>
                        )}
                      </div>
                      {lead.address && (
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          📍 {lead.address}
                        </p>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </ScrollArea>

          <div className="flex flex-col sm:flex-row flex-wrap gap-2">
            <Button variant="outline" onClick={resetScraper} className="flex-1 min-w-[140px]">
              Start New Search
            </Button>
            <Button 
              variant="default"
              onClick={handleSendToEnrichment}
              disabled={selectedLeads.size === 0 || isSendingToEnrichment}
              className="flex-1 min-w-[140px]"
            >
              {isSendingToEnrichment ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowRightCircle className="h-4 w-4 mr-2" />}
              Move to Enrichment ({selectedLeads.size})
            </Button>
            <Button 
              variant="outline"
              onClick={handleSendToInbox} 
              disabled={selectedLeads.size === 0 || isSendingToInbox}
              className="flex-1 min-w-[140px]"
            >
              {isSendingToInbox ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Inbox className="h-4 w-4 mr-2" />}
              Send to Inbox ({selectedLeads.size})
            </Button>
            <Button 
              variant="outline"
              onClick={handleAddToCRM} 
              disabled={selectedLeads.size === 0 || isImporting}
              className="flex-1 min-w-[140px]"
            >
              {isImporting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Database className="h-4 w-4 mr-2" />}
              Add to CRM ({selectedLeads.size})
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
