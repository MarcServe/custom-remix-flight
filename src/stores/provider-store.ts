import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ProviderStore {
  defaultProvider: 'openai' | 'perplexity';
  defaultModels: {
    openai: string;
    perplexity: string;
  };
  
  setDefaultProvider: (provider: 'openai' | 'perplexity') => void;
  setDefaultModel: (provider: 'openai' | 'perplexity', model: string) => void;
}

export const useProviderStore = create<ProviderStore>()(
  persist(
    (set) => ({
      defaultProvider: 'openai',
      defaultModels: {
        openai: 'gpt-4o-mini',
        perplexity: 'sonar',
      },
      
      setDefaultProvider: (provider) => set({ defaultProvider: provider }),
      setDefaultModel: (provider, model) =>
        set((state) => ({
          defaultModels: {
            ...state.defaultModels,
            [provider]: model,
          },
        })),
    }),
    {
      name: 'provider-preferences',
    }
  )
);
