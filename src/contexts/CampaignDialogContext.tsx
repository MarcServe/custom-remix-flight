import { createContext, useContext, useState, useCallback, ReactNode } from "react";

export type CampaignPerson = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  company_id?: string;
  companies?: {
    id?: string;
    name?: string;
    tags?: string[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

interface CampaignDialogState {
  open: boolean;
  selectedPeople: CampaignPerson[];
  draftId: string | null;
}

interface CampaignDialogContextValue {
  open: boolean;
  selectedPeople: CampaignPerson[];
  draftId: string | null;
  /** Open the dialog with a fresh list of people (replaces current list) */
  openWithPeople: (people: CampaignPerson[], draftId?: string | null) => void;
  /** Merge additional people into an already-open dialog */
  addPeople: (people: CampaignPerson[]) => void;
  /** Open an existing draft by ID */
  openDraft: (draftId: string) => void;
  setOpen: (open: boolean) => void;
  setSelectedPeople: (people: CampaignPerson[]) => void;
}

const CampaignDialogContext = createContext<CampaignDialogContextValue | null>(null);

export function CampaignDialogProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CampaignDialogState>({
    open: false,
    selectedPeople: [],
    draftId: null,
  });

  const openWithPeople = useCallback((people: CampaignPerson[], draftId: string | null = null) => {
    setState({ open: true, selectedPeople: people, draftId });
  }, []);

  const addPeople = useCallback((newPeople: CampaignPerson[]) => {
    setState((prev) => {
      // Dedupe by email
      const existingEmails = new Set(prev.selectedPeople.map((p) => p.email?.toLowerCase().trim()).filter(Boolean));
      const toAdd = newPeople.filter((p) => {
        const e = p.email?.toLowerCase().trim();
        return e && !existingEmails.has(e);
      });
      return {
        ...prev,
        open: true,
        selectedPeople: toAdd.length > 0 ? [...prev.selectedPeople, ...toAdd] : prev.selectedPeople,
      };
    });
  }, []);

  const openDraft = useCallback((draftId: string) => {
    setState({ open: true, selectedPeople: [], draftId });
  }, []);

  const setOpen = useCallback((open: boolean) => {
    setState((prev) => ({ ...prev, open }));
  }, []);

  const setSelectedPeople = useCallback((people: CampaignPerson[]) => {
    setState((prev) => ({ ...prev, selectedPeople: people }));
  }, []);

  return (
    <CampaignDialogContext.Provider
      value={{
        open: state.open,
        selectedPeople: state.selectedPeople,
        draftId: state.draftId,
        openWithPeople,
        addPeople,
        openDraft,
        setOpen,
        setSelectedPeople,
      }}
    >
      {children}
    </CampaignDialogContext.Provider>
  );
}

export function useCampaignDialog() {
  const ctx = useContext(CampaignDialogContext);
  if (!ctx) throw new Error("useCampaignDialog must be used within CampaignDialogProvider");
  return ctx;
}
