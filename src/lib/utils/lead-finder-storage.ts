/**
 * LocalStorage utility for Lead Finder results persistence
 */

const STORAGE_KEY = 'leadFinderResults';
const STORAGE_VERSION = 1;

export interface StoredLeadFinderResults {
  version: number;
  timestamp: number;
  searchParams: {
    size: string;
    geography: string;
    industry: string;
  };
  leads: any[];
  stats: any;
  usage: any;
  traceUrl: string | null;
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
};