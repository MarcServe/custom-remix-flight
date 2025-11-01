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

  const [state, setState] = useState<StreamState>({
    leads: [],
    isLoading: false,
    currentStatus: '',
    progress: 0,
    stats: null,
    usage: null,
    error: null,
    traceUrl: null,
  });

  // Load persisted results on mount
  useEffect(() => {
    const stored = leadFinderStorage.load();
    if (stored && stored.leads.length > 0) {
      setState(prev => ({
        ...prev,
        leads: stored.leads,
        stats: stored.stats,
        usage: stored.usage,
        traceUrl: stored.traceUrl,
      }));
    }
  }, []);

  const findLeads = async (params: SearchParams) => {
    // Store search params for later
    searchParamsRef.current = params;

    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();

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
                setState(prev => ({
                  ...prev,
                  currentStatus: event.message,
                  progress: event.progress || prev.progress,
                }));
              } else if (event.type === 'batch') {
                setState(prev => ({
                  ...prev,
                  leads: [...prev.leads, ...event.leads],
                  currentStatus: `Processed batch ${event.batchNumber}/${event.totalBatches}`,
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
                }));

                // Save to localStorage
                if (searchParamsRef.current) {
                  leadFinderStorage.save({
                    searchParams: {
                      size: searchParamsRef.current.size,
                      geography: searchParamsRef.current.geography,
                      industry: searchParamsRef.current.industry,
                    },
                    leads: allLeads,
                    stats: event.stats,
                    usage: event.usage,
                    traceUrl: event.traceUrl,
                  });
                }

                // Invalidate queries if companies were inserted
                if (!params.dryRun && totalLeads > 0) {
                  queryClient.invalidateQueries({ queryKey: ['companies'] });
                  queryClient.invalidateQueries({ queryKey: ['pipeline-stats'] });
                }

                // Show toast notification
                toast({
                  title: '✨ Lead Search Complete',
                  description: `Found ${event.stats.returned} companies. Results saved - navigate to Lead Finder to view.`,
                });
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
        // Request was cancelled
        setState(prev => ({
          ...prev,
          isLoading: false,
          currentStatus: 'Search cancelled',
        }));
        
        toast({
          title: 'Search Cancelled',
          description: 'Lead search was stopped. Partial results are kept.',
        });
      } else {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error : new Error('Unknown error'),
          currentStatus: 'Error',
        }));

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
    setState({
      leads: [],
      isLoading: false,
      currentStatus: '',
      progress: 0,
      stats: null,
      usage: null,
      error: null,
      traceUrl: null,
    });
  };

  return {
    ...state,
    findLeads,
    cancelSearch,
    clearStoredResults,
    hasStoredResults: leadFinderStorage.hasStoredResults(),
  };
};
