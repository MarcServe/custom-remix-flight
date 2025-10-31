import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ProviderStore {
  defaultProvider: 'lovable' | 'openai';
  defaultModels: {
    lovable: string;
    openai: string;
  };
  
  setDefaultProvider: (provider: 'lovable' | 'openai') => void;
  setDefaultModel: (provider: 'lovable' | 'openai', model: string) => void;
}

export const useProviderStore = create<ProviderStore>()(
  persist(
    (set) => ({
      defaultProvider: 'lovable',
      defaultModels: {
        lovable: 'google/gemini-2.5-flash',
        openai: 'gpt-4o-mini',
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
