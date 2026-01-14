import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { 
  Search, 
  MapPin, 
  Building2, 
  Loader2, 
  CheckCircle, 
  AlertCircle,
  Mail,
  Phone,
  Globe,
  Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

interface ApifyScraperDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: (companyIds: string[]) => void;
}

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

type ScraperStep = 'config' | 'scraping' | 'review' | 'importing' | 'complete';

export function ApifyScraperDialog({ open, onOpenChange, onComplete }: ApifyScraperDialogProps) {
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
  const [importProgress, setImportProgress] = useState(0);
  const [importedCount, setImportedCount] = useState(0);

  const handleStartScraping = async () => {
    if (!searchQuery.trim()) {
      toast.error('Please enter a search query');
      return;
    }
    if (!location.trim()) {
      toast.error('Please enter a location');
      return;
    }

    setStep('scraping');
    setProgress(0);
    setStatusMessage('Initializing Apify scraper...');
    setScrapedLeads([]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Please log in');
        return;
      }

      const response = await supabase.functions.invoke('apify-google-scraper', {
        body: {
          query: searchQuery,
          location: location,
          maxResults: maxResults[0],
          scrapeEmails: scrapeEmails,
        },
      });

      if (response.error) throw response.error;

      const leads = response.data?.leads || [];
      setScrapedLeads(leads);
      setSelectedLeads(new Set(leads.map((_: any, i: number) => i)));
      setProgress(100);
      setStatusMessage(`Found ${leads.length} businesses`);
      setStep('review');
      
      toast.success(`Scraped ${leads.length} businesses from Google Maps`);
    } catch (error: any) {
      console.error('Scraping error:', error);
      toast.error(error.message || 'Failed to scrape data');
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

  const handleImport = async () => {
    if (selectedLeads.size === 0) {
      toast.error('Please select at least one lead to import');
      return;
    }

    setStep('importing');
    setImportProgress(0);
    setImportedCount(0);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('Please log in');
      return;
    }

    const leadsToImport = scrapedLeads.filter((_, i) => selectedLeads.has(i));
    const companyIds: string[] = [];
    let imported = 0;

    for (let i = 0; i < leadsToImport.length; i++) {
      const lead = leadsToImport[i];
      
      try {
        // Check for existing company
        const { data: existing } = await supabase
          .from('companies')
          .select('id')
          .eq('user_id', user.id)
          .ilike('name', lead.name)
          .maybeSingle();

        if (existing) {
          companyIds.push(existing.id);
        } else {
          // Create new company
          const { data: newCompany, error } = await supabase
            .from('companies')
            .insert({
              user_id: user.id,
              name: lead.name,
              website: lead.website,
              company_phone: lead.phone,
              general_email: lead.email,
              headquarters: lead.address,
              geography: lead.city,
              industry: lead.category,
              enrichment_data: {
                google_rating: lead.rating,
                google_reviews: lead.reviews,
                source: 'apify_google_maps',
              },
            })
            .select('id')
            .single();

          if (!error && newCompany) {
            companyIds.push(newCompany.id);
            imported++;
          }
        }
      } catch (err) {
        console.error('Import error:', err);
      }

      setImportProgress(Math.round(((i + 1) / leadsToImport.length) * 100));
      setImportedCount(imported);
    }

    queryClient.invalidateQueries({ queryKey: ['companies'] });
    setStep('complete');
    
    if (onComplete) {
      onComplete(companyIds);
    }
  };

  const handleClose = () => {
    setStep('config');
    setSearchQuery('');
    setLocation('');
    setMaxResults([100]);
    setScrapedLeads([]);
    setSelectedLeads(new Set());
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Apify Google Maps Scraper
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {step === 'config' && (
            <div className="space-y-6 py-4">
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
                <p className="text-xs text-muted-foreground">
                  Apify can scrape up to 300 businesses per search
                </p>
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

              <ScrollArea className="h-[400px] pr-4">
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
            </div>
          )}

          {step === 'importing' && (
            <div className="py-12 text-center space-y-6">
              <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary" />
              <div className="space-y-2">
                <h3 className="text-lg font-medium">Importing to CRM</h3>
                <p className="text-sm text-muted-foreground">
                  Imported {importedCount} companies...
                </p>
              </div>
              <Progress value={importProgress} className="w-full max-w-xs mx-auto" />
            </div>
          )}

          {step === 'complete' && (
            <div className="py-12 text-center space-y-6">
              <CheckCircle className="h-16 w-16 mx-auto text-green-500" />
              <div className="space-y-2">
                <h3 className="text-xl font-medium">Import Complete!</h3>
                <p className="text-muted-foreground">
                  Successfully imported {importedCount} new companies
                </p>
              </div>
              <div className="flex justify-center gap-3">
                <Button variant="outline" onClick={handleClose}>
                  Close
                </Button>
                <Button onClick={() => {
                  handleClose();
                  // TODO: Navigate to campaign creation
                }}>
                  Create Email Campaign
                </Button>
              </div>
            </div>
          )}
        </div>

        {(step === 'config' || step === 'review') && (
          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            {step === 'config' && (
              <Button onClick={handleStartScraping} disabled={!searchQuery || !location}>
                <Search className="h-4 w-4 mr-2" />
                Start Scraping
              </Button>
            )}
            {step === 'review' && (
              <Button onClick={handleImport} disabled={selectedLeads.size === 0}>
                <Building2 className="h-4 w-4 mr-2" />
                Import {selectedLeads.size} Companies
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
