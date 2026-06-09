import { create } from 'zustand';
import { CompanyFilters } from '@/lib/api/companies';

interface UIStore {
  // Modal states
  isAddCompanyOpen: boolean;
  isAddDealOpen: boolean;
  isAddPersonOpen: boolean;
  
  // Filter states
  companyFilters: CompanyFilters;
  
  // Lead Finder results
  leadFinderResults: any[];
  
  // Actions
  setAddCompanyOpen: (open: boolean) => void;
  setAddDealOpen: (open: boolean) => void;
  setAddPersonOpen: (open: boolean) => void;
  setCompanyFilters: (filters: CompanyFilters) => void;
  setLeadFinderResults: (results: any) => void;
  resetFilters: () => void;
}

export const useUIStore = create<UIStore>((set) => ({
  // Initial states
  isAddCompanyOpen: false,
  isAddDealOpen: false,
  isAddPersonOpen: false,
  companyFilters: {},
  leadFinderResults: [],
  
  // Actions
  setAddCompanyOpen: (open) => set({ isAddCompanyOpen: open }),
  setAddDealOpen: (open) => set({ isAddDealOpen: open }),
  setAddPersonOpen: (open) => set({ isAddPersonOpen: open }),
  setCompanyFilters: (filters) => set({ companyFilters: filters }),
  setLeadFinderResults: (results) => set({ leadFinderResults: results }),
  resetFilters: () => set({ companyFilters: {} }),
}));
