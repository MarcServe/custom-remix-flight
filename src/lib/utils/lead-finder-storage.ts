/**
 * LocalStorage utility for Lead Finder results persistence
 */

const STORAGE_KEY = 'leadFinderResults'; // Legacy key for completed searches
const ACTIVE_SEARCH_KEY = 'leadFinderActiveSearch'; // Key for in-progress searches
const COMPLETED_SEARCH_KEY = 'leadFinderCompleted'; // Key for completed searches
const STORAGE_VERSION = 1;

export interface SearchParams {
  size: string;
  geography: string;
  industry: string;
  extractionProvider?: string;
  extractionModel?: string;
  enrichmentEnabled?: boolean;
}

export interface StoredLeadFinderResults {
  version: number;
  timestamp: number;
  searchParams: SearchParams;
  leads: any[];
  stats: any;
  usage: any;
  traceUrl: string | null;
}

export interface ActiveSearch {
  searchId: string;
  version: number;
  timestamp: number;
  startTime: number;
  searchParams: SearchParams;
  leads: any[];
  progress: number;
  currentStatus: string;
  stats: any;
  usage: any;
  traceUrl: string | null;
  isComplete: boolean;
  lastBatchTime: number;
}

export const leadFinderStorage = {
  /**
   * Save lead finder results to localStorage
   */
  save(data: Omit<StoredLeadFinderResults, 'version' | 'timestamp'>): void {
    try {
      const stored: StoredLeadFinderResults = {
        version: STORAGE_VERSION,
        timestamp: Date.now(),
        ...data,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    } catch (error) {
      console.error('Failed to save lead finder results to localStorage:', error);
      // Handle quota exceeded
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        console.warn('localStorage quota exceeded. Clearing old data...');
        this.clear();
      }
    }
  },

  /**
   * Load lead finder results from localStorage
   */
  load(): StoredLeadFinderResults | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return null;

      const data = JSON.parse(stored) as StoredLeadFinderResults;
      
      // Validate version
      if (data.version !== STORAGE_VERSION) {
        console.warn('Stored lead finder data version mismatch. Clearing...');
        this.clear();
        return null;
      }

      return data;
    } catch (error) {
      console.error('Failed to load lead finder results from localStorage:', error);
      return null;
    }
  },

  /**
   * Check if there are stored results
   */
  hasStoredResults(): boolean {
    return localStorage.getItem(STORAGE_KEY) !== null;
  },

  /**
   * Clear stored results
   */
  clear(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear lead finder results from localStorage:', error);
    }
  },

  /**
   * Get age of stored results in milliseconds
   */
  getAge(): number | null {
    const stored = this.load();
    if (!stored) return null;
    return Date.now() - stored.timestamp;
  },

  /**
   * Save active search state (in-progress)
   */
  saveActiveSearch(data: Omit<ActiveSearch, 'version' | 'timestamp'>): void {
    try {
      const stored: ActiveSearch = {
        version: STORAGE_VERSION,
        timestamp: Date.now(),
        ...data,
      };
      localStorage.setItem(ACTIVE_SEARCH_KEY, JSON.stringify(stored));
    } catch (error) {
      console.error('Failed to save active search to localStorage:', error);
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        console.warn('localStorage quota exceeded. Clearing active search...');
        this.clearActiveSearch();
      }
    }
  },

  /**
   * Load active search state
   */
  loadActiveSearch(): ActiveSearch | null {
    try {
      const stored = localStorage.getItem(ACTIVE_SEARCH_KEY);
      if (!stored) return null;

      const data = JSON.parse(stored) as ActiveSearch;
      
      // Validate version
      if (data.version !== STORAGE_VERSION) {
        console.warn('Stored active search version mismatch. Clearing...');
        this.clearActiveSearch();
        return null;
      }

      return data;
    } catch (error) {
      console.error('Failed to load active search from localStorage:', error);
      return null;
    }
  },

  /**
   * Check if there is an active search
   */
  hasActiveSearch(): boolean {
    return localStorage.getItem(ACTIVE_SEARCH_KEY) !== null;
  },

  /**
   * Clear active search
   */
  clearActiveSearch(): void {
    try {
      localStorage.removeItem(ACTIVE_SEARCH_KEY);
    } catch (error) {
      console.error('Failed to clear active search from localStorage:', error);
    }
  },

  /**
   * Move active search to completed and clear active
   */
  markSearchComplete(searchId: string): void {
    try {
      const activeSearch = this.loadActiveSearch();
      if (!activeSearch || activeSearch.searchId !== searchId) {
        return;
      }

      // Save to completed search storage
      const completed: StoredLeadFinderResults = {
        version: activeSearch.version,
        timestamp: Date.now(),
        searchParams: activeSearch.searchParams,
        leads: activeSearch.leads,
        stats: activeSearch.stats,
        usage: activeSearch.usage,
        traceUrl: activeSearch.traceUrl,
      };

      // Save to both legacy key and new completed key
      this.save(completed);
      localStorage.setItem(COMPLETED_SEARCH_KEY, JSON.stringify(completed));

      // Clear active search
      this.clearActiveSearch();
    } catch (error) {
      console.error('Failed to mark search complete:', error);
    }
  },

  /**
   * Get active search age in milliseconds
   */
  getActiveSearchAge(): number | null {
    const active = this.loadActiveSearch();
    if (!active) return null;
    return Date.now() - active.startTime;
  },

  /**
   * Update active search progress
   */
  updateActiveSearchProgress(searchId: string, updates: Partial<Omit<ActiveSearch, 'version' | 'searchId'>>): void {
    try {
      const active = this.loadActiveSearch();
      if (!active || active.searchId !== searchId) {
        return;
      }

      const updated: ActiveSearch = {
        ...active,
        ...updates,
        timestamp: Date.now(),
        lastBatchTime: Date.now(),
      };

      localStorage.setItem(ACTIVE_SEARCH_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error('Failed to update active search progress:', error);
    }
  },
};