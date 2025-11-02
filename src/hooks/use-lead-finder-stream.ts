import { useState, useRef, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { leadFinderStorage } from '@/lib/utils/lead-finder-storage';

interface Lead {
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
  socialProfiles?: any;
  keyExecutives?: any[];
  contacts?: any[];
  primaryContact?: any;
  qualityScore?: number;
  dataCompleteness?: number;
  enrichmentTier?: 'basic' | 'deep';
  contactCount?: number;
  enrichmentStatus?: 'pending' | 'skipped' | 'enriching' | 'completed';
  contactSearchStatus?: 'pending' | 'skipped' | 'searching' | 'completed' | 'no-contacts';
}

interface Stats {
  totalFound: number;
  returned: number;
  filtered: number;
  withContacts: number;
  withLinkedIn: number;
  highQuality: number;
  averageScore: number;
}

interface Usage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;
}

interface StreamState {
  leads: Lead[];
  isLoading: boolean;
  currentStatus: string;
  progress: number;
  stats: Stats | null;
  usage: Usage | null;
  error: Error | null;
  traceUrl: string | null;
  searchId: string | null;
  hasActiveSearch: boolean;
}

interface SearchParams {
  size: string;
  geography: string;
  industry: string;
  dryRun?: boolean;
  provider?: 'lovable' | 'openai' | 'perplexity';
  model?: string;
  enrichWithPerplexity?: boolean;
}

