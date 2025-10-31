import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ProviderStore {
  defaultProvider: 'lovable' | 'openai' | 'perplexity';
  defaultModels: {
    lovable: string;
    openai: string;
    perplexity: string;
  };
  
  setDefaultProvider: (provider: 'lovable' | 'openai' | 'perplexity') => void;
  setDefaultModel: (provider: 'lovable' | 'openai' | 'perplexity', model: string) => void;
}

export const useProviderStore = create<ProviderStore>()(
  persist(
    (set) => ({
      defaultProvider: 'lovable',
      defaultModels: {
        lovable: 'google/gemini-2.5-flash',
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