export const useLeadFinderStream = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const abortControllerRef = useRef<AbortController | null>(null);
  const searchParamsRef = useRef<SearchParams | null>(null);
  const currentSearchIdRef = useRef<string | null>(null);

  const [state, setState] = useState<StreamState>({
    leads: [],
    isLoading: false,
    currentStatus: '',
    progress: 0,
    stats: null,
    usage: null,
    error: null,
    traceUrl: null,
    searchId: null,
    hasActiveSearch: false,
  });

  // Load persisted results on mount (check both active and completed)
  useEffect(() => {
    // First check for active search
    const activeSearch = leadFinderStorage.loadActiveSearch();
    if (activeSearch && !activeSearch.isComplete) {
      setState(prev => ({
        ...prev,
        leads: activeSearch.leads,
        stats: activeSearch.stats,
        usage: activeSearch.usage,
        traceUrl: activeSearch.traceUrl,
        progress: activeSearch.progress,
        currentStatus: activeSearch.currentStatus,
        searchId: activeSearch.searchId,
        hasActiveSearch: true,
        isLoading: false, // Not actively loading, but can be resumed
      }));
      currentSearchIdRef.current = activeSearch.searchId;
      searchParamsRef.current = activeSearch.searchParams;
      return;
    }

    // If no active search, load completed results
    const stored = leadFinderStorage.load();
    if (stored && stored.leads.length > 0) {
      setState(prev => ({
        ...prev,
        leads: stored.leads,
        stats: stored.stats,
        usage: stored.usage,
        traceUrl: stored.traceUrl,
        hasActiveSearch: false,
      }));
    }
  }, []);

  const findLeads = async (params: SearchParams) => {
    // Generate unique search ID
    const searchId = crypto.randomUUID();
    currentSearchIdRef.current = searchId;
    
    // Store search params for later
    searchParamsRef.current = params;

    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();

    const startTime = Date.now();

    // Reset state
    setState({
      leads: [],
      isLoading: true,
      currentStatus: 'Initializing...',
      progress: 0,
      stats: null,
      usage: null,
      error: null,
      traceUrl: null,
      searchId,
      hasActiveSearch: true,
    });

    // Save initial active search state
    leadFinderStorage.saveActiveSearch({
      searchId,
      startTime,
      searchParams: {
        size: params.size,
        geography: params.geography,
        industry: params.industry,
        extractionProvider: params.provider,
        extractionModel: params.model,
        enrichmentEnabled: params.enrichWithPerplexity,
      },
      leads: [],
      progress: 0,
      currentStatus: 'Initializing...',
      stats: null,
      usage: null,
      traceUrl: null,
      isComplete: false,
      lastBatchTime: startTime,
    });

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      
      // Get the current session token
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('No active session. Please sign in again.');
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/lead-finder`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      // Process SSE stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete lines
        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);

          // Handle CRLF
          if (line.endsWith('\r')) {
            line = line.slice(0, -1);
          }

          // Skip comments and empty lines
          if (line.startsWith(':') || line.trim() === '') {
            continue;
          }

          // Parse SSE data
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6).trim();
            
            if (dataStr === '[DONE]') {
              break;
            }

            try {
              const event = JSON.parse(dataStr);

              if (event.type === 'status') {
                const newProgress = event.progress || state.progress;
                setState(prev => ({
                  ...prev,
                  currentStatus: event.message,
                  progress: newProgress,
                }));

                // Save progress update to active search
                leadFinderStorage.updateActiveSearchProgress(searchId, {
                  currentStatus: event.message,
                  progress: newProgress,
                });
              } else if (event.type === 'batch') {
                setState(prev => {
                  const updatedLeads = [...prev.leads, ...event.leads];
                  const batchStatus = `Processed batch ${event.batchNumber}/${event.totalBatches}`;
                  
                  // Save batch to active search immediately
                  leadFinderStorage.updateActiveSearchProgress(searchId, {
                    leads: updatedLeads,
                    currentStatus: batchStatus,
                    progress: Math.round((event.batchNumber / event.totalBatches) * 90), // Reserve 100% for completion
                  });

                  return {
                    ...prev,
                    leads: updatedLeads,
                    currentStatus: batchStatus,
                  };
                });
              } else if (event.type === 'lead-update') {
                // PHASE 2: Update specific lead with enriched data
                setState(prev => {
                  const updatedLeads = prev.leads.map(lead => {
                    // Match by name and website
                    if (lead.name === event.lead.name && 
                        (lead.website === event.lead.website || (!lead.website && !event.lead.website))) {
                      return { ...lead, ...event.lead };
                    }
                    return lead;
                  });
                  
                  // Save to localStorage
                  leadFinderStorage.updateActiveSearchProgress(searchId, {
                    leads: updatedLeads,
                  });
                  
                  return {
                    ...prev,
                    leads: updatedLeads,
                  };
                });
              } else if (event.type === 'enrichment-status') {
                // PHASE 2: Update status with enrichment progress
                setState(prev => ({
                  ...prev,
                  currentStatus: event.message,
                }));
              } else if (event.type === 'extraction-complete') {
                setState(prev => ({
                  ...prev,
                  currentStatus: event.message,
                  progress: event.progress || 80,
                }));
              } else if (event.type === 'complete') {
                const totalLeads = state.leads.length + (event.leads?.length || 0);
                const allLeads = [...state.leads, ...(event.leads || [])];
                
                setState(prev => ({
                  ...prev,
                  leads: allLeads,
                  isLoading: false,
                  currentStatus: 'Complete',
                  progress: 100,
                  stats: event.stats,
                  usage: event.usage,
                  traceUrl: event.traceUrl,
                  hasActiveSearch: false,
                }));

                // Mark search as complete and move to completed storage
                leadFinderStorage.updateActiveSearchProgress(searchId, {
                  leads: allLeads,
                  stats: event.stats,
                  usage: event.usage,
                  traceUrl: event.traceUrl,
                  progress: 100,
                  currentStatus: 'Complete',
                  isComplete: true,
                });

                leadFinderStorage.markSearchComplete(searchId);

                // Invalidate queries if companies were inserted
                if (!params.dryRun && totalLeads > 0) {
                  queryClient.invalidateQueries({ queryKey: ['companies'] });
                  queryClient.invalidateQueries({ queryKey: ['pipeline-stats'] });
                }

                // Show toast notification with action
                toast({
                  title: '✨ Lead Search Complete',
                  description: `Found ${event.stats.returned} companies. Results saved and ready to view.`,
                  duration: 8000,
                });

                // Clear current search ID
                currentSearchIdRef.current = null;
              } else if (event.type === 'error') {
                throw new Error(event.message);
              }
            } catch (parseError) {
              // If JSON parse fails, might be incomplete - put it back
              buffer = line + '\n' + buffer;
              break;
            }
          }
        }
      }

      // Process any remaining buffer
      if (buffer.trim()) {
        const lines = buffer.split('\n');
        for (const line of lines) {
          if (!line.trim() || line.startsWith(':')) continue;
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6).trim();
            if (dataStr !== '[DONE]') {
              try {
                const event = JSON.parse(dataStr);
                if (event.type === 'error') {
                  throw new Error(event.message);
                }
              } catch {}
            }
          }
        }
      }

    } catch (error) {
      console.error('Lead finder stream error:', error);
      
      if (error instanceof Error && error.name === 'AbortError') {
        // Request was cancelled - keep active search for potential resume
        setState(prev => ({
          ...prev,
          isLoading: false,
          currentStatus: 'Paused',
        }));
        
        // Save paused state
        if (currentSearchIdRef.current) {
          leadFinderStorage.updateActiveSearchProgress(currentSearchIdRef.current, {
            currentStatus: 'Paused',
            isComplete: false,
          });
        }
        
        toast({
          title: 'Search Paused',
          description: 'Lead search was paused. Partial results are saved. You can navigate away and return later.',
          duration: 5000,
        });
      } else {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error : new Error('Unknown error'),
          currentStatus: 'Error',
          hasActiveSearch: false,
        }));

        // Clear active search on error
        if (currentSearchIdRef.current) {
          leadFinderStorage.clearActiveSearch();
          currentSearchIdRef.current = null;
        }

        toast({
          title: 'Error',
          description: error instanceof Error ? error.message : 'Failed to search for leads',
          variant: 'destructive',
        });
      }
    }
  };

  const cancelSearch = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const clearStoredResults = () => {
    leadFinderStorage.clear();
    leadFinderStorage.clearActiveSearch();
    currentSearchIdRef.current = null;
    setState({
      leads: [],
      isLoading: false,
      currentStatus: '',
      progress: 0,
      stats: null,
      usage: null,
      error: null,
      traceUrl: null,
      searchId: null,
      hasActiveSearch: false,
    });
  };

  const restoreStoredResults = () => {
    const stored = leadFinderStorage.load();
    if (stored && stored.leads.length > 0) {
      setState(prev => ({
        ...prev,
        leads: stored.leads,
        stats: stored.stats,
        usage: stored.usage,
        traceUrl: stored.traceUrl,
        isLoading: false,
        currentStatus: 'Restored',
        progress: 100,
        searchId: null,
        hasActiveSearch: false,
      }));
      return true;
    }
    return false;
  };

  const resumeActiveSearch = () => {
    const activeSearch = leadFinderStorage.loadActiveSearch();
    if (activeSearch && !activeSearch.isComplete) {
      setState(prev => ({
        ...prev,
        leads: activeSearch.leads,
        stats: activeSearch.stats,
        usage: activeSearch.usage,
        traceUrl: activeSearch.traceUrl,
        progress: activeSearch.progress,
        currentStatus: activeSearch.currentStatus + ' (Resumed)',
        searchId: activeSearch.searchId,
        hasActiveSearch: true,
        isLoading: false,
      }));
      currentSearchIdRef.current = activeSearch.searchId;
      searchParamsRef.current = activeSearch.searchParams;
      return true;
    }
    return false;
  };

  const clearActiveSearch = () => {
    leadFinderStorage.clearActiveSearch();
    currentSearchIdRef.current = null;
    setState(prev => ({
      ...prev,
      hasActiveSearch: false,
      searchId: null,
    }));
  };

  return {
    ...state,
    findLeads,
    cancelSearch,
    clearStoredResults,
    restoreStoredResults,
    resumeActiveSearch,
    clearActiveSearch,
    hasStoredResults: leadFinderStorage.hasStoredResults(),
    hasActiveSearch: leadFinderStorage.hasActiveSearch(),
  };
};
